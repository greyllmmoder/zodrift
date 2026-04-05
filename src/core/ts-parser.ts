import path from "node:path";
import ts from "typescript";
import {
  cloneTypeNode,
  locationFromTs,
  makePrimitive,
  stripUndefinedFromUnion,
  unwrapOptional,
} from "./type-utils.js";
import type { ObjectProperty, TypeDeclaration, TypeNode } from "./types.js";

type DeclNode = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

interface DeclRecord {
  node: DeclNode;
  sourceFile: ts.SourceFile;
}

interface ParseContext {
  declarations: Map<string, DeclRecord>;
  cache: Map<string, TypeNode>;
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function getLocationFromNode(sourceFile: ts.SourceFile, node: ts.Node) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return locationFromTs(path.resolve(sourceFile.fileName), pos.line, pos.character);
}

function literalFromTypeNode(node: ts.LiteralTypeNode): TypeNode {
  if (node.literal.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null };
  }
  if (ts.isStringLiteral(node.literal)) {
    return { kind: "literal", value: node.literal.text };
  }
  if (ts.isNumericLiteral(node.literal)) {
    return { kind: "literal", value: Number(node.literal.text) };
  }
  if (node.literal.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "literal", value: true };
  }
  if (node.literal.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "literal", value: false };
  }
  return makePrimitive("unknown");
}

function parseProperty(
  member: ts.TypeElement,
  sourceFile: ts.SourceFile,
  context: ParseContext,
  visiting: Set<string>,
): ObjectProperty | null {
  if (!ts.isPropertySignature(member) || !member.type || !member.name) {
    return null;
  }

  const propName =
    ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
      ? member.name.text
      : ts.isNumericLiteral(member.name)
        ? member.name.text
        : member.name.getText(sourceFile);

  let parsedType = parseTypeNode(member.type, sourceFile, context, visiting);
  let optional = Boolean(member.questionToken);

  if (parsedType.kind === "union") {
    const stripped = stripUndefinedFromUnion(parsedType);
    optional = optional || stripped.optional;
    parsedType = stripped.node;
  }

  const unwrapped = unwrapOptional(parsedType);
  optional = optional || unwrapped.optional;
  parsedType = unwrapped.node;

  return {
    name: propName,
    optional,
    type: parsedType,
    location: getLocationFromNode(sourceFile, member.name),
  };
}

function parseObjectMembers(
  members: readonly ts.TypeElement[],
  sourceFile: ts.SourceFile,
  context: ParseContext,
  visiting: Set<string>,
): TypeNode {
  const properties: Record<string, ObjectProperty> = {};

  for (const member of members) {
    const parsed = parseProperty(member, sourceFile, context, visiting);
    if (!parsed) {
      continue;
    }
    properties[parsed.name] = parsed;
  }

  return {
    kind: "object",
    properties,
  };
}

function parseTypeReference(
  node: ts.TypeReferenceNode,
  sourceFile: ts.SourceFile,
  context: ParseContext,
  visiting: Set<string>,
): TypeNode {
  const name = node.typeName.getText(sourceFile);
  const args = node.typeArguments ?? [];

  if ((name === "Array" || name === "ReadonlyArray") && args.length === 1) {
    return {
      kind: "array",
      element: parseTypeNode(args[0], sourceFile, context, visiting),
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (context.declarations.has(name)) {
    return parseNamedDeclaration(name, sourceFile, context, visiting);
  }

  return {
    kind: "reference",
    name,
    location: getLocationFromNode(sourceFile, node),
  };
}

function parseTypeNode(
  node: ts.TypeNode,
  sourceFile: ts.SourceFile,
  context: ParseContext,
  visiting: Set<string>,
): TypeNode {
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitive", name: "string", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitive", name: "number", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitive", name: "boolean", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "primitive", name: "any", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "primitive", name: "unknown", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitive", name: "null", location: getLocationFromNode(sourceFile, node) };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitive", name: "undefined", location: getLocationFromNode(sourceFile, node) };
    default:
      break;
  }

  if (ts.isParenthesizedTypeNode(node)) {
    return parseTypeNode(node.type, sourceFile, context, visiting);
  }

  if (ts.isLiteralTypeNode(node)) {
    const literal = literalFromTypeNode(node);
    return {
      ...literal,
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "array",
      element: parseTypeNode(node.elementType, sourceFile, context, visiting),
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (ts.isTupleTypeNode(node)) {
    return {
      kind: "tuple",
      items: node.elements.map((element) => parseTypeNode(element, sourceFile, context, visiting)),
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "union",
      members: node.types.map((item) => parseTypeNode(item, sourceFile, context, visiting)),
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (ts.isTypeLiteralNode(node)) {
    return {
      ...parseObjectMembers(node.members, sourceFile, context, visiting),
      location: getLocationFromNode(sourceFile, node),
    };
  }

  if (ts.isTypeReferenceNode(node)) {
    return parseTypeReference(node, sourceFile, context, visiting);
  }

  return {
    kind: "primitive",
    name: "unknown",
    location: getLocationFromNode(sourceFile, node),
  };
}

function parseNamedDeclaration(
  name: string,
  sourceFile: ts.SourceFile,
  context: ParseContext,
  visiting: Set<string>,
): TypeNode {
  const cached = context.cache.get(name);
  if (cached) {
    return cloneTypeNode(cached);
  }

  if (visiting.has(name)) {
    return {
      kind: "reference",
      name,
      location: getLocationFromNode(sourceFile, sourceFile),
    };
  }

  const declaration = context.declarations.get(name);
  if (!declaration) {
    return {
      kind: "reference",
      name,
      location: getLocationFromNode(sourceFile, sourceFile),
    };
  }

  visiting.add(name);
  let parsed: TypeNode;

  if (ts.isInterfaceDeclaration(declaration.node)) {
    parsed = {
      ...parseObjectMembers(
        declaration.node.members,
        declaration.sourceFile,
        context,
        visiting,
      ),
      location: getLocationFromNode(declaration.sourceFile, declaration.node),
    };
  } else {
    parsed = parseTypeNode(
      declaration.node.type,
      declaration.sourceFile,
      context,
      visiting,
    );
  }

  visiting.delete(name);
  context.cache.set(name, parsed);
  return cloneTypeNode(parsed);
}

export function parseTypeDeclarations(filePaths: string[]): {
  declarations: TypeDeclaration[];
  errors: string[];
} {
  const errors: string[] = [];
  if (filePaths.length === 0) {
    return { declarations: [], errors };
  }

  const uniqueFilePaths = Array.from(new Set(filePaths.map((item) => path.resolve(item))));
  const pathSet = new Set(uniqueFilePaths);

  const program = ts.createProgram(uniqueFilePaths, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowJs: false,
    skipLibCheck: true,
  });

  const declarationsMap = new Map<string, DeclRecord>();

  for (const sourceFile of program.getSourceFiles()) {
    const sourcePath = path.resolve(sourceFile.fileName);
    if (!pathSet.has(sourcePath)) {
      continue;
    }

    for (const statement of sourceFile.statements) {
      if (
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
        isExported(statement)
      ) {
        declarationsMap.set(statement.name.text, {
          node: statement,
          sourceFile,
        });
      }
    }
  }

  const context: ParseContext = {
    declarations: declarationsMap,
    cache: new Map(),
  };

  const declarations: TypeDeclaration[] = [];

  for (const [name, record] of declarationsMap.entries()) {
    try {
      const node = parseNamedDeclaration(name, record.sourceFile, context, new Set());
      declarations.push({
        name,
        node,
        location: getLocationFromNode(record.sourceFile, record.node),
        sourceFilePath: path.resolve(record.sourceFile.fileName),
      });
    } catch (error) {
      errors.push(
        `Failed to parse type declaration ${name} in ${record.sourceFile.fileName}: ${String(error)}`,
      );
    }
  }

  return { declarations, errors };
}

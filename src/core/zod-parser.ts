import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { cloneTypeNode, locationFromTs, makePrimitive, stripUndefinedFromUnion, unwrapOptional } from "./type-utils.js";
import type { ObjectProperty, SchemaDeclaration, TypeNode } from "./types.js";

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function getLocationFromNode(sourceFile: ts.SourceFile, node: ts.Node) {
  const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return locationFromTs(path.resolve(sourceFile.fileName), pos.line, pos.character);
}

function normalizePropertyType(node: TypeNode): { optional: boolean; node: TypeNode } {
  const unwrapped = unwrapOptional(node);
  let optional = unwrapped.optional;
  let next = unwrapped.node;

  if (next.kind === "union") {
    const stripped = stripUndefinedFromUnion(next);
    optional = optional || stripped.optional;
    next = stripped.node;
  }

  return {
    optional,
    node: next,
  };
}

function parseLiteralExpression(node: ts.Expression): TypeNode {
  if (ts.isStringLiteral(node)) {
    return { kind: "literal", value: node.text };
  }
  if (ts.isNumericLiteral(node)) {
    return { kind: "literal", value: Number(node.text) };
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: "literal", value: true };
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: "literal", value: false };
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: "literal", value: null };
  }
  return makePrimitive("unknown");
}

function wrapUnion(nodes: TypeNode[]): TypeNode {
  if (nodes.length === 1) {
    return nodes[0];
  }
  return {
    kind: "union",
    members: nodes,
  };
}

function parseShapeObject(
  node: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
  variableMap: Map<string, ts.VariableDeclaration>,
  seen: Set<string>,
): TypeNode {
  const properties: Record<string, ObjectProperty> = {};

  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) {
      continue;
    }

    let propName = "";
    let initializer: ts.Expression | null = null;

    if (ts.isShorthandPropertyAssignment(prop)) {
      propName = prop.name.text;
      initializer = prop.name;
    } else {
      if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) || ts.isNumericLiteral(prop.name)) {
        propName = prop.name.text;
      } else {
        propName = prop.name.getText(sourceFile);
      }
      initializer = prop.initializer;
    }

    if (!initializer) {
      continue;
    }

    const parsed = parseZodExpression(initializer, sourceFile, variableMap, seen);
    const normalized = normalizePropertyType(parsed);

    properties[propName] = {
      name: propName,
      optional: normalized.optional,
      type: normalized.node,
      location: getLocationFromNode(sourceFile, prop.name),
    };
  }

  return {
    kind: "object",
    properties,
    location: getLocationFromNode(sourceFile, node),
  };
}

function parseZodFactory(
  method: string,
  args: readonly ts.Expression[],
  sourceFile: ts.SourceFile,
  variableMap: Map<string, ts.VariableDeclaration>,
  seen: Set<string>,
): TypeNode {
  switch (method) {
    case "string":
      return { kind: "primitive", name: "string" };
    case "number":
      return { kind: "primitive", name: "number" };
    case "boolean":
      return { kind: "primitive", name: "boolean" };
    case "any":
      return { kind: "primitive", name: "any" };
    case "unknown":
      return { kind: "primitive", name: "unknown" };
    case "null":
      return { kind: "primitive", name: "null" };
    case "undefined":
      return { kind: "primitive", name: "undefined" };
    case "literal":
      return args[0] ? parseLiteralExpression(args[0]) : makePrimitive("unknown");
    case "object": {
      if (args[0] && ts.isObjectLiteralExpression(args[0])) {
        return parseShapeObject(args[0], sourceFile, variableMap, seen);
      }
      return {
        kind: "object",
        properties: {},
      };
    }
    case "array":
      return {
        kind: "array",
        element: args[0]
          ? parseZodExpression(args[0], sourceFile, variableMap, seen)
          : makePrimitive("unknown"),
      };
    case "union": {
      const firstArg = args[0];
      if (!firstArg || !ts.isArrayLiteralExpression(firstArg)) {
        return makePrimitive("unknown");
      }
      return {
        kind: "union",
        members: firstArg.elements.map((element) =>
          parseZodExpression(element, sourceFile, variableMap, seen),
        ),
      };
    }
    case "tuple": {
      const firstArg = args[0];
      if (!firstArg || !ts.isArrayLiteralExpression(firstArg)) {
        return makePrimitive("unknown");
      }
      return {
        kind: "tuple",
        items: firstArg.elements.map((element) =>
          parseZodExpression(element, sourceFile, variableMap, seen),
        ),
      };
    }
    case "enum": {
      const firstArg = args[0];
      if (!firstArg || !ts.isArrayLiteralExpression(firstArg)) {
        return makePrimitive("unknown");
      }

      const members = firstArg.elements
        .filter((element) => ts.isStringLiteral(element) || ts.isNumericLiteral(element))
        .map((element) =>
          ts.isStringLiteral(element)
            ? ({ kind: "literal", value: element.text } as TypeNode)
            : ({ kind: "literal", value: Number((element as ts.NumericLiteral).text) } as TypeNode),
        );

      return members.length > 0 ? wrapUnion(members) : makePrimitive("unknown");
    }
    case "optional": {
      const inner = args[0]
        ? parseZodExpression(args[0], sourceFile, variableMap, seen)
        : makePrimitive("unknown");
      return {
        kind: "optional",
        inner,
      };
    }
    case "nullable": {
      const inner = args[0]
        ? parseZodExpression(args[0], sourceFile, variableMap, seen)
        : makePrimitive("unknown");
      return wrapUnion([inner, { kind: "primitive", name: "null" }]);
    }
    default:
      return makePrimitive("unknown");
  }
}

function applyMethod(
  base: TypeNode,
  method: string,
  args: readonly ts.Expression[],
  sourceFile: ts.SourceFile,
  variableMap: Map<string, ts.VariableDeclaration>,
  seen: Set<string>,
): TypeNode {
  switch (method) {
    case "optional":
      return {
        kind: "optional",
        inner: base,
      };
    case "nullable":
      return wrapUnion([base, { kind: "primitive", name: "null" }]);
    case "nullish":
      return {
        kind: "optional",
        inner: wrapUnion([base, { kind: "primitive", name: "null" }]),
      };
    case "array":
      return {
        kind: "array",
        element: base,
      };
    case "or": {
      const right = args[0]
        ? parseZodExpression(args[0], sourceFile, variableMap, seen)
        : makePrimitive("unknown");
      if (base.kind === "union") {
        return {
          kind: "union",
          members: [...base.members, right],
        };
      }
      return {
        kind: "union",
        members: [base, right],
      };
    }
    case "and": {
      const right = args[0]
        ? parseZodExpression(args[0], sourceFile, variableMap, seen)
        : makePrimitive("unknown");
      return {
        kind: "union",
        members: [base, right],
      };
    }
    default:
      // Refinement/metadata methods do not alter the structural type shape.
      return base;
  }
}

function parseZodExpression(
  expression: ts.Expression,
  sourceFile: ts.SourceFile,
  variableMap: Map<string, ts.VariableDeclaration>,
  seen: Set<string>,
): TypeNode {
  if (ts.isIdentifier(expression)) {
    const referenced = variableMap.get(expression.text);
    if (!referenced || !referenced.initializer || seen.has(expression.text)) {
      return {
        kind: "reference",
        name: expression.text,
        location: getLocationFromNode(sourceFile, expression),
      };
    }

    seen.add(expression.text);
    const parsed = parseZodExpression(referenced.initializer, sourceFile, variableMap, seen);
    seen.delete(expression.text);
    return cloneTypeNode(parsed);
  }

  if (ts.isCallExpression(expression)) {
    const callee = expression.expression;

    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.text;

      if (ts.isIdentifier(callee.expression) && callee.expression.text === "z") {
        return {
          ...parseZodFactory(method, expression.arguments, sourceFile, variableMap, seen),
          location: getLocationFromNode(sourceFile, expression),
        };
      }

      const base = parseZodExpression(callee.expression, sourceFile, variableMap, seen);
      return {
        ...applyMethod(base, method, expression.arguments, sourceFile, variableMap, seen),
        location: getLocationFromNode(sourceFile, expression),
      };
    }

    if (ts.isIdentifier(callee) && callee.text === "z") {
      return makePrimitive("unknown");
    }
  }

  return {
    kind: "primitive",
    name: "unknown",
    location: getLocationFromNode(sourceFile, expression),
  };
}

function collectVariables(sourceFile: ts.SourceFile): Map<string, ts.VariableDeclaration> {
  const variableMap = new Map<string, ts.VariableDeclaration>();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        variableMap.set(declaration.name.text, declaration);
      }
    }
  }

  return variableMap;
}

export function parseSchemaDeclarations(filePaths: string[]): {
  declarations: SchemaDeclaration[];
  errors: string[];
} {
  const declarations: SchemaDeclaration[] = [];
  const errors: string[] = [];

  for (const filePath of filePaths) {
    try {
      const absPath = path.resolve(filePath);
      const content = fs.readFileSync(absPath, "utf8");
      const sourceFile = ts.createSourceFile(
        absPath,
        content,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
      );

      const variableMap = collectVariables(sourceFile);

      for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement) || !isExported(statement)) {
          continue;
        }

        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
            continue;
          }

          const name = declaration.name.text;
          if (!name.endsWith("Schema")) {
            continue;
          }

          const parsed = parseZodExpression(
            declaration.initializer,
            sourceFile,
            variableMap,
            new Set<string>(),
          );

          declarations.push({
            name,
            node: parsed,
            location: getLocationFromNode(sourceFile, declaration.name),
            sourceFilePath: absPath,
            objectNodeText: declaration.initializer.getText(sourceFile),
          });
        }
      }
    } catch (error) {
      errors.push(`Failed to parse schemas in ${filePath}: ${String(error)}`);
    }
  }

  return {
    declarations,
    errors,
  };
}

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { DriftIssue, Pairing, SemanticsMode } from "./types.js";

const TYPE_ALIAS_NAME = "__ZodriftTypeAlias";
const INPUT_ALIAS_NAME = "__ZodriftInputAlias";
const OUTPUT_ALIAS_NAME = "__ZodriftOutputAlias";
const TYPE_IMPORT_NAME = "__ZodriftType";
const SCHEMA_IMPORT_NAME = "__ZodriftSchema";

function pairName(pair: Pairing): string {
  return `${pair.typeDecl.name} ↔ ${pair.schemaDecl.name}`;
}

export function pairKey(pair: Pairing): string {
  return `${path.resolve(pair.typeDecl.sourceFilePath)}::${pair.typeDecl.name}::${path.resolve(pair.schemaDecl.sourceFilePath)}::${pair.schemaDecl.name}`;
}

function loadCompilerOptions(cwd: string): ts.CompilerOptions {
  const fallback: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.Preserve,
    allowJs: false,
    skipLibCheck: true,
    strict: true,
    exactOptionalPropertyTypes: true,
    noEmit: true,
  };

  const configPath = ts.findConfigFile(cwd, ts.sys.fileExists, "tsconfig.json");
  if (!configPath) {
    return fallback;
  }

  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) {
    return fallback;
  }

  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configPath),
  );

  return {
    ...parsed.options,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: parsed.options.jsx ?? ts.JsxEmit.Preserve,
    rootDir: cwd,
    strict: true,
    exactOptionalPropertyTypes: true,
    skipLibCheck: true,
    noEmit: true,
  };
}

function toImportSpecifier(fromFilePath: string, targetFilePath: string): string {
  const relative = path
    .relative(path.dirname(fromFilePath), targetFilePath)
    .split(path.sep)
    .join("/");
  const withDot = relative.startsWith(".") ? relative : `./${relative}`;
  const withoutExt = withDot.replace(/\.[cm]?tsx?$/i, "");
  return `${withoutExt}.js`;
}

function formatDiagnostic(diagnostic: ts.Diagnostic): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  if (!diagnostic.file || typeof diagnostic.start !== "number") {
    return message;
  }
  const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  const filePath = path.resolve(diagnostic.file.fileName);
  return `${filePath}:${pos.line + 1}:${pos.character + 1} ${message}`;
}

function typeText(checker: ts.TypeChecker, type: ts.Type): string {
  return checker.typeToString(
    type,
    undefined,
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope,
  );
}

function compareEquivalence(
  checker: ts.TypeChecker,
  left: ts.Type,
  right: ts.Type,
): { leftToRight: boolean; rightToLeft: boolean } {
  return {
    leftToRight: checker.isTypeAssignableTo(left, right),
    rightToLeft: checker.isTypeAssignableTo(right, left),
  };
}

function makeSemanticIssue(params: {
  pair: Pairing;
  mode: "input" | "output";
  message: string;
  typeValue?: string;
  schemaValue?: string;
}): DriftIssue {
  return {
    kind: "semantic_mismatch",
    pairName: pairName(params.pair),
    path: `(semantic:${params.mode})`,
    message: params.message,
    typeValue: params.typeValue,
    schemaValue: params.schemaValue,
    typeLocation: params.pair.typeDecl.location,
    schemaLocation: params.pair.schemaDecl.location,
  };
}

function buildSemanticProbeContent(pair: Pairing, probeFilePath: string): string {
  const typeSpecifier = toImportSpecifier(probeFilePath, pair.typeDecl.sourceFilePath);
  const schemaSpecifier = toImportSpecifier(probeFilePath, pair.schemaDecl.sourceFilePath);

  return `import { z } from "zod";
import type { ${pair.typeDecl.name} as ${TYPE_IMPORT_NAME} } from "${typeSpecifier}";
import { ${pair.schemaDecl.name} as ${SCHEMA_IMPORT_NAME} } from "${schemaSpecifier}";

type ${TYPE_ALIAS_NAME} = ${TYPE_IMPORT_NAME};
type ${INPUT_ALIAS_NAME} = z.input<typeof ${SCHEMA_IMPORT_NAME}>;
type ${OUTPUT_ALIAS_NAME} = z.output<typeof ${SCHEMA_IMPORT_NAME}>;
`;
}

function findAliasType(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  aliasName: string,
): ts.Type | undefined {
  const alias = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === aliasName,
  );
  if (!alias) {
    return undefined;
  }
  return checker.getTypeAtLocation(alias);
}

export function collectSemanticIssues(options: {
  cwd: string;
  pairs: Pairing[];
  semantics: SemanticsMode;
}): {
  issuesByPair: Map<string, DriftIssue[]>;
  errors: string[];
} {
  const issuesByPair = new Map<string, DriftIssue[]>();
  const errors: string[] = [];

  if (options.semantics === "off" || options.pairs.length === 0) {
    return { issuesByPair, errors };
  }

  const compilerOptions = loadCompilerOptions(options.cwd);
  const tempDir = fs.mkdtempSync(path.join(options.cwd, ".zodrift-semantic-"));
  const runInput = options.semantics === "input" || options.semantics === "both";
  const runOutput = options.semantics === "output" || options.semantics === "both";

  try {
    for (let index = 0; index < options.pairs.length; index += 1) {
      const pair = options.pairs[index];
      const pairIssues: DriftIssue[] = [];
      const probeFilePath = path.join(tempDir, `probe-${index}.ts`);
      fs.writeFileSync(
        probeFilePath,
        buildSemanticProbeContent(pair, probeFilePath),
        "utf8",
      );

      const program = ts.createProgram([probeFilePath], compilerOptions);
      const diagnostics = ts
        .getPreEmitDiagnostics(program)
        .filter((diag) => diag.category === ts.DiagnosticCategory.Error);

      if (diagnostics.length > 0) {
        const message = formatDiagnostic(diagnostics[0]);
        pairIssues.push(
          makeSemanticIssue({
            pair,
            mode: runInput ? "input" : "output",
            message: `semantic check could not evaluate pair: ${message}`,
          }),
        );
        issuesByPair.set(pairKey(pair), pairIssues);
        continue;
      }

      const checker = program.getTypeChecker();
      const probeSource = program.getSourceFile(probeFilePath);
      if (!probeSource) {
        pairIssues.push(
          makeSemanticIssue({
            pair,
            mode: runInput ? "input" : "output",
            message: "semantic check could not load probe source file",
          }),
        );
        issuesByPair.set(pairKey(pair), pairIssues);
        continue;
      }

      const typeType = findAliasType(checker, probeSource, TYPE_ALIAS_NAME);
      const inputType = findAliasType(checker, probeSource, INPUT_ALIAS_NAME);
      const outputType = findAliasType(checker, probeSource, OUTPUT_ALIAS_NAME);

      if (!typeType || !inputType || !outputType) {
        pairIssues.push(
          makeSemanticIssue({
            pair,
            mode: runInput ? "input" : "output",
            message: "semantic check could not infer probe alias types",
          }),
        );
        issuesByPair.set(pairKey(pair), pairIssues);
        continue;
      }

      const evaluate = (mode: "input" | "output", schemaType: ts.Type): void => {
        const comparison = compareEquivalence(checker, typeType, schemaType);
        if (comparison.leftToRight) {
          return;
        }

        pairIssues.push(
          makeSemanticIssue({
            pair,
            mode,
            message: `semantic mismatch (${mode}): ${pair.typeDecl.name} is not assignable to z.${mode}<typeof ${pair.schemaDecl.name}> (type->schema=${comparison.leftToRight}, schema->type=${comparison.rightToLeft})`,
            typeValue: typeText(checker, typeType),
            schemaValue: typeText(checker, schemaType),
          }),
        );
      };

      if (runInput) {
        evaluate("input", inputType);
      }
      if (runOutput) {
        evaluate("output", outputType);
      }

      if (pairIssues.length > 0) {
        issuesByPair.set(pairKey(pair), pairIssues);
      }
    }
  } catch (error) {
    errors.push(`Failed semantic check pass: ${String(error)}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return { issuesByPair, errors };
}

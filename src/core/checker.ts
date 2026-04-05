import { comparePair } from "./compare.js";
import { discoverSourceFiles } from "./file-discovery.js";
import { pairTypesWithSchemas } from "./pairing.js";
import { parseTypeDeclarations } from "./ts-parser.js";
import { parseSchemaDeclarations } from "./zod-parser.js";
import type { CheckOptions, CheckResult, DriftPairResult } from "./types.js";

export function runCheck(options: CheckOptions): CheckResult {
  const files = discoverSourceFiles({
    cwd: options.cwd,
    pattern: options.pattern,
    changedOnly: options.changedOnly,
  });

  const typeParsed = parseTypeDeclarations(files);
  const schemaParsed = parseSchemaDeclarations(files);
  const paired = pairTypesWithSchemas(typeParsed.declarations, schemaParsed.declarations);

  const pairs: DriftPairResult[] = [];
  let totalIssues = 0;

  for (const pair of paired.pairs) {
    const issues = comparePair(pair);

    const cappedIssues =
      options.maxIssues && options.maxIssues > 0
        ? issues.slice(0, options.maxIssues)
        : issues;

    totalIssues += cappedIssues.length;

    pairs.push({
      typeName: pair.typeDecl.name,
      schemaName: pair.schemaDecl.name,
      typeDecl: pair.typeDecl,
      schemaDecl: pair.schemaDecl,
      issues: cappedIssues,
    });
  }

  return {
    pairs,
    totalIssues,
    checkedPairs: pairs.length,
    unmatchedTypes: paired.unmatchedTypes,
    unmatchedSchemas: paired.unmatchedSchemas,
    errors: [...typeParsed.errors, ...schemaParsed.errors],
  };
}

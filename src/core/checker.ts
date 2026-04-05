import { comparePair } from "./compare.js";
import { discoverSourceFiles } from "./file-discovery.js";
import { pairTypesWithSchemas } from "./pairing.js";
import { collectSemanticIssues, pairKey } from "./semantic-checker.js";
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
  const semantic = collectSemanticIssues({
    cwd: options.cwd,
    pairs: paired.pairs,
    semantics: options.semantics,
  });

  const pairs: DriftPairResult[] = [];
  let totalIssues = 0;
  let semanticIssueCount = 0;

  for (const pair of paired.pairs) {
    const structuralIssues = comparePair(pair);
    const semanticIssues = semantic.issuesByPair.get(pairKey(pair)) ?? [];
    const issues = [...structuralIssues, ...semanticIssues];

    const cappedIssues =
      options.maxIssues && options.maxIssues > 0
        ? issues.slice(0, options.maxIssues)
        : issues;

    totalIssues += cappedIssues.length;
    semanticIssueCount += cappedIssues.filter((issue) => issue.kind === "semantic_mismatch").length;

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
    semanticsMode: options.semantics,
    semanticIssueCount,
    errors: [...typeParsed.errors, ...schemaParsed.errors, ...semantic.errors],
  };
}

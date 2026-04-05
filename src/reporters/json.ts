import type { ReporterPayload } from "../core/types.js";

export function renderJson(payload: ReporterPayload): string {
  return JSON.stringify(
    {
      summary: {
        checkedPairs: payload.result.checkedPairs,
        totalIssues: payload.result.totalIssues,
        semanticsMode: payload.result.semanticsMode,
        semanticIssueCount: payload.result.semanticIssueCount,
        unmatchedTypes: payload.result.unmatchedTypes,
        unmatchedSchemas: payload.result.unmatchedSchemas,
        errors: payload.result.errors,
      },
      pairs: payload.result.pairs.map((pair) => ({
        typeName: pair.typeName,
        schemaName: pair.schemaName,
        typeFile: pair.typeDecl.sourceFilePath,
        schemaFile: pair.schemaDecl.sourceFilePath,
        issues: pair.issues,
      })),
    },
    null,
    2,
  );
}

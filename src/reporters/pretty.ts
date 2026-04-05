import type { ReporterPayload } from "../core/types.js";

export function renderPretty(payload: ReporterPayload): string {
  const lines: string[] = [];

  if (payload.result.errors.length > 0) {
    lines.push("Errors:");
    for (const error of payload.result.errors) {
      lines.push(`  - ${error}`);
    }
    lines.push("");
  }

  for (const pair of payload.result.pairs) {
    if (pair.issues.length === 0) {
      continue;
    }

    lines.push(`✗ ${pair.typeName} ↔ ${pair.schemaName}`);
    for (const issue of pair.issues) {
      lines.push(`  - ${issue.message}`);
    }
    lines.push("");
  }

  if (payload.result.totalIssues === 0 && payload.result.errors.length === 0) {
    lines.push("✓ No drift found");
  }

  if (payload.result.unmatchedTypes.length > 0) {
    lines.push(
      `Unmatched exported types: ${payload.result.unmatchedTypes
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  if (payload.result.unmatchedSchemas.length > 0) {
    lines.push(
      `Unmatched exported schemas: ${payload.result.unmatchedSchemas
        .slice(0, 20)
        .join(", ")}`,
    );
  }

  lines.push(
    `Checked pairs: ${payload.result.checkedPairs} | Issues: ${payload.result.totalIssues}`,
  );
  if (payload.result.semanticsMode !== "off") {
    lines.push(
      `Semantic mode: ${payload.result.semanticsMode} | Semantic issues: ${payload.result.semanticIssueCount}`,
    );
  }

  return lines.join("\n").trim();
}

import path from "node:path";
import type { DriftIssue, ReporterPayload } from "../core/types.js";

function levelForIssue(kind: DriftIssue["kind"]): "warning" | "error" {
  switch (kind) {
    case "type_mismatch":
    case "optional_mismatch":
      return "error";
    default:
      return "warning";
  }
}

function ruleName(kind: DriftIssue["kind"]): string {
  switch (kind) {
    case "missing_in_schema":
      return "missing-field";
    case "extra_in_schema":
      return "extra-field";
    case "optional_mismatch":
      return "optional-mismatch";
    case "type_mismatch":
      return "type-mismatch";
    default:
      return "drift";
  }
}

export function renderSarif(payload: ReporterPayload): string {
  const rules = [
    {
      id: "missing-field",
      shortDescription: { text: "Field exists in TS type but missing in Zod schema" },
    },
    {
      id: "extra-field",
      shortDescription: { text: "Field exists in Zod schema but not in TS type" },
    },
    {
      id: "optional-mismatch",
      shortDescription: { text: "Optional/required mismatch between TS and Zod" },
    },
    {
      id: "type-mismatch",
      shortDescription: { text: "Type mismatch between TS and Zod" },
    },
  ];

  const results = payload.result.pairs.flatMap((pair) =>
    pair.issues.map((issue) => {
      const location = issue.schemaLocation ?? issue.typeLocation;
      return {
        ruleId: ruleName(issue.kind),
        level: levelForIssue(issue.kind),
        message: {
          text: `${pair.typeName} ↔ ${pair.schemaName}: ${issue.message}`,
        },
        locations: location
          ? [
              {
                physicalLocation: {
                  artifactLocation: {
                    uri: path.relative(payload.cwd, location.filePath) || location.filePath,
                  },
                  region: {
                    startLine: location.line,
                    startColumn: location.column,
                  },
                },
              },
            ]
          : undefined,
      };
    }),
  );

  return JSON.stringify(
    {
      version: "2.1.0",
      $schema:
        "https://schemastore.azurewebsites.net/schemas/json/sarif-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "zodrift",
              informationUri: "https://github.com/greyllmmoder/zodrift",
              rules,
            },
          },
          results,
        },
      ],
    },
    null,
    2,
  );
}

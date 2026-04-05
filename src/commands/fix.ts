import fs from "node:fs";
import path from "node:path";
import { runCheck } from "../core/checker.js";
import { flagBoolean, flagString } from "../utils/args.js";

interface ProposedEdit {
  filePath: string;
  line: number;
  reason: string;
  before: string;
  after: string;
}

const PRIMITIVE_METHODS = new Set(["string", "number", "boolean", "unknown", "any"]);

function addOptional(line: string): string {
  if (line.includes(".optional()")) {
    return line;
  }
  return line.replace(
    /(z\.[A-Za-z_$][A-Za-z0-9_$]*\([^\n]*\))(?!\s*\.optional\(\))/,
    "$1.optional()",
  );
}

function removeOptional(line: string): string {
  return line.replace(/\.optional\(\)/, "");
}

function swapPrimitive(line: string, from: string, to: string): string {
  const pattern = new RegExp(`\\bz\\.${from}\\s*\\(`);
  return line.replace(pattern, `z.${to}(`);
}

export function runFixCommand(flags: Map<string, string | boolean>): number {
  const cwd = process.cwd();
  const pattern = flagString(flags, "pattern", "**/*.{ts,tsx}");
  const write = flagBoolean(flags, "write", false);
  const dryRun = flagBoolean(flags, "dry-run", !write);
  const target = flagString(flags, "target", "schema");

  if (target !== "schema") {
    process.stdout.write("Only --target schema is supported in this version.\n");
    return 2;
  }

  const result = runCheck({
    cwd,
    pattern,
    format: "pretty",
    changedOnly: false,
  });

  const fileLines = new Map<string, string[]>();
  const edits: ProposedEdit[] = [];

  function loadLines(filePath: string): string[] {
    const abs = path.resolve(filePath);
    const cached = fileLines.get(abs);
    if (cached) {
      return cached;
    }
    const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
    fileLines.set(abs, lines);
    return lines;
  }

  for (const pair of result.pairs) {
    for (const issue of pair.issues) {
      const location = issue.schemaLocation;
      if (!location) {
        continue;
      }

      const lines = loadLines(location.filePath);
      const lineIndex = location.line - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) {
        continue;
      }

      const original = lines[lineIndex];
      let updated = original;
      let reason = "";

      if (
        issue.kind === "optional_mismatch" &&
        issue.typeValue === "optional" &&
        issue.schemaValue === "required"
      ) {
        updated = addOptional(original);
        reason = "add optional() to match TypeScript optional field";
      } else if (
        issue.kind === "optional_mismatch" &&
        issue.typeValue === "required" &&
        issue.schemaValue === "optional"
      ) {
        updated = removeOptional(original);
        reason = "remove optional() to match TypeScript required field";
      } else if (
        issue.kind === "type_mismatch" &&
        issue.typeValue &&
        issue.schemaValue &&
        PRIMITIVE_METHODS.has(issue.typeValue) &&
        PRIMITIVE_METHODS.has(issue.schemaValue)
      ) {
        updated = swapPrimitive(original, issue.schemaValue, issue.typeValue);
        reason = `replace z.${issue.schemaValue} with z.${issue.typeValue}`;
      }

      if (!reason || updated === original) {
        continue;
      }

      lines[lineIndex] = updated;
      edits.push({
        filePath: location.filePath,
        line: location.line,
        reason,
        before: original,
        after: updated,
      });
    }
  }

  if (edits.length === 0) {
    process.stdout.write("No safe autofixes available for the current drift set.\n");
    return 0;
  }

  for (const edit of edits) {
    process.stdout.write(`- ${edit.filePath}:${edit.line} ${edit.reason}\n`);
    process.stdout.write(`  before: ${edit.before.trim()}\n`);
    process.stdout.write(`  after : ${edit.after.trim()}\n`);
  }

  if (dryRun || !write) {
    process.stdout.write(`\nDry run complete. ${edits.length} safe edits proposed.\n`);
    process.stdout.write("Re-run with --write to apply changes.\n");
    return 0;
  }

  for (const [filePath, lines] of fileLines.entries()) {
    fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  }

  process.stdout.write(`\nApplied ${edits.length} edits.\n`);
  return 0;
}

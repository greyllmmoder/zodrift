import fs from "node:fs";
import path from "node:path";
import { runCheck } from "../core/checker.js";
import type { OutputFormat } from "../core/types.js";
import { renderOutput } from "../reporters/index.js";
import { flagBoolean, flagNumber, flagString } from "../utils/args.js";

export function runCheckCommand(flags: Map<string, string | boolean>): number {
  const cwd = process.cwd();
  const pattern = flagString(flags, "pattern", "**/*.{ts,tsx}");
  const format = flagString(flags, "format", "pretty") as OutputFormat;
  const maxIssues = flagNumber(flags, "max-issues");
  const changedOnly = flagBoolean(flags, "changed", false);

  const result = runCheck({
    cwd,
    pattern,
    format,
    maxIssues,
    changedOnly,
  });

  const rendered = renderOutput(format, {
    result,
    cwd,
  });

  const outFile = flagString(flags, "out", "").trim();
  if (outFile) {
    const resolvedOut = path.resolve(cwd, outFile);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, rendered, "utf8");
    if (format === "pretty") {
      process.stdout.write(`${rendered}\n`);
    }
    process.stdout.write(`Saved ${format} report to ${resolvedOut}\n`);
  } else {
    process.stdout.write(`${rendered}\n`);
  }

  const failOn = flagString(flags, "fail-on", "all");
  const hasErrors = result.errors.length > 0;
  const hasDrift = result.totalIssues > 0;

  if (hasErrors) {
    return 2;
  }

  if (failOn === "drift" && hasDrift) {
    return 1;
  }
  if (failOn === "error") {
    return 0;
  }
  if (failOn === "all" && (hasDrift || hasErrors)) {
    return hasDrift ? 1 : 2;
  }

  return hasDrift ? 1 : 0;
}

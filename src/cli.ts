#!/usr/bin/env node
import { runCheckCommand } from "./commands/check.js";
import { runCodegenCommand } from "./commands/codegen.js";
import { runFixCommand } from "./commands/fix.js";
import { runFormsCommand } from "./commands/forms.js";
import { runOpenApiCommand } from "./commands/openapi.js";
import { parseArgs } from "./utils/args.js";

function printHelp(): void {
  process.stdout.write(`zodrift

Usage:
  zodrift check [--pattern <glob>] [--format pretty|json|sarif] [--semantics off|input|output|both] [--out <file>] [--changed]
  zodrift fix [--pattern <glob>] [--target schema] [--dry-run] [--write]
  zodrift codegen [--from ts|zod] [--pattern <glob>] [--out-dir <dir>] [--write]
  zodrift openapi [--pattern <glob>] [--out <file>]
  zodrift forms [--pattern <glob>] [--out <file>]

Examples:
  npx zodrift check
  npx zodrift check --pattern "examples/**/*.ts"
  npx zodrift check --semantics both
  npx zodrift check --format json --out reports/zodrift.json
  npx zodrift fix --pattern "src/**/*.ts" --dry-run
`);
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed.command;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  switch (command) {
    case "check":
      return runCheckCommand(parsed.flags);
    case "fix":
      return runFixCommand(parsed.flags);
    case "codegen":
      return runCodegenCommand(parsed.flags);
    case "openapi":
      return runOpenApiCommand(parsed.flags);
    case "forms":
      return runFormsCommand(parsed.flags);
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      printHelp();
      return 2;
  }
}

const exitCode = main();
process.exit(exitCode);

import fs from "node:fs";
import path from "node:path";
import { discoverSourceFiles } from "../core/file-discovery.js";
import { typeNodeToFormFields } from "../core/emit.js";
import { parseSchemaDeclarations } from "../core/zod-parser.js";
import { flagString } from "../utils/args.js";

export function runFormsCommand(flags: Map<string, string | boolean>): number {
  const cwd = process.cwd();
  const pattern = flagString(flags, "pattern", "**/*.{ts,tsx}");
  const outFile = flagString(flags, "out", "").trim();

  const files = discoverSourceFiles({
    cwd,
    pattern,
    changedOnly: false,
  });

  const parsed = parseSchemaDeclarations(files);
  if (parsed.errors.length > 0) {
    process.stdout.write(`${parsed.errors.join("\n")}\n`);
    return 2;
  }

  const forms: Record<string, unknown> = {};

  for (const schema of parsed.declarations) {
    const name = schema.name.endsWith("Schema")
      ? schema.name.slice(0, -"Schema".length)
      : schema.name;

    forms[name] = {
      schema: schema.name,
      fields: typeNodeToFormFields(schema.node),
    };
  }

  const content = `${JSON.stringify({ forms }, null, 2)}\n`;

  if (!outFile) {
    process.stdout.write(content);
    return 0;
  }

  const resolvedOut = path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, content, "utf8");
  process.stdout.write(`Wrote forms metadata to ${resolvedOut}\n`);
  return 0;
}

import fs from "node:fs";
import path from "node:path";
import { discoverSourceFiles } from "../core/file-discovery.js";
import { typeNodeToOpenApi } from "../core/emit.js";
import { parseSchemaDeclarations } from "../core/zod-parser.js";
import { flagString } from "../utils/args.js";

export function runOpenApiCommand(flags: Map<string, string | boolean>): number {
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

  const components: Record<string, unknown> = {};

  for (const schema of parsed.declarations) {
    const name = schema.name.endsWith("Schema")
      ? schema.name.slice(0, -"Schema".length)
      : schema.name;
    components[name] = typeNodeToOpenApi(schema.node);
  }

  const payload = {
    openapi: "3.1.0",
    info: {
      title: "zodrift generated spec",
      version: "0.1.0",
    },
    paths: {},
    components: {
      schemas: components,
    },
  };

  const content = `${JSON.stringify(payload, null, 2)}\n`;

  if (!outFile) {
    process.stdout.write(content);
    return 0;
  }

  const resolvedOut = path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, content, "utf8");
  process.stdout.write(`Wrote OpenAPI spec to ${resolvedOut}\n`);
  return 0;
}

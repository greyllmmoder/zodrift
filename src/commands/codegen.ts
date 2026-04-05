import fs from "node:fs";
import path from "node:path";
import { discoverSourceFiles } from "../core/file-discovery.js";
import { typeNodeToTs, typeNodeToZod } from "../core/emit.js";
import { parseTypeDeclarations } from "../core/ts-parser.js";
import { parseSchemaDeclarations } from "../core/zod-parser.js";
import { flagBoolean, flagString } from "../utils/args.js";

export function runCodegenCommand(flags: Map<string, string | boolean>): number {
  const cwd = process.cwd();
  const pattern = flagString(flags, "pattern", "**/*.{ts,tsx}");
  const from = flagString(flags, "from", "ts");
  const write = flagBoolean(flags, "write", false);
  const outDir = path.resolve(cwd, flagString(flags, "out-dir", "generated"));

  const files = discoverSourceFiles({
    cwd,
    pattern,
    changedOnly: false,
  });

  let output = "";

  if (from === "ts") {
    const parsed = parseTypeDeclarations(files);

    if (parsed.errors.length > 0) {
      process.stdout.write(`${parsed.errors.join("\n")}\n`);
      return 2;
    }

    output = [
      'import { z } from "zod";',
      "",
      ...parsed.declarations.map(
        (declaration) =>
          `export const ${declaration.name}Schema = ${typeNodeToZod(declaration.node)};`,
      ),
      "",
    ].join("\n");
  } else if (from === "zod") {
    const parsed = parseSchemaDeclarations(files);

    if (parsed.errors.length > 0) {
      process.stdout.write(`${parsed.errors.join("\n")}\n`);
      return 2;
    }

    output = [
      ...parsed.declarations.map((declaration) => {
        const name = declaration.name.endsWith("Schema")
          ? declaration.name.slice(0, -"Schema".length)
          : declaration.name;
        return `export type ${name} = ${typeNodeToTs(declaration.node)};`;
      }),
      "",
    ].join("\n");
  } else {
    process.stdout.write("Invalid --from value. Use --from ts or --from zod.\n");
    return 2;
  }

  const outputFile = path.join(outDir, from === "ts" ? "schemas.ts" : "types.ts");

  if (!write) {
    process.stdout.write(output);
    process.stdout.write(
      `\nDry run only. Re-run with --write to save ${path.relative(cwd, outputFile)}\n`,
    );
    return 0;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputFile, output, "utf8");
  process.stdout.write(`Generated ${path.relative(cwd, outputFile)}\n`);
  return 0;
}

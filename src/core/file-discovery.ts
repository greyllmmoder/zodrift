import { execSync } from "node:child_process";
import path from "node:path";
import ts from "typescript";

function readFilesByPattern(cwd: string, pattern: string): string[] {
  const files = ts.sys.readDirectory(cwd, [".ts", ".tsx"], undefined, [pattern]);
  return files.filter((filePath) => !filePath.endsWith(".d.ts"));
}

function gitChangedFiles(cwd: string): string[] {
  try {
    const output = execSync(
      "git diff --name-only --diff-filter=ACMR && git diff --name-only --cached --diff-filter=ACMR",
      { cwd, stdio: ["ignore", "pipe", "ignore"] },
    )
      .toString("utf8")
      .trim();

    if (!output) {
      return [];
    }

    const all = output
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => path.resolve(cwd, item));

    return Array.from(new Set(all));
  } catch {
    return [];
  }
}

export function discoverSourceFiles(options: {
  cwd: string;
  pattern: string;
  changedOnly: boolean;
}): string[] {
  const allFiles = readFilesByPattern(options.cwd, options.pattern);
  if (!options.changedOnly) {
    return allFiles;
  }

  const changed = new Set(gitChangedFiles(options.cwd));
  if (changed.size === 0) {
    return allFiles;
  }

  return allFiles.filter((filePath) => changed.has(path.resolve(filePath)));
}

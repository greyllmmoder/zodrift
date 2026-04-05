import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runCheck } from "./checker.js";
import type { SemanticsMode } from "./types.js";

function withFixture(
  source: string,
  run: (fixture: { cwd: string; pattern: string }) => void,
): void {
  const cwd = process.cwd();
  const fixtureDir = fs.mkdtempSync(path.join(cwd, "tmp-semantic-"));
  const filePath = path.join(fixtureDir, "case.ts");
  fs.writeFileSync(filePath, source, "utf8");

  const relative = path.relative(cwd, fixtureDir).split(path.sep).join("/");
  const pattern = `${relative}/**/*.ts`;

  try {
    run({ cwd, pattern });
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function runSemanticCheck(cwd: string, pattern: string, semantics: SemanticsMode) {
  return runCheck({
    cwd,
    pattern,
    format: "pretty",
    semantics,
    changedOnly: false,
  });
}

test("semantic input mode catches mismatch for simple primitive schema", () => {
  withFixture(
    `
import { z } from "zod";

export type User = number;
export const UserSchema = z.string();
`,
    ({ cwd, pattern }) => {
      const result = runSemanticCheck(cwd, pattern, "input");

      assert.equal(result.checkedPairs, 1);
      assert.equal(result.semanticsMode, "input");
      assert.equal(result.semanticIssueCount, 1);
      assert.ok(result.pairs[0].issues.some((issue) => issue.path === "(semantic:input)"));
    },
  );
});

test("semantic output mode catches preprocess output mismatch", () => {
  withFixture(
    `
import { z } from "zod";

export type User = string;
export const UserSchema = z.preprocess((value) => Number(value), z.number());
`,
    ({ cwd, pattern }) => {
      const result = runSemanticCheck(cwd, pattern, "output");

      assert.equal(result.checkedPairs, 1);
      assert.equal(result.semanticsMode, "output");
      assert.equal(result.semanticIssueCount, 1);
      assert.ok(result.pairs[0].issues.some((issue) => issue.path === "(semantic:output)"));
    },
  );
});

test("semantic both mode passes for matching interface and object schema", () => {
  withFixture(
    `
import { z } from "zod";

export interface User {
  name: string;
  email?: string;
}

export const UserSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
});
`,
    ({ cwd, pattern }) => {
      const result = runSemanticCheck(cwd, pattern, "both");

      assert.equal(result.checkedPairs, 1);
      assert.equal(result.semanticsMode, "both");
      assert.equal(result.semanticIssueCount, 0);
      assert.equal(result.totalIssues, 0);
    },
  );
});

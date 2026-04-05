import test from "node:test";
import assert from "node:assert/strict";
import { comparePair } from "./compare.js";
import type { Pairing } from "./types.js";

function buildPairing(): Pairing {
  return {
    typeDecl: {
      name: "User",
      sourceFilePath: "/tmp/user.ts",
      location: { filePath: "/tmp/user.ts", line: 1, column: 1 },
      node: {
        kind: "object",
        properties: {
          profile: {
            name: "profile",
            optional: false,
            type: {
              kind: "object",
              properties: {
                email: {
                  name: "email",
                  optional: true,
                  type: { kind: "primitive", name: "string" },
                },
                role: {
                  name: "role",
                  optional: false,
                  type: {
                    kind: "union",
                    members: [
                      { kind: "literal", value: "admin" },
                      { kind: "literal", value: "user" },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
    schemaDecl: {
      name: "UserSchema",
      sourceFilePath: "/tmp/user.ts",
      location: { filePath: "/tmp/user.ts", line: 10, column: 1 },
      node: {
        kind: "object",
        properties: {
          profile: {
            name: "profile",
            optional: false,
            type: {
              kind: "object",
              properties: {
                email: {
                  name: "email",
                  optional: false,
                  type: { kind: "primitive", name: "string" },
                },
                role: {
                  name: "role",
                  optional: false,
                  type: {
                    kind: "union",
                    members: [
                      { kind: "literal", value: "admin" },
                      { kind: "literal", value: "editor" },
                    ],
                  },
                },
                extra: {
                  name: "extra",
                  optional: false,
                  type: { kind: "primitive", name: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

test("comparePair catches nested optional, union and extra issues", () => {
  const issues = comparePair(buildPairing());
  const messages = issues.map((issue) => issue.message);

  assert.equal(issues.length, 3);
  assert.ok(messages.some((message) => message.includes("optional mismatch for profile.email")));
  assert.ok(messages.some((message) => message.includes("type mismatch for profile.role")));
  assert.ok(messages.some((message) => message.includes("extra in schema: profile.extra")));
});

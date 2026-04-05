# zodrift

[![npm version](https://img.shields.io/npm/v/zodrift.svg)](https://www.npmjs.com/package/zodrift)
[![CI](https://github.com/greyllmmoder/zodrift/actions/workflows/ci.yml/badge.svg)](https://github.com/greyllmmoder/zodrift/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

ESLint for TypeScript and Zod drift. Catch contract drift before it reaches runtime.

Built for teams that already have TS types and Zod schemas and want CI to fail when they drift.

```ts
import { z } from "zod";

export interface User {
  name: string;
  email?: string;
  age: number;
}

export const UserSchema = z.object({
  name: z.string(),
  email: z.string(),
  age: z.string(),
  role: z.string(),
});
```

```bash
npx zodrift check
```

![zodrift terminal output](https://raw.githubusercontent.com/greyllmmoder/zodrift/main/assets/hero.svg)

Example output:

```text
✗ User ↔ UserSchema
  - optional mismatch for email: type=optional, schema=required
  - type mismatch for age: type=number, schema=string
  - extra in schema: role
```

What it catches:
- missing fields
- extra fields
- required vs optional mismatch
- basic type mismatch
- semantic mismatch when your TS type is not assignable to `z.input<typeof Schema>` / `z.output<typeof Schema>` (optional mode)

CI quick start:

```yaml
- run: npx zodrift check --pattern "src/**/*.{ts,tsx}" --semantics both
```

Exit codes:
- `0`: no drift
- `1`: drift found
- `2`: parser/runtime error

Useful commands:

```bash
# Check current project
npx zodrift check --pattern "src/**/*.{ts,tsx}"

# Add semantic compatibility checks for z.input/z.output
npx zodrift check --pattern "src/**/*.{ts,tsx}" --semantics both

# Machine-readable report for CI artifacts
npx zodrift check --format json --out reports/zodrift.json

# SARIF for GitHub code scanning
npx zodrift check --format sarif --out reports/zodrift.sarif

# Safe autofix pass (dry-run first)
npx zodrift fix --pattern "src/**/*.ts" --dry-run
```

Roadmap:
- nested support
- arrays
- unions
- JSON output
- GitHub Action

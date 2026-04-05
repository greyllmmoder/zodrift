# zodrift

[![npm version](https://img.shields.io/npm/v/zodrift.svg)](https://www.npmjs.com/package/zodrift)
[![CI](https://github.com/greyllmmoder/zodrift/actions/workflows/ci.yml/badge.svg)](https://github.com/greyllmmoder/zodrift/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Catch drift between your TypeScript types and Zod schemas.

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

![zodrift terminal output](./assets/hero.svg)

What it catches:
- missing fields
- extra fields
- required vs optional mismatch
- basic type mismatch

Roadmap:
- nested support
- arrays
- unions
- JSON output
- GitHub Action

# fix

```bash
npx zodrift fix --pattern "src/**/*.ts" --dry-run
npx zodrift fix --pattern "src/**/*.ts" --write
```

Current safe autofixes (`--target schema`):
- required/optional mismatches
- primitive swaps (`z.string` ↔ `z.number`/`z.boolean` etc.) when unambiguous

Use dry-run first in CI or pre-commit.

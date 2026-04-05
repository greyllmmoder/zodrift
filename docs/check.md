# check

```bash
npx zodrift check --pattern "src/**/*.ts"
```

Options:
- `--pattern`: file glob (default `**/*.{ts,tsx}`)
- `--format`: `pretty` | `json` | `sarif`
- `--semantics`: `off` | `input` | `output` | `both` (default `off`)
- `--out`: write report to file
- `--changed`: only changed/staged files
- `--max-issues`: cap issues per pair
- `--fail-on`: `drift` | `error` | `all`

Semantic mode checks whether your exported TS type is assignable to:
- `input`: `z.input<typeof Schema>`
- `output`: `z.output<typeof Schema>`
- `both`: runs both checks

Exit codes:
- `0`: no drift
- `1`: drift found
- `2`: parsing/runtime error

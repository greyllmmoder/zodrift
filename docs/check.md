# check

```bash
npx zodrift check --pattern "src/**/*.ts"
```

Options:
- `--pattern`: file glob (default `**/*.{ts,tsx}`)
- `--format`: `pretty` | `json` | `sarif`
- `--out`: write report to file
- `--changed`: only changed/staged files
- `--max-issues`: cap issues per pair
- `--fail-on`: `drift` | `error` | `all`

Exit codes:
- `0`: no drift
- `1`: drift found
- `2`: parsing/runtime error

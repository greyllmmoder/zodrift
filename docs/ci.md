# ci

Basic gate:

```yaml
- run: npx zodrift check --pattern "src/**/*.ts"
```

Semantic gate (recommended):

```yaml
- run: npx zodrift check --pattern "src/**/*.ts" --semantics both
```

JSON artifact:

```yaml
- run: npx zodrift check --format json --out reports/zodrift.json
```

SARIF for GitHub code scanning:

```yaml
- run: npx zodrift check --format sarif --out reports/zodrift.sarif
```

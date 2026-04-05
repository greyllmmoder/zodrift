# ci

Basic gate:

```yaml
- run: npx zodrift check --pattern "src/**/*.ts"
```

JSON artifact:

```yaml
- run: npx zodrift check --format json --out reports/zodrift.json
```

SARIF for GitHub code scanning:

```yaml
- run: npx zodrift check --format sarif --out reports/zodrift.sarif
```

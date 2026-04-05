# publish

1. Check package availability:

```bash
npm view zodrift name
```

2. Login and publish:

```bash
npm login
npm publish --access public
```

3. Verify install:

```bash
npx zodrift check --help
```

For automated publishing, push a `v*` tag after setting `NPM_TOKEN` in GitHub repository secrets.

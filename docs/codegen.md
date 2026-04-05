# codegen

Generate schemas from TypeScript:

```bash
npx zodrift codegen --from ts --pattern "src/**/*.ts" --write
```

Generate TypeScript from Zod schemas:

```bash
npx zodrift codegen --from zod --pattern "src/**/*.ts" --write
```

Output directory default: `generated/`

import type { Pairing, SchemaDeclaration, TypeDeclaration } from "./types.js";

export function pairTypesWithSchemas(
  typeDeclarations: TypeDeclaration[],
  schemaDeclarations: SchemaDeclaration[],
): {
  pairs: Pairing[];
  unmatchedTypes: string[];
  unmatchedSchemas: string[];
} {
  const typeMap = new Map(typeDeclarations.map((declaration) => [declaration.name, declaration]));
  const schemaMap = new Map(
    schemaDeclarations.map((declaration) => [declaration.name, declaration]),
  );

  const pairs: Pairing[] = [];

  for (const schemaDecl of schemaDeclarations) {
    if (!schemaDecl.name.endsWith("Schema")) {
      continue;
    }

    const baseName = schemaDecl.name.slice(0, -"Schema".length);
    const typeDecl = typeMap.get(baseName);

    if (typeDecl) {
      pairs.push({
        typeDecl,
        schemaDecl,
      });
    }
  }

  const pairedTypeNames = new Set(pairs.map((pair) => pair.typeDecl.name));
  const pairedSchemaNames = new Set(pairs.map((pair) => pair.schemaDecl.name));

  const unmatchedTypes = Array.from(typeMap.keys()).filter((name) => !pairedTypeNames.has(name));
  const unmatchedSchemas = Array.from(schemaMap.keys()).filter(
    (name) => !pairedSchemaNames.has(name),
  );

  return {
    pairs,
    unmatchedTypes,
    unmatchedSchemas,
  };
}

import { unwrapOptional } from "./type-utils.js";
import type { ObjectProperty, TypeNode } from "./types.js";

function isSimpleIdentifier(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function quoteKey(name: string): string {
  return isSimpleIdentifier(name) ? name : JSON.stringify(name);
}

export function typeNodeToZod(node: TypeNode): string {
  const normalized = unwrapOptional(node);

  let body = "z.unknown()";
  switch (normalized.node.kind) {
    case "primitive":
      switch (normalized.node.name) {
        case "string":
          body = "z.string()";
          break;
        case "number":
          body = "z.number()";
          break;
        case "boolean":
          body = "z.boolean()";
          break;
        case "any":
          body = "z.any()";
          break;
        case "unknown":
          body = "z.unknown()";
          break;
        case "null":
          body = "z.null()";
          break;
        case "undefined":
          body = "z.undefined()";
          break;
        default:
          body = "z.unknown()";
          break;
      }
      break;
    case "literal":
      body = `z.literal(${JSON.stringify(normalized.node.value)})`;
      break;
    case "array":
      body = `z.array(${typeNodeToZod(normalized.node.element)})`;
      break;
    case "tuple":
      body = `z.tuple([${normalized.node.items.map((item) => typeNodeToZod(item)).join(", ")}])`;
      break;
    case "union":
      body = `z.union([${normalized.node.members.map((member) => typeNodeToZod(member)).join(", ")}])`;
      break;
    case "reference":
      body = `${normalized.node.name}Schema`;
      break;
    case "object": {
      const fields = Object.values(normalized.node.properties)
        .map((property) => {
          const zodType = property.optional
            ? `${typeNodeToZod(property.type)}.optional()`
            : typeNodeToZod(property.type);
          return `${quoteKey(property.name)}: ${zodType}`;
        })
        .join(", ");
      body = `z.object({ ${fields} })`;
      break;
    }
    case "optional":
      body = `${typeNodeToZod(normalized.node.inner)}.optional()`;
      break;
    default:
      body = "z.unknown()";
      break;
  }

  if (normalized.optional) {
    return `${body}.optional()`;
  }

  return body;
}

export function typeNodeToTs(node: TypeNode): string {
  const normalized = unwrapOptional(node);

  let body = "unknown";
  switch (normalized.node.kind) {
    case "primitive":
      body = normalized.node.name;
      break;
    case "literal":
      body = JSON.stringify(normalized.node.value);
      break;
    case "array":
      body = `${typeNodeToTs(normalized.node.element)}[]`;
      break;
    case "tuple":
      body = `[${normalized.node.items.map((item) => typeNodeToTs(item)).join(", ")}]`;
      break;
    case "union":
      body = normalized.node.members.map((member) => typeNodeToTs(member)).join(" | ");
      break;
    case "reference":
      body = normalized.node.name;
      break;
    case "object": {
      const fields = Object.values(normalized.node.properties)
        .map((property) => `${quoteKey(property.name)}${property.optional ? "?" : ""}: ${typeNodeToTs(property.type)}`)
        .join("; ");
      body = `{ ${fields} }`;
      break;
    }
    case "optional":
      body = `${typeNodeToTs(normalized.node.inner)} | undefined`;
      break;
    default:
      body = "unknown";
      break;
  }

  return normalized.optional ? `${body} | undefined` : body;
}

export function typeNodeToOpenApi(node: TypeNode): Record<string, unknown> {
  const normalized = unwrapOptional(node);

  switch (normalized.node.kind) {
    case "primitive":
      switch (normalized.node.name) {
        case "string":
          return { type: "string" };
        case "number":
          return { type: "number" };
        case "boolean":
          return { type: "boolean" };
        case "null":
          return { type: "null" };
        default:
          return {};
      }
    case "literal":
      return { enum: [normalized.node.value] };
    case "array":
      return {
        type: "array",
        items: typeNodeToOpenApi(normalized.node.element),
      };
    case "tuple":
      return {
        type: "array",
        prefixItems: normalized.node.items.map((item) => typeNodeToOpenApi(item)),
      };
    case "union":
      return {
        oneOf: normalized.node.members.map((member) => typeNodeToOpenApi(member)),
      };
    case "reference":
      return {
        $ref: `#/components/schemas/${normalized.node.name}`,
      };
    case "object": {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const property of Object.values(normalized.node.properties)) {
        properties[property.name] = typeNodeToOpenApi(property.type);
        if (!property.optional) {
          required.push(property.name);
        }
      }

      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      };
    }
    case "optional": {
      return {
        anyOf: [typeNodeToOpenApi(normalized.node.inner), { type: "null" }],
      };
    }
    default:
      return {};
  }
}

function primitiveUiType(node: TypeNode): string {
  const normalized = unwrapOptional(node);
  switch (normalized.node.kind) {
    case "primitive":
      return normalized.node.name;
    case "literal":
      return typeof normalized.node.value;
    case "array":
      return "array";
    case "object":
      return "object";
    case "union":
      return "union";
    case "tuple":
      return "tuple";
    case "reference":
      return "reference";
    default:
      return "unknown";
  }
}

export interface FormField {
  path: string;
  required: boolean;
  type: string;
}

function collectFromProperty(
  property: ObjectProperty,
  basePath: string,
  requiredFromParent: boolean,
  fields: FormField[],
): void {
  const path = basePath ? `${basePath}.${property.name}` : property.name;
  const required = requiredFromParent && !property.optional;

  const normalized = unwrapOptional(property.type);
  if (normalized.node.kind === "object") {
    for (const childProperty of Object.values(normalized.node.properties)) {
      collectFromProperty(childProperty, path, required, fields);
    }
    return;
  }

  fields.push({
    path,
    required,
    type: primitiveUiType(property.type),
  });
}

export function typeNodeToFormFields(node: TypeNode): FormField[] {
  const fields: FormField[] = [];
  const normalized = unwrapOptional(node);

  if (normalized.node.kind === "object") {
    for (const property of Object.values(normalized.node.properties)) {
      collectFromProperty(property, "", true, fields);
    }
    return fields;
  }

  fields.push({
    path: "$",
    required: true,
    type: primitiveUiType(node),
  });

  return fields;
}

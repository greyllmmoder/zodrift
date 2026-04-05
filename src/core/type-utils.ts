import type {
  ObjectProperty,
  PrimitiveTypeName,
  SourceLocation,
  TypeNode,
  UnionNode,
} from "./types.js";

export function normalizePath(base: string, segment: string): string {
  return base ? `${base}.${segment}` : segment;
}

export function locationFromTs(
  sourceFilePath: string,
  line: number,
  character: number,
): SourceLocation {
  return {
    filePath: sourceFilePath,
    line: line + 1,
    column: character + 1,
  };
}

export function makePrimitive(name: PrimitiveTypeName): TypeNode {
  return { kind: "primitive", name };
}

export function unwrapOptional(node: TypeNode): { node: TypeNode; optional: boolean } {
  if (node.kind === "optional") {
    return { node: node.inner, optional: true };
  }
  return { node, optional: false };
}

export function stringifyType(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return node.name;
    case "literal":
      if (typeof node.value === "string") {
        return `"${node.value}"`;
      }
      return String(node.value);
    case "array":
      return `${stringifyType(node.element)}[]`;
    case "tuple":
      return `[${node.items.map((item) => stringifyType(item)).join(", ")}]`;
    case "union":
      return node.members.map((member) => stringifyType(member)).join(" | ");
    case "object":
      return "object";
    case "reference":
      return node.name;
    case "optional":
      return `${stringifyType(node.inner)} | undefined`;
    default:
      return "unknown";
  }
}

export function canonicalSignature(node: TypeNode): string {
  switch (node.kind) {
    case "primitive":
      return `p:${node.name}`;
    case "literal":
      return `l:${JSON.stringify(node.value)}`;
    case "reference":
      return `r:${node.name}`;
    case "array":
      return `a:${canonicalSignature(node.element)}`;
    case "tuple":
      return `t:[${node.items.map((item) => canonicalSignature(item)).join(",")}]`;
    case "optional":
      return `o:${canonicalSignature(node.inner)}`;
    case "object": {
      const sorted = Object.values(node.properties)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((property) => `${property.name}${property.optional ? "?" : ""}:${canonicalSignature(property.type)}`)
        .join(";");
      return `obj:{${sorted}}`;
    }
    case "union": {
      const members = node.members.map((member) => canonicalSignature(member)).sort();
      return `u:${members.join("|")}`;
    }
    default:
      return "unknown";
  }
}

export function stripUndefinedFromUnion(node: UnionNode): {
  optional: boolean;
  node: TypeNode;
} {
  const nonUndefined = node.members.filter(
    (member) => !(member.kind === "primitive" && member.name === "undefined"),
  );
  if (nonUndefined.length === node.members.length) {
    return { optional: false, node };
  }
  if (nonUndefined.length === 0) {
    return { optional: true, node: makePrimitive("undefined") };
  }
  if (nonUndefined.length === 1) {
    return { optional: true, node: nonUndefined[0] };
  }
  return {
    optional: true,
    node: {
      kind: "union",
      members: nonUndefined,
      location: node.location,
    },
  };
}

export function cloneProperty(property: ObjectProperty): ObjectProperty {
  return {
    ...property,
    type: cloneTypeNode(property.type),
  };
}

export function cloneTypeNode(node: TypeNode): TypeNode {
  switch (node.kind) {
    case "primitive":
    case "literal":
    case "reference":
      return { ...node };
    case "optional":
      return {
        ...node,
        inner: cloneTypeNode(node.inner),
      };
    case "array":
      return {
        ...node,
        element: cloneTypeNode(node.element),
      };
    case "tuple":
      return {
        ...node,
        items: node.items.map((item) => cloneTypeNode(item)),
      };
    case "union":
      return {
        ...node,
        members: node.members.map((member) => cloneTypeNode(member)),
      };
    case "object": {
      const properties: Record<string, ObjectProperty> = {};
      for (const [name, property] of Object.entries(node.properties)) {
        properties[name] = cloneProperty(property);
      }
      return {
        ...node,
        properties,
      };
    }
    default:
      return node;
  }
}

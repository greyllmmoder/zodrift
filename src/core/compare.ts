import { canonicalSignature, normalizePath, stringifyType, unwrapOptional } from "./type-utils.js";
import type { DriftIssue, Pairing, TypeNode } from "./types.js";

function isUnknownNode(node: TypeNode): boolean {
  return node.kind === "primitive" && node.name === "unknown";
}

function normalizeComparable(node: TypeNode): TypeNode {
  const unwrapped = unwrapOptional(node);
  return unwrapped.node;
}

function addIssue(
  issues: DriftIssue[],
  issue: Omit<DriftIssue, "message"> & { message?: string },
): void {
  issues.push({
    ...issue,
    message:
      issue.message ??
      `${issue.kind} at ${issue.path || "(root)"}: type=${issue.typeValue ?? "n/a"}, schema=${issue.schemaValue ?? "n/a"}`,
  });
}

function compareUnion(
  pairName: string,
  path: string,
  typeNode: TypeNode,
  schemaNode: TypeNode,
  issues: DriftIssue[],
  typeLocation: DriftIssue["typeLocation"],
  schemaLocation: DriftIssue["schemaLocation"],
): void {
  if (typeNode.kind !== "union" || schemaNode.kind !== "union") {
    addIssue(issues, {
      kind: "type_mismatch",
      pairName,
      path,
      typeValue: stringifyType(typeNode),
      schemaValue: stringifyType(schemaNode),
      typeLocation,
      schemaLocation,
      message: `type mismatch for ${path || "(root)"}: type=${stringifyType(typeNode)}, schema=${stringifyType(schemaNode)}`,
    });
    return;
  }

  const typeSet = new Set(typeNode.members.map((member) => canonicalSignature(member)));
  const schemaSet = new Set(schemaNode.members.map((member) => canonicalSignature(member)));

  const equal =
    typeSet.size === schemaSet.size &&
    Array.from(typeSet).every((value) => schemaSet.has(value));

  if (!equal) {
    addIssue(issues, {
      kind: "type_mismatch",
      pairName,
      path,
      typeValue: stringifyType(typeNode),
      schemaValue: stringifyType(schemaNode),
      typeLocation,
      schemaLocation,
      message: `type mismatch for ${path || "(root)"}: type=${stringifyType(typeNode)}, schema=${stringifyType(schemaNode)}`,
    });
  }
}

function compareNode(
  pairName: string,
  path: string,
  typeNodeRaw: TypeNode,
  schemaNodeRaw: TypeNode,
  issues: DriftIssue[],
  typeLocation: DriftIssue["typeLocation"],
  schemaLocation: DriftIssue["schemaLocation"],
): void {
  const typeNode = normalizeComparable(typeNodeRaw);
  const schemaNode = normalizeComparable(schemaNodeRaw);

  if (isUnknownNode(typeNode) || isUnknownNode(schemaNode)) {
    return;
  }

  if (typeNode.kind === "object" && schemaNode.kind === "object") {
    const typeProps = typeNode.properties;
    const schemaProps = schemaNode.properties;

    for (const [name, typeProp] of Object.entries(typeProps)) {
      const nestedPath = normalizePath(path, name);
      const schemaProp = schemaProps[name];

      if (!schemaProp) {
        addIssue(issues, {
          kind: "missing_in_schema",
          pairName,
          path: nestedPath,
          typeLocation: typeProp.location ?? typeLocation,
          schemaLocation,
          message: `missing in schema: ${nestedPath}`,
        });
        continue;
      }

      if (typeProp.optional !== schemaProp.optional) {
        addIssue(issues, {
          kind: "optional_mismatch",
          pairName,
          path: nestedPath,
          typeValue: typeProp.optional ? "optional" : "required",
          schemaValue: schemaProp.optional ? "optional" : "required",
          typeLocation: typeProp.location ?? typeLocation,
          schemaLocation: schemaProp.location ?? schemaLocation,
          message: `optional mismatch for ${nestedPath}: type=${typeProp.optional ? "optional" : "required"}, schema=${schemaProp.optional ? "optional" : "required"}`,
        });
      }

      compareNode(
        pairName,
        nestedPath,
        typeProp.type,
        schemaProp.type,
        issues,
        typeProp.location ?? typeLocation,
        schemaProp.location ?? schemaLocation,
      );
    }

    for (const [name, schemaProp] of Object.entries(schemaProps)) {
      if (typeProps[name]) {
        continue;
      }
      const nestedPath = normalizePath(path, name);
      addIssue(issues, {
        kind: "extra_in_schema",
        pairName,
        path: nestedPath,
        typeLocation,
        schemaLocation: schemaProp.location ?? schemaLocation,
        message: `extra in schema: ${nestedPath}`,
      });
    }

    return;
  }

  if (typeNode.kind === "array" && schemaNode.kind === "array") {
    compareNode(
      pairName,
      `${path}[]`,
      typeNode.element,
      schemaNode.element,
      issues,
      typeLocation,
      schemaLocation,
    );
    return;
  }

  if (typeNode.kind === "tuple" && schemaNode.kind === "tuple") {
    if (typeNode.items.length !== schemaNode.items.length) {
      addIssue(issues, {
        kind: "type_mismatch",
        pairName,
        path,
        typeValue: stringifyType(typeNode),
        schemaValue: stringifyType(schemaNode),
        typeLocation,
        schemaLocation,
        message: `type mismatch for ${path || "(root)"}: type=${stringifyType(typeNode)}, schema=${stringifyType(schemaNode)}`,
      });
      return;
    }

    for (let i = 0; i < typeNode.items.length; i += 1) {
      compareNode(
        pairName,
        `${path}[${i}]`,
        typeNode.items[i],
        schemaNode.items[i],
        issues,
        typeLocation,
        schemaLocation,
      );
    }

    return;
  }

  if (typeNode.kind === "union" || schemaNode.kind === "union") {
    compareUnion(
      pairName,
      path,
      typeNode,
      schemaNode,
      issues,
      typeLocation,
      schemaLocation,
    );
    return;
  }

  if (typeNode.kind === "literal" && schemaNode.kind === "literal") {
    if (typeNode.value !== schemaNode.value) {
      addIssue(issues, {
        kind: "type_mismatch",
        pairName,
        path,
        typeValue: stringifyType(typeNode),
        schemaValue: stringifyType(schemaNode),
        typeLocation,
        schemaLocation,
        message: `type mismatch for ${path || "(root)"}: type=${stringifyType(typeNode)}, schema=${stringifyType(schemaNode)}`,
      });
    }
    return;
  }

  if (typeNode.kind === "reference" && schemaNode.kind === "reference") {
    if (typeNode.name !== schemaNode.name) {
      addIssue(issues, {
        kind: "type_mismatch",
        pairName,
        path,
        typeValue: typeNode.name,
        schemaValue: schemaNode.name,
        typeLocation,
        schemaLocation,
        message: `type mismatch for ${path || "(root)"}: type=${typeNode.name}, schema=${schemaNode.name}`,
      });
    }
    return;
  }

  if (typeNode.kind === "primitive" && schemaNode.kind === "primitive") {
    if (typeNode.name !== schemaNode.name) {
      addIssue(issues, {
        kind: "type_mismatch",
        pairName,
        path,
        typeValue: typeNode.name,
        schemaValue: schemaNode.name,
        typeLocation,
        schemaLocation,
        message: `type mismatch for ${path || "(root)"}: type=${typeNode.name}, schema=${schemaNode.name}`,
      });
    }
    return;
  }

  if (canonicalSignature(typeNode) !== canonicalSignature(schemaNode)) {
    addIssue(issues, {
      kind: "type_mismatch",
      pairName,
      path,
      typeValue: stringifyType(typeNode),
      schemaValue: stringifyType(schemaNode),
      typeLocation,
      schemaLocation,
      message: `type mismatch for ${path || "(root)"}: type=${stringifyType(typeNode)}, schema=${stringifyType(schemaNode)}`,
    });
  }
}

export function comparePair(pair: Pairing): DriftIssue[] {
  const pairName = `${pair.typeDecl.name} ↔ ${pair.schemaDecl.name}`;
  const issues: DriftIssue[] = [];

  compareNode(
    pairName,
    "",
    pair.typeDecl.node,
    pair.schemaDecl.node,
    issues,
    pair.typeDecl.location,
    pair.schemaDecl.location,
  );

  return issues;
}

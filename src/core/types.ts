export type PrimitiveTypeName =
  | "string"
  | "number"
  | "boolean"
  | "any"
  | "unknown"
  | "null"
  | "undefined";

export type NodeKind =
  | "primitive"
  | "literal"
  | "object"
  | "array"
  | "tuple"
  | "union"
  | "reference"
  | "optional";

export interface SourceLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface PrimitiveNode {
  kind: "primitive";
  name: PrimitiveTypeName;
  location?: SourceLocation;
}

export interface LiteralNode {
  kind: "literal";
  value: string | number | boolean | null;
  location?: SourceLocation;
}

export interface ObjectProperty {
  name: string;
  type: TypeNode;
  optional: boolean;
  location?: SourceLocation;
}

export interface ObjectNode {
  kind: "object";
  properties: Record<string, ObjectProperty>;
  location?: SourceLocation;
}

export interface ArrayNode {
  kind: "array";
  element: TypeNode;
  location?: SourceLocation;
}

export interface TupleNode {
  kind: "tuple";
  items: TypeNode[];
  location?: SourceLocation;
}

export interface UnionNode {
  kind: "union";
  members: TypeNode[];
  location?: SourceLocation;
}

export interface ReferenceNode {
  kind: "reference";
  name: string;
  location?: SourceLocation;
}

export interface OptionalNode {
  kind: "optional";
  inner: TypeNode;
  location?: SourceLocation;
}

export type TypeNode =
  | PrimitiveNode
  | LiteralNode
  | ObjectNode
  | ArrayNode
  | TupleNode
  | UnionNode
  | ReferenceNode
  | OptionalNode;

export interface TypeDeclaration {
  name: string;
  node: TypeNode;
  location: SourceLocation;
  sourceFilePath: string;
}

export interface SchemaDeclaration {
  name: string;
  node: TypeNode;
  location: SourceLocation;
  sourceFilePath: string;
  objectNodeText?: string;
}

export type DriftIssueKind =
  | "missing_in_schema"
  | "extra_in_schema"
  | "optional_mismatch"
  | "type_mismatch";

export interface DriftIssue {
  kind: DriftIssueKind;
  pairName: string;
  path: string;
  message: string;
  typeValue?: string;
  schemaValue?: string;
  typeLocation?: SourceLocation;
  schemaLocation?: SourceLocation;
}

export interface DriftPairResult {
  typeName: string;
  schemaName: string;
  typeDecl: TypeDeclaration;
  schemaDecl: SchemaDeclaration;
  issues: DriftIssue[];
}

export interface CheckResult {
  pairs: DriftPairResult[];
  totalIssues: number;
  checkedPairs: number;
  unmatchedTypes: string[];
  unmatchedSchemas: string[];
  errors: string[];
}

export interface Pairing {
  typeDecl: TypeDeclaration;
  schemaDecl: SchemaDeclaration;
}

export interface ReporterPayload {
  result: CheckResult;
  cwd: string;
}

export type OutputFormat = "pretty" | "json" | "sarif";

export interface CheckOptions {
  cwd: string;
  pattern: string;
  format: OutputFormat;
  maxIssues?: number;
  changedOnly: boolean;
}

export interface FixOptions {
  cwd: string;
  pattern: string;
  write: boolean;
  dryRun: boolean;
  target: "schema" | "type";
}

export interface CodegenOptions {
  cwd: string;
  pattern: string;
  from: "ts" | "zod";
  write: boolean;
  outDir: string;
}

export interface OpenApiOptions {
  cwd: string;
  pattern: string;
  outFile?: string;
}

export interface FormsOptions {
  cwd: string;
  pattern: string;
  outFile?: string;
}

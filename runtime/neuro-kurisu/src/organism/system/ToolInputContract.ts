import { isProxy } from "node:util/types";

export type ToolInputType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";
export type ToolInputScalar = string | number | boolean | null;

export interface ToolInputNodeContract {
  type: ToolInputType;
  description?: string;
  enum?: ToolInputScalar[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, ToolInputNodeContract>;
  required?: string[];
  additionalProperties?: boolean;
  maxProperties?: number;
  items?: ToolInputNodeContract;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}
export interface ToolInputContract extends ToolInputNodeContract {
  type: "object";
  maxSerializedBytes?: number;
}
export interface ToolInputContractIssue { path: string; code: string }
export interface ToolInputContractResult { valid: boolean; issues: ToolInputContractIssue[]; serializedBytes?: number }

const TYPES = new Set<ToolInputType>(["object", "array", "string", "number", "integer", "boolean", "null"]);
const DANGEROUS = new Set(["__proto__", "prototype"]);
const MAX_DEPTH = 8, MAX_ISSUES = 24, MAX_KEYS = 32, MAX_ITEMS = 100, MAX_SCHEMA_KEYS = 128;
const DEFAULT_BYTES = 65_536, MAX_BYTES = 2_097_152;

function plain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (isProxy(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function dataEntries(value: unknown, path: string): Array<[string, unknown]> {
  if (!plain(value)) throw new Error("invalid-tool-input-contract:" + path + ":expected-object");
  const result: Array<[string, unknown]> = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new Error("invalid-tool-input-contract:" + path + ":symbol-key");
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !("value" in d) || d.get || d.set || !d.enumerable) throw new Error("invalid-tool-input-contract:" + path + ":unsafe-property");
    result.push([key, d.value]);
  }
  return result;
}
function safeArrayValues(value: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(value) || isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) {
    throw new Error("invalid-tool-input-contract:" + path + ":invalid-array");
  }
  const values: unknown[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") continue;
    if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length) {
      throw new Error("invalid-tool-input-contract:" + path + ":array-extra-property");
    }
  }
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !("value" in d) || d.get || d.set || !d.enumerable) {
      throw new Error("invalid-tool-input-contract:" + path + ":unsafe-array-item");
    }
    values.push(d.value);
  }
  return values;
}
function intBound(value: unknown, path: string, min: number, max: number): void {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) throw new Error("invalid-tool-input-contract:" + path + ":invalid-bound");
}
function finiteBound(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("invalid-tool-input-contract:" + path + ":invalid-number-bound");
}
function matches(value: unknown, type: ToolInputType): boolean {
  switch (type) {
    case "object": return plain(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isSafeInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return false;
  }
}
function assertNode(raw: unknown, depth: number, path: string, root: boolean): asserts raw is ToolInputNodeContract {
  if (depth > MAX_DEPTH) throw new Error("invalid-tool-input-contract:" + path + ":schema-too-deep");
  const entries = dataEntries(raw, path);
  const n = raw as Record<string, unknown>;
  const type = n.type;
  if (typeof type !== "string" || !TYPES.has(type as ToolInputType)) throw new Error("invalid-tool-input-contract:" + path + ":unsupported-type");
  const allowed = new Set(["type", "description", "enum"]);
  if (type === "string") ["minLength", "maxLength", "pattern"].forEach(k => allowed.add(k));
  if (type === "number" || type === "integer") ["minimum", "maximum"].forEach(k => allowed.add(k));
  if (type === "array") ["items", "minItems", "maxItems", "uniqueItems"].forEach(k => allowed.add(k));
  if (type === "object") ["properties", "required", "additionalProperties", "maxProperties"].forEach(k => allowed.add(k));
  if (root) allowed.add("maxSerializedBytes");
  for (const [key] of entries) if (!allowed.has(key)) throw new Error("invalid-tool-input-contract:" + path + ":unsupported-keyword");
  if (root && type !== "object") throw new Error("invalid-tool-input-contract:$:root-must-be-object");
  if (n.description !== undefined && (typeof n.description !== "string" || n.description.length > 512)) throw new Error("invalid-tool-input-contract:" + path + ":invalid-description");

  if (n.enum !== undefined) {
    const enumValues = safeArrayValues(n.enum, path + ".enum", 64);
    if (enumValues.length === 0) throw new Error("invalid-tool-input-contract:" + path + ":invalid-enum");
    for (const v of enumValues) if (!matches(v, type as ToolInputType) || !(v === null || ["string", "number", "boolean"].includes(typeof v))) throw new Error("invalid-tool-input-contract:" + path + ":enum-type-mismatch");
  }
  if (type === "string") {
    if (n.minLength !== undefined) intBound(n.minLength, path + ".minLength", 0, 16_384);
    if (n.maxLength !== undefined) intBound(n.maxLength, path + ".maxLength", 0, 16_384);
    if (n.minLength !== undefined && n.maxLength !== undefined && Number(n.minLength) > Number(n.maxLength)) throw new Error("invalid-tool-input-contract:" + path + ":length-range-inverted");
    if (n.pattern !== undefined) {
      if (typeof n.pattern !== "string" || n.pattern.length > 256) throw new Error("invalid-tool-input-contract:" + path + ":invalid-pattern");
      try { new RegExp(n.pattern, "u"); } catch { throw new Error("invalid-tool-input-contract:" + path + ":invalid-pattern"); }
    }
  }
  if (type === "number" || type === "integer") {
    if (n.minimum !== undefined) finiteBound(n.minimum, path + ".minimum");
    if (n.maximum !== undefined) finiteBound(n.maximum, path + ".maximum");
    if (n.minimum !== undefined && n.maximum !== undefined && Number(n.minimum) > Number(n.maximum)) throw new Error("invalid-tool-input-contract:" + path + ":numeric-range-inverted");
  }
  if (type === "array") {
    if (n.items === undefined) throw new Error("invalid-tool-input-contract:" + path + ":array-items-required");
    if (n.minItems !== undefined) intBound(n.minItems, path + ".minItems", 0, MAX_ITEMS);
    if (n.maxItems !== undefined) intBound(n.maxItems, path + ".maxItems", 0, MAX_ITEMS);
    if (n.minItems !== undefined && n.maxItems !== undefined && Number(n.minItems) > Number(n.maxItems)) throw new Error("invalid-tool-input-contract:" + path + ":item-range-inverted");
    if (n.uniqueItems !== undefined && typeof n.uniqueItems !== "boolean") throw new Error("invalid-tool-input-contract:" + path + ":invalid-unique-items");
    assertNode(n.items, depth + 1, path + ".items", false);
  }
  if (type === "object") {
    const props = dataEntries(n.properties === undefined ? {} : n.properties, path + ".properties");
    if (props.length > MAX_SCHEMA_KEYS) throw new Error("invalid-tool-input-contract:" + path + ":too-many-properties");
    const names = new Set(props.map(([key]) => key));
    for (const [key, child] of props) {
      if (!key || key.length > 128 || DANGEROUS.has(key)) throw new Error("invalid-tool-input-contract:" + path + ":invalid-property-name");
      assertNode(child, depth + 1, path + ".properties." + key, false);
    }
    if (n.required !== undefined) {
      const requiredValues = safeArrayValues(n.required, path + ".required", MAX_SCHEMA_KEYS);
      const seen = new Set<string>();
      for (const key of requiredValues) {
        if (typeof key !== "string" || !names.has(key) || seen.has(key)) throw new Error("invalid-tool-input-contract:" + path + ":invalid-required-property");
        seen.add(key);
      }
    }
    if (n.additionalProperties !== undefined && typeof n.additionalProperties !== "boolean") throw new Error("invalid-tool-input-contract:" + path + ":invalid-additional-properties");
    if (n.maxProperties !== undefined) intBound(n.maxProperties, path + ".maxProperties", 0, MAX_SCHEMA_KEYS);
  }
  if (root && n.maxSerializedBytes !== undefined) intBound(n.maxSerializedBytes, path + ".maxSerializedBytes", 1, MAX_BYTES);
}

export function assertToolInputContract(contract: unknown): asserts contract is ToolInputContract {
  try { assertNode(contract, 0, "$", true); }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("invalid-tool-input-contract:")) throw error;
    throw new Error("invalid-tool-input-contract:$:uninspectable-schema");
  }
}
export function cloneFrozenToolInputContract(contract: ToolInputContract): ToolInputContract {
  assertToolInputContract(contract);
  const copy = structuredClone(contract);
  const freeze = (value: unknown): void => {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
    for (const key of Reflect.ownKeys(value)) {
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (d && "value" in d) freeze(d.value);
    }
    Object.freeze(value);
  };
  freeze(copy);
  return copy;
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (plain(value)) return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
function inspect(value: unknown, path: string, depth: number, active: WeakSet<object>, issues: ToolInputContractIssue[]): void {
  const add = (code: string) => { if (issues.length < MAX_ISSUES) issues.push({ path: path.slice(0, 220), code }); };
  if (depth > MAX_DEPTH) { add("maximum-depth"); return; }
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") { if (Array.from(value).length > 16_384) add("string-too-long"); return; }
  if (typeof value === "number") { if (!Number.isFinite(value)) add("number-not-finite"); return; }
  if (typeof value !== "object") { add("non-json-value"); return; }
  if (active.has(value)) { add("cyclic-value"); return; }
  active.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || value.length > MAX_ITEMS) { add("invalid-array"); return; }
      for (const key of Reflect.ownKeys(value)) if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) add("array-extra-property");
      for (let i = 0; i < value.length && issues.length < MAX_ISSUES; i++) {
        const d = Object.getOwnPropertyDescriptor(value, String(i));
        if (!d || !("value" in d) || d.get || d.set || !d.enumerable) issues.push({ path: (path + "[" + i + "]").slice(0, 220), code: "unsafe-array-item" });
        else inspect(d.value, path + "[" + i + "]", depth + 1, active, issues);
      }
      return;
    }
    if (!plain(value)) { add("expected-plain-object"); return; }
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_KEYS) add("too-many-properties");
    for (const key of keys) {
      if (typeof key !== "string" || DANGEROUS.has(key)) { add("unsafe-property-name"); continue; }
      const d = Object.getOwnPropertyDescriptor(value, key);
      if (!d || !("value" in d) || d.get || d.set || !d.enumerable) issues.push({ path: (path + "." + key).slice(0, 220), code: "accessor-or-hidden-property" });
      else inspect(d.value, path + "." + key, depth + 1, active, issues);
    }
  } finally { active.delete(value); }
}
export function validateToolInputContract(input: unknown, contract: ToolInputContract): ToolInputContractResult {
  const issues: ToolInputContractIssue[] = [];
  const add = (path: string, code: string) => { if (issues.length < MAX_ISSUES) issues.push({ path: path.slice(0, 220), code }); };
  const active = new WeakSet<object>();
  const visit = (value: unknown, node: ToolInputNodeContract, path: string, depth: number): void => {
    if (issues.length >= MAX_ISSUES) return;
    if (depth > MAX_DEPTH) { add(path, "maximum-depth"); return; }
    if (!matches(value, node.type)) { add(path, "type-mismatch"); return; }
    if (node.enum && !node.enum.some(candidate => Object.is(candidate, value))) { add(path, "enum-mismatch"); return; }
    if (node.type === "string") {
      const length = Array.from(value as string).length;
      if (node.minLength !== undefined && length < node.minLength) add(path, "string-too-short");
      if (node.maxLength !== undefined && length > node.maxLength) add(path, "string-too-long");
      if (node.pattern !== undefined && !new RegExp(node.pattern, "u").test(value as string)) add(path, "pattern-mismatch");
      return;
    }
    if (node.type === "number" || node.type === "integer") {
      const number = value as number;
      if (node.minimum !== undefined && number < node.minimum) add(path, "number-too-small");
      if (node.maximum !== undefined && number > node.maximum) add(path, "number-too-large");
      return;
    }
    if (node.type === "null" || node.type === "boolean") return;
    if (typeof value !== "object" || value === null) { add(path, "invalid-container"); return; }
    if (active.has(value)) { add(path, "cyclic-value"); return; }
    active.add(value);
    try {
      if (node.type === "array") {
        const arr = value as unknown[];
        if (arr.length < (node.minItems ?? 0)) add(path, "too-few-items");
        if (arr.length > (node.maxItems ?? MAX_ITEMS)) add(path, "too-many-items");
        const seen = new Set<string>();
        for (let i = 0; i < arr.length && issues.length < MAX_ISSUES; i++) {
          const d = Object.getOwnPropertyDescriptor(arr, String(i));
          if (!d || !("value" in d)) { add(path + "[" + i + "]", "unsafe-array-item"); continue; }
          visit(d.value, node.items as ToolInputNodeContract, path + "[" + i + "]", depth + 1);
          if (node.uniqueItems) {
            const signature = stable(d.value);
            if (seen.has(signature)) add(path + "[" + i + "]", "duplicate-item");
            seen.add(signature);
          }
        }
        return;
      }
      const record = value as Record<string, unknown>;
      const props = node.properties ?? {};
      const allowed = new Set(Object.keys(props));
      const keys = Reflect.ownKeys(record);
      if (keys.length > (node.maxProperties ?? MAX_KEYS)) add(path, "too-many-properties");
      for (const key of keys) {
        if (typeof key !== "string" || DANGEROUS.has(key)) { add(path, "unsafe-property-name"); continue; }
        const d = Object.getOwnPropertyDescriptor(record, key);
        if (!d || !("value" in d)) { add(path + "." + key, "accessor-or-hidden-property"); continue; }
        if (allowed.has(key)) visit(d.value, props[key], path + "." + key, depth + 1);
        else if (node.additionalProperties !== true) add(path + "." + key, "additional-property");
      }
      for (const key of node.required ?? []) if (!Object.prototype.hasOwnProperty.call(record, key)) add(path + "." + key, "required-property-missing");
    } finally { active.delete(value); }
  };
  try {
    assertToolInputContract(contract);
    inspect(input, "$", 0, new WeakSet<object>(), issues);
    if (issues.length) return { valid: false, issues };
    visit(input, contract, "$", 0);
    if (issues.length) return { valid: false, issues };
    const json = JSON.stringify(input);
    if (json === undefined) return { valid: false, issues: [{ path: "$", code: "not-json-serializable" }] };
    const serializedBytes = new TextEncoder().encode(json).byteLength;
    if (serializedBytes > (contract.maxSerializedBytes ?? DEFAULT_BYTES)) return { valid: false, issues: [{ path: "$", code: "payload-too-large" }], serializedBytes };
    return { valid: true, issues: [], serializedBytes };
  } catch { return { valid: false, issues: [{ path: "$", code: "input-not-inspectable" }] }; }
}


/** Output payloads share the same bounded JSON-object contract subset. */
export type ToolOutputContract = ToolInputContract;
export function cloneFrozenToolOutputContract(contract: ToolOutputContract): ToolOutputContract {
  return cloneFrozenToolInputContract(contract);
}
export function validateToolOutputContract(output: unknown, contract: ToolOutputContract): ToolInputContractResult {
  return validateToolInputContract(output, contract);
}

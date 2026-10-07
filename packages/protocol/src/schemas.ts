// Valibot-схемы графа (общие с форматами файлов, src/model) и сообщений протокола (research R5)
import * as v from 'valibot';
import type { JsonValue } from '@dagflow/engine';

export const JsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.null(),
    v.boolean(),
    v.number(),
    v.string(),
    v.array(JsonValueSchema),
    v.record(v.string(), JsonValueSchema),
  ]),
);

export const PortTypeSchema = v.picklist(['number', 'text', 'boolean', 'array', 'object', 'any']);

export const PortDefSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  type: PortTypeSchema,
  required: v.optional(v.boolean()),
  default: v.optional(JsonValueSchema),
});

const PositionSchema = v.object({ x: v.number(), y: v.number() });
const PortRefSchema = v.object({ node: v.string(), port: v.string() });

export const GraphSchema = v.object({
  nodes: v.array(
    v.object({
      id: v.pipe(v.string(), v.minLength(1)),
      type: v.pipe(v.string(), v.minLength(1)),
      // Имя экземпляра обязательно (фича 002, contracts/file-formats.md): файлы без имён некорректны
      name: v.pipe(v.string(), v.trim(), v.minLength(1)),
      position: PositionSchema,
      values: v.record(v.string(), JsonValueSchema),
      ports: v.optional(v.array(PortDefSchema)),
    }),
  ),
  edges: v.array(
    v.object({
      id: v.pipe(v.string(), v.minLength(1)),
      source: PortRefSchema,
      target: PortRefSchema,
    }),
  ),
});

export const NameSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

export const CompositeSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: NameSchema,
  description: v.string(),
  graph: GraphSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
});

const ValuesSchema = v.record(v.string(), JsonValueSchema);

export const NodeStateSchema = v.object({
  status: v.picklist(['ok', 'computing', 'waiting', 'error', 'blocked']),
  inputs: ValuesSchema,
  outputs: ValuesSchema,
  message: v.optional(v.string()),
});

const DocSchema = v.pipe(v.string(), v.minLength(1));
const RevSchema = v.pipe(v.number(), v.integer(), v.minValue(1));
const VersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export const ClientMessageSchema = v.variant('type', [
  v.object({ type: v.literal('hello'), protocol: VersionSchema, engine: v.string() }),
  v.object({ type: v.literal('library'), composites: v.array(CompositeSchema) }),
  v.object({ type: v.literal('open'), doc: DocSchema, rev: RevSchema, graph: GraphSchema }),
  v.object({ type: v.literal('update'), doc: DocSchema, rev: RevSchema, graph: GraphSchema }),
  v.object({ type: v.literal('close'), doc: DocSchema }),
]);

export const ErrorCodeSchema = v.picklist([
  'version-mismatch',
  'invalid-message',
  'not-ready',
  'unknown-doc',
  'too-large',
  'internal',
]);

export const HostMessageSchema = v.variant('type', [
  v.object({ type: v.literal('welcome'), protocol: VersionSchema, engine: v.string() }),
  v.object({
    type: v.literal('pending'),
    doc: DocSchema,
    rev: RevSchema,
    nodes: v.array(v.string()),
  }),
  v.object({
    type: v.literal('states'),
    doc: DocSchema,
    rev: RevSchema,
    states: v.record(v.string(), NodeStateSchema),
  }),
  v.object({
    type: v.literal('error'),
    code: ErrorCodeSchema,
    doc: v.optional(DocSchema),
    detail: v.optional(v.string()),
  }),
]);

/** Краткое описание ошибки схемы для поля detail: путь и ожидание. */
export function describeIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  const first = issues[0];
  if (!first) return 'Invalid message';
  const path = v.getDotPath(first);
  return path ? `${path}: ${first.message}` : first.message;
}

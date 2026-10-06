// Valibot-схемы файлов (contracts/file-formats.md) с ограничениями data-model
import * as v from 'valibot';
import type { JsonValue } from '../engine';

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

const PortTypeSchema = v.picklist(['number', 'text', 'boolean', 'array', 'object', 'any']);

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

const NameSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const VersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export const WorkflowSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: NameSchema,
  graph: GraphSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const CompositeSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: NameSchema,
  description: v.string(),
  graph: GraphSchema,
  createdAt: v.string(),
  updatedAt: v.string(),
});

const TabSchema = v.object({
  id: v.string(),
  kind: v.picklist(['workflow', 'composite']),
  targetId: v.string(),
  viewport: v.object({ x: v.number(), y: v.number(), zoom: v.number() }),
});

export const WorkspaceSchema = v.object({
  workflowOrder: v.array(v.string()),
  tabs: v.array(TabSchema),
  activeTabId: v.nullable(v.string()),
});

const header = <F extends string>(format: F) => ({
  format: v.literal(format),
  version: VersionSchema,
});

export const WorkflowFileSchema = v.object({
  ...header('dagflow-workflow'),
  ...WorkflowSchema.entries,
});
export const CompositeFileSchema = v.object({
  ...header('dagflow-composite'),
  ...CompositeSchema.entries,
});
export const WorkspaceFileSchema = v.object({
  ...header('dagflow-workspace'),
  ...WorkspaceSchema.entries,
});
export const ExportFileSchema = v.object({
  ...header('dagflow-export'),
  exportedAt: v.string(),
  workflow: WorkflowSchema,
  composites: v.array(CompositeSchema),
});

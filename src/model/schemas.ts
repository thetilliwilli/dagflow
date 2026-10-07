// Valibot-схемы файлов (contracts/file-formats.md) с ограничениями data-model
import * as v from 'valibot';
import { CompositeSchema, GraphSchema, NameSchema } from '@dagflow/protocol';

// Схемы графа и составного нода — общие с протоколом (@dagflow/protocol, research R5 фичи 004)
export { CompositeSchema, GraphSchema, JsonValueSchema, PortDefSchema } from '@dagflow/protocol';

const VersionSchema = v.pipe(v.number(), v.integer(), v.minValue(1));

export const WorkflowSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  name: NameSchema,
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

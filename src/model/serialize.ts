// Файлы ↔ объекты модели (contracts/file-formats.md)
import * as v from 'valibot';
import { compositeDependencies, compositeIdOf, type CompositeDef, type Workflow, type Workspace } from '../engine';
import { CompositeFileSchema, ExportFileSchema, WorkflowFileSchema, WorkspaceFileSchema } from './schemas';

export const FORMAT_VERSION = 1;

export class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatError';
  }
}

export type WorkflowFile = v.InferOutput<typeof WorkflowFileSchema>;
export type CompositeFile = v.InferOutput<typeof CompositeFileSchema>;
export type WorkspaceFile = v.InferOutput<typeof WorkspaceFileSchema>;
export type ExportFile = v.InferOutput<typeof ExportFileSchema>;

/** Человекочитаемый JSON: отступ 2 пробела, перевод строки в конце (принцип III). */
export function toJsonText(data: unknown): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Путь к первому полю с ошибкой, например `workflow.graph.nodes`. */
export function issuePath(issues: v.BaseIssue<unknown>[]): string {
  const issue = issues[0];
  return (issue && v.getDotPath(issue)) || '(корень)';
}

function parse<S extends v.GenericSchema>(schema: S, data: unknown, what: string): v.InferOutput<S> {
  const r = v.safeParse(schema, data);
  if (!r.success) throw new FormatError(`Некорректный файл ${what}: ${issuePath(r.issues)}`);
  return r.output;
}

function strip<T extends { format: string; version: number }>(file: T): Omit<T, 'format' | 'version'> {
  const { format: _f, version: _v, ...rest } = file;
  return rest;
}

export function workflowToFile(wf: Workflow): WorkflowFile {
  return { format: 'dagflow-workflow', version: FORMAT_VERSION, ...wf };
}

export function fileToWorkflow(data: unknown): Workflow {
  return strip(parse(WorkflowFileSchema, data, 'workflow'));
}

export function compositeToFile(def: CompositeDef): CompositeFile {
  return { format: 'dagflow-composite', version: FORMAT_VERSION, ...def };
}

export function fileToComposite(data: unknown): CompositeDef {
  return strip(parse(CompositeFileSchema, data, 'составного нода'));
}

export function workspaceToFile(ws: Workspace): WorkspaceFile {
  return { format: 'dagflow-workspace', version: FORMAT_VERSION, ...ws };
}

export function fileToWorkspace(data: unknown): Workspace {
  return strip(parse(WorkspaceFileSchema, data, 'workspace'));
}

/** Файл выгрузки: workflow + транзитивно используемые им определения составных нодов (FR-029). */
export function buildExport(workflow: Workflow, composites: CompositeDef[], exportedAt: string): ExportFile {
  const deps = compositeDependencies(composites);
  const used = new Set<string>();
  for (const n of workflow.graph.nodes) {
    const id = compositeIdOf(n.type);
    if (id === null) continue;
    used.add(id);
    for (const d of deps.get(id) ?? []) used.add(d);
  }
  return { format: 'dagflow-export', version: FORMAT_VERSION, exportedAt, workflow, composites: composites.filter((c) => used.has(c.id)) };
}

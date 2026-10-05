// Импорт файла выгрузки: шаги 1–6 алгоритма из contracts/file-formats.md.
// Шаги 1–4 только проверяют; результат применяет вызывающий код (FR-030).
import * as v from 'valibot';
import { createRegistry, validateGraph, type CompositeDef, type Graph, type Workflow } from '../engine';
import { ExportFileSchema } from './schemas';
import { FORMAT_VERSION, issuePath } from './serialize';

export interface ImportContext {
  workflows: Record<string, Workflow>;
  composites: Record<string, CompositeDef>;
  newId: () => string;
  now: () => string;
}

export type ImportResult =
  | { ok: true; workflow: Workflow; composites: CompositeDef[]; notices: string[] }
  | { ok: false; message: string };

export const importMessages = {
  invalidJson: 'Файл не является корректным JSON',
  unknownFormat: 'Неизвестный формат файла',
  newerVersion: 'Файл создан более новой версией редактора',
  schema: (path: string) => `Файл не похож на выгрузку workflow: ${path}`,
  unknownTypes: (types: string[]) => `В файле есть неизвестные типы нодов: ${types.join(', ')}`,
  invalidGraph: (reason: string) => `Граф в файле некорректен: ${reason}`,
};

/** Слияние определений составных нодов (FR-029a). В US3 — только разрешение конфликтов id. */
export function mergeComposites(
  incoming: CompositeDef[],
  existing: Record<string, CompositeDef>,
  newId: () => string,
): { added: CompositeDef[]; idMap: Map<string, string>; notices: string[] } {
  const idMap = new Map<string, string>();
  const added: CompositeDef[] = [];
  for (const def of incoming) {
    const id = existing[def.id] ? newId() : def.id;
    idMap.set(def.id, id);
    added.push({ ...def, id });
  }
  return {
    added: added.map((d) => ({ ...d, graph: rewriteCompositeRefs(d.graph, idMap) })),
    idMap,
    notices: [],
  };
}

/** Переписывает ссылки `composite:<id>` по таблице соответствия. */
export function rewriteCompositeRefs(graph: Graph, idMap: Map<string, string>): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map((n) => {
      if (!n.type.startsWith('composite:')) return n;
      const mapped = idMap.get(n.type.slice('composite:'.length));
      return mapped ? { ...n, type: `composite:${mapped}` } : n;
    }),
  };
}

export function importExport(text: string, ctx: ImportContext): ImportResult {
  // 1. JSON
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: importMessages.invalidJson };
  }
  // 3 (раньше схемы, чтобы чужой файл получил понятное сообщение). Формат и версия
  const header = data as { format?: unknown; version?: unknown } | null;
  if (typeof header !== 'object' || header === null || Array.isArray(header) || header.format !== 'dagflow-export') {
    return { ok: false, message: importMessages.unknownFormat };
  }
  if (typeof header.version === 'number' && header.version > FORMAT_VERSION) {
    return { ok: false, message: importMessages.newerVersion };
  }
  // 2. Схема
  const parsed = v.safeParse(ExportFileSchema, data);
  if (!parsed.success) return { ok: false, message: importMessages.schema(issuePath(parsed.issues)) };
  const file = parsed.output;

  // 4. Семантика
  const registry = createRegistry([...Object.values(ctx.composites), ...file.composites]);
  const graphs = [file.workflow.graph, ...file.composites.map((c) => c.graph)];
  const unknown = new Set<string>();
  for (const g of graphs) for (const n of g.nodes) if (!registry.get(n.type) && !n.type.startsWith('builtin:input') && !n.type.startsWith('builtin:output')) unknown.add(n.type);
  if (unknown.size > 0) return { ok: false, message: importMessages.unknownTypes([...unknown]) };
  const problems = [
    ...validateGraph(file.workflow.graph, registry),
    ...file.composites.flatMap((c) => validateGraph(c.graph, registry, { insideComposite: true })),
  ];
  if (problems.length > 0) return { ok: false, message: importMessages.invalidGraph(problems[0]!.message) };

  // 5. Составные ноды
  const merged = mergeComposites(file.composites, ctx.composites, ctx.newId);

  // 6. Новый id workflow
  const workflow: Workflow = {
    ...file.workflow,
    id: ctx.newId(),
    graph: rewriteCompositeRefs(file.workflow.graph, merged.idMap),
  };
  return { ok: true, workflow, composites: merged.added, notices: merged.notices };
}

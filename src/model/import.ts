// Импорт файла выгрузки: шаги 1–6 алгоритма из contracts/file-formats.md.
// Шаги 1–4 только проверяют; результат применяет вызывающий код (FR-030).
import * as v from 'valibot';
import {
  compositeDependencies,
  createRegistry,
  validateGraph,
  type CompositeDef,
  type Graph,
  type Workflow,
} from '../engine';
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
  invalidJson: 'The file is not valid JSON.',
  unknownFormat: 'Unknown file format.',
  newerVersion: 'The file was created by a newer version of the editor.',
  schema: (path: string) => `The file does not look like a workflow export: ${path}.`,
  unknownTypes: (types: string[]) => `The file contains unknown node types: ${types.join(', ')}.`,
  invalidGraph: (reason: string) => `The graph in the file is invalid: ${reason}`,
  recursion: (name: string) =>
    `Composite node “${name}” in the file contains itself; a composite node cannot be inside itself (directly or through others).`,
  compositeRenamed: (name: string, renamed: string) =>
    `Composite node “${name}” already exists in the palette with different content — added as “${renamed}”.`,
};

/** JSON с отсортированными ключами — для сравнения содержимого определений. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : v,
  );
}

const contentOf = (d: CompositeDef) =>
  canonicalJson({ name: d.name, description: d.description, graph: d.graph });

/** Порядок «зависимости раньше зависящих» среди входящих определений. */
function dependencyOrder(defs: CompositeDef[]): CompositeDef[] {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const done = new Set<string>();
  const result: CompositeDef[] = [];
  const visit = (d: CompositeDef, stack: Set<string>) => {
    if (done.has(d.id) || stack.has(d.id)) return;
    stack.add(d.id);
    for (const n of d.graph.nodes) {
      const dep = n.type.startsWith('composite:')
        ? byId.get(n.type.slice('composite:'.length))
        : undefined;
      if (dep) visit(dep, stack);
    }
    done.add(d.id);
    result.push(d);
  };
  for (const d of defs) visit(d, new Set());
  return result;
}

/**
 * Слияние определений составных нодов (FR-029a):
 * то же содержимое — переиспользовать; то же имя, другое содержимое — копия «<имя> (N)»;
 * занятый id — новый id. Существующие определения никогда не изменяются.
 */
export function mergeComposites(
  incoming: CompositeDef[],
  existing: Record<string, CompositeDef>,
  newId: () => string,
): { added: CompositeDef[]; idMap: Map<string, string>; notices: string[] } {
  const idMap = new Map<string, string>();
  const added: CompositeDef[] = [];
  const notices: string[] = [];
  const known = () => [...Object.values(existing), ...added];
  for (const def of dependencyOrder(incoming)) {
    const candidate: CompositeDef = { ...def, graph: rewriteCompositeRefs(def.graph, idMap) };
    const same = known().find((k) => contentOf(k) === contentOf(candidate));
    if (same) {
      idMap.set(def.id, same.id);
      continue;
    }
    const names = new Set(known().map((k) => k.name));
    let name = candidate.name;
    if (names.has(name)) {
      let n = 2;
      while (names.has(`${candidate.name} (${n})`)) n += 1;
      name = `${candidate.name} (${n})`;
      notices.push(importMessages.compositeRenamed(candidate.name, name));
    }
    const taken = existing[def.id] || added.some((a) => a.id === def.id);
    const id = taken ? newId() : def.id;
    idMap.set(def.id, id);
    added.push({ ...candidate, id, name });
  }
  // Ссылки на определения, получившие новый id позже, тоже переписываем
  return {
    added: added.map((d) => ({ ...d, graph: rewriteCompositeRefs(d.graph, idMap) })),
    idMap,
    notices,
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
  if (
    typeof header !== 'object' ||
    header === null ||
    Array.isArray(header) ||
    header.format !== 'dagflow-export'
  ) {
    return { ok: false, message: importMessages.unknownFormat };
  }
  if (typeof header.version === 'number' && header.version > FORMAT_VERSION) {
    return { ok: false, message: importMessages.newerVersion };
  }
  // 2. Схема
  const parsed = v.safeParse(ExportFileSchema, data);
  if (!parsed.success)
    return { ok: false, message: importMessages.schema(issuePath(parsed.issues)) };
  const file = parsed.output;

  // 4. Семантика
  const registry = createRegistry([...Object.values(ctx.composites), ...file.composites]);
  const graphs = [file.workflow.graph, ...file.composites.map((c) => c.graph)];
  const unknown = new Set<string>();
  for (const g of graphs) for (const n of g.nodes) if (!registry.get(n.type)) unknown.add(n.type);
  if (unknown.size > 0) return { ok: false, message: importMessages.unknownTypes([...unknown]) };
  const problems = [
    ...validateGraph(file.workflow.graph, registry),
    ...file.composites.flatMap((c) => validateGraph(c.graph, registry, { insideComposite: true })),
  ];
  if (problems.length > 0)
    return { ok: false, message: importMessages.invalidGraph(problems[0]!.message) };
  const deps = compositeDependencies(file.composites);
  const recursive = file.composites.find((c) => deps.get(c.id)?.has(c.id));
  if (recursive) return { ok: false, message: importMessages.recursion(recursive.name) };

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

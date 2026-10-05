// Хранение: загрузка при старте, восстановление доступа, смена хранилища и слияние, сбой папки (FR-028…028d)
import type { CompositeDef, Workflow } from '../engine';
import { createAutosave, workspaceOf } from '../storage/autosave';
import { DirectoryStorage, type LoadedData } from '../storage/directory-storage';
import {
  browserEnv,
  browserStorageHandle,
  detectLocation,
  pickFolder,
  restoreAccess as requestAccess,
  type LocationEnv,
  type StorageLocation,
} from '../storage/location';
import { mergeComposites, rewriteCompositeRefs } from '../model/import';
import { storageMessages } from '../ui/messages';
import { freshWorkspace, type AppState, type AppStore } from './store';

export interface PersistenceOptions {
  autosaveDelay?: number;
  events?: EventTarget;
}

/** Сравнение содержимого workflow (имя и граф) — для поиска разошедшихся версий. */
function sameContent(a: Workflow, b: Workflow): boolean {
  return JSON.stringify([a.name, a.graph]) === JSON.stringify([b.name, b.graph]);
}

/** Какие workflow текущего хранилища предложить добавить в папку с данными (FR-028c). */
export function planMerge(
  current: Workflow[],
  target: Workflow[],
): { add: Workflow[]; copies: Workflow[] } {
  const byId = new Map(target.map((w) => [w.id, w]));
  const add: Workflow[] = [];
  const copies: Workflow[] = [];
  for (const wf of current) {
    const other = byId.get(wf.id);
    if (!other) add.push(wf);
    else if (!sameContent(wf, other)) copies.push(wf);
  }
  return { add, copies };
}

export function createPersistence(
  app: AppStore,
  env: LocationEnv = browserEnv(),
  opts: PersistenceOptions = {},
) {
  const { store, deps } = app;
  let storage: DirectoryStorage | null = null;
  let pendingHandle: FileSystemDirectoryHandle | null = null;
  let pendingTarget: DirectoryStorage | null = null;
  /** Составные ноды прежнего хранилища — для слияния при добавлении workflow в папку. */
  let pendingCompositeSource: CompositeDef[] = [];
  let fallback: Promise<void> = Promise.resolve();

  const autosave = createAutosave(store, () => storage, {
    delay: opts.autosaveDelay,
    events: opts.events,
    onError: (e) => {
      fallback = fallback.then(() => onWriteError(e));
    },
  });

  function setLocation(location: StorageLocation) {
    store.setState({ storageLocation: location });
  }

  function notify(kind: 'info' | 'warning' | 'error', text: string) {
    store.setState((d: AppState) => {
      d.notifications.push({ id: deps.newId(), kind, text });
    });
  }

  const reasonOf = (e: unknown) => (e instanceof Error ? e.message || e.name : String(e));

  /** Ошибка операции хранения — понятное уведомление вместо молчаливого сбоя (принцип IV). */
  async function guard(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      notify('error', storageMessages.operationFailed(reasonOf(e)));
    }
  }

  function currentData() {
    const s = store.getState();
    return {
      workspace: workspaceOf(s),
      workflows: Object.values(s.workflows),
      composites: Object.values(s.composites),
    };
  }

  /** Заменить состояние стора загруженными данными. */
  function applyLoaded(data: LoadedData) {
    if (data.workflows.length === 0 && !data.workspace) {
      store.setState((d: AppState) => {
        Object.assign(d, freshWorkspace(deps));
        d.composites = {};
        d.nodeStates = {};
        d.history = {};
        d.unavailable = data.unavailable;
      });
      autosave.markAllDirty();
      return;
    }
    const workflows = Object.fromEntries(data.workflows.map((w) => [w.id, w]));
    const composites = Object.fromEntries(data.composites.map((c) => [c.id, c]));
    const ws = data.workspace;
    const order = (ws?.workflowOrder ?? []).filter((id) => workflows[id]);
    for (const w of data.workflows) if (!order.includes(w.id)) order.push(w.id);
    const tabs = (ws?.tabs ?? []).filter((t) =>
      t.kind === 'workflow' ? workflows[t.targetId] : composites[t.targetId],
    );
    const activeTabId = tabs.some((t) => t.id === ws?.activeTabId)
      ? ws!.activeTabId
      : (tabs[0]?.id ?? null);
    store.setState((d: AppState) => {
      d.workflows = workflows;
      d.composites = composites;
      d.workflowOrder = order;
      d.tabs = tabs;
      d.activeTabId = activeTabId;
      d.nodeStates = {};
      d.history = {};
      d.unavailable = data.unavailable;
    });
    autosave.resetBaseline();
  }

  const browserStorage = async () =>
    new DirectoryStorage(await browserStorageHandle(env), env.opfsFallbackWrite);

  async function use(target: DirectoryStorage, location: StorageLocation) {
    pendingHandle = null;
    storage = target;
    setLocation(location);
    applyLoaded(await target.loadAll());
  }

  async function onWriteError(e: unknown) {
    const location = store.getState().storageLocation;
    if (location?.kind !== 'folder') {
      notify('error', storageMessages.saveFailed((e as Error).message));
      return;
    }
    // Папка стала недоступна: продолжаем в браузере, ничего не теряя
    const browser = await browserStorage();
    await browser.saveAll(currentData());
    storage = browser;
    setLocation({ kind: 'browser' });
    autosave.resetBaseline();
    notify('warning', storageMessages.folderLost(location.name));
  }

  let started: Promise<void> | null = null;

  async function doStart() {
    store.setState({ folderSupported: !!env.showDirectoryPicker });
    const detected = await detectLocation(env);
    if (detected.location.kind === 'folder-pending') {
      storage = null;
      pendingHandle = detected.handle;
      setLocation(detected.location);
      return;
    }
    const target =
      detected.location.kind === 'browser'
        ? new DirectoryStorage(detected.handle, env.opfsFallbackWrite)
        : new DirectoryStorage(detected.handle);
    await use(target, detected.location);
  }

  return {
    /** Определить хранилище и загрузить данные; повторные вызовы возвращают тот же результат. */
    start(): Promise<void> {
      started ??= doStart().catch((e: unknown) => {
        storage = null;
        setLocation({ kind: 'none', reason: reasonOf(e) });
        notify('error', storageMessages.unavailable(reasonOf(e)));
      });
      return started;
    },

    /** Кнопка «Восстановить доступ» (FR-028d). */
    async restoreAccess() {
      if (!pendingHandle) return;
      const handle = pendingHandle;
      await guard(async () => {
        if (await requestAccess(handle))
          await use(new DirectoryStorage(handle), { kind: 'folder', name: handle.name });
        else notify('warning', storageMessages.accessDenied(handle.name));
      });
    },

    /** Явное переключение на хранилище браузера. */
    async useBrowser() {
      await guard(async () => {
        await autosave.flush();
        await use(await browserStorage(), { kind: 'browser' });
      });
    },

    /** Выбор или смена рабочей папки (FR-028c). */
    chooseFolder: () =>
      guard(async () => {
        const handle = await pickFolder(env);
        if (!handle) return;
        await autosave.flush();
        const target = new DirectoryStorage(handle);
        if (!(await target.hasData())) {
          pendingTarget = target;
          store.setState({ storagePrompt: { kind: 'copy-to-empty', folderName: handle.name } });
          return;
        }
        const current = Object.values(store.getState().workflows);
        const data = await target.loadAll();
        const plan = planMerge(current, data.workflows);
        const currentComposites = Object.values(store.getState().composites);
        await use(target, { kind: 'folder', name: handle.name });
        pendingCompositeSource = currentComposites;
        if (plan.add.length > 0 || plan.copies.length > 0) {
          store.setState({
            storagePrompt: { kind: 'add-from-browser', folderName: handle.name, ...plan },
          });
        }
      }),

    confirmPrompt: () =>
      guard(async () => {
        const prompt = store.getState().storagePrompt;
        if (!prompt) return;
        store.setState({ storagePrompt: null });
        if (prompt.kind === 'copy-to-empty' && pendingTarget) {
          const target = pendingTarget;
          pendingTarget = null;
          await target.saveAll(currentData());
          storage = target;
          setLocation({ kind: 'folder', name: target.name });
          autosave.resetBaseline();
        } else if (prompt.kind === 'add-from-browser') {
          const merged = mergeComposites(
            pendingCompositeSource,
            store.getState().composites,
            deps.newId,
          );
          const fix = (wf: Workflow): Workflow => ({
            ...wf,
            graph: rewriteCompositeRefs(wf.graph, merged.idMap),
          });
          const copies = prompt.copies.map((wf) => ({
            ...fix(wf),
            id: deps.newId(),
            name: storageMessages.copyName(wf.name),
          }));
          store.setState((d: AppState) => {
            for (const c of merged.added) d.composites[c.id] = c;
            for (const wf of [...prompt.add.map(fix), ...copies]) {
              d.workflows[wf.id] = wf;
              d.workflowOrder.push(wf.id);
            }
          });
        }
      }),

    dismissPrompt: () =>
      guard(async () => {
        const prompt = store.getState().storagePrompt;
        store.setState({ storagePrompt: null });
        if (prompt?.kind === 'copy-to-empty' && pendingTarget) {
          const target = pendingTarget;
          pendingTarget = null;
          await use(target, { kind: 'folder', name: target.name }); // начать с чистого листа; данные браузера остаются в браузере
        }
      }),

    async flush() {
      await autosave.flush();
      await fallback;
    },

    stop() {
      autosave.stop();
    },
  };
}

export type Persistence = ReturnType<typeof createPersistence>;

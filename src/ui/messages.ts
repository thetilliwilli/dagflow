// Тексты интерфейса (принцип IV: все сообщения понятные; язык — английский, фича 003)
import { typeNames, type NodeStatus, type PortType } from '@dagflow/engine';

export const statusLabels: Record<NodeStatus, string> = {
  ok: 'computed',
  computing: 'computing',
  waiting: 'waiting for inputs',
  error: 'error',
  blocked: 'not computed: upstream problem',
};

/** Полные названия типов портов — те же, что в сообщениях движка. */
export const typeLabels: Record<PortType, string> = typeNames;

export const messages = {
  appTitle: 'DAG Flow',
  palette: 'Palette',
  paletteHint: 'Click a node or drag it onto the canvas.',
  showMore: 'show',
  showLess: 'hide',
  invalidJson: (reason: string) => `Invalid JSON: ${reason}`,
  valueTypeMismatch: (type: PortType) =>
    `The value does not match the port type “${typeLabels[type]}”.`,
  noValue: '—',
  closeNotification: 'Close notification',
  nodeNotFound: (id: string) => `Node “${id}” not found.`,
  invalidName: 'The name cannot be empty.',
  renderFailed: 'Could not display the tab. Your data is safe — try reloading the tab.',
  reloadTab: 'Reload tab',
  noOpenTab: 'No open tab.',
  compositeNotFound: 'Composite node not found.',
  ioNodeNotFound: 'Input/Output node not found.',
  portNotFound: (port: string) => `Port “${port}” not found.`,
  defaultWorkflowName: 'New workflow',
  copyName: (name: string) => `${name} (copy)`,
  /** Подсказка элемента палитры: порты с полными названиями типов. */
  portsSummary: (inputs: string, outputs: string) => `Inputs: ${inputs}. Outputs: ${outputs}.`,
};

export const storageMessages = {
  region: 'Storage',
  folder: (name: string) => `Folder: ${name}`,
  browser: 'Data is stored in the browser',
  loading: 'Loading…',
  chooseFolder: 'Choose working folder',
  changeFolder: 'Change folder',
  firstRunHint:
    'Choose a working folder on your disk — all your work will be saved there automatically.',
  browserReminder:
    'Data is stored in the browser. To move your work to another computer, export workflows to a file.',
  copyToEmpty: (folder: string) => `Folder “${folder}” is empty. Move your current data there?`,
  addFromBrowser: (folder: string, add: number, copies: number) =>
    `Folder “${folder}” already has data. ` +
    (add > 0 ? `Workflows from the previous storage that are not in the folder: ${add}. ` : '') +
    (copies > 0
      ? `Different versions (will be added as “(from browser)” copies): ${copies}. `
      : '') +
    'Add them to the folder?',
  move: 'Move',
  dontMove: 'Don’t move',
  add: 'Add',
  dontAdd: 'Don’t add',
  later: 'Later',
  accessTitle: 'Restore access to the working folder',
  accessText: (folder: string) =>
    `The browser asks you to confirm access to folder “${folder}” again.`,
  restoreAccess: 'Restore access',
  workInBrowser: 'Work in the browser',
  workInBrowserNote: 'The browser keeps a separate set of data; the folder data stays untouched.',
  folderLost: (folder: string) =>
    `Working folder “${folder}” is unavailable. Work continues and is saved in the browser.`,
  saveFailed: (reason: string) => `Could not save changes: ${reason}`,
  copyName: (name: string) => `${name} (from browser)`,
  none: 'Saving unavailable',
  unavailable: (reason: string) =>
    `Saving unavailable: the browser denied access to storage (${reason}). The editor works, but changes will be lost when you close it — export workflows to a file.`,
  unavailableBanner:
    'Saving unavailable: changes will be lost when you close the page. Export workflows to a file to keep your work.',
  operationFailed: (reason: string) => `Storage operation failed: ${reason}`,
  accessDenied: (folder: string) =>
    `Access not granted: the browser did not allow working with folder “${folder}”. Try again or work in the browser.`,
  gotIt: 'Got it',
};

export const workflowMessages = {
  list: 'Workflows',
  create: 'Create workflow',
  open: (name: string) => `Open “${name}”`,
  rename: (name: string) => `Rename “${name}”`,
  duplicate: (name: string) => `Duplicate “${name}”`,
  remove: (name: string) => `Delete “${name}”`,
  nameInput: 'Workflow name',
  confirmDeleteTitle: 'Delete workflow?',
  confirmDelete: (name: string) => `Workflow “${name}” will be deleted permanently.`,
  deleteButton: 'Delete',
  cancel: 'Cancel',
  unavailable: (id: string) => `Unavailable: ${id}`,
  closeTab: (name: string) => `Close tab “${name}”`,
  noTabs: 'Open a workflow from the list or create a new one',
  exportButton: 'Export to file',
  importLabel: 'Import from file',
  importErrorTitle: 'Could not load the file',
  close: 'Close',
};

export const compositeMessages = {
  collapse: 'Collapse into composite node',
  collapseTitle: 'Collapse into composite node',
  nameLabel: 'Composite node name',
  collapseButton: 'Collapse',
  renameTitle: 'Rename composite node',
  renameButton: 'Rename',
  open: (name: string) => `Open composite node “${name}”`,
  openButton: 'Open',
  expandButton: 'Expand',
  expand: (name: string) => `Expand “${name}”`,
  rename: (name: string) => `Rename composite node “${name}”`,
  remove: (name: string) => `Delete composite node “${name}”`,
  removeTitle: 'Delete composite node?',
  removeText: (name: string, usage: number) =>
    usage > 0
      ? `Instances in use: ${usage}. All instances of “${name}” will be removed with their links.`
      : `“${name}” will be removed from the palette.`,
  tabTitle: (name: string) => `Composite node: ${name}`,
  nameTaken: (name: string) => `Name “${name}” is already taken by another composite node`,
  edgesRemoved: (n: number) => `Composite node ports changed. Links removed: ${n}`,
  ports: 'Ports',
  addPort: 'Add port',
  portName: 'Port name',
  portType: 'Port type',
  removePort: (name: string) => `Remove port “${name}”`,
  defaultLabel: (port: string) => `Default: ${port}`,
  defaultHint:
    'Default value: used when an instance input is not connected or filled; inside the composite node tab — for debugging',
  defaultTypeMismatch: (port: string) =>
    `The default value of port “${port}” does not match its type`,
  unknownNode: 'Unknown node',
  unknownType: (type: string) =>
    `Type “${type}” not found: the composite node was deleted or its file is damaged. Delete the node or import the definition from a file.`,
};

export const historyMessages = {
  undo: 'Undo',
  redo: 'Redo',
  minimap: 'Graph minimap',
};

/** Плавающие окна (фича 002, contracts/ui-contract.md). */
export const windowMessages = {
  close: 'Close',
  menu: 'Menu',
  sidebar: 'Workflows & storage',
  sidebarAttention: 'Workflows & storage: there is a message about data storage',
  /** Ссылка на репозиторий проекта внизу левой панели (FR-004). */
  repoLink: 'github',
  repoUrl: 'https://github.com/thetilliwilli/dagflow',
  paletteCategories: 'Categories',
  noComposites:
    'No composite nodes yet: select nodes on the canvas and collapse them into a composite node.',
};

/** Окно свойств выделенного нода (US3, contracts/ui-contract.md). */
export const propertiesMessages = {
  title: 'Properties',
  inputs: 'Inputs',
  outputs: 'Outputs',
  noInputs: 'No inputs',
  noOutputs: 'No outputs',
  link: (port: string) => `Link “${port}”`,
  /** Откуда приходит значение подключённого входа. */
  source: (node: string, port: string) => `← ${node}.${port}`,
  /** Режим привязки по маркеру (FR-018a). */
  linkHint: 'Pick a node and a property to link',
  /** Временное окно нода при связывании (FR-018). */
  peekTitle: (node: string) => `Properties: ${node}`,
  /** Метка за курсором при перетаскивании параметра. */
  ghost: (port: string, type: string) => `${port} (${type})`,
  /** Поле переименования нода (FR-009). */
  nodeNameLabel: 'Node name',
};

/** Краткие обозначения типов портов в окне свойств (FR-013b). */
export const typeAbbr: Record<PortType, string> = {
  number: 'num',
  text: 'str',
  boolean: 'bool',
  array: 'arr',
  object: 'obj',
  any: 'any',
};

/** Линии связей и окно связей (US5, FR-023 – FR-025). */
export const edgeMessages = {
  more: (n: number) => `+${n} more`,
  windowTitle: (source: string, target: string) => `Links: ${source} → ${target}`,
  link: (out: string, input: string) => `${out}→${input}`,
  remove: (link: string) => `Delete link “${link}”`,
};

/** Цель вычисления: раздел «Engine», индикатор, ошибки подключения (фича 004, contracts/ui-texts.md). */
export const engineMessages = {
  section: 'Engine',
  localRow: 'This tab',
  workerRow: 'This browser',
  kindLocal: 'Local',
  kindWorker: 'Worker',
  kindServer: 'Server',
  addressPlaceholder: 'Server address, e.g. localhost:8080',
  connect: 'Connect',
  connecting: 'Connecting…',
  remove: (address: string) => `Remove ${address} from the list`,
  invalidAddress: 'Enter a server address, for example localhost:8080.',
  serverVersions: (server: string, editor: string) => `engine ${server} (editor ${editor})`,
  // Индикатор
  indicatorLocal: '● Local',
  indicatorWorker: '● Worker',
  indicatorServer: (address: string, engine: string, editor: string) =>
    `● Server · ${address} · engine ${engine}${engine === editor ? '' : ` (editor ${editor})`}`,
  notEncrypted: 'not encrypted',
  offline: (seconds: number) => `◌ Offline — retrying in ${seconds} s`,
  retryNow: 'Retry now',
  protocolDiffers: (server: number, editor: number) =>
    `Protocol version differs (server ${server}, editor ${editor})`,
  workerFailing: 'The background engine keeps failing.',
  useLocal: 'Use local engine',
  indicatorLabel: (state: string) => `Engine: ${state}. Open engine settings.`,
  // Ошибки пробной попытки (у поля или строки)
  couldNotConnect: (address: string) =>
    `Could not connect to ${address}. Check that the server is running and the address is correct.`,
  blocked: (address: string) =>
    `The browser blocks unencrypted connections from this page. The server at ${address} needs an encrypted (wss) address.`,
  protocolMismatch: (server: number, editor: number) =>
    `The server uses a different protocol version (server ${server}, editor ${editor}). Update the server or the editor.`,
  noWorker: 'This browser cannot run the engine in the background.',
  lnaDenied:
    'The browser blocks access to the local network for this page. Allow it in the site settings and try again.',
  lnaPrompt: 'Allow local network access in the browser prompt.',
  // Ноды, вкладки, уведомления
  staleValue: 'Last known value — engine offline',
  tooLarge: 'This workflow is too large for the server (limit: 8 MB).',
  processFailed: 'The engine could not process the workflow. Retrying.',
  workerRestarted: 'The engine restarted after a failure.',
};

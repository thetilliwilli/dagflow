// Тексты интерфейса (принцип IV: все сообщения — на русском и понятные)
import type { NodeStatus, PortType } from '../engine';

export const statusLabels: Record<NodeStatus, string> = {
  ok: 'вычислен',
  computing: 'вычисляется',
  waiting: 'ожидает входов',
  error: 'ошибка',
  blocked: 'не вычислен: проблема выше по графу',
};

export const typeLabels: Record<PortType, string> = {
  number: 'число',
  text: 'текст',
  boolean: 'логическое',
  array: 'массив',
  object: 'объект',
  any: 'любое',
};

export const messages = {
  appTitle: 'DAG Flow',
  palette: 'Палитра',
  paletteHint: 'Перетащите нод на холст или дважды щёлкните по нему',
  showMore: 'показать',
  showLess: 'свернуть',
  invalidJson: (reason: string) => `Некорректный JSON: ${reason}`,
  valueTypeMismatch: (type: PortType) => `Значение не подходит к типу порта «${typeLabels[type]}»`,
  connected: 'подключено',
  noValue: '—',
  closeNotification: 'Закрыть уведомление',
  invalidName: 'Имя должно содержать от 1 до 100 символов',
  renderFailed: 'Не удалось отобразить вкладку. Ваши данные не потеряны — попробуйте перезагрузить вкладку.',
  reloadTab: 'Перезагрузить вкладку',
};

export const storageMessages = {
  folder: (name: string) => `Папка: ${name}`,
  browser: 'Данные хранятся в браузере',
  loading: 'Загрузка…',
  chooseFolder: 'Выбрать рабочую папку',
  changeFolder: 'Сменить папку',
  firstRunHint: 'Выберите рабочую папку на диске — вся работа будет сохраняться в неё автоматически.',
  browserReminder: 'Данные хранятся в браузере. Чтобы перенести работу на другой компьютер, выгрузите workflow в файл.',
  copyToEmpty: (folder: string) => `Папка «${folder}» пуста. Перенести в неё текущие данные?`,
  addFromBrowser: (folder: string, add: number, copies: number) =>
    `В папке «${folder}» уже есть данные. ` +
    (add > 0 ? `Workflow из прежнего хранилища, которых нет в папке: ${add}. ` : '') +
    (copies > 0 ? `Отличающихся версий (будут добавлены копиями «(из браузера)»): ${copies}. ` : '') +
    'Добавить их в папку?',
  move: 'Перенести',
  dontMove: 'Не переносить',
  add: 'Добавить',
  dontAdd: 'Не добавлять',
  later: 'Позже',
  accessTitle: 'Восстановите доступ к рабочей папке',
  accessText: (folder: string) => `Браузер просит заново подтвердить доступ к папке «${folder}».`,
  restoreAccess: 'Восстановить доступ',
  workInBrowser: 'Работать в браузере',
  workInBrowserNote: 'В браузере хранится отдельный набор данных; данные папки останутся нетронутыми',
  folderLost: (folder: string) => `Рабочая папка «${folder}» недоступна. Работа продолжается и сохраняется в браузере.`,
  saveFailed: (reason: string) => `Не удалось сохранить изменения: ${reason}`,
  copyName: (name: string) => `${name} (из браузера)`.slice(0, 100),
  none: 'Сохранение недоступно',
  unavailable: (reason: string) =>
    `Сохранение недоступно: браузер не дал доступ к хранилищу (${reason}). Редактор работает, но изменения не сохранятся после закрытия — выгружайте workflow в файл.`,
  unavailableBanner:
    'Сохранение недоступно: изменения не сохранятся после закрытия страницы. Чтобы не потерять работу, выгрузите workflow в файл.',
  operationFailed: (reason: string) => `Не удалось выполнить операцию с хранилищем: ${reason}`,
  accessDenied: (folder: string) => `Доступ не предоставлен: браузер не разрешил работать с папкой «${folder}». Попробуйте ещё раз или работайте в браузере.`,
  gotIt: 'Понятно',
};

export const workflowMessages = {
  list: 'Workflow',
  create: 'Создать workflow',
  open: (name: string) => `Открыть «${name}»`,
  rename: (name: string) => `Переименовать «${name}»`,
  duplicate: (name: string) => `Дублировать «${name}»`,
  remove: (name: string) => `Удалить «${name}»`,
  nameInput: 'Имя workflow',
  confirmDeleteTitle: 'Удалить workflow?',
  confirmDelete: (name: string) => `Workflow «${name}» будет удалён без возможности восстановления.`,
  deleteButton: 'Удалить',
  cancel: 'Отмена',
  unavailable: (id: string) => `Недоступен: ${id}`,
  closeTab: (name: string) => `Закрыть вкладку «${name}»`,
  noTabs: 'Откройте workflow из списка или создайте новый',
  exportButton: 'Выгрузить в файл',
  importLabel: 'Загрузить из файла',
  importErrorTitle: 'Не удалось загрузить файл',
  close: 'Закрыть',
};

export const compositeMessages = {
  category: 'Мои составные ноды',
  interface: 'Интерфейс составного нода',
  collapse: 'Свернуть в составной нод',
  collapseTitle: 'Свернуть в составной нод',
  nameLabel: 'Имя составного нода',
  collapseButton: 'Свернуть',
  renameTitle: 'Переименовать составной нод',
  renameButton: 'Переименовать',
  open: (name: string) => `Открыть составной нод «${name}»`,
  expand: (name: string) => `Развернуть «${name}»`,
  rename: (name: string) => `Переименовать составной нод «${name}»`,
  remove: (name: string) => `Удалить составной нод «${name}»`,
  removeTitle: 'Удалить составной нод?',
  removeText: (name: string, usage: number) =>
    usage > 0
      ? `Используется в ${usage} ${usage === 1 ? 'месте' : 'местах'}. Все экземпляры «${name}» будут удалены вместе со связями.`
      : `«${name}» будет удалён из палитры.`,
  tabTitle: (name: string) => `Составной нод: ${name}`,
  nameTaken: (name: string) => `Имя «${name}» уже занято другим составным нодом`,
  edgesRemoved: (n: number) => `Порты составного нода изменились. Удалено связей: ${n}`,
  ports: 'Порты',
  addPort: 'Добавить порт',
  portName: 'Имя порта',
  portType: 'Тип порта',
  removePort: (name: string) => `Удалить порт «${name}»`,
  unknownNode: 'Неизвестный нод',
  unknownType: (type: string) =>
    `Тип «${type}» не найден: составной нод удалён или его файл повреждён. Удалите нод или загрузите определение из файла.`,
};

export const historyMessages = {
  undo: 'Отменить',
  redo: 'Повторить',
  minimap: 'Мини-карта графа',
};

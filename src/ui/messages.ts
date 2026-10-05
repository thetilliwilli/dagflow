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
  renderFailed: 'Не удалось отобразить вкладку. Ваши данные не потеряны — попробуйте перезагрузить вкладку.',
  reloadTab: 'Перезагрузить вкладку',
};

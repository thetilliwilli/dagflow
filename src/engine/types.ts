// Типы движка — см. specs/001-dag-workflow-editor/data-model.md

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type PortType = 'number' | 'text' | 'boolean' | 'array' | 'object' | 'any';

export interface PortDef {
  /** Уникально среди входов (или среди выходов) нода; 1–40 символов. */
  name: string;
  type: PortType;
  /** Только для входов: незаполненный вход переводит нод в `waiting`. */
  required?: boolean;
  /** Только для входов: значение, если вход не подключён и не задан вручную. */
  default?: JsonValue;
}

export type Inputs = Record<string, JsonValue>;
export type Outputs = Record<string, JsonValue>;

export interface NodeTypeDef {
  /** `builtin:<имя>` или `composite:<uuid>`. */
  id: string;
  title: string;
  category: string;
  description: string;
  inputs: PortDef[];
  outputs: PortDef[];
  /** Чистая синхронная функция; бросает NodeError. Есть у встроенных нодов. */
  compute?: (inputs: Inputs) => Outputs;
  /** Где нод доступен в палитре: только внутри составного нода или нигде (служебный). */
  paletteScope?: 'composite' | 'hidden';
}

export interface NodeRegistry {
  get(typeId: string): NodeTypeDef | undefined;
  /** Типы для палитры (FR-001). */
  list(): NodeTypeDef[];
}

export interface Position {
  x: number;
  y: number;
}

export interface NodeInstance {
  id: string;
  type: string;
  /** Имя экземпляра (FR-009, фича 002): обязательно; при создании равно названию типа; 1–100 символов. */
  name: string;
  position: Position;
  /** Вручную заданные значения входов (FR-007). */
  values: Record<string, JsonValue>;
  /** Только у нодов «Вход»/«Выход» внутри составного нода (FR-021a). */
  ports?: PortDef[];
}

export interface PortRef {
  node: string;
  port: string;
}

export interface Edge {
  id: string;
  source: PortRef;
  target: PortRef;
}

/** Сторона параметра нода при связывании (фича 002). */
export type PortSide = 'in' | 'out';

/** Параметр, с которого начато связывание: нод, порт и его сторона. */
export interface LinkEnd {
  node: string;
  port: string;
  side: PortSide;
}

export interface Graph {
  nodes: NodeInstance[];
  edges: Edge[];
}

export interface Workflow {
  id: string;
  /** 1–100 символов; уникальность не требуется. */
  name: string;
  graph: Graph;
  createdAt: string;
  updatedAt: string;
}

export interface CompositeDef {
  id: string;
  /** 1–100 символов; уникально в палитре (FR-023a). */
  name: string;
  description: string;
  graph: Graph;
  createdAt: string;
  updatedAt: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Tab {
  id: string;
  kind: 'workflow' | 'composite';
  targetId: string;
  viewport: Viewport;
}

export interface Workspace {
  workflowOrder: string[];
  tabs: Tab[];
  activeTabId: string | null;
}

export type NodeStatus = 'ok' | 'computing' | 'waiting' | 'error' | 'blocked';

export interface NodeState {
  status: NodeStatus;
  inputs: Inputs;
  outputs: Outputs;
  message?: string;
}

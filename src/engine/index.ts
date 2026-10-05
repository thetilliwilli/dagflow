// Публичный API движка (contracts/engine-api.md)
export * from './types';
export { NodeError, rejections, typeNames, plural, type Rejection, type RejectCode } from './errors';
export { matchesType, isCompatible, deepEqual, describeKind, formatCompact, isPlainObject } from './values';
export { builtinNodes, categories } from './builtins';
export { createRegistry } from './registry';
export { canConnect, canAddNode, validateGraph, nodePorts, topologicalOrder, IO_NODE_TYPES } from './validate';
export { createEvaluator, type Evaluator } from './evaluator';

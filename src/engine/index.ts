// Публичный API движка (contracts/engine-api.md)
export * from './types';
export { NodeError, rejections, typeNames, type Rejection, type RejectCode } from './errors';
export {
  matchesType,
  isCompatible,
  deepEqual,
  describeKind,
  formatCompact,
  isPlainObject,
} from './values';
export { builtinNodes, categories } from './builtins';
export { createRegistry } from './registry';
export {
  canConnect,
  canAddNode,
  validateGraph,
  nodePorts,
  topologicalOrder,
  normalizeNodeName,
  linkCandidates,
  IO_NODE_TYPES,
  type LinkCandidate,
  type LinkCandidates,
} from './validate';
export { createEvaluator, type Evaluator, type RegistrySource } from './evaluator';
export {
  collapse,
  expand,
  compositePorts,
  compositeDependencies,
  compositeIdOf,
  validateIoPorts,
  flatten,
  COMPOSITE_PREFIX,
} from './composite';
export { IO_INPUT, IO_OUTPUT, PASSTHROUGH } from './builtins/io';
export { COMPOSITE_CATEGORY } from './registry';

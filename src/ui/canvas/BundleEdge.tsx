// Ребро-пучок: прямая линия от рамки к рамке со стрелкой у получателя и подписью
// «выход→вход» (FR-023, FR-024; research R2, R10)
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  useInternalNode,
  useStore,
  type Edge as RfEdge,
  type EdgeProps,
  type InternalNode,
} from '@xyflow/react';
import { useUiActions } from '../../store/ui';
import { bundleLabel, type Bundle } from './bundles';
import { borderPoint, type Box } from './edge-geometry';

/** Ниже этого масштаба подписи не показываются (Clarifications спеки). */
export const LABEL_MIN_ZOOM = 0.5;

export type BundleRfEdge = RfEdge<{ bundle: Bundle }, 'bundle'>;

function box(node: InternalNode): Box {
  return {
    x: node.internals.positionAbsolute.x,
    y: node.internals.positionAbsolute.y,
    width: node.measured.width ?? 0,
    height: node.measured.height ?? 0,
  };
}

const center = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

export function BundleEdge({
  id,
  source,
  target,
  data,
  markerEnd,
  style,
}: EdgeProps<BundleRfEdge>) {
  const ui = useUiActions();
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  const showLabel = useStore((s) => s.transform[2] >= LABEL_MIN_ZOOM);
  if (!from || !to || !data) return null;
  const a = box(from);
  const b = box(to);
  const start = borderPoint(a, center(b));
  const end = borderPoint(b, center(a));
  const [path, labelX, labelY] = getStraightPath({
    sourceX: start.x,
    sourceY: start.y,
    targetX: end.x,
    targetY: end.y,
  });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} interactionWidth={12} />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="bundle-label nodrag nopan"
            style={{ transform: `translate(-50%, -100%) translate(${labelX}px, ${labelY - 4}px)` }}
            onClick={(e) => ui.openEdgeWindow(source, target, { x: e.clientX, y: e.clientY })}
          >
            {bundleLabel(data.bundle).map((line, i) => (
              <div key={i} className="bundle-label__line">
                {line}
              </div>
            ))}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

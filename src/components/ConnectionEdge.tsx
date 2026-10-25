import { BaseEdge, type Edge, type EdgeProps, useInternalNode } from '@xyflow/react';
import type { ConnectionKind } from '../types';
import type { ThoughtFlowNode } from './ThoughtNodeCard';

export type ConnectionFlowEdge = Edge<{ kind: ConnectionKind }, 'connection'>;

interface Point { x: number; y: number }

function nodeCenter(node: NonNullable<ReturnType<typeof useInternalNode<ThoughtFlowNode>>>): Point {
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 286) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 154) / 2,
  };
}

function boundaryPoint(
  node: NonNullable<ReturnType<typeof useInternalNode<ThoughtFlowNode>>>,
  toward: Point,
): { point: Point; normal: Point } {
  const center = nodeCenter(node);
  const halfWidth = Math.max((node.measured.width ?? 286) / 2, 1);
  const halfHeight = Math.max((node.measured.height ?? 154) / 2, 1);
  const dx = toward.x - center.x || 0.001;
  const dy = toward.y - center.y || 0.001;
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  const point = { x: center.x + dx * scale, y: center.y + dy * scale };
  const horizontal = Math.abs(dx) / halfWidth >= Math.abs(dy) / halfHeight;
  const normal = horizontal
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) };
  return { point, normal };
}

export function ConnectionEdge({ id, source, target, data, selected }: EdgeProps<ConnectionFlowEdge>) {
  const sourceNode = useInternalNode<ThoughtFlowNode>(source);
  const targetNode = useInternalNode<ThoughtFlowNode>(target);
  if (!sourceNode || !targetNode) return null;

  const sourceCenter = nodeCenter(sourceNode);
  const targetCenter = nodeCenter(targetNode);
  const start = boundaryPoint(sourceNode, targetCenter);
  const end = boundaryPoint(targetNode, sourceCenter);
  const distance = Math.hypot(end.point.x - start.point.x, end.point.y - start.point.y);
  const controlLength = Math.min(180, Math.max(48, distance * 0.32));
  const firstControl = {
    x: start.point.x + start.normal.x * controlLength,
    y: start.point.y + start.normal.y * controlLength,
  };
  const secondControl = {
    x: end.point.x + end.normal.x * controlLength,
    y: end.point.y + end.normal.y * controlLength,
  };
  const path = `M ${start.point.x} ${start.point.y} C ${firstControl.x} ${firstControl.y}, ${secondControl.x} ${secondControl.y}, ${end.point.x} ${end.point.y}`;
  const kind = data?.kind ?? 'relation';
  const classes = `connection-edge ${kind} ${selected ? 'selected' : ''}`;

  return <>
    <BaseEdge id={id} path={path} className={classes} interactionWidth={24} />
    <circle className={`connection-port ${kind} source-port`} cx={start.point.x} cy={start.point.y} r={8.5} />
    <circle className={`connection-port ${kind} target-port`} cx={end.point.x} cy={end.point.y} r={8.5} />
  </>;
}

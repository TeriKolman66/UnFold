import dagre from '@dagrejs/dagre';
import type { Edge } from '@xyflow/react';
import type { ThoughtNode } from '../types';
import type { ThoughtFlowNode } from '../components/ThoughtNodeCard';
import { visibleNodes } from './workspace';

export const NODE_WIDTH = 286;
export const NODE_HEIGHT = 132;
export const nodeHeight = (node: ThoughtNode) => node.kind === 'location' ? (node.answer ? 380 : 318) : node.kind === 'image' ? 318 : node.kind === 'note' || node.kind === 'file' ? 154 : NODE_HEIGHT;

export function layoutThoughtTree(nodes: ThoughtNode[], onToggle: (id: string) => void): { nodes: ThoughtFlowNode[]; edges: Edge[] } {
  const shown = visibleNodes(nodes);
  const shownIds = new Set(shown.map((node) => node.id));
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'TB', ranksep: 92, nodesep: 48, marginx: 56, marginy: 56 });
  for (const node of shown) graph.setNode(node.id, { width: NODE_WIDTH, height: nodeHeight(node) });
  for (const node of shown) if (node.parentId && shownIds.has(node.parentId)) graph.setEdge(node.parentId, node.id);
  dagre.layout(graph);
  return {
    nodes: shown.map((thought) => {
      const position = graph.node(thought.id);
      const automaticPosition = { x: position.x - NODE_WIDTH / 2, y: position.y - nodeHeight(thought) / 2 };
      return { id: thought.id, type: 'thought', position: thought.position ?? automaticPosition, data: { thought, childCount: nodes.filter((node) => node.parentId === thought.id).length, onToggle }, selected: false };
    }),
    edges: shown.filter((node) => node.parentId && shownIds.has(node.parentId)).map((node) => ({ id: `${node.parentId}-${node.id}`, source: node.parentId!, target: node.id, type: 'bezier', className: node.completed ? 'edge-complete' : '' })),
  };
}

import type { ThoughtNode, WorkspaceDocument } from '../types';

export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();

export function createWorkspace(name: string, objective: string): WorkspaceDocument {
  const timestamp = now();
  return {
    format: 'unfold-workspace',
    version: 1,
    id: uid(),
    name: name.trim() || 'Untitled workspace',
    objective: objective.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [],
    connections: [],
  };
}

export function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<WorkspaceDocument>;
  if (doc.format !== 'unfold-workspace' || doc.version !== 1 || !Array.isArray(doc.nodes)) return false;
  if (typeof doc.id !== 'string' || typeof doc.name !== 'string' || typeof doc.objective !== 'string') return false;
  const ids = new Set<string>();
  for (const node of doc.nodes) {
    if (!node || typeof node.id !== 'string' || typeof node.question !== 'string') return false;
    if (ids.has(node.id)) return false;
    ids.add(node.id);
  }
  return true;
}

export function getProgress(nodes: ThoughtNode[]) {
  const actionable = nodes.filter((node) => node.kind === 'question' || node.kind === 'task');
  const completed = actionable.filter((node) => node.completed).length;
  return { total: actionable.length, completed, remaining: actionable.length - completed, percentage: actionable.length ? Math.round((completed / actionable.length) * 100) : 0 };
}

export function descendantsOf(nodes: ThoughtNode[], parentId: string): Set<string> {
  const result = new Set<string>();
  const queue = [parentId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const node of nodes) if (node.parentId === id && !result.has(node.id)) {
      result.add(node.id);
      queue.push(node.id);
    }
  }
  return result;
}

export function visibleNodes(nodes: ThoughtNode[]) {
  const hidden = new Set<string>();
  for (const node of nodes) if (node.collapsed) descendantsOf(nodes, node.id).forEach((id) => hidden.add(id));
  return nodes.filter((node) => !hidden.has(node.id));
}

export function ancestorContext(nodes: ThoughtNode[], nodeId: string) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const chain: ThoughtNode[] = [];
  let cursor = byId.get(nodeId);
  while (cursor?.parentId) {
    cursor = byId.get(cursor.parentId);
    if (cursor) chain.unshift(cursor);
  }
  return chain;
}

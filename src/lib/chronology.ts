import type { WorkspaceDocument } from '../types';

export type ChronologyEvent =
  | { kind: 'node'; id: string; at: string; label: string }
  | { kind: 'connection'; id: string; at: string; label: string }
  | { kind: 'photo'; id: string; nodeId: string; photoIndex: number; at: string; label: string };

/** Reconstructs additions from the current document only; deleted content has no event. */
export function buildChronology(doc: WorkspaceDocument): ChronologyEvent[] {
  const nodes = new Map(doc.nodes.map((node) => [node.id, node]));
  const events: ChronologyEvent[] = doc.nodes.map((node) => ({ kind: 'node', id: node.id, at: node.createdAt || doc.createdAt, label: node.question }));
  for (const node of doc.nodes) {
    if (node.kind !== 'location') continue;
    for (const [photoIndex, photo] of (node.location?.photos ?? []).entries()) {
      events.push({ kind: 'photo', id: `${node.id}:photo:${photoIndex}`, nodeId: node.id, photoIndex, at: photo.createdAt || node.createdAt || doc.createdAt, label: photo.name });
    }
  }
  for (const edge of doc.connections ?? []) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (!source || !target) continue;
    events.push({ kind: 'connection', id: edge.id, at: edge.createdAt || [source.createdAt, target.createdAt].sort().at(-1) || doc.createdAt, label: `${source.question} → ${target.question}` });
  }
  const priority = { node: 0, photo: 1, connection: 2 };
  return events.sort((a, b) => a.at.localeCompare(b.at) || priority[a.kind] - priority[b.kind]);
}

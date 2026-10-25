import type { ClueConnection, ConnectionKind } from '../types';

export function connectionKind(connection: ClueConnection): ConnectionKind {
  return connection.kind ?? 'relation';
}

export function validateConnection(
  connections: ClueConnection[],
  source: string,
  target: string,
  kind: ConnectionKind,
): string | null {
  if (source === target) return 'A clue cannot connect to itself';

  const samePair = connections.some((edge) => connectionKind(edge) === kind && (
    (edge.source === source && edge.target === target) ||
    (kind === 'relation' && edge.source === target && edge.target === source)));
  if (samePair) return 'These clues are already connected';
  return null;
}

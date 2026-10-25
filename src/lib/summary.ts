import type { ThoughtNode, WorkspaceDocument } from '../types';

export function buildSummary(workspace: WorkspaceDocument): string {
  const children = new Map<string | null, ThoughtNode[]>();
  for (const node of workspace.nodes) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  const lines = [`# ${workspace.name}`, ''];
  if (workspace.objective) lines.push('## Main objective', '', workspace.objective, '');
  lines.push('## Items', '');
  const render = (node: ThoughtNode, depth: number) => {
    if (node.kind !== 'root') {
      const label = node.kind === 'task' ? 'Task' : node.kind === 'question' ? 'Question' : node.kind === 'note' ? 'Note' : node.kind === 'image' ? 'Image' : 'File';
      lines.push(`${'#'.repeat(Math.min(depth + 2, 6))} ${label}: ${node.question}`, '');
      if (node.kind === 'question' || node.kind === 'task') {
        lines.push(`**Status:** ${node.completed ? 'Complete' : 'Open'}`, '');
        lines.push(node.answer.trim() ? `**Answer:** ${node.answer.trim()}` : '**Answer:** _Unanswered_', '');
      } else if (node.kind === 'note') {
        if (node.answer.trim()) lines.push(node.answer.trim(), '');
      } else if (node.attachment) {
        lines.push(`**Attached:** ${node.attachment.name} (${node.attachment.mimeType || 'file'}, ${node.attachment.size} bytes)`, '');
      }
    }
    for (const child of children.get(node.id) ?? []) render(child, depth + 1);
  };
  const topLevel = workspace.nodes.filter((node) => node.parentId === null);
  for (const node of topLevel) render(node, 0);
  if (!workspace.nodes.length) lines.push('_This space is empty._', '');
  return lines.join('\n').trim() + '\n';
}

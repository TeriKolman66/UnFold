import type { ReviewFinding, ThoughtNode, WorkspaceDocument } from '../types';

export function reviewWorkspace(workspace: WorkspaceDocument): ReviewFinding[] {
  const nodes = workspace.nodes;
  const findings: ReviewFinding[] = [];
  const children = new Map<string, ThoughtNode[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);

  for (const node of nodes) {
    if (node.kind === 'root') {
      if (!(children.get(node.id)?.length)) findings.push({ nodeId: node.id, type: 'unexplored', text: 'The main objective has no exploration questions yet.' });
      continue;
    }
    if (node.kind === 'question' && !node.answer.trim()) findings.push({ nodeId: node.id, type: 'unanswered', text: `“${node.question}” has no answer yet.` });
    if (node.kind === 'task' && !node.completed) findings.push({ nodeId: node.id, type: 'open-task', text: `The task “${node.question}” remains open.` });
    if ((node.kind === 'question' || node.kind === 'task') && node.answer.trim() && !(children.get(node.id)?.length) && node.answer.trim().length < 24) {
      findings.push({ nodeId: node.id, type: 'clarification', text: `Could “${node.question}” benefit from a little more detail or a follow-up question?` });
    }
    if ((node.kind === 'question' || node.kind === 'task') && !node.completed && node.answer.trim() && !(children.get(node.id)?.length)) {
      findings.push({ nodeId: node.id, type: 'unexplored', text: `The branch under “${node.question}” has not been explored further.` });
    }
  }
  return findings;
}

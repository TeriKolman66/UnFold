import type { ThoughtNode } from '../types';

export function nextDueReminder(nodes: ThoughtNode[], at = Date.now()): ThoughtNode | undefined {
  return nodes.filter((node) => node.reminderAt && !node.remindedAt && Date.parse(node.reminderAt) <= at)
    .sort((a, b) => Date.parse(a.reminderAt!) - Date.parse(b.reminderAt!))[0];
}

import { describe, expect, it } from 'vitest';
import type { ThoughtNode } from '../types';
import { nextDueReminder } from './reminders';

const node = (id: string, reminderAt?: string, remindedAt?: string): ThoughtNode => ({
  id, parentId: null, kind: 'note', question: id, answer: '', completed: false, collapsed: false,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', reminderAt, remindedAt,
});

describe('clue reminders', () => {
  it('shows the earliest due clue once, ignoring future and dismissed reminders', () => {
    const nodes = [node('future', '2026-11-09T12:00:00Z'), node('later', '2026-11-08T12:00:00Z'), node('first', '2026-11-07T12:00:00Z'), node('done', '2026-11-06T12:00:00Z', '2026-11-06T12:01:00Z')];
    expect(nextDueReminder(nodes, Date.parse('2026-11-08T14:00:00Z'))?.id).toBe('first');
  });
});

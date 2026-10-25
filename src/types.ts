import type { Viewport } from '@xyflow/react';

export type NodeKind = 'root' | 'question' | 'task' | 'note' | 'image' | 'file' | 'location';

export interface EmbeddedAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  createdAt?: string;
  sourceUrl?: string;
  attribution?: string;
  license?: string;
}

export interface LocationDetails {
  query: string;
  sourceUrl?: string;
  embedUrl?: string;
  latitude?: number;
  longitude?: number;
  photos: EmbeddedAttachment[];
}

export interface ThoughtNode {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  question: string;
  answer: string;
  completed: boolean;
  collapsed: boolean;
  position?: { x: number; y: number };
  color?: string;
  attachment?: EmbeddedAttachment;
  location?: LocationDetails;
  createdAt: string;
  updatedAt: string;
}

export type ConnectionKind = 'parent' | 'relation';

export interface ClueConnection {
  id: string;
  source: string;
  target: string;
  /** Older workspace files omit this and are treated as relationship links. */
  kind?: ConnectionKind;
  createdAt?: string;
}

export interface WorkspaceDocument {
  format: 'unfold-workspace';
  version: 1;
  id: string;
  name: string;
  objective: string;
  createdAt: string;
  updatedAt: string;
  nodes: ThoughtNode[];
  connections?: ClueConnection[];
  viewport: Viewport;
}

export interface WorkspaceIndexEntry {
  id: string;
  name: string;
  objective: string;
  updatedAt: string;
  filePath?: string;
  completed: number;
  total: number;
  snapshot?: WorkspaceDocument;
}

export interface GeneratedQuestion {
  question: string;
  kind: 'question' | 'task';
  rationale?: string;
}

export interface QuestionGenerationInput {
  objective: string;
  currentQuestion?: string;
  answer?: string;
  ancestors: Array<{ question: string; answer?: string }>;
  siblingQuestions: string[];
  count: number;
}

export interface QuestionProvider {
  readonly id: string;
  readonly label: string;
  generate(input: QuestionGenerationInput): Promise<GeneratedQuestion[]>;
}

export interface ReviewFinding {
  nodeId: string;
  type: 'unanswered' | 'open-task' | 'unexplored' | 'clarification';
  text: string;
}

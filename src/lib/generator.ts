import type { GeneratedQuestion, QuestionGenerationInput, QuestionProvider } from '../types';

const normalize = (value: string) => value.trim().replace(/[?.!]+$/, '');

export class ContextualTemplateProvider implements QuestionProvider {
  readonly id = 'contextual-templates-v1';
  readonly label = 'Guided questions';

  async generate(input: QuestionGenerationInput): Promise<GeneratedQuestion[]> {
    const subject = normalize(input.currentQuestion || input.objective) || 'this objective';
    const answer = normalize(input.answer || '');
    const rootTemplates: GeneratedQuestion[] = [
      { question: `What would a meaningful outcome for “${subject}” look like?`, kind: 'question' },
      { question: `What is currently unclear about “${subject}”?`, kind: 'question' },
      { question: `Who or what is affected by “${subject}”?`, kind: 'question' },
      { question: `What constraints shape how you can approach “${subject}”?`, kind: 'question' },
      { question: `What evidence would tell you that progress is being made?`, kind: 'question' },
      { question: `What assumption about “${subject}” should be examined first?`, kind: 'question' },
    ];
    const answeredTemplates: GeneratedQuestion[] = answer ? [
      { question: `What makes “${answer}” important in this context?`, kind: 'question' },
      { question: `What remains uncertain about “${answer}”?`, kind: 'question' },
      { question: `What would need to be true for “${answer}” to hold?`, kind: 'question' },
      { question: `What is one concrete next question raised by “${answer}”?`, kind: 'question' },
    ] : [];
    const existing = new Set(input.siblingQuestions.map((q) => q.toLocaleLowerCase()));
    const candidates = [...answeredTemplates, ...rootTemplates].filter((item) => !existing.has(item.question.toLocaleLowerCase()));
    return candidates.slice(0, Math.max(1, Math.min(input.count, 6)));
  }
}

export const questionProvider: QuestionProvider = new ContextualTemplateProvider();

import { parseMealTurn as baseParseMealTurn, optimisticDraft, trainerReply, AI_INFO } from './client-base.js';

export { optimisticDraft, trainerReply, AI_INFO };

export async function parseMealTurn(text, current = [], mode = 'voice') {
  const lab = globalThis.__PFC_VOICE_LAB__;
  if ((mode === 'voice' || mode === 'chat') && lab?.consumeLiveResult) {
    const live = lab.consumeLiveResult(mode, text);
    if (live) return { items: Array.isArray(live.items) ? live.items : [], question: String(live.question || '') };
  }

  if (mode === 'auto' && lab) {
    try {
      lab.brainStart?.();
      const result = await baseParseMealTurn(text, current, mode);
      lab.brainDone?.(result);
      return result;
    } catch (error) {
      lab.brainError?.(error);
      throw error;
    }
  }

  return baseParseMealTurn(text, current, mode);
}

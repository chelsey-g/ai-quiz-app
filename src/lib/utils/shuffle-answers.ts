function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Combines correct answer + up to 3 distractors into a shuffled 4-option array.
 * Dedupes and strips distractors that match the correct answer.
 */
export function shuffleAnswers(correct: string, distractors: string[]): string[] {
  const ck = norm(correct);
  const seen = new Set([ck]);
  const deduped: string[] = [];

  for (const d of distractors) {
    const t = d.trim();
    if (!t) continue;
    const k = norm(t);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
    if (deduped.length >= 3) break;
  }

  return [...deduped, correct.trim()].sort(() => Math.random() - 0.5);
}

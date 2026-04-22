export type SM2Card = {
  repetitions: number;
  ease_factor: number;
  interval_days: number;
};

export type SM2Result = SM2Card & {
  next_review_at: string;
};

/**
 * SM-2 algorithm. quality: 0–5 (≥3 = correct, <3 = incorrect).
 * Returns updated scheduling fields and the ISO next review timestamp.
 */
export function sm2(card: SM2Card, quality: number): SM2Result {
  let { repetitions, ease_factor, interval_days } = card;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
    ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;
  } else {
    repetitions = 0;
    interval_days = 1;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval_days);
  next.setHours(0, 0, 0, 0);

  return { repetitions, ease_factor, interval_days, next_review_at: next.toISOString() };
}

/** Map boolean review outcome to SM-2 quality score. */
export function qualityFromCorrect(correct: boolean): number {
  return correct ? 4 : 1;
}

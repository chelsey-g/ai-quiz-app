import { useEffect, useRef, useState } from "react";

type AnswerRecord = {
  cardId: string;
  correct: boolean;
  userAnswer: string;
  card: {
    id: string;
    front: string;
    back: string;
  };
};

type ExplanationChunk =
  | { cardId: string; chunk: string; done?: never; error?: never }
  | { cardId: string; done: true; chunk?: never; error?: never }
  | { cardId: string; error: string; chunk?: never; done?: never };

/**
 * Automatically fetches and streams wrong-answer explanations from
 * POST /api/quiz/explain when the answers array becomes non-empty.
 *
 * Returns:
 *   explanations — Record<cardId, accumulatedText>
 *   explanationsLoading — true while the stream is open
 */
export function useWrongAnswerExplanations(answers: AnswerRecord[]) {
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explanationsLoading, setExplanationsLoading] = useState(false);
  // Tracks the sorted card-ID fingerprint of the last fetch so we don't re-fetch
  // the same set but DO re-fetch when a retry-missed produces a different set.
  const lastFetchedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const wrongAnswers = answers.filter((a) => !a.correct);
    if (wrongAnswers.length === 0) return;

    // Build a stable fingerprint from the sorted card IDs of wrong answers
    const fingerprint = wrongAnswers
      .map((a) => a.cardId)
      .sort()
      .join(",");

    if (fingerprint === lastFetchedFingerprintRef.current) return;
    lastFetchedFingerprintRef.current = fingerprint;

    // Clear stale explanations from any previous quiz
    setExplanations({});
    setExplanationsLoading(true);

    const payload = wrongAnswers.map((a) => ({
      cardId: a.cardId,
      question: a.card.front,
      correctAnswer: a.card.back,
      userAnswer: a.userAnswer,
    }));

    let cancelled = false;

    async function fetchExplanations() {
      try {
        const res = await fetch("/api/quiz/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wrongAnswers: payload }),
        });

        if (!res.ok || !res.body) {
          setExplanationsLoading(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });

          // Process all complete lines in the buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep any incomplete trailing line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed: ExplanationChunk = JSON.parse(trimmed);
              if (parsed.chunk) {
                setExplanations((prev) => ({
                  ...prev,
                  [parsed.cardId]: (prev[parsed.cardId] ?? "") + parsed.chunk,
                }));
              }
              if (parsed.error) {
                setExplanations((prev) => ({
                  ...prev,
                  [parsed.cardId]: "Could not generate explanation.",
                }));
              }
              // parsed.done is informational — we keep reading until the stream closes
            } catch {
              // Malformed line — skip it
            }
          }
        }
      } catch {
        // Network error or abort — fail silently; explanations just stay empty
      } finally {
        if (!cancelled) setExplanationsLoading(false);
      }
    }

    fetchExplanations();

    return () => {
      cancelled = true;
    };
  }, [answers]);

  return { explanations, explanationsLoading };
}

/**
 * Returns the active deck id when `pathname` is a single-deck route
 * (/decks/[id] or /quiz/[deckId]), or null otherwise.
 * /quiz/quick is multi-deck and explicitly excluded.
 */
export function matchDeckRoute(pathname: string): string | null {
  const deckMatch = pathname.match(/^\/decks\/([^/]+)/);
  if (deckMatch) return deckMatch[1];

  const quizMatch = pathname.match(/^\/quiz\/([^/]+)/);
  if (quizMatch && quizMatch[1] !== "quick") return quizMatch[1];

  return null;
}

export type PausedDeckQuiz = {
  type: "deck";
  deckId: string;
  deckTitle: string;
  quizCards: unknown[];
  allCards: unknown[];
  answers: unknown[];
  cardModes: Record<string, string>;
  currentIndex: number;
  quizMode: string;
  cardLimit: number | "all";
  startedAt: string | null;
  pausedAt: string;
};

export type PausedQuickQuiz = {
  type: "quick";
  cards: unknown[];
  answers: unknown[];
  cardModes: Record<string, string>;
  currentIndex: number;
  quizMode: string;
  cardLimit: number;
  deckFilter: string | null;
  startedAt: string | null;
  pausedAt: string;
};

const DECK_KEY = (deckId: string) => `trove:paused:deck:${deckId}`;
const QUICK_KEY = "trove:paused:quick";

export function savePausedDeckQuiz(state: PausedDeckQuiz) {
  try { localStorage.setItem(DECK_KEY(state.deckId), JSON.stringify(state)); } catch {}
}

export function loadPausedDeckQuiz(deckId: string): PausedDeckQuiz | null {
  try {
    const raw = localStorage.getItem(DECK_KEY(deckId));
    return raw ? (JSON.parse(raw) as PausedDeckQuiz) : null;
  } catch { return null; }
}

export function clearPausedDeckQuiz(deckId: string) {
  try { localStorage.removeItem(DECK_KEY(deckId)); } catch {}
}

export function savePausedQuickQuiz(state: PausedQuickQuiz) {
  try { localStorage.setItem(QUICK_KEY, JSON.stringify(state)); } catch {}
}

export function loadPausedQuickQuiz(): PausedQuickQuiz | null {
  try {
    const raw = localStorage.getItem(QUICK_KEY);
    return raw ? (JSON.parse(raw) as PausedQuickQuiz) : null;
  } catch { return null; }
}

export function clearPausedQuickQuiz() {
  try { localStorage.removeItem(QUICK_KEY); } catch {}
}

export function formatPausedTime(pausedAt: string): string {
  const diff = Date.now() - new Date(pausedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

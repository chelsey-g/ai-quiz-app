# Collections Feature Design

**Goal:** Declutter the dashboard by moving the flat deck grid to a dedicated Collections page, and replace it with smart curated sections.

---

## Architecture

Three pieces of work:
1. Strip flat deck grid from Dashboard; add smart sections (Needs More Practice, Recently Added)
2. Build `/collections` browse page and `/collections/[id]` detail page
3. Add Collections to sidebar nav + one new API endpoint

DB and all CRUD API routes already exist. This is UI-only plus one new GET endpoint.

---

## Dashboard (`/`)

**Keep:** stat banner, Jump Back In card, New Deck button, Import button, Quick Quiz button.

**Remove:** the entire flat deck grid ("Your decks" section, sort controls, select/delete mode).

**Add two smart sections:**
- **Needs More Practice** — up to 6 decks where `times_seen > 0` and accuracy < 70%, sorted by accuracy ascending. If none qualify, section is hidden.
- **Recently Added** — up to 6 decks sorted by `created_at` descending. Hidden if user has no decks.

Each section uses the existing `DeckCard` component. Section headers link to `/collections` ("See all →").

---

## Collections Page (`/collections`)

**URL:** `/collections`

**Sidebar nav:** Add "Collections" entry between Decks/Dashboard and Stats.

**Layout:**
- Page header: "Collections" title + "New collection" button
- Collection cards grid: one card per user collection showing name and deck count. Click → `/collections/[id]`.
- "All Decks" pinned card at the top of the grid (always visible, shows total deck count). Click → `/collections/all`.
- Empty state if no collections yet.
- Create collection: inline input or dialog (name only, same pattern as New Deck dialog).
- Rename/delete: via a `···` menu on each collection card.

---

## Collection Detail Page (`/collections/[id]` and `/collections/all`)

**URL:** `/collections/[id]` for a named collection, `/collections/all` for the flat "all decks" view.

**Layout:**
- Back link → `/collections`
- Collection name as heading (editable inline, same pattern as deck title)
- Deck count subtitle
- Deck grid using `DeckCard` with `CollectionPopover` (for moving decks between collections)
- For named collections: "Remove from collection" action on each card (via a small ×/remove button)
- Sort controls (same sort modes as current dashboard)
- Delete collection button (with confirmation) in the header area — only on named collections, not "All"

---

## New API Endpoint

**`GET /api/collections/[id]`** — returns collection metadata + its decks (full `DeckWithStats` shape).

For the special `/collections/all` route, the page fetches `/api/decks` directly (already exists).

---

## Sidebar Nav Update

Add to `NAV_LINKS` in `app-sidebar.tsx`:
```
{ href: "/collections", label: "Collections", icon: <folder svg> }
```
Placed between the current Decks (Dashboard) link and Stats.

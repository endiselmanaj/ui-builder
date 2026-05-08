# Compare Fullscreen View

Open both compare-mode variant previews in a dedicated fullscreen page with a draggable divider for side-by-side visual comparison.

## Routing

Add `react-router-dom` to the client. Replace the existing `useState`-based tab switching in `App.tsx` with URL-based routing.

| Route | Component | Purpose |
|---|---|---|
| `/` | `GeneratePage` | Current generate/feed view |
| `/skills` | `SkillsPage` | Current skills management view |
| `/compare/:generationId` | `ComparePage` | Fullscreen side-by-side comparison |

### Changes to existing code

- **`App.tsx`**: Remove `view` state and conditional rendering. Wrap content in `BrowserRouter` and `Routes`. Each tab becomes a `Route`.
- **`Nav.tsx`**: Replace `onChange(view)` callbacks with `<Link>` elements. Derive active tab from `useLocation().pathname`.
- **Vite config**: No changes — `/api/*` proxy already covers all API routes.

## "Open both ↗" button

**Location:** `GenerationCard.tsx`, in the card header area above the two variant panes.

**Visibility conditions:**
1. Generation is a comparison (`withoutSkills !== null`)
2. Generation status is `"ready"` (both variants finished successfully)

**Implementation:** `<Link to={/compare/${gen.id}} target="_blank">Open both ↗</Link>` — opens the compare page in a new browser tab.

**Style:** Pill-style link consistent with the existing per-pane "Open ↗" links.

## ComparePage component

**File:** `client/src/pages/ComparePage.tsx`

### Data flow

1. Read `generationId` from `useParams()`
2. Fetch `/api/generations`, find the matching generation
3. If not found or not a compare generation, show an error with a link back to `/`

No new API endpoints needed. The page is self-contained — it fetches its own data since it opens in a new tab (no shared state with the main app). This also means bookmarked URLs work.

### Layout

Full viewport, flexbox column:

```
┌─────────────────────────────────────────────────────┐
│ ← Back to feed  │  "prompt text..."  │  ✓ Ready     │  ← top bar (44px)
├─────────────────────────┬───┬───────────────────────┤
│ With skills      Open ↗ │   │ Without skills Open ↗ │  ← pane headers (36px)
├─────────────────────────┤ D ├───────────────────────┤
│                         │ I │                       │
│     iframe              │ V │     iframe            │  ← fill remaining height
│     (preview)           │   │     (preview)         │
│                         │   │                       │
└─────────────────────────┴───┴───────────────────────┘
```

- **Top bar**: `<Link to="/">← Back to feed</Link>`, truncated prompt (max-width with ellipsis), status pill
- **Pane headers**: "With skills" / "Without skills" label, individual "Open ↗" link to that variant's `previewUrl`
- **Iframes**: `src={variant.previewUrl}`, fill remaining vertical space
- Content is previews only — no activity logs (the feed page already has those)

## Draggable divider

### Hook: `useDivider`

Returns `{ leftPercent, dividerProps, containerProps }`.

### Mechanics

- `leftPercent` state, default `50`
- `onPointerDown` on the divider: `setPointerCapture`, set dragging flag
- `onPointerMove` on the container: calculate percentage from `clientX` relative to container `getBoundingClientRect()`, clamp to `[20, 80]`
- `onPointerUp`: release capture, clear flag
- Double-click on divider: reset to `50`

### Pane sizing

- Left pane: `width: ${leftPercent}%`
- Right pane: `width: ${100 - leftPercent}%`

### Drag UX

- While dragging: `user-select: none` on the container, `pointer-events: none` on both iframes (prevents iframes from swallowing events mid-drag)
- Divider: 6px wide, `cursor: col-resize`, small vertical accent line centered
- Uses pointer events (not mouse events) for touch support and reliable `setPointerCapture`

## Files to create or modify

| File | Action | Purpose |
|---|---|---|
| `client/package.json` | modify | Add `react-router-dom` dependency |
| `client/src/App.tsx` | modify | Replace useState tabs with BrowserRouter + Routes |
| `client/src/Nav.tsx` | modify | Replace callbacks with Link + useLocation |
| `client/src/pages/ComparePage.tsx` | create | Fullscreen comparison page |
| `client/src/hooks/useDivider.ts` | create | Draggable divider hook |
| `client/src/GenerationCard.tsx` | modify | Add "Open both ↗" link for ready compare gens |
| `client/src/styles.css` | modify | Add compare page and divider styles |

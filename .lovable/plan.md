# Plan: Speed trend chart for recent tests

## Goal
Add a visual speed trend chart to the Recent tests section so users can see download/upload speeds over time and ping changes across their last 5 runs.

## What we'll build
1. A new chart component (or inline section) in `src/components/SpeedTest.tsx` that renders when the user toggles a chart view.
2. A toggle button next to the existing **Filters / Sort / Export** controls in the Recent tests header: **List** / **Chart**.
3. A line + bar combo chart using `recharts`:
   - X-axis: test timestamp (formatted as time).
   - Left Y-axis: Download & Upload Mbps (lines with different colors).
   - Right Y-axis: Ping ms (bar or line).
   - Tooltip showing all three values per timestamp.
4. The chart uses the same `sortedRecent` data source so it respects filters and sorting.

## Technical approach
- Install `recharts` as a dependency.
- Keep the chart client-only to avoid SSR issues with the charting library (use a lazy/dynamic import inside a ClientOnly guard or `useEffect` + `useState`).
- Reuse the existing `filteredRecent` / `sortedRecent` data so filtering/sorting still applies.
- Add minimal Tailwind styling to match the Fast.com-like black/white/red theme.
- Empty state: when there are no tests, show the same empty message as the list view.

## Files changed
- `src/components/SpeedTest.tsx`: add chart toggle, chart component integration, and empty state.
- `package.json`: add `recharts` dependency.

## Scope
- Only the last 5 stored tests (existing `MAX_RECENT` limit).
- No server-side storage or chart persistence.
- No export of the chart image (future enhancement).

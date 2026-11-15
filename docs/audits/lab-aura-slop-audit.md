---
title: Lab and Aura design audit
---

# Lab and Aura design audit (DASH-09)

Audit of the Lexicon Lab shell and the `/lab/aura` page (Lifecycle and Dedup tabs) against `DESIGN.md`, using the `design-slop-audit` checklist and axe-core. Run on the dev server with the seeded synthetic data.

## What was checked, and how

| Check | Method | Result |
| --- | --- | --- |
| Accessibility rules | axe-core 4.10.2, tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa and best-practice, run on both tabs with a fitted term loaded | **0 violations** after the fixes below (3 before) |
| Colour contrast | axe `color-contrast` plus hand calculation for what axe could not measure (SVG axis text, the stage icon) | No violations. Muted text on the surface is 6.05:1; the parent-territory pink is 5.82:1 |
| Design tells | Code scan of `components/aura`, `components/lab`, `app/lab/aura` | No gradients, shadows, purple or indigo, Inter, emoji, banned copy or raw hex colours. A test now guards raw hex |
| Motion | Code scan | No animation anywhere. Chart animation is off on every chart |
| Console | Browser console during a full session (fit, unknown term, tab switch) | No errors or warnings |
| Keyboard | Driven in the browser: graph nodes (Enter, arrow keys), threshold slider (arrow keys), roving tab stop | Works. One tab stop on the graph, arrows move between connected nodes |

## Findings and fixes

| Finding | Fix | Commit |
| --- | --- | --- |
| Heading order: chart and graph panels used `h3` under the page `h1` (axe, moderate) | Panel titles are `h2` | ba7100e, 571c941 |
| Environment banner outside any landmark (axe, moderate) | Banner moved inside `<header>` | d9c5b47 |
| Slider thumb 16 px, below the 24 px WCAG 2.2 minimum (axe, serious) | Thumb is 24 px | 5e91a15 |
| Slider thumb had no accessible name | Thumb takes the slider's `aria-label` | b0e906c |
| "1 submissions" and "1 matches" in graph node names | Singular and plural handled | 571c941 |
| "down 1 points" in the trend sentence | "1 point" | b2eded6 |
| Charts had no axes, grid or legend, so line styles could not be matched to names | Axes, grid, hover tooltip and a legend that shows each line style | 710f405 |
| The 180-day band and the "Now" marker did not draw (their ends were not plotted weeks) | `windowBounds` snaps both to plotted weeks | e3bf2c5, b7d8650 |
| Last x-axis label clipped; peaking-line label sat on the data | Axis padding and label positions | b7d8650 |
| A fit was lost when switching to Dedup and back | Both tabs stay mounted | 5b61ab5 |
| Stat row overlapped the stage badge | Wider first column, no-wrap figures | d1d6837 |
| Focus did not move into the mobile drawer | Focus moves into the drawer on open and back to its button on close | 8ba8161, 7dde99a |

## Scores

Scored out of 10 from what could be checked. A score is left out where the check could not be run.

| Dimension | Score | Basis |
| --- | --- | --- |
| Hierarchy | 8 | One focal point per tab (stage and stat row; the counter). Single primary button per form |
| Spacing | 7 | Consistent 8 px scale. Not checked at narrow widths |
| Type | 8 | IBM Plex Sans with tabular IBM Plex Mono figures, one scale |
| Colour | 8 | Okabe-Ito stage colours, every stage also has a shape and a label |
| Consistency | 8 | Theme tokens only; shadcn components reused |
| Accessibility | 8 | axe clean, keyboard driven. Not tested with a screen reader |
| Responsiveness | not scored | See below |

## Not verified

- **Screenshots at 375, 768 and 1280 px.** The browser used here would not narrow its viewport, and the app (correctly) refuses to be framed, so no narrow-width screenshots were taken. The 375 px drawer, the graph's table-by-default view and "no sideways scroll at 375 px" are therefore untested. They need a manual pass or a Playwright run.
- **Screen readers** (NVDA, VoiceOver). Names, roles and live regions are asserted in tests and checked by axe, not heard.
- **Drawer focus management** is covered by a unit test of its decision logic and by reading the code, but could not be exercised in the browser because the menu button only exists below 768 px.

## Known gaps

- The graph counter says "N merges at this threshold", which counts matched pairs, while the Dedup counter's "Rows merged" counts rows. On the seeded data they read 14 and 5. Both are correct for what they count, but the wording invites confusion.
- The spec's "one signature moment" (the fitted curve drawing in once) is not built. Charts do not animate at all, which is the safe default for calm motion.

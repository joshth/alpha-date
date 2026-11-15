---
version: alpha
name: Lexicon Lab
description: Dense, calm reviewer dashboard for the Gen Alpha Decoder Lab (Aura lifecycle and dedup analytics).
colors:
  primary: "#22c393"
  on-primary: "#050506"
  chrome: "#050506"
  surface: "#18171d"
  surface-raised: "#28272d"
  input: "#1a191d"
  border: "#3e3d43"
  border-strong: "#6e6d73"
  control: "#4f4e53"
  text: "#ececef"
  text-muted: "#979699"
  primary-light: "#147a62"
  chrome-light: "#f4f4f6"
  surface-light: "#ffffff"
  surface-raised-light: "#ececef"
  input-light: "#ffffff"
  border-light: "#d4d3d8"
  border-strong-light: "#8a8990"
  control-light: "#e2e1e6"
  text-light: "#1f1e24"
  text-muted-light: "#5c5b62"
  stage-emerging: "#009E73"
  stage-peaking: "#E69F00"
  stage-declining: "#56B4E9"
  stage-parent-territory: "#CC79A7"
typography:
  title:
    fontFamily: IBM Plex Sans
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.2
  heading:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-dense:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4
  figure:
    fontFamily: IBM Plex Mono
    fontSize: 28px
    fontWeight: 500
    lineHeight: 1.1
    fontFeature: "'tnum'"
  figure-dense:
    fontFamily: IBM Plex Mono
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "'tnum'"
rounded:
  control: 4px
  surface: 8px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
  text-input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.control}"
  app-frame:
    backgroundColor: "{colors.chrome}"
    textColor: "{colors.text}"
  list-row:
    borderColor: "{colors.border}"
    textColor: "{colors.text-muted}"
  stage-emerging:
    textColor: "{colors.stage-emerging}"
  stage-peaking:
    textColor: "{colors.stage-peaking}"
  stage-declining:
    textColor: "{colors.stage-declining}"
  stage-parent-territory:
    textColor: "{colors.stage-parent-territory}"
  nav-item-active:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
  stat-figure:
    textColor: "{colors.text}"
    typography: "{typography.figure}"
---

# Lexicon Lab

## Overview

A work tool for reviewers and educators, not a marketing page. It is calm and dense, and data comes first: the frame stays dark and quiet so the Aura stage and the dedup counter are the focal points. The layout follows the GitLab-style dashboard the team already uses: a near-black header and sidebar around a slightly lighter content surface. Dark is the default; a light set exists for daylight and print.

## Colors

- **Chrome (#050506):** header and sidebar. The darkest step, so the content reads as the place to look.
- **Surface (#18171d):** the content area. **Surface raised (#28272d):** filter bar, active nav item, panels.
- **Input (#1a191d), Border (#3e3d43):** inputs and hairline row dividers. Hairlines are decorative; input and control outlines use **Border strong (#6e6d73)**, which passes 3:1 against the input (1.4.11).
- **Control (#4f4e53):** secondary button fill.
- **Text (#ececef)** at 15:1 on surface; **Text muted (#979699)** at 6:1 for secondary text.
- **Primary (#22c393):** the project teal, lightened until it passes 4.5:1 on surface (7.9:1). Focus rings and links only, never a fill for large areas. Light mode uses #147a62.
- **Stage colours (Okabe-Ito, colour-blind safe):** emerging #009E73, peaking #E69F00, declining #56B4E9, parent territory #CC79A7, no stage = text muted. Colour is never the only channel: every stage also has a text label and a shape (↗ ▲ ↘ ●), and every chart series has its own line style.
- Components use theme tokens only. No raw hex values in components.

## Typography

- IBM Plex Sans for the UI. IBM Plex Mono with tabular figures (`tnum`) for counters, `r`, `Δ` and table numbers.
- Scale: 12 / 14 / 16 / 20 / 28 px. Body text is 16 px; 14 px only in dense tables.
- Atkinson Hyperlegible stays available through the display settings (Feature 5).

## Layout

- Header (full width, chrome): product name, a centred "Search or go to…" box with a `/` shortcut, the user's avatar.
- Left sidebar (chrome): grouped nav, active item on surface raised, "Collapse sidebar" at the bottom. Below 768 px it becomes a drawer opened from the header.
- Content (surface): breadcrumbs, a 28 px title, underline tabs, a filter bar, then content.
- Lists are rows divided by hairlines, not cards. A stat row sits above a panel grid, Grafana style.
- 8 px spacing scale. No page scrolls sideways at 375 px.

## Elevation & Depth

No shadows. Depth comes from the surface steps: chrome → surface → surface raised.

## Shapes

Radius 4 px on controls, 8 px on the content surface. Graph nodes are circles; stage icons are the only decorative shapes.

## Components

- **Primary button:** text-coloured fill with surface-coloured text, as in the reference.
- **Secondary button:** control fill.
- **Stat figure:** IBM Plex Mono, 28 px, tabular.
- **Charts:** Recharts via the shadcn chart component. Each chart has a one-sentence summary and a "Show as table" toggle. Points are focusable; tooltips show on focus and hover.
- **Similarity graph:** SVG drawn by React, layout from d3-force computed once. Nodes are real focusable elements; focusing a node dims the rest.
- **Motion:** one signature moment, the fitted curve drawing in once after a fit. Off with calm motion or `prefers-reduced-motion`.

## Do's and Don'ts

- Do lead with rows and review items; label any money or time figure **estimate** and show its assumption.
- Do keep focus visible on every control and give every chart a table.
- Don't use Inter by default, purple or indigo gradients, or emoji as icons.
- Don't put a card around every panel, borders on everything, or an icon chip above each stat.
- Don't use scroll-reveal, glowing neon charts or 3D graphs.
- Don't write "modern", "sleek" or "elevate" copy.

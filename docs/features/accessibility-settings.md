---
title: Accessibility settings
sidebar_position: 10
---

# Accessibility settings

The Accessibility options entry is available on every page. On a fresh page load, the first Tab stop is **Skip to search** and the next is **Accessibility options**. Activate the second link to open the settings panel. Press Escape or choose Close to close it; focus returns to the options link. The panel does not trap focus.

## Presets

| Preset | Settings enabled |
| --- | --- |
| **Vision** | High contrast and 125% text size |
| **Motor** | Calm motion and larger controls |
| **Reading** | OpenDyslexic font and wide line spacing |

Applying a preset sets its listed settings and leaves other settings at their standard defaults. Changing an individual setting after applying a preset changes the active preset label to **Custom**.

## Individual settings

- **Text size:** 100%, 125%, 150% or 200%.
- **Line spacing:** Standard, Relaxed or Wide.
- **Font:** System default, Atkinson Hyperlegible or OpenDyslexic. The two optional fonts are bundled with the app; their SIL Open Font Licenses are in `public/fonts/`.
- **Calm motion:** Reduces animation and transition durations across the page.
- **High contrast:** Uses a black background with white text and yellow accents and focus outlines.
- **Larger controls:** Increases the minimum control dimensions.

The live preview shows a sample search result and its Aura badge using the selected display settings.

## System preferences and saved settings

When no setting has been saved, calm motion follows `prefers-reduced-motion`, high contrast follows `prefers-contrast: more`, and the Lab theme follows `prefers-color-scheme`. Text size, line spacing and font start at their standard defaults.

Explicit choices are saved in this browser's local storage. If storage is blocked or unavailable, settings still apply for the current visit. **Reset to defaults** clears the saved choices and returns to the OS-aware defaults.

## High-contrast shortcut

Press **Ctrl+Shift+H** on Windows or Linux, or **Command+Shift+H** on macOS, to toggle high contrast. The change is announced through a status message. The shortcut is ignored while focus is in a text input, text area, select, or editable region.

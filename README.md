# Lumina — Color Generation Tool

Generate Radix-style 12-step color scales (solid + alpha) from a single base color, check APCA/WCAG contrast, and export design tokens.

Original design: https://www.figma.com/design/jGuf8eCUhTKBJDkFGUPHzQ/Color-Generation-Toolv2.5

## Running the code

```sh
npm i
npm run dev     # http://localhost:3000
npm run build   # outputs to dist/
```

## Project structure

- `src/components/palette-generator/`
  - `PaletteGenerator.tsx` — app shell: header, palettes sidebar, canvas, inspector
  - `PaletteSidebar.tsx` — palette list (select, add, reorder, duplicate, delete)
  - `PaletteInspector.tsx` — editing panel for the active palette
  - `PaletteDisplay.tsx` — scale card with Solid / Alpha / Contrast views
  - `PaletteDocumentation.tsx` — Docs view (token reference table + previews)
  - `ExportDialog.tsx` — CSS, JSON, Figma tokens and Sheets CSV export
  - `PresetsMenu.tsx` — save / open / import / export presets
- `src/lib/color-utils.ts` — scale generation, alpha conversion, contrast math
- `src/lib/export-utils.ts` — token generators shared by export and docs
- `src/index.css` — Tailwind v4 entry and theme tokens (light + dark)

Palettes and presets are stored in `localStorage`, so work survives a reload.

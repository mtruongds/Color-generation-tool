/**
 * The mode whose tokens are being edited. It's separate from the interface theme, so you can edit
 * dark tokens in a light app, and the canvas renders in this mode either way.
 */
export type EditMode = 'light' | 'dark';

export const EDIT_MODE_KEY = 'lumina_edit_mode';

export function loadEditMode(): EditMode {
  try {
    const saved = localStorage.getItem(EDIT_MODE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    // First visit: start in the mode the interface shows
    const legacy = localStorage.getItem('lumina_theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch {
    // Fall through to the system preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function saveEditMode(mode: EditMode) {
  try {
    localStorage.setItem(EDIT_MODE_KEY, mode);
  } catch {
    // Blocked storage only forgets the mode.
  }
}

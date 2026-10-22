import { toast } from 'sonner';

/** Query that makes the app render only the preview, for a second window. */
const POPOUT_QUERY = 'popout=preview';
const WINDOW_NAME = 'lumina-preview';

export function isPreviewPopout() {
  return new URLSearchParams(window.location.search).get('popout') === 'preview';
}

/**
 * Opens the preview in its own window, or brings it forward if it's already open. Sized like a
 * laptop screen so the desktop preset shows close to 1:1.
 */
export function openPreviewWindow() {
  const url = new URL(window.location.href);
  url.search = `?${POPOUT_QUERY}`;
  url.hash = '';
  const width = Math.min(1440, window.screen.availWidth);
  const height = Math.min(960, window.screen.availHeight);
  const win = window.open(url.toString(), WINDOW_NAME, `popup,width=${width},height=${height}`);
  if (!win) {
    toast.error('Your browser blocked the preview window. Allow pop-ups for this site and try again.');
    return;
  }
  win.focus();
}

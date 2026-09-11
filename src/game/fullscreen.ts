/**
 * Fullscreen helpers. On a phone the browser's URL bar and nav bar eat ~20-25%
 * of the screen height, and since the play area is locked to 16:9 the whole
 * game is scaled down to whatever height is left — so going fullscreen is the
 * single biggest win for how large the game renders on a phone.
 *
 * Not universally available: iPhone Safari has never shipped the Fullscreen
 * API (iPad does), so callers check supportsFullscreen() and hide the control
 * rather than offering a button that silently does nothing.
 */

/** vendor-prefixed shapes, still needed for older WebKit */
interface WebkitDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
}
interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

export function supportsFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const d = document as WebkitDocument;
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/**
 * Toggles fullscreen on the document root. Must be called straight from a user
 * gesture — browsers reject the request otherwise, which is why this is wired
 * to a button press rather than fired on load or on stage transitions.
 */
export async function toggleFullscreen(): Promise<void> {
  const d = document as WebkitDocument;
  try {
    if (isFullscreen()) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement as WebkitElement;
    await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    // A landscape game has no use for a portrait fullscreen; this keeps the
    // phone from rotating out from under the player. Unsupported on desktop
    // and on iOS, where it rejects — harmless either way.
    try {
      await (screen.orientation as ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      }).lock?.("landscape");
    } catch {
      // orientation lock is a nice-to-have, never a reason to fail the toggle
    }
  } catch {
    // denied (no gesture, embedded in an iframe without allowfullscreen, …):
    // leave the player where they were rather than throwing into the UI
  }
}

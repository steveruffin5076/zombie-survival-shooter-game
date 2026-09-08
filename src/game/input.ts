/** Converts a client-space (e.g. PointerEvent clientX/Y) point into the
 * engine's fixed logical canvas coordinate space, accounting for the
 * canvas being scaled to fit the viewport. */
export function canvasPointFromClient(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  W: number,
  H: number
): { x: number; y: number } {
  // A zero-size rect (detached/hidden canvas) would divide to NaN/Infinity.
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

/** True if the device should show touch controls instead of relying on
 * mouse/keyboard. Takes raw signals so this stays testable without a DOM.
 *
 * Deliberately conservative: both signals must agree. A touchscreen laptop
 * driven by a mouse reports maxTouchPoints > 0 with a fine pointer, and
 * showing the touch aim-drag surface there would break mouse aiming. */
export function isTouchCapable(maxTouchPoints: number, coarsePointer: boolean): boolean {
  return maxTouchPoints > 0 && coarsePointer;
}

/** True if the device should show touch controls instead of relying on
 * mouse/keyboard. Takes raw signals so this stays testable without a DOM.
 *
 * Deliberately conservative: both signals must agree. A touchscreen laptop
 * driven by a mouse reports maxTouchPoints > 0 with a fine pointer, and
 * showing the touch aim-drag surface there would break mouse aiming. */
export function isTouchCapable(maxTouchPoints: number, coarsePointer: boolean): boolean {
  return maxTouchPoints > 0 && coarsePointer;
}

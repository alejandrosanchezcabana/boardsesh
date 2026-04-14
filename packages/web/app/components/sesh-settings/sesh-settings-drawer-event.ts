/**
 * Window-level event that asks the GlobalHeader to open the SeshSettingsDrawer.
 * Dispatched by the SessionMiniBar (bottom bar) which lives outside the
 * GlobalHeader's React tree. Mirrors play-drawer-event.ts.
 *
 * Lives in its own module so the mini-bar can import it without pulling in
 * the full SeshSettingsDrawer tree.
 */
export const SESH_SETTINGS_DRAWER_EVENT = 'boardsesh:open-sesh-settings-drawer';

export const dispatchOpenSeshSettingsDrawer = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESH_SETTINGS_DRAWER_EVENT));
};

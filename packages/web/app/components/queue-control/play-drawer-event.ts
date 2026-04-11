/**
 * Window-level event that asks the mounted QueueControlBar / PlayViewDrawer
 * to open the play drawer. Dispatched by climb list items and similar
 * surfaces that live outside the bar's React tree. Mirrors TOUR_DRAWER_EVENT.
 *
 * Callers MUST set the active climb (via setCurrentClimb or
 * setCurrentClimbQueueItem) before dispatching — the listener only toggles
 * the drawer open.
 *
 * Lives in its own module so lightweight components (like QueueClimbListItem)
 * can import it without pulling in the full QueueControlBar tree — important
 * for isolated unit tests.
 */
export const PLAY_DRAWER_EVENT = 'boardsesh:open-play-drawer';

export const dispatchOpenPlayDrawer = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PLAY_DRAWER_EVENT));
};

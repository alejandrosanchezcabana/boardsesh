export type TourStepId =
  | 'home-intro'
  | 'home-pick-board'
  | 'climb-list'
  | 'queue-add'
  | 'queue-bar'
  | 'queue-thumbnail'
  | 'play-view'
  | 'play-queue'
  | 'queue-bar-reopen'
  | 'session-mini-bar'
  | 'sesh-invite'
  | 'sesh-activity'
  | 'sesh-analytics';

export type AdvanceTrigger =
  | 'next'
  | 'route-change'
  | 'queue-added'
  | 'current-climb-set'
  | 'play-drawer-open'
  | 'finish';

export type StepEnterEffect =
  | 'open-start-sesh'
  | 'open-dummy-sesh'
  | 'open-play-queue'
  | 'close-play-view'
  | 'replay-climb-list-swipe-hint';
export type StepExitEffect = 'close-dummy-sesh' | 'close-play-queue' | 'close-play-view';

export interface TourStepDef {
  id: TourStepId;
  routeMatches: (pathname: string) => boolean;
  /**
   * CSS selector candidates for the anchor. First match wins. null renders the
   * overlay centred with no anchor.
   */
  anchorSelectors: string[] | null;
  title: string;
  body: string;
  /** Label on the primary advance button. null means event-driven (no button). */
  primaryLabel: string | null;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  advanceTrigger: AdvanceTrigger;
  /** Fire when the step becomes active. */
  onEnter?: StepEnterEffect;
  /** Fire when the step exits (toward the next step or on skip). */
  onExit?: StepExitEffect;
}

const isHomePath = (p: string) => p === '/' || p === '';
const isBoardListPath = (p: string) => /\/list\/?$/.test(p);

export const TOUR_STEPS: TourStepDef[] = [
  {
    id: 'home-intro',
    routeMatches: isHomePath,
    anchorSelectors: null,
    title: "Let's get you climbing",
    body: "We'll pick a board, queue a climb, and show you what sessions with your crew look like. Under a minute.",
    primaryLabel: 'Start the tour',
    advanceTrigger: 'next',
  },
  {
    id: 'home-pick-board',
    routeMatches: isHomePath,
    anchorSelectors: null,
    title: 'Pick a board to start your sesh',
    body: 'Grab a nearby board, a popular config, or dial in a custom one. Tap one to jump to your wall.',
    primaryLabel: null,
    advanceTrigger: 'route-change',
    onEnter: 'open-start-sesh',
  },
  {
    id: 'climb-list',
    routeMatches: isBoardListPath,
    anchorSelectors: ['#onboarding-climb-card-2', '#onboarding-climb-card'],
    title: 'Your wall, your climbs',
    body: 'Every card is a climb for the config you picked. Tap this one to make it your active climb.',
    primaryLabel: null,
    placement: 'bottom',
    advanceTrigger: 'current-climb-set',
  },
  {
    id: 'queue-add',
    routeMatches: isBoardListPath,
    anchorSelectors: ['#onboarding-climb-card', '#onboarding-climb-card-2'],
    title: 'Queue one up',
    body: 'Swipe this climb to the left to drop it in your queue. Stack a whole session before you chalk up.',
    primaryLabel: null,
    placement: 'bottom',
    advanceTrigger: 'queue-added',
    onEnter: 'replay-climb-list-swipe-hint',
  },
  {
    id: 'queue-bar',
    routeMatches: isBoardListPath,
    anchorSelectors: ['#onboarding-queue-bar'],
    title: 'This is your current climb',
    body: 'The bar at the bottom always shows what you are working on. Swipe it left or right to switch between queued climbs.',
    primaryLabel: null,
    placement: 'top',
    advanceTrigger: 'current-climb-set',
  },
  {
    id: 'queue-thumbnail',
    routeMatches: isBoardListPath,
    anchorSelectors: [
      '#onboarding-climb-card [data-testid="climb-thumbnail"]',
      '#onboarding-climb-card-2 [data-testid="climb-thumbnail"]',
      '#onboarding-climb-card',
    ],
    title: 'Tap a thumbnail',
    body: 'Tap any climb thumbnail to open the play view — hold map, beta, comments, and one-tap logging.',
    primaryLabel: null,
    placement: 'bottom',
    advanceTrigger: 'play-drawer-open',
  },
  {
    id: 'play-view',
    routeMatches: isBoardListPath,
    anchorSelectors: null,
    title: 'Everything for this climb',
    body: 'Light the holds, read beta, log a send — all without leaving this view.',
    primaryLabel: 'Next',
    advanceTrigger: 'next',
  },
  {
    id: 'play-queue',
    routeMatches: isBoardListPath,
    anchorSelectors: null,
    title: 'One queue for the whole crew',
    body: 'In a shared session, everyone sees and controls the same queue. Add a climb, the whole crew sees it. Swap active climb — you all swap together.',
    primaryLabel: 'Next',
    advanceTrigger: 'next',
    onEnter: 'open-play-queue',
    onExit: 'close-play-queue',
  },
  {
    id: 'queue-bar-reopen',
    routeMatches: isBoardListPath,
    anchorSelectors: ['#onboarding-queue-bar'],
    title: 'Jump back anytime',
    body: 'Tap the bar at the bottom any time to reopen the play view for your current climb.',
    primaryLabel: 'Next',
    placement: 'top',
    advanceTrigger: 'next',
    onEnter: 'close-play-view',
  },
  {
    id: 'session-mini-bar',
    routeMatches: isBoardListPath,
    anchorSelectors: ['[data-tour-anchor="session-mini-bar"]'],
    title: 'Open your session',
    body: 'Tap the session bar inside the queue control any time to see who is in, live stats, and your share link.',
    primaryLabel: 'Next',
    placement: 'top',
    advanceTrigger: 'next',
  },
  {
    id: 'sesh-invite',
    routeMatches: isBoardListPath,
    anchorSelectors: null,
    title: 'Invite your crew',
    body: 'Share the link or scan the QR code together. Everyone who joins shows up in the session live.',
    primaryLabel: 'Next',
    advanceTrigger: 'next',
    onEnter: 'open-dummy-sesh',
  },
  {
    id: 'sesh-activity',
    routeMatches: isBoardListPath,
    anchorSelectors: null,
    title: 'Every ascent, logged',
    body: 'Each send, flash, and attempt from the whole crew lands here with their comments and sends.',
    primaryLabel: 'Next',
    advanceTrigger: 'next',
  },
  {
    id: 'sesh-analytics',
    routeMatches: isBoardListPath,
    anchorSelectors: null,
    title: 'See how the night went',
    body: 'Your grade breakdown updates in real time, and we mark the hardest climb you sent.',
    primaryLabel: 'Finish',
    advanceTrigger: 'finish',
    onExit: 'close-dummy-sesh',
  },
];

export const TOUR_STEP_IDS: TourStepId[] = TOUR_STEPS.map((s) => s.id);

export const getStepIndex = (id: TourStepId | null): number => {
  if (!id) return -1;
  return TOUR_STEP_IDS.indexOf(id);
};

export const getStepById = (id: TourStepId): TourStepDef | undefined => TOUR_STEPS.find((s) => s.id === id);

export const getNextStepId = (id: TourStepId): TourStepId | null => {
  const idx = getStepIndex(id);
  if (idx < 0 || idx >= TOUR_STEPS.length - 1) return null;
  return TOUR_STEPS[idx + 1].id;
};

export const isValidStepId = (id: string): id is TourStepId => (TOUR_STEP_IDS as string[]).includes(id);

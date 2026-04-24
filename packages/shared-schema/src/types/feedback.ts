export type AppFeedbackPlatform = 'ios' | 'android' | 'web';
export type AppFeedbackSource = 'prompt' | 'drawer-feedback' | 'shake-bug' | 'drawer-bug';

export interface SubmitAppFeedbackInput {
  rating?: number | null;
  comment?: string | null;
  platform: AppFeedbackPlatform;
  appVersion?: string | null;
  source: AppFeedbackSource;
}

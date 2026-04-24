import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { buildWebhookBody, postFeedbackToDiscord } from '../services/discord';

const originalUrl = process.env.DISCORD_FEEDBACK_URL;

function serialize(obj: unknown): string {
  return JSON.stringify(obj);
}

describe('Discord webhook payload privacy', () => {
  // The payload's top-level `username` is Discord's bot display name — that
  // field is always the string "Boardsesh Feedback" and is not user info.
  // What we guard against is the feedback row's user identifiers leaking:
  // userId, email, or a display name associated with a specific user.
  it('never includes user-identifying fields from the feedback row', () => {
    const bugBody = buildWebhookBody({
      feedbackId: 42,
      rating: null,
      comment: 'Crashed on submit',
      platform: 'ios',
      appVersion: '1.0.0',
      source: 'shake-bug',
    });

    const ratingBody = buildWebhookBody({
      feedbackId: 99,
      rating: 5,
      comment: null,
      platform: 'android',
      appVersion: '1.0.0',
      source: 'prompt',
    });

    for (const body of [serialize(bugBody), serialize(ratingBody)]) {
      expect(body).not.toMatch(/userId/);
      expect(body).not.toMatch(/user_id/);
      expect(body).not.toMatch(/email/i);
      expect(body).not.toMatch(/displayName/i);
    }
  });

  it('labels bug-source feedback with a bug-report title', () => {
    const body = buildWebhookBody({
      feedbackId: 1,
      rating: null,
      comment: 'It broke',
      platform: 'web',
      appVersion: null,
      source: 'drawer-bug',
    });
    const embed = (body.embeds as Array<Record<string, unknown>>)[0];
    expect(embed.title).toBe('🐞 Bug report');
  });

  it('labels rating feedback with a star title including the rating', () => {
    const body = buildWebhookBody({
      feedbackId: 1,
      rating: 3,
      comment: null,
      platform: 'web',
      appVersion: '1.2.3',
      source: 'drawer-feedback',
    });
    const embed = (body.embeds as Array<Record<string, unknown>>)[0];
    expect(embed.title).toBe('⭐ Rating: 3/5');
  });

  it('includes the feedback id in the footer for correlation', () => {
    const body = buildWebhookBody({
      feedbackId: 1337,
      rating: 4,
      comment: null,
      platform: 'web',
      appVersion: null,
      source: 'prompt',
    });
    const embed = (body.embeds as Array<Record<string, unknown>>)[0];
    expect((embed.footer as { text: string }).text).toBe('feedback #1337');
  });
});

describe('postFeedbackToDiscord', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.DISCORD_FEEDBACK_URL;
    else process.env.DISCORD_FEEDBACK_URL = originalUrl;
  });

  it('no-ops (does not call fetch) when the env var is unset', async () => {
    delete process.env.DISCORD_FEEDBACK_URL;
    await postFeedbackToDiscord({
      feedbackId: 1,
      rating: 5,
      comment: null,
      platform: 'web',
      appVersion: null,
      source: 'prompt',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs to the configured URL with a JSON body that omits userId', async () => {
    process.env.DISCORD_FEEDBACK_URL = 'https://discord.test/webhook';
    await postFeedbackToDiscord({
      feedbackId: 1,
      rating: 4,
      comment: 'Great',
      platform: 'web',
      appVersion: '1.0',
      source: 'prompt',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://discord.test/webhook');
    expect(init.method).toBe('POST');
    expect(String(init.body)).not.toMatch(/userId/i);
  });

  it('never throws when fetch rejects', async () => {
    process.env.DISCORD_FEEDBACK_URL = 'https://discord.test/webhook';
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    await expect(
      postFeedbackToDiscord({
        feedbackId: 1,
        rating: 4,
        comment: null,
        platform: 'web',
        appVersion: null,
        source: 'prompt',
      }),
    ).resolves.toBeUndefined();
  });

  it('never throws when Discord returns a non-OK response', async () => {
    process.env.DISCORD_FEEDBACK_URL = 'https://discord.test/webhook';
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });

    await expect(
      postFeedbackToDiscord({
        feedbackId: 1,
        rating: 4,
        comment: null,
        platform: 'web',
        appVersion: null,
        source: 'prompt',
      }),
    ).resolves.toBeUndefined();
  });
});

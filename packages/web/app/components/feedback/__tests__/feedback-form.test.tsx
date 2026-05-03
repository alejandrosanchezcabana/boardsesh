import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FeedbackForm } from '../feedback-form';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

function pickStars(n: number) {
  fireEvent.click(screen.getByRole('option', { name: `${n} star${n > 1 ? 's' : ''}` }));
}

function getSaveButton(name: RegExp): HTMLButtonElement {
  return screen.getByRole('button', { name }) as HTMLButtonElement;
}

describe('FeedbackForm — prompt mode', () => {
  it('disables Save until a star is picked', () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="prompt" title="Enjoying Boardsesh?" onSubmit={onSubmit} />);
    expect(getSaveButton(/save/i).disabled).toBe(true);
    pickStars(5);
    expect(getSaveButton(/save/i).disabled).toBe(false);
  });

  it('submits immediately when rating is 3 or higher', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="prompt" title="Enjoying Boardsesh?" onSubmit={onSubmit} />);
    pickStars(4);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save/i }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, comment: null });
  });

  it('transitions to the comment view when rating is below 3', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="prompt" title="Enjoying Boardsesh?" onSubmit={onSubmit} />);
    pickStars(2);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/what's missing/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/tell us what would help/i)).toBeTruthy();
  });

  it('Skip on the low-rating view still submits the rating (no comment)', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<FeedbackForm mode="prompt" title="Enjoying Boardsesh?" onSubmit={onSubmit} onCancel={onCancel} />);
    pickStars(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 1, comment: null });
    // Skip short-circuits to submit — onCancel is NOT called on the low-rating path.
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('submits rating + trimmed comment from the low-rating view', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<FeedbackForm mode="prompt" title="Enjoying Boardsesh?" onSubmit={onSubmit} onCancel={onCancel} />);
    pickStars(2);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    });
    fireEvent.change(screen.getByPlaceholderText(/tell us what would help/i), {
      target: { value: '  crashes on login  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send/i }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 2, comment: 'crashes on login' });
  });
});

describe('FeedbackForm — drawer-feedback mode', () => {
  it('disables Send until a rating is picked, even with a comment', () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="drawer-feedback" title="Send feedback" submitLabel="Send" onSubmit={onSubmit} />);
    const send = getSaveButton(/^send$/i);
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), {
      target: { value: 'hi' },
    });
    // Still disabled — backend requires a rating.
    expect(send.disabled).toBe(true);
    pickStars(3);
    expect(send.disabled).toBe(false);
  });

  it('submits rating and optional comment', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="drawer-feedback" title="Send feedback" submitLabel="Send" onSubmit={onSubmit} />);
    pickStars(5);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 5, comment: null });
  });
});

describe('FeedbackForm — bug mode', () => {
  const BUG_PLACEHOLDER = /what were you doing/i;

  it('hides the star picker', () => {
    render(<FeedbackForm mode="bug" title="Report a bug" submitLabel="Send bug report" onSubmit={vi.fn()} />);
    expect(screen.queryByRole('option', { name: /1 star/i })).toBeNull();
    expect(screen.queryByRole('option', { name: /5 stars/i })).toBeNull();
  });

  it('disables submit until the description reaches the 10-char minimum', () => {
    render(<FeedbackForm mode="bug" title="Report a bug" submitLabel="Send bug report" onSubmit={vi.fn()} />);
    const submit = getSaveButton(/send bug report/i);
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(BUG_PLACEHOLDER), { target: { value: 'too short' } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(BUG_PLACEHOLDER), { target: { value: 'ten chars!' } });
    expect(submit.disabled).toBe(false);
  });

  it('shows a character-remaining helper until the minimum is reached', () => {
    render(<FeedbackForm mode="bug" title="Report a bug" submitLabel="Send bug report" onSubmit={vi.fn()} />);
    expect(screen.getByText(/10 more characters to go/i)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(BUG_PLACEHOLDER), { target: { value: 'abc' } });
    expect(screen.getByText(/7 more characters to go/i)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(BUG_PLACEHOLDER), { target: { value: 'abcdefghij' } });
    // At or past the minimum — the counter text is gone.
    expect(screen.queryByText(/more characters to go/i)).toBeNull();
  });

  it('submits with rating=null and the trimmed description', async () => {
    const onSubmit = vi.fn();
    render(<FeedbackForm mode="bug" title="Report a bug" submitLabel="Send bug report" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(BUG_PLACEHOLDER), {
      target: { value: '  app crashed on submit  ' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send bug report/i }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: null, comment: 'app crashed on submit' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/app/lib/in-app-review', () => ({
  requestInAppReview: vi.fn().mockResolvedValue(undefined),
}));

import { StoreReviewPromptDialog } from '../store-review-prompt-dialog';
import { requestInAppReview } from '@/app/lib/in-app-review';

const mockedRequestInAppReview = vi.mocked(requestInAppReview);

describe('StoreReviewPromptDialog', () => {
  beforeEach(() => {
    mockedRequestInAppReview.mockClear();
  });

  it('calls requestInAppReview and closes when the user clicks "Leave a review"', () => {
    const onClose = vi.fn();
    render(<StoreReviewPromptDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /leave a review/i }));
    expect(mockedRequestInAppReview).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes WITHOUT calling requestInAppReview when the user clicks "Not now"', () => {
    const onClose = vi.fn();
    render(<StoreReviewPromptDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(mockedRequestInAppReview).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when open=false', () => {
    render(<StoreReviewPromptDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /leave a review/i })).toBeNull();
  });
});

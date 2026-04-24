'use client';

import React, { useId, useState } from 'react';
import MuiButton from '@mui/material/Button';
import MuiTypography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import ArrowForwardOutlined from '@mui/icons-material/ArrowForwardOutlined';
import { InlineStarPicker } from '@/app/components/logbook/tick-controls';
import styles from './feedback-form.module.css';

type View = 'rating' | 'comment';

const BUG_COMMENT_MIN = 10;

interface FeedbackFormProps {
  /**
   * 'prompt' — compact, inline rating + save icon; low ratings reveal a comment.
   * 'drawer-feedback' — manual from user drawer; rating required, comment optional.
   * 'bug' — bug report: no rating, description required (≥10 chars).
   */
  mode: 'prompt' | 'drawer-feedback' | 'bug';
  onSubmit: (values: { rating: number | null; comment: string | null }) => void | Promise<void>;
  onCancel?: () => void;
  title: string;
  submitLabel?: string;
  titleId?: string;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  mode,
  onSubmit,
  onCancel,
  title,
  submitLabel = 'Save',
  titleId,
}) => {
  const generatedId = useId();
  const resolvedTitleId = titleId ?? generatedId;
  const [rating, setRating] = useState<number | null>(null);
  const [view, setView] = useState<View>(mode === 'prompt' ? 'rating' : 'comment');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isBug = mode === 'bug';
  const isPromptRating = mode === 'prompt' && view === 'rating';
  const isPromptComment = mode === 'prompt' && view === 'comment';

  const handlePrimary = async () => {
    if (isPromptRating) {
      if (rating === null) return;
      if (rating < 3) {
        setView('comment');
        return;
      }
    }
    setSubmitting(true);
    try {
      const trimmed = comment.trim();
      await onSubmit({
        rating: isBug ? null : rating,
        comment: trimmed || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Skip on low-rating comment view still submits the rating so we never
  // silently drop a star.
  const handleSecondary = async () => {
    if (isPromptComment && rating !== null) {
      setSubmitting(true);
      try {
        await onSubmit({ rating, comment: null });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    onCancel?.();
  };

  const canSubmit = (() => {
    if (submitting) return false;
    if (isPromptRating) return rating !== null;
    if (isBug) return comment.trim().length >= BUG_COMMENT_MIN;
    // Drawer Send-feedback always requires a rating. Backend schema enforces
    // min=1, so sending rating=null or 0 would hard-fail.
    if (mode === 'drawer-feedback') return rating !== null;
    return true;
  })();

  const heading = isPromptComment ? "What's missing?" : title;

  if (mode === 'prompt') {
    return (
      <div className={styles.compactForm}>
        <MuiTypography component="h2" className={styles.compactTitle} id={resolvedTitleId}>
          {heading}
        </MuiTypography>

        {view === 'rating' && (
          <div className={styles.compactRow}>
            <InlineStarPicker quality={rating} onSelect={setRating} />
            <IconButton
              aria-label={rating !== null && rating < 3 ? 'Next' : submitLabel}
              onClick={handlePrimary}
              disabled={!canSubmit}
              size="small"
              className={styles.saveIconButton}
            >
              {rating !== null && rating < 3 ? (
                <ArrowForwardOutlined fontSize="small" />
              ) : (
                <SaveOutlined fontSize="small" />
              )}
            </IconButton>
          </div>
        )}

        {view === 'comment' && (
          <>
            <TextField
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell us what would help"
              multiline
              minRows={2}
              maxRows={4}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 2000 } }}
              className={styles.compactComment}
            />
            <div className={styles.compactActions}>
              <MuiButton onClick={handleSecondary} disabled={submitting} size="small">
                Skip
              </MuiButton>
              <IconButton
                aria-label="Send"
                onClick={handlePrimary}
                disabled={!canSubmit}
                size="small"
                className={styles.saveIconButton}
              >
                <SaveOutlined fontSize="small" />
              </IconButton>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.form}>
      <MuiTypography variant="subtitle1" component="h2" fontWeight={600} className={styles.title} id={resolvedTitleId}>
        {heading}
      </MuiTypography>

      {!isBug && (
        <div className={styles.rating}>
          <InlineStarPicker quality={rating} onSelect={setRating} />
        </div>
      )}

      <TextField
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={isBug ? 'What were you doing? What did you expect vs see?' : "What's on your mind?"}
        multiline
        minRows={isBug ? 4 : 3}
        maxRows={isBug ? 8 : 6}
        fullWidth
        size="small"
        required={isBug}
        helperText={(() => {
          if (!isBug) return undefined;
          const remaining = BUG_COMMENT_MIN - comment.trim().length;
          return remaining > 0 ? `${remaining} more characters to go` : ' ';
        })()}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
        className={styles.comment}
      />

      <div className={styles.actions}>
        {onCancel && (
          <MuiButton onClick={handleSecondary} disabled={submitting} size="small">
            Cancel
          </MuiButton>
        )}
        <MuiButton variant="contained" onClick={handlePrimary} disabled={!canSubmit} size="small">
          {submitLabel}
        </MuiButton>
      </div>
    </div>
  );
};

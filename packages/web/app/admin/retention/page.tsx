import React from 'react';
import { sql } from 'drizzle-orm';
import Container from '@mui/material/Container';
import Alert from '@mui/material/Alert';
import { getServerTranslation } from '@/app/lib/i18n/server';
import { getLocale } from '@/app/lib/i18n/get-locale';
import I18nProvider from '@/app/components/providers/i18n-provider';
import { createNoIndexMetadata } from '@/app/lib/seo/metadata';
import { dbz, executeRows } from '@/app/lib/db/db';
import { checkAdmin } from '@/app/lib/admin/check-admin';
import RetentionDashboard, { type RetentionRow } from './retention-dashboard';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const { t, locale } = await getServerTranslation('admin');
  return createNoIndexMetadata({
    title: t('metadata.retention.title'),
    description: t('metadata.retention.description'),
    path: '/admin/retention',
    locale,
  });
}

type RawRetentionRow = {
  cohort_week: string;
  signups: number;
  d1_count: number;
  d3_count: number;
  d7_count: number;
  d30_count: number;
  activated_count: number;
  d1_pct: string | null;
  d3_pct: string | null;
  d7_pct: string | null;
  d30_pct: string | null;
  activation_pct: string | null;
  d1_any_count: number;
  d3_any_count: number;
  d7_any_count: number;
  d30_any_count: number;
  activated_any_count: number;
  d1_any_pct: string | null;
  d3_any_pct: string | null;
  d7_any_pct: string | null;
  d30_any_pct: string | null;
  activation_any_pct: string | null;
};

async function fetchRetention(): Promise<RetentionRow[]> {
  // Cohort = week-of-signup (UTC). Two parallel "active" definitions:
  //   1. Tick activity: at least one boardsesh tick (aurora_id IS NULL —
  //      not synced in from Aurora). This is the original metric.
  //   2. Any activity: a UNION ALL of every user-attributable timestamp
  //      we record — ticks, party sessions, favorites/playlists/pins/follows,
  //      comments/votes/proposals/feedback. Captures returners who don't tick.
  // Window capped at 180 days. D7/D30 columns are NULL'd for cohorts younger
  // than the window so the UI can render a placeholder instead of 0%.
  const rows = await executeRows<RawRetentionRow>(
    dbz,
    sql`
      WITH signup_cohorts AS (
        SELECT
          id AS user_id,
          (date_trunc('week', created_at AT TIME ZONE 'UTC'))::date AS cohort_week,
          created_at
        FROM users
        WHERE created_at >= NOW() - INTERVAL '180 days'
      ),
      ticks_by_user AS (
        SELECT
          sc.user_id,
          BOOL_OR(t.climbed_at <= sc.created_at + INTERVAL '1 day')  AS active_d1,
          BOOL_OR(t.climbed_at <= sc.created_at + INTERVAL '3 days') AS active_d3,
          BOOL_OR(t.climbed_at <= sc.created_at + INTERVAL '7 days') AS active_d7,
          BOOL_OR(t.climbed_at <= sc.created_at + INTERVAL '30 days') AS active_d30,
          BOOL_OR(TRUE) AS ever_active
        FROM signup_cohorts sc
        JOIN boardsesh_ticks t
          ON t.user_id = sc.user_id
         AND t.climbed_at >= sc.created_at
         AND t.aurora_id IS NULL
        GROUP BY sc.user_id
      ),
      activity_events AS (
        SELECT user_id, climbed_at AS ts FROM boardsesh_ticks WHERE aurora_id IS NULL
        UNION ALL
        SELECT created_by_user_id AS user_id, created_at AS ts FROM board_sessions WHERE created_by_user_id IS NOT NULL
        UNION ALL
        SELECT user_id, joined_at AS ts FROM board_session_participants
        UNION ALL
        SELECT user_id, created_at AS ts FROM user_favorites
        UNION ALL
        SELECT user_id, created_at AS ts FROM playlist_ownership
        UNION ALL
        SELECT user_id, created_at AS ts FROM user_playlist_pins
        UNION ALL
        SELECT follower_id AS user_id, created_at AS ts FROM user_follows
        UNION ALL
        SELECT follower_id AS user_id, created_at AS ts FROM playlist_follows
        UNION ALL
        SELECT follower_id AS user_id, created_at AS ts FROM setter_follows
        UNION ALL
        SELECT user_id, created_at AS ts FROM new_climb_subscriptions
        UNION ALL
        SELECT user_id, created_at AS ts FROM comments
        UNION ALL
        SELECT user_id, created_at AS ts FROM votes
        UNION ALL
        SELECT user_id, created_at AS ts FROM proposal_votes
        UNION ALL
        SELECT user_id, created_at AS ts FROM app_feedback WHERE user_id IS NOT NULL
      ),
      activity_by_user AS (
        SELECT
          sc.user_id,
          BOOL_OR(ae.ts <= sc.created_at + INTERVAL '1 day')  AS active_d1,
          BOOL_OR(ae.ts <= sc.created_at + INTERVAL '3 days') AS active_d3,
          BOOL_OR(ae.ts <= sc.created_at + INTERVAL '7 days') AS active_d7,
          BOOL_OR(ae.ts <= sc.created_at + INTERVAL '30 days') AS active_d30,
          BOOL_OR(TRUE) AS ever_active
        FROM signup_cohorts sc
        JOIN activity_events ae
          ON ae.user_id = sc.user_id
         AND ae.ts >= sc.created_at
        GROUP BY sc.user_id
      ),
      cohort_rollup AS (
        SELECT
          sc.cohort_week,
          COUNT(*)::int AS signups,
          COUNT(*) FILTER (WHERE tbu.active_d1)::int AS d1_count,
          COUNT(*) FILTER (WHERE tbu.active_d3)::int AS d3_count,
          COUNT(*) FILTER (WHERE tbu.active_d7)::int AS d7_count,
          COUNT(*) FILTER (WHERE tbu.active_d30)::int AS d30_count,
          COUNT(*) FILTER (WHERE tbu.ever_active)::int AS activated_count,
          COUNT(*) FILTER (WHERE abu.active_d1)::int AS d1_any_count,
          COUNT(*) FILTER (WHERE abu.active_d3)::int AS d3_any_count,
          COUNT(*) FILTER (WHERE abu.active_d7)::int AS d7_any_count,
          COUNT(*) FILTER (WHERE abu.active_d30)::int AS d30_any_count,
          COUNT(*) FILTER (WHERE abu.ever_active)::int AS activated_any_count
        FROM signup_cohorts sc
        LEFT JOIN ticks_by_user tbu USING (user_id)
        LEFT JOIN activity_by_user abu USING (user_id)
        GROUP BY sc.cohort_week
      )
      SELECT
        to_char(cohort_week, 'YYYY-MM-DD') AS cohort_week,
        signups,
        d1_count,
        d3_count,
        d7_count,
        d30_count,
        activated_count,
        ROUND(100.0 * d1_count  / NULLIF(signups, 0), 1) AS d1_pct,
        ROUND(100.0 * d3_count  / NULLIF(signups, 0), 1) AS d3_pct,
        CASE WHEN cohort_week + INTERVAL '7 days'  <= CURRENT_DATE
             THEN ROUND(100.0 * d7_count  / NULLIF(signups, 0), 1) END AS d7_pct,
        CASE WHEN cohort_week + INTERVAL '30 days' <= CURRENT_DATE
             THEN ROUND(100.0 * d30_count / NULLIF(signups, 0), 1) END AS d30_pct,
        ROUND(100.0 * activated_count / NULLIF(signups, 0), 1) AS activation_pct,
        d1_any_count,
        d3_any_count,
        d7_any_count,
        d30_any_count,
        activated_any_count,
        ROUND(100.0 * d1_any_count  / NULLIF(signups, 0), 1) AS d1_any_pct,
        ROUND(100.0 * d3_any_count  / NULLIF(signups, 0), 1) AS d3_any_pct,
        CASE WHEN cohort_week + INTERVAL '7 days'  <= CURRENT_DATE
             THEN ROUND(100.0 * d7_any_count  / NULLIF(signups, 0), 1) END AS d7_any_pct,
        CASE WHEN cohort_week + INTERVAL '30 days' <= CURRENT_DATE
             THEN ROUND(100.0 * d30_any_count / NULLIF(signups, 0), 1) END AS d30_any_pct,
        ROUND(100.0 * activated_any_count / NULLIF(signups, 0), 1) AS activation_any_pct
      FROM cohort_rollup
      ORDER BY cohort_week DESC;
    `,
  );

  const toNumberOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

  return rows.map((row) => ({
    cohortWeek: row.cohort_week,
    signups: row.signups,
    d1Count: row.d1_count,
    d3Count: row.d3_count,
    d7Count: row.d7_count,
    d30Count: row.d30_count,
    activatedCount: row.activated_count,
    d1Pct: toNumberOrNull(row.d1_pct),
    d3Pct: toNumberOrNull(row.d3_pct),
    d7Pct: toNumberOrNull(row.d7_pct),
    d30Pct: toNumberOrNull(row.d30_pct),
    activationPct: toNumberOrNull(row.activation_pct),
    d1AnyCount: row.d1_any_count,
    d3AnyCount: row.d3_any_count,
    d7AnyCount: row.d7_any_count,
    d30AnyCount: row.d30_any_count,
    activatedAnyCount: row.activated_any_count,
    d1AnyPct: toNumberOrNull(row.d1_any_pct),
    d3AnyPct: toNumberOrNull(row.d3_any_pct),
    d7AnyPct: toNumberOrNull(row.d7_any_pct),
    d30AnyPct: toNumberOrNull(row.d30_any_pct),
    activationAnyPct: toNumberOrNull(row.activation_any_pct),
  }));
}

export default async function AdminRetentionPage() {
  const access = await checkAdmin();
  const locale = await getLocale();
  const { t } = await getServerTranslation('admin');

  if (!access.authenticated) {
    return (
      <I18nProvider locale={locale} namespaces={['common', 'admin']}>
        <Container maxWidth="md" sx={{ py: 4, pt: 'calc(var(--global-header-height) + 32px)' }}>
          <Alert severity="warning">{t('auth.signInRequired')}</Alert>
        </Container>
      </I18nProvider>
    );
  }

  if (!access.isAdmin) {
    return (
      <I18nProvider locale={locale} namespaces={['common', 'admin']}>
        <Container maxWidth="md" sx={{ py: 4, pt: 'calc(var(--global-header-height) + 32px)' }}>
          <Alert severity="error">{t('auth.noAccess')}</Alert>
        </Container>
      </I18nProvider>
    );
  }

  const rows = await fetchRetention();

  return (
    <I18nProvider locale={locale} namespaces={['common', 'admin']}>
      <RetentionDashboard rows={rows} />
    </I18nProvider>
  );
}

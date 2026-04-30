'use client';

import React from 'react';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import { GitHub, GroupOutlined, FavoriteBorderOutlined, ApiOutlined, RocketLaunchOutlined } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { useTranslation } from 'react-i18next';
import Logo from '@/app/components/brand/logo';
import BackButton from '@/app/components/back-button';
import LocaleLink from '@/app/components/i18n/locale-link';
import styles from './about.module.css';

export default function AboutContent() {
  const { t } = useTranslation('marketing');
  return (
    <Box className={styles.pageLayout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Logo size="sm" showText={false} />
        <Typography variant="h4" className={styles.headerTitle}>
          {t('about.headerTitle')}
        </Typography>
      </Box>

      <Box component="main" className={styles.content}>
        <MuiCard>
          <CardContent>
            <Stack spacing={3} className={styles.cardContent}>
              <div className={styles.heroSection}>
                <Logo size="lg" linkToHome={false} />
                <Typography variant="h2" className={styles.heroTitle}>
                  {t('about.hero.title')}
                </Typography>
                <Typography variant="body2" component="span" color="text.secondary" className={styles.heroSubtitle}>
                  {t('about.hero.subtitle')}
                </Typography>
              </div>

              <section>
                <Typography variant="h3">
                  <RocketLaunchOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                  {t('about.vision.title')}
                </Typography>
                <Typography variant="body1" component="p">
                  {t('about.vision.p1')}
                </Typography>
                <Typography variant="body1" component="p">
                  {t('about.vision.p2')}
                </Typography>
              </section>

              <section>
                <Typography variant="h3">
                  <GroupOutlined className={`${styles.sectionIcon} ${styles.successIcon}`} />
                  {t('about.features.title')}
                </Typography>
                <ul className={styles.featureList}>
                  <li>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {t('about.features.queueLabel')}
                    </Typography>{' '}
                    {t('about.features.queueDescription')}
                  </li>
                  <li>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {t('about.features.partyLabel')}
                    </Typography>{' '}
                    {t('about.features.partyDescription')}
                  </li>
                  <li>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {t('about.features.multiBoardLabel')}
                    </Typography>{' '}
                    {t('about.features.multiBoardDescription')}
                  </li>
                  <li>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {t('about.features.communityLabel')}
                    </Typography>{' '}
                    {t('about.features.communityDescription')}
                  </li>
                  <li>
                    <Typography variant="body2" component="span" fontWeight={600}>
                      {t('about.features.selfHostedLabel')}
                    </Typography>{' '}
                    {t('about.features.selfHostedDescription')}
                  </li>
                </ul>
              </section>

              <section>
                <Typography variant="h3">
                  <GitHub className={styles.sectionIcon} />
                  {t('about.openSource.title')}
                </Typography>
                <Typography variant="body1" component="p">
                  {t('about.openSource.body')}
                </Typography>
                <Typography variant="body1" component="p">
                  <MuiLink href="https://github.com/marcodejongh/boardsesh" target="_blank" rel="noopener noreferrer">
                    {t('about.openSource.cta')}
                  </MuiLink>
                </Typography>
              </section>

              <section>
                <Typography variant="h3">
                  <ApiOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                  {t('about.api.title')}
                </Typography>
                <Typography variant="body1" component="p">
                  {t('about.api.body')}
                </Typography>
                <Typography variant="body1" component="p">
                  <MuiLink component={LocaleLink} href="/docs">
                    {t('about.api.cta')}
                  </MuiLink>
                </Typography>
              </section>

              <section>
                <Typography variant="h3">
                  <FavoriteBorderOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                  {t('about.community.title')}
                </Typography>
                <Typography variant="body1" component="p">
                  {t('about.community.body')}
                </Typography>
              </section>

              <section>
                <Typography variant="body1" component="p">
                  <MuiLink component={LocaleLink} href="/legal">
                    {t('about.legalLink')}
                  </MuiLink>
                </Typography>
              </section>

              <section className={styles.callToAction}>
                <Typography variant="body1" component="p" color="text.secondary">
                  {t('about.footer')}
                </Typography>
              </section>
            </Stack>
          </CardContent>
        </MuiCard>
      </Box>
    </Box>
  );
}

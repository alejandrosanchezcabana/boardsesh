'use client';

import React, { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreOutlined from '@mui/icons-material/ExpandMoreOutlined';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import {
  GridOnOutlined,
  GroupOutlined,
  ElectricBoltOutlined,
  SearchOutlined,
  ApiOutlined,
  HelpOutlineOutlined,
} from '@mui/icons-material';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';
import Logo from '@/app/components/brand/logo';
import BackButton from '@/app/components/back-button';
import styles from './help.module.css';

type LabeledItem = { label: string; body: string };

function BoldRow({ label, body }: LabeledItem) {
  return (
    <li>
      <Typography variant="body2" component="span" fontWeight={600}>
        {label}
      </Typography>{' '}
      {body}
    </li>
  );
}

export default function HelpContent() {
  const { t } = useTranslation('marketing');
  const [expandedSection, setExpandedSection] = useState<string | false>('visualization');

  const helpSections = [
    {
      key: 'visualization',
      label: (
        <span>
          <GridOnOutlined className={styles.sectionIcon} />
          {t('help.sections.visualization.label')}
        </span>
      ),
      children: [
        {
          key: 'heatmap',
          label: t('help.heatmap.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/heatmap.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/help/heatmap.png" alt={t('help.heatmap.imgAlt')} className={styles.featureImage} />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.heatmap.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.heatmap.accessLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.heatmap.access1')}</li>
                <li>{t('help.heatmap.access2')}</li>
                <li>{t('help.heatmap.access3')}</li>
              </ol>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.heatmap.modesLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow label={t('help.heatmap.modes.ascentsLabel')} body={t('help.heatmap.modes.ascentsBody')} />
                <BoldRow label={t('help.heatmap.modes.startLabel')} body={t('help.heatmap.modes.startBody')} />
                <BoldRow label={t('help.heatmap.modes.handFootLabel')} body={t('help.heatmap.modes.handFootBody')} />
                <BoldRow label={t('help.heatmap.modes.finishLabel')} body={t('help.heatmap.modes.finishBody')} />
              </ul>
              <Typography variant="body1" component="p">
                {t('help.heatmap.outro')}
              </Typography>
            </div>
          ),
        },
        {
          key: 'hold-classification',
          label: t('help.holdClassification.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/hold-classification.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/hold-classification.png"
                  alt={t('help.holdClassification.imgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.holdClassification.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.holdClassification.attrsLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow
                  label={t('help.holdClassification.attrs.holdTypeLabel')}
                  body={t('help.holdClassification.attrs.holdTypeBody')}
                />
                <BoldRow
                  label={t('help.holdClassification.attrs.handRatingLabel')}
                  body={t('help.holdClassification.attrs.handRatingBody')}
                />
                <BoldRow
                  label={t('help.holdClassification.attrs.footRatingLabel')}
                  body={t('help.holdClassification.attrs.footRatingBody')}
                />
                <BoldRow
                  label={t('help.holdClassification.attrs.pullDirectionLabel')}
                  body={t('help.holdClassification.attrs.pullDirectionBody')}
                />
              </ul>
              <Typography variant="body1" component="p">
                {t('help.holdClassification.outro')}
              </Typography>
            </div>
          ),
        },
      ],
    },
    {
      key: 'collaboration',
      label: (
        <span>
          <GroupOutlined className={styles.sectionIcon} />
          {t('help.sections.collaboration.label')}
        </span>
      ),
      children: [
        {
          key: 'party-mode',
          label: t('help.partyMode.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/party-mode-active.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/party-mode-active.png"
                  alt={t('help.partyMode.imgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.partyMode.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.partyMode.startLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.partyMode.start1')}</li>
                <li>{t('help.partyMode.start2')}</li>
                <li>{t('help.partyMode.start3')}</li>
                <li>{t('help.partyMode.start4')}</li>
              </ol>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.partyMode.joinLabel')}
                </Typography>
              </Typography>
              <ol>
                <BoldRow label={t('help.partyMode.join.qrLabel')} body={t('help.partyMode.join.qrBody')} />
                <BoldRow label={t('help.partyMode.join.shareLabel')} body={t('help.partyMode.join.shareBody')} />
                <BoldRow label={t('help.partyMode.join.idLabel')} body={t('help.partyMode.join.idBody')} />
              </ol>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.partyMode.featuresLabel')}
                </Typography>
              </Typography>
              <ul>
                <li>{t('help.partyMode.feature1')}</li>
                <li>{t('help.partyMode.feature2')}</li>
                <li>{t('help.partyMode.feature3')}</li>
                <li>{t('help.partyMode.feature4')}</li>
                <li>{t('help.partyMode.feature5')}</li>
              </ul>
            </div>
          ),
        },
        {
          key: 'queue-management',
          label: t('help.queueManagement.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/main-interface.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/main-interface.png"
                  alt={t('help.queueManagement.imgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.queueManagement.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.queueManagement.actionsLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow
                  label={t('help.queueManagement.actions.addLabel')}
                  body={t('help.queueManagement.actions.addBody')}
                />
                <BoldRow
                  label={t('help.queueManagement.actions.reorderLabel')}
                  body={t('help.queueManagement.actions.reorderBody')}
                />
                <BoldRow
                  label={t('help.queueManagement.actions.currentLabel')}
                  body={t('help.queueManagement.actions.currentBody')}
                />
                <BoldRow
                  label={t('help.queueManagement.actions.removeLabel')}
                  body={t('help.queueManagement.actions.removeBody')}
                />
                <BoldRow
                  label={t('help.queueManagement.actions.mirrorLabel')}
                  body={t('help.queueManagement.actions.mirrorBody')}
                />
              </ul>
              <Typography variant="body1" component="p">
                {t('help.queueManagement.outro')}
              </Typography>
            </div>
          ),
        },
      ],
    },
    {
      key: 'training',
      label: (
        <span>
          <ElectricBoltOutlined className={styles.sectionIcon} />
          {t('help.sections.training.label')}
        </span>
      ),
      children: [
        {
          key: 'playlist-generator',
          label: t('help.playlistGenerator.q'),
          children: (
            <div className={styles.answerContent}>
              <Typography variant="body1" component="p">
                {t('help.playlistGenerator.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.playlistGenerator.typesLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow
                  label={t('help.playlistGenerator.types.volumeLabel')}
                  body={t('help.playlistGenerator.types.volumeBody')}
                />
                <BoldRow
                  label={t('help.playlistGenerator.types.pyramidLabel')}
                  body={t('help.playlistGenerator.types.pyramidBody')}
                />
                <BoldRow
                  label={t('help.playlistGenerator.types.ladderLabel')}
                  body={t('help.playlistGenerator.types.ladderBody')}
                />
                <BoldRow
                  label={t('help.playlistGenerator.types.gradeFocusLabel')}
                  body={t('help.playlistGenerator.types.gradeFocusBody')}
                />
              </ul>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.playlistGenerator.optionsLabel')}
                </Typography>
              </Typography>
              <ul>
                <li>{t('help.playlistGenerator.option1')}</li>
                <li>{t('help.playlistGenerator.option2')}</li>
                <li>{t('help.playlistGenerator.option3')}</li>
                <li>{t('help.playlistGenerator.option4')}</li>
                <li>{t('help.playlistGenerator.option5')}</li>
              </ul>
            </div>
          ),
        },
        {
          key: 'mirroring',
          label: t('help.mirroring.q'),
          children: (
            <div className={styles.answerContent}>
              <Typography variant="body1" component="p">
                {t('help.mirroring.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.mirroring.howLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.mirroring.step1')}</li>
                <li>{t('help.mirroring.step2')}</li>
                <li>{t('help.mirroring.step3')}</li>
              </ol>
              <Typography variant="body1" component="p">
                {t('help.mirroring.outro')}
              </Typography>
            </div>
          ),
        },
      ],
    },
    {
      key: 'search',
      label: (
        <span>
          <SearchOutlined className={styles.sectionIcon} />
          {t('help.sections.search.label')}
        </span>
      ),
      children: [
        {
          key: 'search-filters',
          label: t('help.searchFilters.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/search-filters.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/search-filters.png"
                  alt={t('help.searchFilters.imgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.searchFilters.basicLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow
                  label={t('help.searchFilters.basic.nameLabel')}
                  body={t('help.searchFilters.basic.nameBody')}
                />
                <BoldRow
                  label={t('help.searchFilters.basic.gradeLabel')}
                  body={t('help.searchFilters.basic.gradeBody')}
                />
                <BoldRow
                  label={t('help.searchFilters.basic.setterLabel')}
                  body={t('help.searchFilters.basic.setterBody')}
                />
                <BoldRow
                  label={t('help.searchFilters.basic.minAscentsLabel')}
                  body={t('help.searchFilters.basic.minAscentsBody')}
                />
                <BoldRow
                  label={t('help.searchFilters.basic.minRatingLabel')}
                  body={t('help.searchFilters.basic.minRatingBody')}
                />
                <BoldRow
                  label={t('help.searchFilters.basic.classicsLabel')}
                  body={t('help.searchFilters.basic.classicsBody')}
                />
              </ul>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.searchFilters.personalLabel')}
                </Typography>{' '}
                {t('help.searchFilters.personalRequires')}
              </Typography>
              <picture>
                <source srcSet="/help/personal-progress.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/personal-progress.png"
                  alt={t('help.searchFilters.personalImgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <ul>
                <li>{t('help.searchFilters.personal1')}</li>
                <li>{t('help.searchFilters.personal2')}</li>
                <li>{t('help.searchFilters.personal3')}</li>
                <li>{t('help.searchFilters.personal4')}</li>
              </ul>
            </div>
          ),
        },
        {
          key: 'search-by-hold',
          label: t('help.searchByHold.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/search-by-hold.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/help/search-by-hold.png"
                  alt={t('help.searchByHold.imgAlt')}
                  className={styles.featureImage}
                />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.searchByHold.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.searchByHold.howLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.searchByHold.step1')}</li>
                <li>{t('help.searchByHold.step2')}</li>
                <li>{t('help.searchByHold.step3')}</li>
                <li>{t('help.searchByHold.step4')}</li>
              </ol>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.searchByHold.includeLabel')}
                </Typography>{' '}
                {t('help.searchByHold.includeBody')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.searchByHold.excludeLabel')}
                </Typography>{' '}
                {t('help.searchByHold.excludeBody')}
              </Typography>
            </div>
          ),
        },
      ],
    },
    {
      key: 'connectivity',
      label: (
        <span>
          <ApiOutlined className={styles.sectionIcon} />
          {t('help.sections.connectivity.label')}
        </span>
      ),
      children: [
        {
          key: 'bluetooth',
          label: t('help.bluetooth.q'),
          children: (
            <div className={styles.answerContent}>
              <Typography variant="body1" component="p">
                {t('help.bluetooth.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.bluetooth.requirementsLabel')}
                </Typography>
              </Typography>
              <ul>
                <li>{t('help.bluetooth.req1')}</li>
                <li>{t('help.bluetooth.req2')}</li>
                <li>{t('help.bluetooth.req3')}</li>
                <li>{t('help.bluetooth.req4')}</li>
              </ul>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.bluetooth.connectLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.bluetooth.connect1')}</li>
                <li>{t('help.bluetooth.connect2')}</li>
                <li>{t('help.bluetooth.connect3')}</li>
              </ol>
              <Typography variant="body1" component="p">
                {t('help.bluetooth.outro')}
              </Typography>
            </div>
          ),
        },
        {
          key: 'user-sync',
          label: t('help.userSync.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/settings-aurora.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/help/settings-aurora.png" alt={t('help.userSync.imgAlt')} className={styles.featureImage} />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.userSync.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.userSync.linkLabel')}
                </Typography>
              </Typography>
              <ol>
                <li>{t('help.userSync.link1')}</li>
                <li>{t('help.userSync.link2')}</li>
                <li>{t('help.userSync.link3')}</li>
                <li>{t('help.userSync.link4')}</li>
              </ol>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.userSync.syncsLabel')}
                </Typography>
              </Typography>
              <ul>
                <li>{t('help.userSync.syncs1')}</li>
                <li>{t('help.userSync.syncs2')}</li>
                <li>{t('help.userSync.syncs3')}</li>
              </ul>
              <Typography variant="body1" component="p">
                {t('help.userSync.outro')}
              </Typography>
            </div>
          ),
        },
        {
          key: 'logbook',
          label: t('help.logbook.q'),
          children: (
            <div className={styles.answerContent}>
              <picture>
                <source srcSet="/help/climb-detail.avif" type="image/avif" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/help/climb-detail.png" alt={t('help.logbook.imgAlt')} className={styles.featureImage} />
              </picture>
              <Typography variant="body1" component="p">
                {t('help.logbook.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.logbook.fromLabel')}
                </Typography>
              </Typography>
              <ul>
                <BoldRow label={t('help.logbook.actions.tickLabel')} body={t('help.logbook.actions.tickBody')} />
                <BoldRow label={t('help.logbook.actions.logLabel')} body={t('help.logbook.actions.logBody')} />
                <BoldRow
                  label={t('help.logbook.actions.favoriteLabel')}
                  body={t('help.logbook.actions.favoriteBody')}
                />
              </ul>
              <Typography variant="body1" component="p">
                {t('help.logbook.outro')}
              </Typography>
            </div>
          ),
        },
        {
          key: 'offline',
          label: t('help.offline.q'),
          children: (
            <div className={styles.answerContent}>
              <Typography variant="body1" component="p">
                {t('help.offline.intro')}
              </Typography>
              <Typography variant="body1" component="p">
                <Typography variant="body2" component="span" fontWeight={600}>
                  {t('help.offline.worksLabel')}
                </Typography>
              </Typography>
              <ul>
                <li>{t('help.offline.works1')}</li>
                <li>{t('help.offline.works2')}</li>
                <li>{t('help.offline.works3')}</li>
                <li>{t('help.offline.works4')}</li>
              </ul>
              <Typography variant="body1" component="p">
                {t('help.offline.outro')}
              </Typography>
            </div>
          ),
        },
      ],
    },
  ];

  return (
    <Box className={styles.pageLayout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Logo size="sm" showText={false} />
        <Typography variant="h6" component="h4" className={styles.headerTitle}>
          {t('help.headerTitle')}
        </Typography>
      </Box>

      <Box component="main" className={styles.content}>
        <MuiCard>
          <CardContent>
            <div className={styles.heroSection}>
              <HelpOutlineOutlined className={styles.heroIcon} />
              <Typography variant="h4" component="h2" className={styles.heroTitle}>
                {t('help.hero.title')}
              </Typography>
              <Typography variant="body2" component="span" color="text.secondary" className={styles.heroSubtitle}>
                {t('help.hero.subtitle')}
              </Typography>
            </div>

            {helpSections.map((section) => (
              <Accordion
                key={section.key}
                expanded={expandedSection === section.key}
                onChange={(_, isExpanded) => setExpandedSection(isExpanded ? section.key : false)}
                className={styles.mainCollapse}
              >
                <AccordionSummary expandIcon={<ExpandMoreOutlined />}>{section.label}</AccordionSummary>
                <AccordionDetails>
                  {section.children.map((item) => (
                    <Accordion key={item.key} className={styles.nestedCollapse}>
                      <AccordionSummary expandIcon={<ExpandMoreOutlined />}>{item.label}</AccordionSummary>
                      <AccordionDetails>{item.children}</AccordionDetails>
                    </Accordion>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </MuiCard>
      </Box>
    </Box>
  );
}

'use client';

import React from 'react';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import {
  GitHub,
  GroupOutlined,
  FavoriteBorderOutlined,
  ApiOutlined,
  RocketLaunchOutlined,
} from '@mui/icons-material';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Logo from '@/app/components/brand/logo';
import BackButton from '@/app/components/back-button';
import styles from './about.module.css';

export default function AboutContent() {
  return (
    <Box className={styles.pageLayout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Logo size="sm" showText={false} />
        <Typography variant="h4" className={styles.headerTitle}>
          About
        </Typography>
      </Box>

      <Box component="main" className={styles.content}>
        <MuiCard>
          <CardContent>
          <Stack spacing={3} className={styles.cardContent}>
            {/* Hero Section */}
            <div className={styles.heroSection}>
              <Logo size="lg" linkToHome={false} />
              <Typography variant="h2" className={styles.heroTitle}>
                Track, Train, and Climb Together
              </Typography>
              <Typography variant="body2" component="span" color="text.secondary" className={styles.heroSubtitle}>
                One app for every climbing board
              </Typography>
            </div>

            {/* Our Vision */}
            <section>
              <Typography variant="h3">
                <RocketLaunchOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                Our Vision
              </Typography>
              <Typography variant="body1" component="p">
                Kilter, Tension, MoonBoard, Decoy, Grasshopper. Every board has its own app
                and its own walled garden. Your training shouldn&apos;t be locked inside one of them.
              </Typography>
              <Typography variant="body1" component="p">
                Boardsesh works across all of them so you can just climb.
              </Typography>
            </section>

            {/* Features */}
            <section>
              <Typography variant="h3">
                <GroupOutlined className={`${styles.sectionIcon} ${styles.successIcon}`} />
                What Boardsesh Offers
              </Typography>
              <ul className={styles.featureList}>
                <li>
                  <Typography variant="body2" component="span" fontWeight={600}>Queue management.</Typography> Take turns without the awkward &quot;who&apos;s next?&quot;
                </li>
                <li>
                  <Typography variant="body2" component="span" fontWeight={600}>Party Mode.</Typography> Share a session and climb together in real time
                </li>
                <li>
                  <Typography variant="body2" component="span" fontWeight={600}>Multi-board.</Typography> Works with Kilter, Tension, MoonBoard, and more
                </li>
                <li>
                  <Typography variant="body2" component="span" fontWeight={600}>Community-driven.</Typography> Built and improved by people who actually climb
                </li>
                <li>
                  <Typography variant="body2" component="span" fontWeight={600}>Self-hostable.</Typography> Run your own instance if that&apos;s your thing
                </li>
              </ul>
            </section>

            {/* Open Source */}
            <section>
              <Typography variant="h3">
                <GitHub className={styles.sectionIcon} />
                Open Source
              </Typography>
              <Typography variant="body1" component="p">
                Boardsesh is open source under the Apache license. Browse the code, send a PR,
                file a bug, or fork the whole project.
              </Typography>
              <Typography variant="body1" component="p">
                <MuiLink
                  href="https://github.com/marcodejongh/boardsesh"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub →
                </MuiLink>
              </Typography>
            </section>

            {/* API Documentation */}
            <section>
              <Typography variant="h3">
                <ApiOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                API Documentation
              </Typography>
              <Typography variant="body1" component="p">
                Want to build on climbing data? The API is public. Have at it.
              </Typography>
              <Typography variant="body1" component="p">
                <MuiLink href="/docs">Explore the API Documentation →</MuiLink>
              </Typography>
            </section>

            {/* Collaboration */}
            <section>
              <Typography variant="h3">
                <FavoriteBorderOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                Join the Community
              </Typography>
              <Typography variant="body1" component="p">
                Whether you write code, set problems, or just want to tell us what&apos;s broken,
                we&apos;d like to hear from you.
              </Typography>
            </section>

            {/* Legal */}
            <section>
              <Typography variant="body1" component="p">
                <MuiLink href="/legal">Legal &amp; Intellectual Property Policy</MuiLink>
              </Typography>
            </section>

            {/* Call to Action */}
            <section className={styles.callToAction}>
              <Typography variant="body1" component="p" color="text.secondary">
                Made by climbers. Open to everyone.
              </Typography>
            </section>
          </Stack>
          </CardContent>
        </MuiCard>
      </Box>
    </Box>
  );
}

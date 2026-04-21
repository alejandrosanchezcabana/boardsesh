"use client";

import React from "react";
import MuiCard from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import MuiLink from "@mui/material/Link";
import { GavelOutlined } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import BackButton from "@/app/components/back-button";
import styles from "../about/about.module.css";

export default function LegalContent() {
  return (
    <Box className={styles.pageLayout}>
      <Box component="header" className={styles.header}>
        <BackButton fallbackUrl="/" />
        <Typography variant="h4" className={styles.headerTitle}>
          Legal
        </Typography>
      </Box>

      <Box component="main" className={styles.content}>
        <MuiCard>
          <CardContent>
            <Stack spacing={3} className={styles.cardContent}>
              {/* Intro */}
              <section>
                <Typography variant="h3">
                  <GavelOutlined className={`${styles.sectionIcon} ${styles.primaryIcon}`} />
                  Legal &amp; Intellectual Property Policy
                </Typography>
                <Typography variant="body1" component="p">
                  Boardsesh is a free, open-source, community-built alternative for browsing and
                  interacting with standardised LED climbing training boards (Kilter Board, Tension
                  Board, MoonBoard, and others). It is non-commercial and maintained entirely by
                  volunteers.
                </Typography>
                <Typography variant="body1" component="p">
                  We believe climbers should have the freedom to choose how they interact with
                  hardware they&apos;ve purchased, and that community-created data should remain
                  accessible to the community.
                </Typography>
              </section>

              {/* Climb Data */}
              <section>
                <Typography variant="h3">Our Position on Climb Data</Typography>

                <Typography variant="h4" sx={{ mt: 2 }}>
                  Climbs are factual data
                </Typography>
                <Typography variant="body1" component="p">
                  A climb on a standardised board is a list of hold positions on a fixed,
                  standardised layout (e.g. &quot;start on A5, use B12, C3, D18, finish on
                  K11&quot;), combined with a grade and wall angle. This is factual, functional
                  information &mdash; comparable to a chess position, a set of GPS coordinates, or a
                  phone number &mdash; not a creative work of authorship.
                </Typography>
                <Typography variant="body1" component="p">
                  Under U.S. copyright law, facts are not copyrightable (
                  <em>Feist Publications, Inc. v. Rural Telephone Service Co.</em>, 499 U.S. 340
                  (1991)). A standardised board with a finite number of holds (typically
                  200&ndash;500) produces climb definitions that are inherently constrained,
                  factual, and functional.
                </Typography>

                <Typography variant="h4" sx={{ mt: 2 }}>
                  The database is community-created
                </Typography>
                <Typography variant="body1" component="p">
                  The climb databases for these boards are almost entirely user-generated content.
                  Individual climbers create and submit climbs. The board manufacturers did not
                  author this content &mdash; they provide a platform for submission and display.
                </Typography>
                <Typography variant="body1" component="p">
                  The licensing position varies by manufacturer, but in no case does a manufacturer
                  own the community&apos;s climb data:
                </Typography>
                <Typography variant="body1" component="p">
                  <strong>Aurora Climbing</strong> (Kilter Board, Tension Board, and others):
                  Aurora&apos;s Terms of Use grant them a &quot;perpetual, unrestricted, unlimited,
                  non-exclusive, irrevocable license&quot; over user-submitted content. Crucially,
                  this license is <strong>non-exclusive</strong> &mdash; it does not transfer
                  ownership to Aurora, nor does it prevent the original creator (or third parties)
                  from independently using, collecting, or presenting the same factual data.
                </Typography>
                <Typography variant="body1" component="p">
                  <strong>Moon Climbing</strong> (MoonBoard): As of the last review of Moon
                  Climbing&apos;s public-facing legal documents (February 2026), Moon Climbing has
                  no app-specific Terms of Service, no End User License Agreement, and no
                  contributed content license governing the MoonBoard app or its climb database. In
                  the absence of any such agreement, Moon Climbing has no contractual claim over
                  climbs created and submitted by its users.
                </Typography>

                <Typography variant="h4" sx={{ mt: 2 }}>
                  Comprehensive databases have weak compilation protection
                </Typography>
                <Typography variant="body1" component="p">
                  Even where a database arrangement might qualify for thin copyright protection as a
                  compilation, the U.S. Supreme Court has held that protection extends only to
                  creative selection or arrangement &mdash; not to the underlying facts. A database
                  that comprehensively collects all user submissions without editorial curation (as
                  these platforms do) is analogous to an alphabetical phone directory, which the
                  Court found unprotectable in <em>Feist</em>.
                </Typography>
              </section>

              {/* Attribution */}
              <section>
                <Typography variant="h3">Attribution &amp; Respect for Creators</Typography>
                <Typography variant="body1" component="p">
                  We respect the climbing community and the people who create climbs.
                </Typography>
                <ul className={styles.featureList}>
                  <li>
                    <Typography variant="body1" component="span">
                      Where climb creator information is available, we attribute the creator by
                      their username.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      We do not claim authorship of climbs we did not create.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      If you are the creator of a climb and would like it removed, please{" "}
                      <MuiLink
                        href="https://github.com/marcodejongh/boardsesh/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        open an issue
                      </MuiLink>{" "}
                      or contact us and we will honour your request promptly.
                    </Typography>
                  </li>
                </ul>
              </section>

              {/* Interoperability */}
              <section>
                <Typography variant="h3">Interoperability &amp; Hardware Compatibility</Typography>
                <Typography variant="body1" component="p">
                  This project provides software and hardware designs that are compatible with
                  standardised climbing board hardware. Climbers who have purchased these boards
                  have a right to use third-party software and controllers with their own hardware.
                </Typography>

                <Typography variant="h4" sx={{ mt: 2 }}>
                  Software interoperability
                </Typography>
                <Typography variant="body1" component="p">
                  Our app communicates with board controllers over standard Bluetooth protocols. The
                  Bluetooth communication protocol used by these boards is unencrypted and based on
                  commodity hardware (WS2812B addressable LEDs driven by standard Bluetooth
                  controllers). Implementing a compatible Bluetooth interface for the purpose of
                  interoperability is well-established as lawful under both U.S. and EU law (
                  <em>Sega Enterprises Ltd. v. Accolade, Inc.</em>, 977 F.2d 1510 (9th Cir. 1992);
                  EU Directive 2009/24/EC, Article 6).
                </Typography>

                <Typography variant="h4" sx={{ mt: 2 }}>
                  Open-source controller
                </Typography>
                <Typography variant="body1" component="p">
                  This project also offers open-source controller hardware and firmware designs. The
                  controller is an independent, original implementation that communicates using the
                  same Bluetooth protocol as the official controllers. It is built on commodity
                  components (standard microcontrollers and WS2812B LEDs) and does not incorporate
                  any proprietary firmware, code, or hardware designs from any board manufacturer.
                  No patents are known to exist covering the LED controller systems used by any
                  current board manufacturer.
                </Typography>
                <Typography variant="body1" component="p">
                  Our controller is designed to be interoperable with both this project&apos;s
                  software and, at the user&apos;s discretion, official manufacturer apps. Any such
                  interoperability is initiated by the end user on their own hardware.
                </Typography>
              </section>

              {/* Trademark */}
              <section>
                <Typography variant="h3">Trademark Usage</Typography>
                <Typography variant="body1" component="p">
                  We use board and product names (e.g. &quot;Kilter Board&quot;,
                  &quot;MoonBoard&quot;, &quot;Tension Board&quot;) solely to describe hardware
                  compatibility and interoperability. These names are trademarks of their respective
                  owners. This project is not affiliated with, endorsed by, or sponsored by Aurora
                  Climbing, Moon Climbing, or any board manufacturer.
                </Typography>
              </section>

              {/* DMCA */}
              <section>
                <Typography variant="h3">DMCA &amp; Takedown Requests</Typography>
                <Typography variant="body1" component="p">
                  We take intellectual property concerns seriously. If you believe any material in
                  this project infringes your copyright, please contact us with the following
                  information:
                </Typography>
                <ol className={styles.featureList}>
                  <li>
                    <Typography variant="body1" component="span">
                      Identification of the copyrighted work you believe is infringed.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      Identification of the material you believe is infringing, with enough detail
                      for us to locate it.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      Your contact information (name, address, email, phone number).
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      A statement that you have a good faith belief that the use is not authorised
                      by the copyright owner, its agent, or the law.
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body1" component="span">
                      A statement, under penalty of perjury, that the information in your notice is
                      accurate and that you are the copyright owner or authorised to act on their
                      behalf.
                    </Typography>
                  </li>
                </ol>
                <Typography variant="body1" component="p">
                  We will review all valid requests promptly and in good faith. We may also file a
                  counter-notice where we believe a takedown request is based on a misidentification
                  of the material or a misunderstanding of the law.
                </Typography>
                <Typography variant="body1" component="p">
                  <strong>Contact:</strong>{" "}
                  <MuiLink href="mailto:legal@mdj.ac">legal@mdj.ac</MuiLink>
                </Typography>
              </section>

              {/* Community Note */}
              <section>
                <Typography variant="h3">A Note to the Community</Typography>
                <Typography variant="body1" component="p">
                  The climbing community has a long tradition of openly sharing beta. This project
                  exists in that spirit. We are not trying to harm any company &mdash; we are trying
                  to give climbers better tools to interact with hardware they already own and data
                  they helped create.
                </Typography>
                <Typography variant="body1" component="p">
                  Manufacturers continue to benefit from this ecosystem. Our project drives demand
                  for their physical products (holds, boards, panels) where they provide genuine
                  value. We simply believe climbers deserve a choice in how they interact with their
                  hardware.
                </Typography>
                <Typography variant="body1" component="p">
                  If you are a board manufacturer and would like to discuss collaboration or have
                  concerns, we welcome open dialogue. Please reach out.
                </Typography>
              </section>

              {/* Third-Party Notices */}
              <section>
                <Typography variant="h3">Third-Party Notices</Typography>
                <ul className={styles.featureList}>
                  <li>
                    <Typography variant="body1" component="span">
                      <strong>Person Falling icon</strong> from{" "}
                      <MuiLink
                        href="https://fontawesome.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Font Awesome Free 6.7.2
                      </MuiLink>{" "}
                      by @fontawesome. License:{" "}
                      <MuiLink
                        href="https://fontawesome.com/license/free"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CC BY 4.0
                      </MuiLink>
                      . Copyright 2024 Fonticons, Inc.
                    </Typography>
                  </li>
                </ul>
              </section>

              {/* Footer */}
              <section className={styles.callToAction}>
                <Typography variant="body2" component="p" color="text.secondary">
                  This document is provided for informational purposes and does not constitute legal
                  advice. Last updated: 08-02-2026
                </Typography>
              </section>
            </Stack>
          </CardContent>
        </MuiCard>
      </Box>
    </Box>
  );
}

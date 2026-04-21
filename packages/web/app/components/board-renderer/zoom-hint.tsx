"use client";

import React, { useEffect, useState, useCallback } from "react";
import ZoomInOutlined from "@mui/icons-material/ZoomInOutlined";
import { getPreference, setPreference } from "@/app/lib/user-preferences-db";
import styles from "./swipe-board-carousel.module.css";

const PREF_KEY = "playview:zoomHintSeen";
const AUTO_DISMISS_MS = 4000;

interface ZoomHintProps {
  visible: boolean;
}

export default function ZoomHint({ visible }: ZoomHintProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    getPreference<boolean>(PREF_KEY).then((seen) => {
      if (cancelled || seen) return;
      setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setShow(false);
      setPreference(PREF_KEY, true);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [show]);

  const dismiss = useCallback(() => {
    setShow(false);
    setPreference(PREF_KEY, true);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.zoomHintOverlay} onClick={dismiss}>
      <div className={styles.zoomHintPill}>
        <ZoomInOutlined sx={{ fontSize: 20 }} />
        <span>Pinch to zoom</span>
      </div>
    </div>
  );
}

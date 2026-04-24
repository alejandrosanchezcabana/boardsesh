'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './collapsible-section.module.css';

export type CollapsibleSectionConfig = {
  key: string;
  label: string;
  title: string;
  defaultSummary: string;
  /** Optional dynamic summary parts. When omitted or it returns [], falls back to defaultSummary. */
  getSummary?: () => string[];
  content: React.ReactNode;
  /** When true, content is only mounted while this section is the active one. */
  lazy?: boolean;
  /** When true, this section should be the initially active one (overrides defaultActiveKey). */
  defaultActive?: boolean;
  /** When true, removes the inner padding around the expanded content. */
  flush?: boolean;
};

type CollapsibleSectionProps = {
  sections: CollapsibleSectionConfig[];
  defaultActiveKey?: string;
  /** When provided, forces this section to be active (e.g. for a guided tour). */
  forcedActiveKey?: string | null;
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ sections, defaultActiveKey, forcedActiveKey }) => {
  const sectionDefaultActive = sections.find((s) => s.defaultActive);
  const initialActiveKey = sectionDefaultActive?.key ?? defaultActiveKey ?? null;
  const [activeKey, setActiveKey] = useState<string | null>(initialActiveKey);
  // Preserve the initial default so we can restore it if we transition back
  // from controlled (forcedActiveKey set) to uncontrolled mode.
  const initialActiveKeyRef = useRef(initialActiveKey);

  useEffect(() => {
    if (forcedActiveKey !== undefined) {
      setActiveKey(forcedActiveKey);
    } else {
      // Transitioned back to uncontrolled — snap back to the original default
      // so the last forced value doesn't leak into user-driven mode.
      setActiveKey(initialActiveKeyRef.current);
    }
  }, [forcedActiveKey]);

  const effectiveActiveKey = forcedActiveKey !== undefined ? forcedActiveKey : activeKey;
  const interactionDisabled = forcedActiveKey !== undefined;

  return (
    <div className={styles.steppedContainer}>
      {sections.map((section) => {
        const isActive = effectiveActiveKey === section.key;
        const summaryParts = section.getSummary?.() ?? [];
        const summaryText = summaryParts.length > 0 ? summaryParts.join(' \u00B7 ') : section.defaultSummary;

        const shouldRenderContent = section.lazy ? isActive : true;

        return (
          <div
            key={section.key}
            className={`${styles.sectionCard} ${isActive ? styles.sectionCardActive : ''}`}
            {...(!isActive && !interactionDisabled ? { onClick: () => setActiveKey(section.key) } : {})}
          >
            <div
              className={`${styles.collapsedRow} ${isActive ? styles.collapsedRowActive : ''}`}
              {...(isActive && !interactionDisabled ? { onClick: () => setActiveKey(null) } : {})}
            >
              <span className={styles.collapsedLabel}>{isActive ? section.title : section.label}</span>
              <span className={`${styles.collapsedSummary} ${isActive ? styles.collapsedSummaryHidden : ''}`}>
                {summaryText}
              </span>
            </div>
            <div className={`${styles.expandableContent} ${isActive ? styles.expandableContentOpen : ''}`}>
              <div className={styles.expandableInner}>
                <div className={section.flush ? styles.expandableInnerFlush : styles.expandableInnerPadding}>
                  {shouldRenderContent ? section.content : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CollapsibleSection;

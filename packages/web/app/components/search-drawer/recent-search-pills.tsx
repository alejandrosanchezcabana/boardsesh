'use client';

import React, { useState, useEffect, useCallback } from 'react';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import { getRecentSearches, getFilterKey, RecentSearch, RECENT_SEARCHES_CHANGED_EVENT } from './recent-searches-storage';
import { useUISearchParams } from '@/app/components/queue-control/ui-searchparams-provider';
import { SearchRequestPagination } from '@/app/lib/types';
import { DEFAULT_SEARCH_PARAMS } from '@/app/lib/url-utils';
import { getSearchPillFullSummary } from './search-summary-utils';
import styles from './recent-search-pills.module.css';

const RecentSearchPills: React.FC = () => {
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const { uiSearchParams, updateFilters } = useUISearchParams();

  const currentFilterKey = getFilterKey(uiSearchParams);

  const refreshSearches = useCallback(() => {
    getRecentSearches().then(setSearches);
  }, []);

  useEffect(() => {
    refreshSearches();

    const handleChange = () => refreshSearches();
    window.addEventListener(RECENT_SEARCHES_CHANGED_EVENT, handleChange);

    return () => {
      window.removeEventListener(RECENT_SEARCHES_CHANGED_EVENT, handleChange);
    };
  }, [refreshSearches]);

  if (searches.length === 0) return null;

  const handleApply = (filters: Partial<SearchRequestPagination>) => {
    updateFilters(filters, true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.pillList}>
        {searches.map((search) => {
          const isActive = getFilterKey(search.filters) === currentFilterKey;
          // Compute full summary for tooltip (shows all filters without truncation)
          const fullFilters = { ...DEFAULT_SEARCH_PARAMS, ...search.filters } as SearchRequestPagination;
          const tooltipText = getSearchPillFullSummary(fullFilters);
          return (
            <button
              key={search.id}
              type="button"
              className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
              onClick={() => handleApply(search.filters)}
              title={tooltipText}
            >
              <HistoryOutlined className={styles.pillIcon} />
              <span className={styles.pillLabel}>{search.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecentSearchPills;

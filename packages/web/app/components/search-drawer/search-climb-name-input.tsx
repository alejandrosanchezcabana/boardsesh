'use client';

import React from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import { useTranslation } from 'react-i18next';
import { useUISearchParams } from '../queue-control/ui-searchparams-provider';

const SearchClimbNameInput = () => {
  const { t } = useTranslation('climbs');
  const { uiSearchParams, updateFilters } = useUISearchParams();

  return (
    <TextField
      placeholder={t('search.placeholders.climbs')}
      variant="outlined"
      size="small"
      fullWidth
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlined color="action" />
            </InputAdornment>
          ),
        },
      }}
      onChange={(e) => {
        updateFilters({
          name: e.target.value,
        });
      }}
      value={uiSearchParams.name}
    />
  );
};

export default SearchClimbNameInput;

'use client';

import React, { useState } from 'react';
import MuiAlert from '@mui/material/Alert';
import MuiTooltip from '@mui/material/Tooltip';
import MuiTypography from '@mui/material/Typography';
import MuiButton from '@mui/material/Button';
import MuiSelect, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import MuiSwitch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import LoginOutlined from '@mui/icons-material/LoginOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import { TENSION_KILTER_GRADES } from '@/app/lib/board-data';
import { useUISearchParams } from '@/app/components/queue-control/ui-searchparams-provider';
import { useBoardProvider } from '@/app/components/board-provider/board-provider-context';
import SearchClimbNameInput from './search-climb-name-input';
import SetterNameSelect from './setter-name-select';
import ClimbHoldSearchForm from './climb-hold-search-form';
import type { BoardDetails } from '@/app/lib/types';
import { buildGradeRangeUpdate } from './grade-range-utils';
import { useAuthModal } from '@/app/components/providers/auth-modal-provider';
import {
  getQualityPanelSummary,
  getStatusPanelSummary,
  getUserPanelSummary,
  getHoldsPanelSummary,
} from './search-summary-utils';
import CollapsibleSection, {
  type CollapsibleSectionConfig,
} from '@/app/components/collapsible-section/collapsible-section';
import styles from './accordion-search-form.module.css';

import { KILTER_HOMEWALL_LAYOUT_ID } from '@/app/lib/board-constants';

type AccordionSearchFormProps = {
  boardDetails: BoardDetails;
  defaultActiveKey?: string[];
};

const AccordionSearchForm: React.FC<AccordionSearchFormProps> = ({ boardDetails, defaultActiveKey }) => {
  const { uiSearchParams, updateFilters } = useUISearchParams();
  const { isAuthenticated } = useBoardProvider();
  const grades = TENSION_KILTER_GRADES;
  const { openAuthModal } = useAuthModal();
  const [showSort, setShowSort] = useState(false);

  const isKilterHomewall = boardDetails.board_name === 'kilter' && boardDetails.layout_id === KILTER_HOMEWALL_LAYOUT_ID;
  const isLargestSize = boardDetails.size_name?.toLowerCase().includes('12');
  const showTallClimbsFilter = isKilterHomewall && isLargestSize;

  const statusValue: 'any' | 'drafts' | 'established' | 'projects' = uiSearchParams.onlyDrafts
    ? 'drafts'
    : uiSearchParams.projectsOnly
      ? 'projects'
      : uiSearchParams.minAscents >= 2
        ? 'established'
        : 'any';

  const handleGradeChange = (type: 'min' | 'max', value: number | undefined) => {
    updateFilters(buildGradeRangeUpdate(type, value, uiSearchParams.minGrade, uiSearchParams.maxGrade));
  };

  const climbContent = (
    <div className={styles.panelContent}>
      <div className={styles.inputGroup}>
        <span className={styles.fieldLabel}>Climb Name</span>
        <SearchClimbNameInput />
      </div>

      <div className={styles.inputGroup}>
        <span className={styles.fieldLabel}>Grade Range</span>
        <div className={styles.gradeRow}>
          <MuiSelect
            value={uiSearchParams.minGrade || 0}
            onChange={(e: SelectChangeEvent<number>) => handleGradeChange('min', Number(e.target.value) || 0)}
            className={styles.fullWidth}
            size="small"
            displayEmpty
            MenuProps={{ disableScrollLock: true }}
          >
            <MenuItem value={0}>Min</MenuItem>
            {grades.map((grade) => (
              <MenuItem key={grade.difficulty_id} value={grade.difficulty_id}>
                {grade.difficulty_name}
              </MenuItem>
            ))}
          </MuiSelect>
          <MuiSelect
            value={uiSearchParams.maxGrade || 0}
            onChange={(e: SelectChangeEvent<number>) => handleGradeChange('max', Number(e.target.value) || 0)}
            className={styles.fullWidth}
            size="small"
            displayEmpty
            MenuProps={{ disableScrollLock: true }}
          >
            <MenuItem value={0}>Max</MenuItem>
            {grades.map((grade) => (
              <MenuItem key={grade.difficulty_id} value={grade.difficulty_id}>
                {grade.difficulty_name}
              </MenuItem>
            ))}
          </MuiSelect>
        </div>
      </div>

      {showTallClimbsFilter && (
        <div className={styles.switchGroup}>
          <FormControlLabel
            className={styles.switchRow}
            labelPlacement="start"
            control={
              <MuiSwitch
                size="small"
                color="primary"
                checked={uiSearchParams.onlyTallClimbs}
                onChange={(_, checked) => updateFilters({ onlyTallClimbs: checked })}
              />
            }
            label={
              <MuiTooltip title="Show only climbs that use holds in the bottom 8 rows (only available on 10x12 boards)">
                <MuiTypography variant="body2" component="span">
                  Tall Climbs Only
                </MuiTypography>
              </MuiTooltip>
            }
          />
        </div>
      )}

      <div className={styles.inputGroup}>
        <span className={styles.fieldLabel}>Setter</span>
        <SetterNameSelect />
      </div>

      <MuiButton
        variant="text"
        size="small"
        startIcon={<ArrowUpwardOutlined />}
        className={styles.sortToggle}
        onClick={() => setShowSort(!showSort)}
      >
        Sort
      </MuiButton>

      {showSort && (
        <div className={styles.inputGroup}>
          <div className={styles.sortRow}>
            <MuiSelect
              value={uiSearchParams.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value })}
              className={styles.fullWidth}
              size="small"
              MenuProps={{ disableScrollLock: true }}
            >
              <MenuItem value="ascents">Ascents</MenuItem>
              <MenuItem value="popular">Popular</MenuItem>
              <MenuItem value="difficulty">Difficulty</MenuItem>
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="quality">Quality</MenuItem>
              <MenuItem value="creation">Creation</MenuItem>
            </MuiSelect>
            <MuiSelect
              value={uiSearchParams.sortOrder}
              onChange={(e) => updateFilters({ sortOrder: e.target.value })}
              className={styles.fullWidth}
              size="small"
              MenuProps={{ disableScrollLock: true }}
            >
              <MenuItem value="desc">Desc</MenuItem>
              <MenuItem value="asc">Asc</MenuItem>
            </MuiSelect>
          </div>
        </div>
      )}
    </div>
  );

  const sections: CollapsibleSectionConfig[] = [
    {
      key: 'quality',
      label: 'Quality',
      title: 'Quality',
      defaultSummary: 'Any',
      getSummary: () => getQualityPanelSummary(uiSearchParams),
      content: (
        <div className={styles.panelContent}>
          <div className={styles.qualityRow}>
            <div className={styles.compactInputGroup}>
              <span className={styles.fieldLabel}>Min Ascents</span>
              <TextField
                type="number"
                slotProps={{ htmlInput: { min: 1 } }}
                // 0 is the "no filter" sentinel (DEFAULT_SEARCH_PARAMS.minAscents),
                // so render it as the empty placeholder rather than a literal "0".
                value={uiSearchParams.minAscents || ''}
                onChange={(e) => updateFilters({ minAscents: Number(e.target.value) || 0 })}
                className={styles.fullWidth}
                placeholder="Any"
                size="small"
              />
            </div>
            <div className={styles.compactInputGroup}>
              <span className={styles.fieldLabel}>Min Rating</span>
              <TextField
                type="number"
                slotProps={{ htmlInput: { min: 1.0, max: 3.0, step: 0.1 } }}
                // 0 is the "no filter" sentinel (DEFAULT_SEARCH_PARAMS.minRating),
                // so render it as the empty placeholder rather than a literal "0".
                value={uiSearchParams.minRating || ''}
                onChange={(e) => updateFilters({ minRating: Number(e.target.value) || 0 })}
                className={styles.fullWidth}
                placeholder="Any"
                size="small"
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <span className={styles.fieldLabel}>Grade Accuracy</span>
            <MuiSelect
              value={uiSearchParams.gradeAccuracy ?? 0}
              onChange={(e) => updateFilters({ gradeAccuracy: Number(e.target.value) || 0 })}
              className={styles.fullWidth}
              size="small"
              MenuProps={{ disableScrollLock: true }}
            >
              <MenuItem value={0}>Any</MenuItem>
              <MenuItem value={0.2}>Somewhat Accurate (&lt;0.2)</MenuItem>
              <MenuItem value={0.1}>Very Accurate (&lt;0.1)</MenuItem>
              <MenuItem value={0.05}>Extremely Accurate (&lt;0.05)</MenuItem>
            </MuiSelect>
          </div>

          <div className={styles.switchGroup}>
            <FormControlLabel
              className={styles.switchRow}
              labelPlacement="start"
              control={
                <MuiSwitch
                  size="small"
                  color="primary"
                  checked={uiSearchParams.onlyClassics}
                  onChange={(_, checked) => updateFilters({ onlyClassics: checked })}
                />
              }
              label={
                <MuiTypography variant="body2" component="span">
                  Classics Only
                </MuiTypography>
              }
            />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Ascent Status',
      title: 'Ascent Status',
      defaultSummary: 'Any',
      getSummary: () => getStatusPanelSummary(uiSearchParams),
      content: (
        <div className={styles.panelContent}>
          <RadioGroup
            className={styles.radioGroup}
            value={statusValue}
            onChange={(e) => {
              const value = e.target.value as 'any' | 'drafts' | 'established' | 'projects';
              if (value === 'drafts') {
                updateFilters({
                  onlyDrafts: true,
                  projectsOnly: false,
                  minAscents: 0,
                  sortBy: 'creation',
                  sortOrder: 'desc',
                });
              } else if (value === 'established') {
                updateFilters({
                  onlyDrafts: false,
                  projectsOnly: false,
                  minAscents: 2,
                });
              } else if (value === 'projects') {
                updateFilters({
                  onlyDrafts: false,
                  projectsOnly: true,
                  minAscents: 0,
                });
              } else {
                updateFilters({
                  onlyDrafts: false,
                  projectsOnly: false,
                  minAscents: 0,
                });
              }
            }}
          >
            <FormControlLabel
              className={styles.radioRow}
              value="any"
              control={<Radio size="small" color="primary" />}
              label={
                <MuiTypography variant="body2" component="span">
                  Any
                </MuiTypography>
              }
            />
            <FormControlLabel
              className={styles.radioRow}
              value="established"
              control={<Radio size="small" color="primary" />}
              label={
                <MuiTooltip title="Climbs with 2 or more ascents">
                  <MuiTypography variant="body2" component="span">
                    Established
                  </MuiTypography>
                </MuiTooltip>
              }
            />
            <FormControlLabel
              className={styles.radioRow}
              value="projects"
              control={<Radio size="small" color="primary" />}
              label={
                <MuiTooltip title="Climbs with zero recorded ascents">
                  <MuiTypography variant="body2" component="span">
                    Projects
                  </MuiTypography>
                </MuiTooltip>
              }
            />
            <FormControlLabel
              className={styles.radioRow}
              value="drafts"
              disabled={!isAuthenticated}
              control={<Radio size="small" color="primary" />}
              label={
                <MuiTypography variant="body2" component="span">
                  My Drafts{!isAuthenticated ? ' (sign in)' : ''}
                </MuiTypography>
              }
            />
          </RadioGroup>
          {!isAuthenticated && (
            <MuiAlert
              severity="info"
              className={styles.progressAlert}
              action={
                <MuiButton
                  size="small"
                  variant="contained"
                  startIcon={<LoginOutlined />}
                  onClick={() =>
                    openAuthModal({
                      title: 'Sign in to Boardsesh',
                      description: 'Sign in to browse your draft climbs.',
                    })
                  }
                >
                  Sign In
                </MuiButton>
              }
            >
              Sign in to filter by your drafts.
            </MuiAlert>
          )}
        </div>
      ),
    },
    {
      key: 'user',
      label: 'Progress',
      title: 'Progress',
      defaultSummary: 'All climbs',
      getSummary: () => getUserPanelSummary(uiSearchParams),
      content: (
        <div className={styles.panelContent}>
          {!isAuthenticated ? (
            <MuiAlert
              severity="info"
              className={styles.progressAlert}
              action={
                <MuiButton
                  size="small"
                  variant="contained"
                  startIcon={<LoginOutlined />}
                  onClick={() =>
                    openAuthModal({
                      title: 'Sign in to Boardsesh',
                      description: 'Create an account to filter by your climbing progress and save favorites.',
                    })
                  }
                >
                  Sign In
                </MuiButton>
              }
            >
              <strong>Sign in to filter by your data</strong>
              <br />
              Login to filter climbs based on your attempt and completion history.
            </MuiAlert>
          ) : (
            <div className={styles.switchGroup}>
              <FormControlLabel
                className={styles.switchRow}
                labelPlacement="start"
                control={
                  <MuiSwitch
                    size="small"
                    color="primary"
                    checked={uiSearchParams.hideAttempted}
                    onChange={(_, checked) => updateFilters({ hideAttempted: checked })}
                  />
                }
                label={
                  <MuiTypography variant="body2" component="span">
                    Hide Attempted
                  </MuiTypography>
                }
              />
              <FormControlLabel
                className={styles.switchRow}
                labelPlacement="start"
                control={
                  <MuiSwitch
                    size="small"
                    color="primary"
                    checked={uiSearchParams.hideCompleted}
                    onChange={(_, checked) => updateFilters({ hideCompleted: checked })}
                  />
                }
                label={
                  <MuiTypography variant="body2" component="span">
                    Hide Completed
                  </MuiTypography>
                }
              />
              <FormControlLabel
                className={styles.switchRow}
                labelPlacement="start"
                control={
                  <MuiSwitch
                    size="small"
                    color="primary"
                    checked={uiSearchParams.showOnlyAttempted}
                    onChange={(_, checked) => updateFilters({ showOnlyAttempted: checked })}
                  />
                }
                label={
                  <MuiTypography variant="body2" component="span">
                    Only Attempted
                  </MuiTypography>
                }
              />
              <FormControlLabel
                className={styles.switchRow}
                labelPlacement="start"
                control={
                  <MuiSwitch
                    size="small"
                    color="primary"
                    checked={uiSearchParams.showOnlyCompleted}
                    onChange={(_, checked) => updateFilters({ showOnlyCompleted: checked })}
                  />
                }
                label={
                  <MuiTypography variant="body2" component="span">
                    Only Completed
                  </MuiTypography>
                }
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'holds',
      label: 'Holds',
      title: 'Search by Hold',
      defaultSummary: 'Any',
      getSummary: () => getHoldsPanelSummary(uiSearchParams),
      lazy: true,
      content: (
        <div className={styles.holdSearchContainer}>
          <ClimbHoldSearchForm boardDetails={boardDetails} />
        </div>
      ),
    },
  ];

  return (
    <div className={styles.formWrapper}>
      <div className={styles.primaryContent}>{climbContent}</div>
      <CollapsibleSection sections={sections} defaultActiveKey={defaultActiveKey?.[0]} />
    </div>
  );
};

export default AccordionSearchForm;

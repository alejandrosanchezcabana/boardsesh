'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import MuiTypography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MuiSelect from '@mui/material/Select';
import type { SelectChangeEvent } from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';

interface BoardFormFieldValues {
  name: string;
  slug?: string;
  description: string;
  locationName: string;
  isPublic: boolean;
  isOwned: boolean;
  angle?: number;
  isAngleAdjustable?: boolean;
  layoutId?: number;
  sizeId?: number;
  setIds?: string;
  serialNumber?: string;
}

interface BoardFormProps {
  /** Form title displayed at the top */
  title: string;
  /** Submit button label */
  submitLabel: string;
  /** Initial field values */
  initialValues: BoardFormFieldValues;
  /** Whether to show the slug field (edit mode only) */
  showSlugField?: boolean;
  /** Slug helper text prefix */
  slugHelperPrefix?: string;
  /** Placeholder for the name field */
  namePlaceholder?: string;
  /** Placeholder for the description field */
  descriptionPlaceholder?: string;
  /** Placeholder for the location field */
  locationPlaceholder?: string;
  /** Available angles for this board type */
  availableAngles?: number[];
  /** Config editing: show layout/size/set selectors */
  configEditable?: {
    boardType: string;
    layouts: { id: number; name: string }[];
    sizes: Record<string, { id: number; name: string; description: string }[]>;
    sets: Record<string, { id: number; name: string }[]>;
  };
  /** Called with form values on submit. Should throw on failure. */
  onSubmit: (values: BoardFormFieldValues) => Promise<void>;
  /** Optional cancel handler */
  onCancel?: () => void;
}

/**
 * Shared form component for creating and editing boards.
 * Consolidates the duplicated form structure between CreateBoardForm and EditBoardForm.
 */
export default function BoardForm({
  title,
  submitLabel,
  initialValues,
  showSlugField = false,
  slugHelperPrefix = 'boardsesh.com/b/',
  namePlaceholder,
  descriptionPlaceholder = 'Optional description',
  locationPlaceholder,
  availableAngles,
  configEditable,
  onSubmit,
  onCancel,
}: BoardFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [slug, setSlug] = useState(initialValues.slug ?? '');
  const [description, setDescription] = useState(initialValues.description);
  const [locationName, setLocationName] = useState(initialValues.locationName);
  const [isPublic, setIsPublic] = useState(initialValues.isPublic);
  const [isOwned, setIsOwned] = useState(initialValues.isOwned);
  const [angle, setAngle] = useState(initialValues.angle ?? 40);
  const [isAngleAdjustable, setIsAngleAdjustable] = useState(initialValues.isAngleAdjustable ?? true);
  const [serialNumber, setSerialNumber] = useState(initialValues.serialNumber ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Config editing state
  const [layoutId, setLayoutId] = useState(initialValues.layoutId);
  const [sizeId, setSizeId] = useState(initialValues.sizeId);
  const [selectedSets, setSelectedSets] = useState<number[]>(
    initialValues.setIds ? initialValues.setIds.split(',').map(Number) : [],
  );

  const availableSizes = configEditable && layoutId
    ? configEditable.sizes[`${configEditable.boardType}-${layoutId}`] ?? []
    : [];
  const availableSets = configEditable && layoutId && sizeId
    ? configEditable.sets[`${configEditable.boardType}-${layoutId}-${sizeId}`] ?? []
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim(),
        locationName: locationName.trim(),
        isPublic,
        isOwned,
        angle,
        isAngleAdjustable,
        ...(configEditable ? {
          layoutId,
          sizeId,
          setIds: selectedSets.length > 0 ? selectedSets.sort((a, b) => a - b).join(',') : undefined,
        } : {}),
        serialNumber: serialNumber.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <MuiTypography variant="h6">{title}</MuiTypography>

      {configEditable && (
        <>
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            You can change the board layout because no climbs have been logged yet.
          </Alert>

          <FormControl size="small" fullWidth>
            <InputLabel>Layout</InputLabel>
            <MuiSelect
              value={layoutId ?? ''}
              label="Layout"
              onChange={(e: SelectChangeEvent<number | string>) => {
                const newLayout = e.target.value as number;
                setLayoutId(newLayout);
                // Reset dependent fields
                const newSizes = configEditable.sizes[`${configEditable.boardType}-${newLayout}`] ?? [];
                setSizeId(newSizes.length > 0 ? newSizes[0].id : undefined);
                setSelectedSets([]);
              }}
            >
              {configEditable.layouts.map(({ id, name: layoutName }) => (
                <MenuItem key={id} value={id}>{layoutName}</MenuItem>
              ))}
            </MuiSelect>
          </FormControl>

          {availableSizes.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>Size</InputLabel>
              <MuiSelect
                value={sizeId ?? ''}
                label="Size"
                onChange={(e: SelectChangeEvent<number | string>) => {
                  setSizeId(e.target.value as number);
                  setSelectedSets([]);
                }}
              >
                {availableSizes.map(({ id, name: sizeName, description: sizeDesc }) => (
                  <MenuItem key={id} value={id}>{`${sizeName} ${sizeDesc}`}</MenuItem>
                ))}
              </MuiSelect>
            </FormControl>
          )}

          {availableSets.length > 0 && (
            <FormControl size="small" fullWidth>
              <InputLabel>Hold Sets</InputLabel>
              <MuiSelect
                multiple
                value={selectedSets}
                label="Hold Sets"
                onChange={(e) => {
                  const val = e.target.value as unknown as number[];
                  setSelectedSets(val);
                }}
                renderValue={() =>
                  availableSets
                    .filter((s) => selectedSets.includes(s.id))
                    .map((s) => s.name)
                    .join(', ')
                }
              >
                {availableSets.map(({ id, name: setName }) => (
                  <MenuItem key={id} value={id}>
                    <Checkbox checked={selectedSets.includes(id)} />
                    <ListItemText primary={setName} />
                  </MenuItem>
                ))}
              </MuiSelect>
            </FormControl>
          )}
        </>
      )}

      <TextField
        label="Board Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        fullWidth
        size="small"
        placeholder={namePlaceholder}
        inputProps={{ maxLength: 100 }}
      />

      {showSlugField && (
        <TextField
          label="URL Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
          fullWidth
          size="small"
          helperText={`${slugHelperPrefix}${slug || '...'}`}
        />
      )}

      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        fullWidth
        size="small"
        multiline
        minRows={2}
        maxRows={4}
        placeholder={descriptionPlaceholder}
      />

      <TextField
        label="Location"
        value={locationName}
        onChange={(e) => setLocationName(e.target.value)}
        fullWidth
        size="small"
        placeholder={locationPlaceholder}
      />

      <TextField
        label="Controller Serial Number"
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.target.value)}
        fullWidth
        size="small"
        placeholder="e.g. ABC-12345"
        inputProps={{ maxLength: 100 }}
      />

      {availableAngles && availableAngles.length > 0 && (
        <TextField
          label="Default Angle"
          value={angle}
          onChange={(e) => setAngle(Number(e.target.value))}
          select
          fullWidth
          size="small"
        >
          {availableAngles.map((a) => (
            <MenuItem key={a} value={a}>
              {a}°
            </MenuItem>
          ))}
        </TextField>
      )}

      <FormControlLabel
        control={<Switch checked={isAngleAdjustable} onChange={(e) => setIsAngleAdjustable(e.target.checked)} />}
        label="Angle is adjustable"
      />

      <FormControlLabel
        control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
        label="Public board"
      />

      <FormControlLabel
        control={<Switch checked={isOwned} onChange={(e) => setIsOwned(e.target.checked)} />}
        label="I own this board"
      />

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
        {onCancel && (
          <MuiButton variant="text" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </MuiButton>
        )}
        <MuiButton
          type="submit"
          variant="contained"
          disabled={isSubmitting || !name.trim()}
        >
          {isSubmitting ? <CircularProgress size={20} color="inherit" /> : submitLabel}
        </MuiButton>
      </Box>
    </Box>
  );
}

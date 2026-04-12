'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MuiAlert from '@mui/material/Alert';
import MuiTooltip from '@mui/material/Tooltip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import MuiButton from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import MuiSwitch from '@mui/material/Switch';
import MuiSlider from '@mui/material/Slider';
import MuiSelect from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Badge from '@mui/material/Badge';
import { SettingsOutlined, LocalFireDepartmentOutlined, SaveOutlined, LoginOutlined, CloudUploadOutlined, GetAppOutlined, DraftsOutlined, DeleteOutlined, CheckCircleOutlined } from '@mui/icons-material';
import { themeTokens } from '@/app/theme/theme-config';
import HoldIndicator from './hold-indicator';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { track } from '@vercel/analytics';
import { useSession } from 'next-auth/react';
import BoardRenderer from '../board-renderer/board-renderer';
import MoonBoardRenderer from '../moonboard-renderer/moonboard-renderer';
import ZoomableBoard from '../board-renderer/zoomable-board';
import SwipeableDrawer from '../swipeable-drawer/swipeable-drawer';
import { useBoardProvider } from '../board-provider/board-provider-context';
import { useCreateClimb } from './use-create-climb';
import { useMoonBoardCreateClimb } from './use-moonboard-create-climb';
import { useBoardBluetooth } from '../board-bluetooth-control/use-board-bluetooth';
import type { MoonBoardClimbDuplicateMatch, UpdateClimbInput } from '@boardsesh/shared-schema';
import type { BoardDetails, Climb } from '@/app/lib/types';
import { convertLitUpHoldsStringToMap } from '../board-renderer/util';
import type { LitUpHoldsMap } from '../board-renderer/types';
import { MOONBOARD_GRADES, MOONBOARD_ANGLES } from '@/app/lib/moonboard-config';
import { getSoftFontGradeColor } from '@/app/lib/grade-colors';
import { useColorMode } from '@/app/hooks/use-color-mode';
import { parseScreenshot } from '@boardsesh/moonboard-ocr/browser';
import { convertOcrHoldsToMap } from '@/app/lib/moonboard-climbs-db';
import { createGraphQLClient, execute, type Client } from '../graphql-queue/graphql-client';
import { getBackendWsUrl } from '@/app/lib/backend-url';
import { createGraphQLHttpClient } from '@/app/lib/graphql/client';
import { useAuthModal } from '@/app/components/providers/auth-modal-provider';
import { useSnackbar } from '../providers/snackbar-provider';
import { useOptionalQueueActions } from '@/app/components/graphql-queue';
import { refreshClimbSearchAfterSave } from '@/app/lib/climb-search-cache';
import CreateClimbHeatmapOverlay from './create-climb-heatmap-overlay';
import DraftsDrawer from './drafts-drawer';
import HoldTypePicker from './hold-type-picker';
import { useHoldTypePicker } from './use-hold-type-picker';
import { useCreateHeaderBridgeSetters } from './create-header-bridge-context';
import {
  SEARCH_CLIMBS_COUNT,
  type ClimbSearchCountResponse,
  type ClimbSearchInputVariables,
} from '@/app/lib/graphql/operations/climb-search';
import {
  convertLitUpHoldsMapToMoonBoardHolds,
  isMoonBoardDuplicateError,
} from '@/app/lib/moonboard-climb-helpers';
import styles from './create-climb-form.module.css';
import {
  CHECK_MOONBOARD_CLIMB_DUPLICATES_QUERY,
  type CheckMoonBoardClimbDuplicatesResponse,
  type CheckMoonBoardClimbDuplicatesVariables,
  SAVE_MOONBOARD_CLIMB_MUTATION,
  type SaveMoonBoardClimbMutationVariables,
  type SaveMoonBoardClimbMutationResponse,
} from '@/app/lib/graphql/operations/new-climb-feed';
import { useWsAuthToken } from '@/app/hooks/use-ws-auth-token';


const SETTINGS_DRAWER_STYLES = {
  wrapper: { height: 'auto', maxHeight: '70vh' },
  body: { padding: 0 },
};


interface CreateClimbFormValues {
  name: string;
  description: string;
  isDraft: boolean;
}

type BoardType = 'aurora' | 'moonboard';

interface CreateClimbFormProps {
  boardType: BoardType;
  angle: number;
  // Aurora-specific
  boardDetails?: BoardDetails;
  forkFrames?: string;
  forkName?: string;
  // Pre-loaded climb to edit (Aurora only, for now). When present the form
  // seeds its hold map, name, description, and saved-row tracker from this
  // climb on mount so the user can pick up a draft or recent publish via URL.
  editClimb?: Climb;
  // MoonBoard-specific
  layoutFolder?: string;
  layoutId?: number;
  holdSetImages?: string[];
}

export default function CreateClimbForm({
  boardType,
  angle,
  boardDetails,
  forkFrames,
  forkName,
  editClimb,
  layoutFolder,
  layoutId,
  holdSetImages,
}: CreateClimbFormProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { register, update, deregister } = useCreateHeaderBridgeSetters();
  const { mode } = useColorMode();
  const isDark = mode === 'dark';
  const queryClient = useQueryClient();

  // Aurora-specific hooks
  const { isAuthenticated, saveClimb, updateClimb } = useBoardProvider();
  const { showMessage } = useSnackbar();
  const { token: wsAuthToken } = useWsAuthToken();

  // Determine which auth check to use based on board type
  const isLoggedIn = boardType === 'aurora' ? isAuthenticated : !!session?.user?.id;
  const hasMoonBoardSessionUser = !!session?.user;

  // Convert fork frames to initial holds map if provided (Aurora only)
  const initialHoldsMap = useMemo(() => {
    if (boardType !== 'aurora' || !forkFrames || !boardDetails) return undefined;
    const framesMap = convertLitUpHoldsStringToMap(forkFrames, boardDetails.board_name);
    return framesMap[0] ?? undefined;
  }, [boardType, forkFrames, boardDetails]);

  // Aurora hold management
  const auroraClimb = useCreateClimb(boardDetails?.board_name || 'kilter', { initialHoldsMap });

  // MoonBoard hold management
  const moonboardClimb = useMoonBoardCreateClimb();

  // Use the appropriate hook values based on board type
  const {
    litUpHoldsMap,
    setHoldState,
    startingCount,
    finishCount,
    totalHolds,
    isValid,
    resetHolds: baseResetHolds,
  } = boardType === 'aurora' ? auroraClimb : moonboardClimb;

  const handCount = boardType === 'moonboard' ? moonboardClimb.handCount : 0;
  const generateFramesString = boardType === 'aurora' ? auroraClimb.generateFramesString : undefined;
  const setLitUpHoldsMap = boardType === 'moonboard' ? moonboardClimb.setLitUpHoldsMap : undefined;
  const loadAuroraHolds = boardType === 'aurora' ? auroraClimb.loadHolds : undefined;

  // Bluetooth for Aurora boards
  const { isConnected, sendFramesToBoard } = useBoardBluetooth({
    boardDetails: boardType === 'aurora' ? boardDetails : undefined
  });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const graphqlClientRef = useRef<Client | null>(null);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  // Set to true briefly after a successful save so the Save button flips to a
  // "Saved" confirmation state for both draft and published saves.
  const [justSaved, setJustSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);
  const { openAuthModal } = useAuthModal();
  const [pendingFormValues, setPendingFormValues] = useState<CreateClimbFormValues | null>(null);

  // Tracks the row we've saved during this form session so subsequent Save
  // presses update that row in place instead of creating a new climb. Cleared
  // by Clear. Set by both create (saveClimb) and load-a-draft flows.
  interface SavedClimbState {
    uuid: string;
    boardType: string;
    /** ISO timestamp of when the row was created */
    createdAt: string | null;
    /** ISO timestamp of when the row was first published; null while still draft */
    publishedAt: string | null;
    isDraft: boolean;
  }
  const [savedClimb, setSavedClimb] = useState<SavedClimbState | null>(null);

  // Tracks the uuid of the queue item representing the climb the user is
  // authoring. Set when the climb first lands in the queue (first save or
  // drafts-drawer load) and reused on subsequent saves to replace the same
  // queue slot in place instead of piling up duplicates. Cleared by Clear.
  const [queueItemUuid, setQueueItemUuid] = useState<string | null>(null);

  // The create page is always mounted inside GraphQLQueueProvider, but use the
  // optional hook so unit tests that render the form in isolation don't blow up.
  const queueActions = useOptionalQueueActions();

  const markJustSaved = useCallback(() => {
    setJustSaved(true);
    if (savedTimeoutRef.current !== null) {
      window.clearTimeout(savedTimeoutRef.current);
    }
    savedTimeoutRef.current = window.setTimeout(() => {
      setJustSaved(false);
      savedTimeoutRef.current = null;
    }, 3000);
  }, []);

  const clearJustSaved = useCallback(() => {
    setJustSaved(false);
    if (savedTimeoutRef.current !== null) {
      window.clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = null;
    }
  }, []);

  // Clear the timer on unmount so we don't touch state after the form is gone.
  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current !== null) {
        window.clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Published climbs remain editable for 24 hours after their first publish.
  // Drafts are editable indefinitely. We re-check on every render so the lock
  // naturally engages while the form is open past the window.
  const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (!savedClimb?.publishedAt) return;
    const publishedMs = Date.parse(savedClimb.publishedAt);
    if (!Number.isFinite(publishedMs)) return;
    const remaining = publishedMs + EDIT_WINDOW_MS - Date.now();
    if (remaining <= 0) {
      setNowTick(Date.now());
      return;
    }
    // Tick once when the edit window expires so the button flips to locked.
    const timeoutId = window.setTimeout(() => setNowTick(Date.now()), remaining + 50);
    return () => window.clearTimeout(timeoutId);
  }, [savedClimb?.publishedAt, EDIT_WINDOW_MS]);

  const editLocked = useMemo(() => {
    if (!savedClimb) return false;
    if (savedClimb.isDraft) return false; // drafts are always editable
    if (!savedClimb.publishedAt) return false;
    const publishedMs = Date.parse(savedClimb.publishedAt);
    if (!Number.isFinite(publishedMs)) return false;
    return nowTick - publishedMs > EDIT_WINDOW_MS;
  }, [savedClimb, nowTick, EDIT_WINDOW_MS]);

  // Aurora-specific state
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.7);
  const [isDraft, setIsDraft] = useState(true);

  // MoonBoard-specific state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrWarnings, setOcrWarnings] = useState<string[]>([]);
  const [userGrade, setUserGrade] = useState<string | undefined>(undefined);
  const [isBenchmark, setIsBenchmark] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<number>(angle);
  const [moonBoardDuplicateMatch, setMoonBoardDuplicateMatch] = useState<MoonBoardClimbDuplicateMatch | null>(null);
  const [isCheckingMoonBoardDuplicate, setIsCheckingMoonBoardDuplicate] = useState(false);

  // Common state
  const [climbName, setClimbName] = useState(forkName ? `${forkName} fork` : '');
  const [description, setDescription] = useState('');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showDraftsDrawer, setShowDraftsDrawer] = useState(false);
  const zoomResetKey = boardType === 'moonboard' ? `moonboard-${selectedAngle}` : `aurora-${angle}`;
  const climbNameRef = useRef(climbName);
  const setClimbNameRef = useRef(setClimbName);
  const headerActionRef = useRef<React.ReactNode | null>(null);
  const duplicateCheckRequestIdRef = useRef(0);

  // Construct the bulk import URL (MoonBoard only)
  const bulkImportUrl = pathname.replace(/\/create$/, '/import');

  const moonBoardHolds = useMemo(
    () => (boardType === 'moonboard' ? convertLitUpHoldsMapToMoonBoardHolds(litUpHoldsMap) : null),
    [boardType, litUpHoldsMap],
  );

  const moonBoardDuplicateError = useMemo(() => {
    if (!moonBoardDuplicateMatch?.exists) return null;
    return moonBoardDuplicateMatch.existingClimbName
      ? `This hold pattern already exists as "${moonBoardDuplicateMatch.existingClimbName}". Change at least one hold to save.`
      : 'This hold pattern already exists. Change at least one hold to save.';
  }, [moonBoardDuplicateMatch]);

  // Send frames to board whenever litUpHoldsMap changes (Aurora only)
  useEffect(() => {
    if (boardType === 'aurora' && isConnected && generateFramesString) {
      const frames = generateFramesString();
      sendFramesToBoard(frames);
    }
  }, [boardType, litUpHoldsMap, isConnected, generateFramesString, sendFramesToBoard]);

  // As soon as the user edits the climb after a successful save, flip the
  // button back to its normal "Save" state so they can save the revision.
  useEffect(() => {
    if (justSaved) {
      clearJustSaved();
    }
    // We intentionally depend only on the edit signals, not on justSaved
    // itself — otherwise this effect would re-run every time we clear the flag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [climbName, description, litUpHoldsMap]);

  // Hold-type picker: tracks which hold the user just tapped, anchors the
  // popover against its DOM element, and routes selections back to setHoldState.
  const picker = useHoldTypePicker({ litUpHoldsMap, setHoldState });
  const pickerBoardName = boardType === 'aurora' ? boardDetails?.board_name ?? 'kilter' : 'moonboard';

  // Wrap resetHolds so Clear starts a brand-new climb: holds wiped, text fields
  // cleared, Bluetooth board blanked, any lingering "Saved" confirmation
  // dismissed, and the tracked savedClimb row detached so the next Save
  // creates a new climb instead of updating the previous one.
  // Leaves the Draft toggle alone — that's a user preference.
  const resetHolds = useCallback(() => {
    baseResetHolds();
    setClimbName('');
    setDescription('');
    clearJustSaved();
    setSavedClimb(null);
    // Detach the tracked queue slot too — Clear starts a fresh climb, so the
    // next Save should create a new queue item rather than replace the old one.
    // The existing queue item is intentionally left in place; Clear resets the
    // form, not party state.
    setQueueItemUuid(null);
    if (boardType === 'aurora' && isConnected) {
      sendFramesToBoard('');
    }
    if (boardType === 'moonboard') {
      setUserGrade(undefined);
      setIsBenchmark(false);
      setOcrError(null);
      setOcrWarnings([]);
      setMoonBoardDuplicateMatch(null);
    }
  }, [boardType, baseResetHolds, isConnected, sendFramesToBoard, clearJustSaved]);

  // MoonBoard OCR import
  const handleOcrImport = useCallback(async (file: File) => {
    if (boardType !== 'moonboard' || !setLitUpHoldsMap) return;

    setIsOcrProcessing(true);
    setOcrError(null);
    setOcrWarnings([]);

    try {
      const result = await parseScreenshot(file);

      if (!result.success || !result.climb) {
        setOcrError(result.error || 'Failed to parse screenshot');
        return;
      }

      const climb = result.climb;
      const warnings = [...result.warnings];

      // Check angle mismatch
      if (climb.angle !== angle) {
        warnings.push(`Screenshot is for ${climb.angle}° but current page is ${angle}°. Holds imported anyway.`);
      }

      setOcrWarnings(warnings);

      // Convert OCR holds to form state
      const newHoldsMap = convertOcrHoldsToMap(climb.holds);
      setLitUpHoldsMap(newHoldsMap);

      // Populate fields from OCR
      if (climb.name) setClimbName(climb.name);
      if (climb.userGrade) setUserGrade(climb.userGrade);
      if (climb.isBenchmark) setIsBenchmark(true);
      if (climb.setter) setDescription(`Setter: ${climb.setter}`);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'Unknown error during OCR');
    } finally {
      setIsOcrProcessing(false);
    }
  }, [boardType, angle, setLitUpHoldsMap]);

  const runMoonBoardDuplicateCheck = useCallback(async (holds: NonNullable<typeof moonBoardHolds>) => {
    if (!layoutId) return null;

    const requestId = ++duplicateCheckRequestIdRef.current;
    setIsCheckingMoonBoardDuplicate(true);

    try {
      const client = createGraphQLHttpClient();
      const variables: CheckMoonBoardClimbDuplicatesVariables = {
        input: {
          layoutId,
          angle: selectedAngle,
          climbs: [{ clientKey: 'create-form', holds }],
        },
      };

      const response = await client.request<
        CheckMoonBoardClimbDuplicatesResponse,
        CheckMoonBoardClimbDuplicatesVariables
      >(CHECK_MOONBOARD_CLIMB_DUPLICATES_QUERY, variables);
      const duplicateMatch = response.checkMoonBoardClimbDuplicates[0] ?? null;

      if (requestId === duplicateCheckRequestIdRef.current) {
        setMoonBoardDuplicateMatch(duplicateMatch?.exists ? duplicateMatch : null);
      }

      return duplicateMatch?.exists ? duplicateMatch : null;
    } catch (error) {
      console.warn('Failed to check MoonBoard climb duplicates:', error);

      if (requestId === duplicateCheckRequestIdRef.current) {
        setMoonBoardDuplicateMatch(null);
      }

      return null;
    } finally {
      if (requestId === duplicateCheckRequestIdRef.current) {
        setIsCheckingMoonBoardDuplicate(false);
      }
    }
  }, [layoutId, selectedAngle]);

  useEffect(() => {
    if (boardType !== 'moonboard') {
      setMoonBoardDuplicateMatch(null);
      setIsCheckingMoonBoardDuplicate(false);
      return;
    }

    if (!layoutId || !moonBoardHolds || !isValid) {
      duplicateCheckRequestIdRef.current += 1;
      setMoonBoardDuplicateMatch(null);
      setIsCheckingMoonBoardDuplicate(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void runMoonBoardDuplicateCheck(moonBoardHolds);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [boardType, isValid, layoutId, moonBoardHolds, runMoonBoardDuplicateCheck, selectedAngle]);

  // Builds a Climb object from the form's current state + a freshly-issued
  // uuid. Used to push the in-progress climb into the live queue so party
  // peers and a connected Bluetooth board see it as the current climb. Fields
  // the form doesn't own (difficulty, stars, ascents, etc.) get safe defaults
  // — a brand-new draft has nothing to report for those.
  const buildClimbFromFormState = useCallback(
    (uuid: string, frames: string): Climb => ({
      uuid,
      name: climbName,
      description,
      frames,
      angle: boardType === 'moonboard' ? selectedAngle : angle,
      setter_username: session?.user?.name || '',
      ascensionist_count: 0,
      difficulty: '',
      quality_average: '0',
      stars: 0,
      difficulty_error: '0',
      benchmark_difficulty: null,
      mirrored: false,
      is_draft: isDraft,
      layoutId: boardType === 'aurora' ? boardDetails?.layout_id ?? null : layoutId ?? null,
      boardType: boardType === 'aurora' ? boardDetails?.board_name : 'moonboard',
    }),
    [climbName, description, angle, selectedAngle, boardType, session?.user?.name, isDraft, boardDetails?.layout_id, boardDetails?.board_name, layoutId],
  );

  // Pushes the just-saved (or just-updated) climb into the live queue so it
  // becomes the current active climb. On first save we call setCurrentClimb
  // and remember the queue-item uuid; on subsequent saves we call
  // replaceQueueItem against that uuid so the queue slot stays stable.
  // BluetoothAutoSender reacts to currentClimbQueueItem identity changes and
  // pushes new frames to the board automatically, so party peers with a
  // connected board also see the update.
  const syncSavedClimbToQueue = useCallback(
    async (uuid: string, frames: string) => {
      if (!queueActions) return;
      const climb = buildClimbFromFormState(uuid, frames);
      if (queueItemUuid) {
        queueActions.replaceQueueItem(queueItemUuid, climb);
        return;
      }
      const newItem = await queueActions.setCurrentClimb(climb);
      if (newItem) {
        setQueueItemUuid(newItem.uuid);
      }
    },
    [queueActions, queueItemUuid, buildClimbFromFormState],
  );

  // Save climb - Aurora
  //
  // Flow:
  //   - First press (no savedClimb yet): create a new row via saveClimb.
  //   - Subsequent press on the same row: update it in place via updateClimb.
  //     Drafts stay editable indefinitely; published climbs have a 24h window
  //     (enforced on the backend too).
  //
  // The form never navigates away on save anymore — the user stays on the
  // create page and the Save button flips to a transient "Saved" confirmation
  // state. Clearing the form (via Clear) detaches savedClimb so the next
  // save starts a fresh row.
  const doSaveAuroraClimb = useCallback(async () => {
    if (!boardDetails || !generateFramesString) return;

    setIsSaving(true);

    try {
      const frames = generateFramesString();

      // Invalidation keys used in both branches.
      const invalidateDraftCaches = () =>
        Promise.all([
          queryClient.invalidateQueries({ queryKey: ['climbDrafts', boardDetails.board_name, boardDetails.layout_id] }),
          queryClient.invalidateQueries({ queryKey: ['climbDraftsCount', boardDetails.board_name, boardDetails.layout_id] }),
        ]);

      // Decide create-vs-update. We can only update when we have a savedClimb
      // for the current board type and its edit window is still open (for
      // drafts, the window is effectively infinite).
      const canUpdate = !!savedClimb
        && savedClimb.boardType === boardDetails.board_name
        && (savedClimb.isDraft || (
          !!savedClimb.publishedAt
          && Date.now() - Date.parse(savedClimb.publishedAt) <= EDIT_WINDOW_MS
        ));

      if (canUpdate && savedClimb) {
        const updateInput: UpdateClimbInput = {
          uuid: savedClimb.uuid,
          boardType: savedClimb.boardType,
          name: climbName,
          description: description || '',
          frames,
          angle,
          framesCount: 1,
          framesPace: 0,
          isDraft,
        };
        const updateResult = await updateClimb(updateInput);

        // A draft→published transition updates the published climb list too;
        // otherwise we just refresh the drafts cache either way so UI stays
        // in sync.
        if (savedClimb.isDraft && !updateResult.isDraft) {
          await refreshClimbSearchAfterSave(queryClient, boardDetails.board_name, boardDetails.layout_id);
        }
        await invalidateDraftCaches();

        setSavedClimb({
          uuid: updateResult.uuid,
          boardType: boardDetails.board_name,
          createdAt: updateResult.createdAt ?? savedClimb.createdAt,
          publishedAt: updateResult.publishedAt ?? null,
          isDraft: updateResult.isDraft,
        });

        track('Climb Updated', {
          boardLayout: boardDetails.layout_name || '',
          isDraft: updateResult.isDraft,
          holdCount: totalHolds,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[climb-update]', {
            uuid: updateResult.uuid,
            isDraft: updateResult.isDraft,
            publishedAt: updateResult.publishedAt,
          });
        }

        await syncSavedClimbToQueue(updateResult.uuid, frames);

        markJustSaved();
        return;
      }

      // Create a brand-new row.
      const saveResult = await saveClimb({
        layout_id: boardDetails.layout_id,
        name: climbName,
        description: description || '',
        is_draft: isDraft,
        frames,
        frames_count: 1,
        frames_pace: 0,
        angle,
      });

      if (!isDraft) {
        await refreshClimbSearchAfterSave(queryClient, boardDetails.board_name, boardDetails.layout_id);
      }
      await invalidateDraftCaches();

      track('Climb Created', {
        boardLayout: boardDetails.layout_name || '',
        isDraft: isDraft,
        holdCount: totalHolds,
      });

      setSavedClimb({
        uuid: saveResult.uuid,
        boardType: boardDetails.board_name,
        createdAt: saveResult.createdAt ?? null,
        publishedAt: saveResult.publishedAt ?? null,
        isDraft,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[climb-save]', {
          uuid: saveResult?.uuid,
          isDraft,
          publishedAt: saveResult?.publishedAt ?? null,
          boardType: boardDetails.board_name,
          layoutId: boardDetails.layout_id,
          sizeId: boardDetails.size_id,
          setIds: boardDetails.set_ids,
          angle,
        });
      }

      await syncSavedClimbToQueue(saveResult.uuid, frames);

      markJustSaved();
    } catch (error) {
      console.error('Failed to save climb:', error);
      track('Climb Create Failed', {
        boardLayout: boardDetails.layout_name || '',
      });
      showMessage(error instanceof Error ? error.message : 'Failed to save climb. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [boardDetails, generateFramesString, saveClimb, updateClimb, climbName, description, isDraft, angle, totalHolds, queryClient, markJustSaved, savedClimb, showMessage, EDIT_WINDOW_MS, syncSavedClimbToQueue]);

  // Save climb - MoonBoard
  //
  // Mirrors the Aurora flow: first Save creates a new row; subsequent Saves
  // update the tracked row in place (within the 24h post-publish window for
  // non-drafts). The form never navigates away on save.
  //
  // Note: MoonBoard hold re-encoding on update isn't supported by updateClimb,
  // so updates only touch name/description/angle/isDraft. If the user changes
  // holds after a save we intentionally skip the update and create a new row,
  // which the duplicate check will catch if the new holds collide.
  const doSaveMoonBoardClimb = useCallback(async () => {
    const userId = session?.user?.id;
    if (!layoutId || !userId || !moonBoardHolds) return;

    if (moonBoardDuplicateError) {
      showMessage(moonBoardDuplicateError, 'error');
      return;
    }

    setIsSaving(true);

    try {
      if (!wsAuthToken) {
        throw new Error('Authentication required to save climb');
      }

      const invalidateCaches = async (wasDraft: boolean) => {
        if (!wasDraft) {
          await refreshClimbSearchAfterSave(queryClient, 'moonboard', layoutId);
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['climbDrafts', 'moonboard', layoutId] }),
          queryClient.invalidateQueries({ queryKey: ['climbDraftsCount', 'moonboard', layoutId] }),
        ]);
      };

      // Update path: we already have a savedClimb and its edit window is open.
      const canUpdate = !!savedClimb
        && savedClimb.boardType === 'moonboard'
        && (savedClimb.isDraft || (
          !!savedClimb.publishedAt
          && Date.now() - Date.parse(savedClimb.publishedAt) <= EDIT_WINDOW_MS
        ));

      if (canUpdate && savedClimb) {
        const updateInput: UpdateClimbInput = {
          uuid: savedClimb.uuid,
          boardType: 'moonboard',
          name: climbName,
          description: description || '',
          angle: selectedAngle,
          isDraft,
        };
        const updateResult = await updateClimb(updateInput);

        await invalidateCaches(savedClimb.isDraft);

        setSavedClimb({
          uuid: updateResult.uuid,
          boardType: 'moonboard',
          createdAt: updateResult.createdAt ?? savedClimb.createdAt,
          publishedAt: updateResult.publishedAt ?? null,
          isDraft: updateResult.isDraft,
        });

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[climb-update]', {
            uuid: updateResult.uuid,
            isDraft: updateResult.isDraft,
            publishedAt: updateResult.publishedAt,
            boardType: 'moonboard',
          });
        }

        // MoonBoard doesn't regenerate a frames string on update (updateClimb
        // only touches metadata), so reuse whatever the existing queue item
        // already has via an empty frames string — the queue renderer won't
        // use it for MoonBoard and the form's own hold map is authoritative.
        await syncSavedClimbToQueue(updateResult.uuid, '');

        markJustSaved();
        return;
      }

      if (!graphqlClientRef.current) {
        graphqlClientRef.current = createGraphQLClient({
          url: getBackendWsUrl()!,
          authToken: wsAuthToken,
        });
      }

      const variables: SaveMoonBoardClimbMutationVariables = {
        input: {
          boardType: 'moonboard',
          layoutId,
          name: climbName,
          description: description || '',
          holds: moonBoardHolds,
          angle: selectedAngle,
          isDraft: isDraft,
          userGrade,
          isBenchmark,
          setter: undefined,
        },
      };

      const moonBoardResult = await execute<SaveMoonBoardClimbMutationResponse, SaveMoonBoardClimbMutationVariables>(
        graphqlClientRef.current,
        { query: SAVE_MOONBOARD_CLIMB_MUTATION, variables },
      );

      await invalidateCaches(isDraft);

      setSavedClimb({
        uuid: moonBoardResult.saveMoonBoardClimb.uuid,
        boardType: 'moonboard',
        createdAt: moonBoardResult.saveMoonBoardClimb.createdAt ?? null,
        publishedAt: moonBoardResult.saveMoonBoardClimb.publishedAt ?? null,
        isDraft,
      });

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[climb-save]', {
          uuid: moonBoardResult?.saveMoonBoardClimb?.uuid,
          isDraft,
          publishedAt: moonBoardResult?.saveMoonBoardClimb?.publishedAt ?? null,
          boardType: 'moonboard',
          layoutId,
          angle: selectedAngle,
        });
      }

      await syncSavedClimbToQueue(moonBoardResult.saveMoonBoardClimb.uuid, '');

      markJustSaved();
    } catch (error) {
      console.error('Failed to save climb:', error);
      if (error instanceof Error && isMoonBoardDuplicateError(error.message)) {
        await runMoonBoardDuplicateCheck(moonBoardHolds);
      }
      showMessage(error instanceof Error ? error.message : 'Failed to save climb. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    layoutId,
    session,
    moonBoardHolds,
    moonBoardDuplicateError,
    climbName,
    description,
    userGrade,
    isBenchmark,
    isDraft,
    selectedAngle,
    wsAuthToken,
    queryClient,
    showMessage,
    runMoonBoardDuplicateCheck,
    markJustSaved,
    savedClimb,
    updateClimb,
    EDIT_WINDOW_MS,
    syncSavedClimbToQueue,
  ]);

  const handleAuthSuccess = useCallback(async () => {
    if (pendingFormValues) {
      setTimeout(async () => {
        setPendingFormValues(null);
      }, 1000);
    }
  }, [pendingFormValues]);

  const handlePublish = useCallback(async () => {
    if (!isValid || !climbName.trim()) {
      return;
    }

    if (boardType === 'moonboard' && (isCheckingMoonBoardDuplicate || moonBoardDuplicateError)) {
      if (moonBoardDuplicateError) {
        showMessage(moonBoardDuplicateError, 'error');
      }
      return;
    }

    if (!isLoggedIn) {
      if (boardType === 'aurora') {
        setPendingFormValues({ name: climbName, description, isDraft });
        openAuthModal({
          title: 'Sign in to save your climb',
          description: 'Create an account or sign in to save your climb to the board.',
          onSuccess: handleAuthSuccess,
        });
      }
      return;
    }

    if (boardType === 'aurora') {
      await doSaveAuroraClimb();
    } else {
      await doSaveMoonBoardClimb();
    }
  }, [
    boardType,
    isValid,
    climbName,
    isLoggedIn,
    description,
    isDraft,
    isCheckingMoonBoardDuplicate,
    moonBoardDuplicateError,
    doSaveAuroraClimb,
    doSaveMoonBoardClimb,
    openAuthModal,
    handleAuthSuccess,
    showMessage,
  ]);

  const canSave = isLoggedIn
    && isValid
    && climbName.trim().length > 0
    && (boardType !== 'moonboard' || (!isCheckingMoonBoardDuplicate && !moonBoardDuplicateError));

  const handleToggleSettings = useCallback(() => {
    setShowSettingsPanel((prev) => !prev);
  }, []);

  // Drafts: count query for the badge (Aurora only — MoonBoard has its own flow).
  // Scoped to the current layout/size/sets/angle so users see drafts for the wall in front of them.
  const canShowDrafts = boardType === 'aurora' && !!boardDetails && isLoggedIn;
  const draftsCountQueryKey = useMemo(() => {
    if (!boardDetails) return ['climbDraftsCount', 'disabled'] as const;
    return [
      'climbDraftsCount',
      boardDetails.board_name,
      boardDetails.layout_id,
      boardDetails.size_id,
      boardDetails.set_ids.join(','),
      angle,
    ] as const;
  }, [boardDetails, angle]);

  const { data: draftsCount } = useQuery({
    queryKey: draftsCountQueryKey,
    enabled: canShowDrafts && !!wsAuthToken,
    queryFn: async (): Promise<number> => {
      if (!boardDetails) return 0;
      const input: ClimbSearchInputVariables['input'] = {
        boardName: boardDetails.board_name,
        layoutId: boardDetails.layout_id,
        sizeId: boardDetails.size_id,
        setIds: boardDetails.set_ids.join(','),
        angle,
        page: 0,
        pageSize: 1,
        onlyDrafts: true,
      };
      const client = createGraphQLHttpClient(wsAuthToken);
      const result = await client.request<ClimbSearchCountResponse>(SEARCH_CLIMBS_COUNT, { input });
      return result.searchClimbs.totalCount ?? 0;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const handleOpenDrafts = useCallback(() => {
    setShowDraftsDrawer(true);
  }, []);

  const handleCloseDrafts = useCallback(() => {
    setShowDraftsDrawer(false);
  }, []);

  // Loads a draft climb back into the form so the user can keep working on it.
  // Aurora-only for now — the MoonBoard form doesn't mount a drafts drawer.
  //
  // Tracks the loaded row as savedClimb so subsequent Save presses update it
  // in place rather than creating a duplicate.
  //
  // The create form only ever produces single-frame climbs (framesCount: 1),
  // but a draft may originate from elsewhere with multiple frames. In that
  // case we flatten every frame into a single map — later frames override
  // earlier ones for the same hold id — so no holds are silently dropped.
  // Frame separation is lost on re-save, which is acceptable because the
  // editor has no concept of multiple frames.
  const handleLoadDraft = useCallback((climb: Climb) => {
    if (boardType !== 'aurora' || !boardDetails || !loadAuroraHolds) return;

    const framesMap = convertLitUpHoldsStringToMap(climb.frames, boardDetails.board_name);
    const frameEntries = Object.entries(framesMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, frame]) => frame);
    const mergedHolds = frameEntries.reduce((acc, frame) => ({ ...acc, ...frame }), {} as LitUpHoldsMap);
    loadAuroraHolds(mergedHolds);
    setClimbName(climb.name || '');
    setDescription(climb.description || '');
    setSavedClimb({
      uuid: climb.uuid,
      boardType: boardDetails.board_name,
      createdAt: climb.created_at ?? null,
      publishedAt: climb.published_at ?? null,
      isDraft: climb.is_draft ?? true,
    });
    clearJustSaved();
    // Push the loaded draft into the queue as the current climb so party peers
    // and any connected Bluetooth board see it. Start from a fresh queue slot
    // so subsequent saves replace the same item in place.
    setQueueItemUuid(null);
    if (queueActions) {
      void queueActions.setCurrentClimb(climb).then((newItem) => {
        if (newItem) setQueueItemUuid(newItem.uuid);
      });
    }
    // The litUpHoldsMap effect at the top of this component pushes new frames
    // to a connected Bluetooth board automatically.
  }, [boardType, boardDetails, loadAuroraHolds, clearJustSaved, queueActions]);

  // When the parent passes an editClimb (typically from
  // /b/.../create?editClimbUuid=...), seed the form once it has mounted.
  // Tracked by uuid so we only seed once per distinct target climb — subsequent
  // saves update savedClimb in place and must not trigger another reload.
  const seededEditClimbUuidRef = useRef<string | null>(null);
  useEffect(() => {
    if (!editClimb || boardType !== 'aurora' || !boardDetails || !loadAuroraHolds) return;
    if (seededEditClimbUuidRef.current === editClimb.uuid) return;
    seededEditClimbUuidRef.current = editClimb.uuid;
    handleLoadDraft(editClimb);
  }, [editClimb, boardType, boardDetails, loadAuroraHolds, handleLoadDraft]);

  const handleToggleHeatmap = useCallback(() => {
    if (boardType !== 'aurora' || !boardDetails) return;
    setShowHeatmap((prev) => {
      track(`Create Climb Heatmap ${!prev ? 'Shown' : 'Hidden'}`, {
        boardLayout: boardDetails.layout_name || '',
      });
      return !prev;
    });
  }, [boardType, boardDetails]);

  const headerAction = useMemo(() => {
    const renderSaveButton = () => {
      if (editLocked) {
        return (
          <MuiTooltip title="Published climbs can only be edited for 24 hours after first publish.">
            <span>
              <MuiButton
                size="small"
                variant="outlined"
                color="inherit"
                disabled
              >
                Edit window closed
              </MuiButton>
            </span>
          </MuiTooltip>
        );
      }
      if (justSaved) {
        // Pure confirmation state — no onClick so a mis-tap can't fire off
        // another save (which would otherwise publish a draft the user
        // thought they were just dismissing). The button flips back to the
        // normal Save state automatically on the next edit or after the
        // 3s timeout.
        return (
          <MuiButton
            size="small"
            variant="contained"
            color="success"
            startIcon={<CheckCircleOutlined />}
            disableRipple
          >
            Saved
          </MuiButton>
        );
      }
      return (
        <MuiButton
          size="small"
          variant="contained"
          startIcon={isSaving ? <CircularProgress size={16} /> : <SaveOutlined />}
          disabled={isSaving || !canSave}
          onClick={handlePublish}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </MuiButton>
      );
    };

    if (boardType === 'aurora') {
      if (!isAuthenticated) {
        return (
          <MuiButton
            size="small"
            variant="contained"
            startIcon={<LoginOutlined />}
            onClick={() => openAuthModal({ title: 'Sign in to save your climb', description: 'Create an account or sign in to save your climb to the board.', onSuccess: handleAuthSuccess })}
          >
            Sign In
          </MuiButton>
        );
      }
      return renderSaveButton();
    }

    // MoonBoard
    if (!hasMoonBoardSessionUser) {
      return (
        <Link href="/api/auth/signin">
          <MuiButton size="small" variant="contained" startIcon={<LoginOutlined />}>
            Log In
          </MuiButton>
        </Link>
      );
    }
    return renderSaveButton();
  }, [boardType, isAuthenticated, openAuthModal, handleAuthSuccess, isSaving, canSave, handlePublish, hasMoonBoardSessionUser, justSaved, editLocked]);

  climbNameRef.current = climbName;
  setClimbNameRef.current = setClimbName;
  headerActionRef.current = headerAction;

  useEffect(() => {
    register({
      climbName: climbNameRef.current,
      setClimbName: setClimbNameRef.current,
      actionSlot: headerActionRef.current,
    });

    return () => {
      deregister();
    };
  }, [register, deregister]);

  useEffect(() => {
    update({
      climbName,
      setClimbName,
      actionSlot: headerAction,
    });
  }, [climbName, headerAction, setClimbName, update]);

  return (
    <div className={styles.pageContainer} data-testid="climb-setter">
      {/* Header section: alerts + control row */}
      <div className={styles.headerSection}>
        {/* MoonBoard OCR errors */}
        {boardType === 'moonboard' && ocrError && (
          <MuiAlert
            severity="error"
            onClose={() => setOcrError(null)}
            className={styles.alertBanner}
          >
            Import Failed: {ocrError}
          </MuiAlert>
        )}

        {boardType === 'moonboard' && ocrWarnings.length > 0 && (
          <MuiAlert
            severity="warning"
            onClose={() => setOcrWarnings([])}
            className={styles.alertBanner}
          >
            Import Warnings: {ocrWarnings.map((w, i) => <div key={i}>{w}</div>)}
          </MuiAlert>
        )}

        {boardType === 'moonboard' && moonBoardDuplicateError && (
          <MuiAlert severity="error" className={styles.alertBanner}>
            {moonBoardDuplicateError}
          </MuiAlert>
        )}

        {boardType === 'moonboard' && !moonBoardDuplicateError && isCheckingMoonBoardDuplicate && isValid && (
          <MuiAlert severity="info" className={styles.alertBanner}>
            Checking whether this MoonBoard climb already exists...
          </MuiAlert>
        )}

        {/* Holds row: hold count indicators + Clear button */}
        <div className={styles.holdsRow}>
          <Stack direction="row" className={styles.holdsRowChips} alignItems="center" spacing={1.5}>
            {boardType === 'aurora' ? (
              <>
                <HoldIndicator count={startingCount} max={2} color={themeTokens.colors.success} label="Starting" />
                <HoldIndicator count={finishCount} max={2} color={themeTokens.colors.pink} label="Finish" />
                <HoldIndicator count={totalHolds} color={themeTokens.colors.primary} label="Total" />
              </>
            ) : (
              <>
                <HoldIndicator count={startingCount} max={2} color={themeTokens.colors.error} label="Start" />
                <HoldIndicator count={handCount} color={themeTokens.colors.primary} label="Hand" />
                <HoldIndicator count={finishCount} max={2} color={themeTokens.colors.success} label="Finish" />
                <HoldIndicator count={totalHolds} color={themeTokens.colors.secondary} label="Total" />
              </>
            )}
          </Stack>
          <MuiTooltip title="Clear all holds">
            <span>
              <IconButton size="small" onClick={resetHolds} disabled={totalHolds === 0}>
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </span>
          </MuiTooltip>
        </div>
      </div>

      {/* Board section: zoomable SVG renderer */}
      <div className={styles.boardSectionWrapper} data-testid="climb-setter-board">
        <ZoomableBoard resetKey={zoomResetKey}>
          {boardType === 'aurora' && boardDetails ? (
            <div className={styles.zoomFill}>
              <BoardRenderer
                boardDetails={boardDetails}
                litUpHoldsMap={litUpHoldsMap}
                mirrored={false}
                onHoldClick={picker.handleHoldClick}
                fillHeight
              />
              <CreateClimbHeatmapOverlay
                boardDetails={boardDetails}
                angle={angle}
                litUpHoldsMap={litUpHoldsMap}
                opacity={heatmapOpacity}
                enabled={showHeatmap}
              />
            </div>
          ) : boardType === 'moonboard' && layoutFolder && holdSetImages ? (
            <div className={styles.moonboardFill}>
              <MoonBoardRenderer
                layoutFolder={layoutFolder}
                holdSetImages={holdSetImages}
                litUpHoldsMap={litUpHoldsMap}
                onHoldClick={picker.handleHoldClick}
              />
            </div>
          ) : null}
        </ZoomableBoard>
      </div>

      <HoldTypePicker
        boardName={pickerBoardName}
        anchorEl={picker.anchorEl}
        currentState={picker.currentState}
        startingCount={startingCount}
        finishCount={finishCount}
        onSelect={picker.handleSelect}
        onClose={picker.handleClose}
      />

      {/* MoonBoard validation hint band */}
      {boardType === 'moonboard' && !isValid && totalHolds > 0 && (
        <div className={styles.validationHintBar}>
          <Typography variant="body2" component="span" color="text.secondary">
            A valid climb needs at least 1 start hold and 1 finish hold
          </Typography>
        </div>
      )}

      {/* MoonBoard-only: Import buttons */}
      {boardType === 'moonboard' && (
        <div className={styles.importActionsBar}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleOcrImport(file);
              e.target.value = '';
            }}
            disabled={isOcrProcessing}
          />
          <MuiButton size="small" variant="outlined" startIcon={isOcrProcessing ? <CircularProgress size={16} /> : <CloudUploadOutlined />} disabled={isOcrProcessing} onClick={() => fileInputRef.current?.click()}>
            {isOcrProcessing ? 'Processing...' : 'Import'}
          </MuiButton>
          <Link href={bulkImportUrl}>
            <MuiButton size="small" variant="outlined" startIcon={<GetAppOutlined />}>Bulk</MuiButton>
          </Link>
        </div>
      )}

      {/* Bottom controls: draft toggle, heatmap, Drafts/Settings buttons */}
      <div className={styles.bottomControls}>
        <div className={styles.bottomControlsLeft}>
          <Typography variant="body2" component="span" color="text.secondary" className={styles.draftLabel}>
            Draft
          </Typography>
          <MuiSwitch
            size="small"
            checked={isDraft}
            onChange={(_, checked) => setIsDraft(checked)}
          />
          {boardType === 'aurora' && (
            <>
              <MuiTooltip title={showHeatmap ? 'Hide heatmap' : 'Show which holds get used most'}>
                <IconButton
                  color={showHeatmap ? 'error' : 'default'}
                  size="small"
                  onClick={handleToggleHeatmap}
                  className={styles.heatmapButton}
                  aria-label={showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
                >
                  <LocalFireDepartmentOutlined />
                </IconButton>
              </MuiTooltip>
              {showHeatmap && (
                <>
                  <Typography variant="body2" component="span" color="text.secondary" className={styles.draftLabel}>
                    Opacity
                  </Typography>
                  <MuiSlider
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={heatmapOpacity}
                    onChange={(_, value) => setHeatmapOpacity(value as number)}
                    className={styles.opacitySlider}
                  />
                </>
              )}
            </>
          )}
          {boardType === 'moonboard' && userGrade && (
            <Typography
              variant="body2"
              component="span"
              className={styles.gradeBadge}
              sx={{ color: getSoftFontGradeColor(userGrade, isDark) ?? 'var(--neutral-500)' }}
            >
              {userGrade}
            </Typography>
          )}
        </div>
        <Stack direction="row" spacing={1} alignItems="center">
          {canShowDrafts && (
            <Badge
              color="primary"
              badgeContent={draftsCount ?? 0}
              max={99}
              invisible={!draftsCount}
              overlap="rectangular"
            >
              <MuiButton
                size="small"
                variant="outlined"
                startIcon={<DraftsOutlined />}
                onClick={handleOpenDrafts}
              >
                Drafts
              </MuiButton>
            </Badge>
          )}
          <MuiButton
            size="small"
            variant="outlined"
            startIcon={<SettingsOutlined />}
            onClick={handleToggleSettings}
          >
            Settings
          </MuiButton>
        </Stack>
      </div>

      {/* Drafts drawer — only for Aurora boards where boardDetails is loaded */}
      {canShowDrafts && boardDetails && (
        <DraftsDrawer
          open={showDraftsDrawer}
          onClose={handleCloseDrafts}
          boardDetails={boardDetails}
          angle={angle}
          onLoadDraft={handleLoadDraft}
        />
      )}

      {/* Settings nested drawer — lazy-mounted */}
      {showSettingsPanel && (
        <SwipeableDrawer
          title="Climb Settings"
          placement="bottom"
          open={showSettingsPanel}
          onClose={() => setShowSettingsPanel(false)}
          swipeEnabled={false}
          styles={SETTINGS_DRAWER_STYLES}
        >
          <div className={styles.settingsDrawerContent}>
            {/* MoonBoard-specific: Angle, Grade and Benchmark */}
            {boardType === 'moonboard' && (
              <>
                <div className={styles.settingsField}>
                  <Typography variant="body2" component="span" color="text.secondary" className={styles.settingsLabel}>
                    Angle
                  </Typography>
                  <MuiSelect
                    value={selectedAngle}
                    onChange={(e) => setSelectedAngle(e.target.value as number)}
                    className={styles.settingsGradeField}
                    size="small"
                  >
                    {MOONBOARD_ANGLES.map(a => (
                      <MenuItem key={a} value={a}>{a}&deg;</MenuItem>
                    ))}
                  </MuiSelect>
                </div>
                <div className={styles.settingsField}>
                  <Typography variant="body2" component="span" color="text.secondary" className={styles.settingsLabel}>
                    Grade
                  </Typography>
                  <MuiSelect
                    displayEmpty
                    value={userGrade ?? ''}
                    onChange={(e) => setUserGrade(e.target.value === '' ? undefined : (e.target.value as string))}
                    className={styles.settingsGradeField}
                    size="small"
                  >
                    <MenuItem value=""><em>None</em></MenuItem>
                    {MOONBOARD_GRADES.map(g => (
                      <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>
                    ))}
                  </MuiSelect>
                </div>
                <div className={styles.settingsField}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <MuiSwitch
                      size="small"
                      checked={isBenchmark}
                      onChange={(_, checked) => setIsBenchmark(checked)}
                    />
                    <Typography variant="body2" component="span">Benchmark</Typography>
                  </Box>
                </div>
              </>
            )}
            {/* Common: Description */}
            <div className={styles.settingsField}>
              <Typography variant="body2" component="span" color="text.secondary" className={styles.settingsLabel}>
                Description (optional)
              </Typography>
              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add beta or notes about your climb..."
                multiline
                rows={3}
                inputProps={{ maxLength: 500 }}
                variant="outlined"
                size="small"
                fullWidth
              />
            </div>
          </div>
        </SwipeableDrawer>
      )}
    </div>
  );
}

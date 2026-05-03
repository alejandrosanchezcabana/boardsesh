'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined';
import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup as LeafletLayerGroup } from 'leaflet';
import type * as LeafletNamespace from 'leaflet';
import type { UserBoard } from '@boardsesh/shared-schema';
import { themeTokens } from '@/app/theme/theme-config';
import markerStyles from './board-search-map.module.css';

const VIEWPORT_DEBOUNCE_MS = 250;
const MARKER_SIZE = 16;
const MARKER_SIZE_SELECTED = 22;
const FLY_TO_ZOOM = 13;
type BoardSearchMapProps = {
  center: { lat: number; lng: number };
  zoom: number;
  boards: UserBoard[];
  selectedBoardUuid: string | null;
  /** Resolved geolocation coordinates (null until the user grants permission). */
  userCoords: { latitude: number; longitude: number } | null;
  /** Trigger the browser/OS geolocation prompt. Parent owns the state so this
   *  doesn't fire a duplicate permission request — the drawer already asked on open. */
  requestPermission: () => void | Promise<void>;
  onBoardClick: (board: UserBoard) => void;
  onViewportChange: (viewport: { lat: number; lng: number; zoom: number }) => void;
};

function markerClassName(selected: boolean): string {
  return selected ? `${markerStyles.marker} ${markerStyles.markerSelected}` : markerStyles.marker;
}

function markerSize(selected: boolean): number {
  return selected ? MARKER_SIZE_SELECTED : MARKER_SIZE;
}

export default function BoardSearchMap({
  center,
  zoom,
  boards,
  selectedBoardUuid,
  userCoords,
  requestPermission,
  onBoardClick,
  onViewportChange,
}: BoardSearchMapProps) {
  const { t } = useTranslation('boards');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof LeafletNamespace | null>(null);
  const markersLayerRef = useRef<LeafletLayerGroup | null>(null);
  const markersByUuidRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onViewportChangeRef = useRef(onViewportChange);
  const onBoardClickRef = useRef(onBoardClick);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticMoveRef = useRef(false);
  // Keep the latest center/zoom accessible to the async Leaflet import callback
  // so the map mounts at whatever the parent has settled on by then, not the
  // values that were current at first render.
  const centerRef = useRef(center);
  const zoomRef = useRef(zoom);
  const selectedBoardUuidRef = useRef(selectedBoardUuid);
  // Tracks whether the init effect has torn down. Guards deferred Leaflet
  // access (debounced setTimeout, one-shot moveend) from firing after
  // map.remove() — reading a destroyed map's _mapPane throws.
  const cancelledRef = useRef(false);
  const fireViewportRef = useRef<(() => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [pendingMyLocation, setPendingMyLocation] = useState(false);

  onViewportChangeRef.current = onViewportChange;
  onBoardClickRef.current = onBoardClick;
  centerRef.current = center;
  zoomRef.current = zoom;
  selectedBoardUuidRef.current = selectedBoardUuid;

  // Initialize the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Per-invocation cancellation for the async Leaflet import. Must stay a
    // local `let` (not a ref): under React Strict Mode the effect runs twice,
    // and the first run's Promise.all callback must see its own `cancelled`
    // — a shared ref would be reset to false by the second mount and the
    // stale callback would create a second map on the same container.
    let cancelled = false;
    cancelledRef.current = false;
    let resizeObserver: ResizeObserver | null = null;

    const markersByUuid = markersByUuidRef.current;

    // The `leaflet/dist/leaflet.css` import loads the Leaflet stylesheet via
    // Next.js's CSS import handling. Do NOT remove it thinking it's dead code:
    // without it, tile panes, zoom controls, and attribution render unstyled.
    void Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([centerRef.current.lat, centerRef.current.lng], zoomRef.current);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const markersLayer = L.layerGroup().addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      markersLayerRef.current = markersLayer;
      setMapReady(true);

      const fireViewport = () => {
        if (programmaticMoveRef.current) {
          programmaticMoveRef.current = false;
          return;
        }
        if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
        viewportTimerRef.current = setTimeout(() => {
          // A moveend can re-arm this timer mid-cleanup (e.g. from flyTo's
          // tail animation or from invalidateSize during teardown). Bail out
          // if the map has been removed — getCenter() would throw on a
          // destroyed _mapPane.
          if (cancelledRef.current || mapRef.current !== map) return;
          const c = map.getCenter();
          onViewportChangeRef.current({
            lat: Math.round(c.lat * 1000000) / 1000000,
            lng: Math.round(c.lng * 1000000) / 1000000,
            zoom: map.getZoom(),
          });
        }, VIEWPORT_DEBOUNCE_MS);
      };

      // 'moveend' fires after any view change — pan, zoom, or both — so a
      // separate 'zoomend' handler is redundant. More importantly, flyTo emits
      // 'zoomend' before 'moveend'; a second handler on 'zoomend' would clear
      // programmaticMoveRef prematurely, letting the 'moveend' fireViewport and
      // the once('moveend') callback both fire, producing two updates per flyTo.
      fireViewportRef.current = fireViewport;
      map.on('moveend', fireViewport);

      // Observe container size so we can correct Leaflet's internal size whenever
      // the parent (e.g. bottom-sheet drawer) finishes animating in, rotates, or
      // otherwise resizes. Replaces a flakey setTimeout(250) after mount.
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          map.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);
      }
    });

    return () => {
      cancelled = true;
      cancelledRef.current = true;
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mapRef.current) {
        // Detach our specific handler before remove() so teardown-time events
        // can't re-arm fireViewport's setTimeout. fireViewportRef is always set
        // when mapRef is set (both assigned in the same .then() block). If that
        // invariant is ever broken by a future refactor, fall back to broad
        // removal and log in dev so it surfaces without breaking teardown.
        if (fireViewportRef.current) {
          mapRef.current.off('moveend', fireViewportRef.current);
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.error(
              'BoardSearchMap: fireViewportRef.current is null while mapRef.current is set; ' +
                'falling back to broad map.off("moveend"). Both refs should be set in the ' +
                'same .then() block — if this fires, they were decoupled.',
            );
          }
          mapRef.current.off('moveend');
        }
        fireViewportRef.current = null;
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        markersByUuid.clear();
        leafletRef.current = null;
        setMapReady(false);
      }
    };
    // Only initialize once — center/zoom updates are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan / zoom programmatically when parent controls the viewport (e.g. carousel selection).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const current = map.getCenter();
    const distLat = Math.abs(current.lat - center.lat);
    const distLng = Math.abs(current.lng - center.lng);
    const zoomChanged = map.getZoom() !== zoom;
    // Avoid feedback loop: only re-pan if the parent's coords differ meaningfully.
    if (distLat < 0.0005 && distLng < 0.0005 && !zoomChanged) return;
    programmaticMoveRef.current = true;
    map.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  // Sync markers whenever boards change. The selection-to-icon mapping is
  // handled by the separate "Update marker icons when selection changes"
  // effect below, so this effect only adds/removes markers. We read the
  // current selection through a ref to pick the correct initial icon for
  // newly-added markers without re-running on every selection change.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = markersLayerRef.current;
    if (!L || !layer) return;

    const nextUuids = new Set(boards.filter((b) => b.latitude != null && b.longitude != null).map((b) => b.uuid));

    // Remove markers no longer in results
    for (const [uuid, marker] of markersByUuidRef.current.entries()) {
      if (!nextUuids.has(uuid)) {
        layer.removeLayer(marker);
        markersByUuidRef.current.delete(uuid);
      }
    }

    // Add new markers
    for (const board of boards) {
      if (board.latitude == null || board.longitude == null) continue;
      if (markersByUuidRef.current.has(board.uuid)) continue;

      const isSelected = board.uuid === selectedBoardUuidRef.current;
      const size = markerSize(isSelected);
      const icon = L.divIcon({
        className: markerClassName(isSelected),
        html: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([board.latitude, board.longitude], { icon });
      marker.on('click', () => onBoardClickRef.current(board));
      marker.addTo(layer);
      markersByUuidRef.current.set(board.uuid, marker);
    }
  }, [boards]);

  // Update marker icons when selection changes (without recreating all markers).
  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;
    for (const [uuid, marker] of markersByUuidRef.current.entries()) {
      const isSelected = uuid === selectedBoardUuid;
      const size = markerSize(isSelected);
      const icon = L.divIcon({
        className: markerClassName(isSelected),
        html: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      marker.setIcon(icon);
    }
  }, [selectedBoardUuid]);

  const flyToUserCoords = useCallback((coords: { latitude: number; longitude: number }) => {
    const map = mapRef.current;
    if (!map) return;

    // At-destination guard: if the map is already at the target position and
    // zoom, Leaflet skips the animation and never emits moveend. The once()
    // handler below would never fire, onViewportChangeRef would not be called,
    // and locationResolved would stay false for the session. Report the current
    // viewport immediately and bail out instead.
    const current = map.getCenter();
    if (
      Math.abs(current.lat - coords.latitude) < 0.0001 &&
      Math.abs(current.lng - coords.longitude) < 0.0001 &&
      map.getZoom() === FLY_TO_ZOOM
    ) {
      onViewportChangeRef.current({
        lat: Math.round(coords.latitude * 1000000) / 1000000,
        lng: Math.round(coords.longitude * 1000000) / 1000000,
        zoom: FLY_TO_ZOOM,
      });
      return;
    }

    // Register the one-shot listener BEFORE setting programmaticMoveRef and
    // calling flyTo. If flyTo fires moveend synchronously (e.g. in test mocks),
    // the listener must already be attached or the viewport callback is dropped.
    //
    // Listener-ordering note: Leaflet fires 'moveend' handlers in registration
    // order. The persistent fireViewport handler (registered at map init) runs
    // first, sees programmaticMoveRef=true, clears the flag and returns without
    // debouncing. This once() callback then fires unconditionally and reports
    // the final viewport. This relies on Leaflet's stable (but undocumented)
    // FIFO ordering — if that ever changes, fireViewport must not clear the flag
    // before the once() handler has read it.
    map.once('moveend', () => {
      if (cancelledRef.current || mapRef.current !== map) return;
      const c = map.getCenter();
      onViewportChangeRef.current({
        lat: Math.round(c.lat * 1000000) / 1000000,
        lng: Math.round(c.lng * 1000000) / 1000000,
        zoom: map.getZoom(),
      });
    });
    // Suppress the regular fireViewport debounce so the parent's center/zoom
    // isn't updated mid-flight — that would trigger the pan effect's setView,
    // racing the flyTo.
    programmaticMoveRef.current = true;
    map.flyTo([coords.latitude, coords.longitude], FLY_TO_ZOOM);
  }, []);

  const handleUseMyLocation = useCallback(() => {
    if (userCoords) {
      flyToUserCoords(userCoords);
    } else {
      // Remember the user's intent so we can finish the recenter once the
      // async permission request resolves — otherwise the first tap just
      // triggers the permission prompt and looks like a no-op.
      setPendingMyLocation(true);
      void requestPermission();
    }
  }, [userCoords, requestPermission, flyToUserCoords]);

  // Finish a pending "My location" tap once geolocation resolves.
  useEffect(() => {
    if (!pendingMyLocation || !userCoords || !mapReady) return;
    setPendingMyLocation(false);
    flyToUserCoords(userCoords);
  }, [pendingMyLocation, userCoords, mapReady, flyToUserCoords]);

  return (
    <Box data-swipe-blocked="true" sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} className={markerStyles.mapContainer} />
      {mapReady && (
        <MuiButton
          size="small"
          variant="contained"
          startIcon={<MyLocationOutlined />}
          onClick={handleUseMyLocation}
          sx={{
            position: 'absolute',
            bottom: themeTokens.spacing[2],
            right: themeTokens.spacing[2],
            zIndex: themeTokens.zIndex.dropdown,
            fontSize: `${themeTokens.typography.fontSize.xs}px`,
            textTransform: 'none',
          }}
        >
          {t('boardSearchMap.myLocation')}
        </MuiButton>
      )}
    </Box>
  );
}

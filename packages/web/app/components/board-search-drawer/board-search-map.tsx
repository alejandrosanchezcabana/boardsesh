'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined';
import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup as LeafletLayerGroup } from 'leaflet';
import type { UserBoard } from '@boardsesh/shared-schema';
import { themeTokens } from '@/app/theme/theme-config';
import markerStyles from './board-search-map.module.css';

const VIEWPORT_DEBOUNCE_MS = 250;
const MARKER_SIZE = 16;
const MARKER_SIZE_SELECTED = 22;

interface BoardSearchMapProps {
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
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
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

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    // The `leaflet/dist/leaflet.css` import loads the Leaflet stylesheet via
    // Next.js's CSS import handling. It isn't a real ES module so TypeScript
    // can't type-check it — hence the @ts-expect-error. Do NOT remove the
    // import thinking it's dead code: without it, tile panes, zoom controls,
    // and attribution render unstyled.
    // @ts-expect-error — CSS dynamic import handled by Next.js bundler
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
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
          const c = map.getCenter();
          onViewportChangeRef.current({
            lat: Math.round(c.lat * 1000000) / 1000000,
            lng: Math.round(c.lng * 1000000) / 1000000,
            zoom: map.getZoom(),
          });
        }, VIEWPORT_DEBOUNCE_MS);
      };

      map.on('moveend', fireViewport);
      map.on('zoomend', fireViewport);

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
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
        markersByUuidRef.current.clear();
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

  const flyToUserCoords = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const map = mapRef.current;
      if (!map) return;
      // Suppress the regular fireViewport debounce for this animation so the
      // parent's center/zoom isn't updated mid-flight — that would re-render
      // and trigger the pan effect's setView, racing the flyTo.
      // Register the one-shot listener BEFORE setting programmaticMoveRef and
      // calling flyTo. In environments where flyTo fires moveend synchronously
      // (e.g. test mocks), the listener must already be attached or the
      // viewport callback is silently dropped.
      map.once('moveend', () => {
        const c = map.getCenter();
        onViewportChangeRef.current({
          lat: Math.round(c.lat * 1000000) / 1000000,
          lng: Math.round(c.lng * 1000000) / 1000000,
          zoom: map.getZoom(),
        });
      });
      // Suppress the regular fireViewport debounce for this animation so the
      // parent's center/zoom isn't updated mid-flight — that would re-render
      // and trigger the pan effect's setView, racing the flyTo.
      programmaticMoveRef.current = true;
      map.flyTo([coords.latitude, coords.longitude], 13);
    },
    [],
  );

  const handleUseMyLocation = useCallback(() => {
    if (userCoords) {
      flyToUserCoords(userCoords);
    } else {
      // Remember the user's intent so we can finish the recenter once the
      // async permission request resolves — otherwise the first tap just
      // triggers the permission prompt and looks like a no-op.
      setPendingMyLocation(true);
      requestPermission();
    }
  }, [userCoords, requestPermission, flyToUserCoords]);

  // Finish a pending "My location" tap once geolocation resolves.
  useEffect(() => {
    if (!pendingMyLocation || !userCoords || !mapReady) return;
    setPendingMyLocation(false);
    flyToUserCoords(userCoords);
  }, [pendingMyLocation, userCoords, mapReady, flyToUserCoords]);

  return (
    <Box
      data-swipe-blocked="true"
      sx={{ position: 'relative', width: '100%', height: '100%' }}
    >
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
          My location
        </MuiButton>
      )}
    </Box>
  );
}

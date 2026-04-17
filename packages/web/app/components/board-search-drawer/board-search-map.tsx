'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import MuiButton from '@mui/material/Button';
import MyLocationOutlined from '@mui/icons-material/MyLocationOutlined';
import type { Map as LeafletMap, Marker as LeafletMarker, LayerGroup as LeafletLayerGroup } from 'leaflet';
import type { UserBoard } from '@boardsesh/shared-schema';
import { useGeolocation } from '@/app/hooks/use-geolocation';

const VIEWPORT_DEBOUNCE_MS = 250;

interface BoardSearchMapProps {
  center: { lat: number; lng: number };
  zoom: number;
  boards: UserBoard[];
  selectedBoardUuid: string | null;
  onBoardClick: (board: UserBoard) => void;
  onViewportChange: (viewport: { lat: number; lng: number; zoom: number }) => void;
}

function buildMarkerHtml(selected: boolean): string {
  const size = selected ? 22 : 16;
  const ring = selected ? '4px solid #fff' : '3px solid #fff';
  return `<div style="width:${size}px;height:${size}px;background:var(--color-primary);border:${ring};border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`;
}

export default function BoardSearchMap({
  center,
  zoom,
  boards,
  selectedBoardUuid,
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
  const [mapReady, setMapReady] = useState(false);
  const [pendingMyLocation, setPendingMyLocation] = useState(false);

  onViewportChangeRef.current = onViewportChange;
  onBoardClickRef.current = onBoardClick;
  centerRef.current = center;
  zoomRef.current = zoom;

  const { coordinates: userCoords, requestPermission } = useGeolocation();

  // Initialize the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

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

  // Sync markers whenever boards change.
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

      const isSelected = board.uuid === selectedBoardUuid;
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(isSelected),
        iconSize: [isSelected ? 22 : 16, isSelected ? 22 : 16],
        iconAnchor: [isSelected ? 11 : 8, isSelected ? 11 : 8],
      });
      const marker = L.marker([board.latitude, board.longitude], { icon });
      marker.on('click', () => onBoardClickRef.current(board));
      marker.addTo(layer);
      markersByUuidRef.current.set(board.uuid, marker);
    }
  }, [boards, selectedBoardUuid]);

  // Update marker icons when selection changes (without recreating all markers).
  useEffect(() => {
    const L = leafletRef.current;
    if (!L) return;
    for (const [uuid, marker] of markersByUuidRef.current.entries()) {
      const isSelected = uuid === selectedBoardUuid;
      const icon = L.divIcon({
        className: '',
        html: buildMarkerHtml(isSelected),
        iconSize: [isSelected ? 22 : 16, isSelected ? 22 : 16],
        iconAnchor: [isSelected ? 11 : 8, isSelected ? 11 : 8],
      });
      marker.setIcon(icon);
    }
  }, [selectedBoardUuid]);

  const flyToUserCoords = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      const map = mapRef.current;
      if (!map) return;
      programmaticMoveRef.current = true;
      map.flyTo([coords.latitude, coords.longitude], 13);
      onViewportChangeRef.current({
        lat: Math.round(coords.latitude * 1000000) / 1000000,
        lng: Math.round(coords.longitude * 1000000) / 1000000,
        zoom: 13,
      });
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
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {mapReady && (
        <MuiButton
          size="small"
          variant="contained"
          startIcon={<MyLocationOutlined />}
          onClick={handleUseMyLocation}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 1000,
            fontSize: '0.75rem',
            textTransform: 'none',
          }}
        >
          My location
        </MuiButton>
      )}
    </Box>
  );
}

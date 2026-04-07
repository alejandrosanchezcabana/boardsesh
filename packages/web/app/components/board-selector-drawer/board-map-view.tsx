'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { UserBoard } from '@boardsesh/shared-schema';
import { useNearbyBoards } from '@/app/hooks/use-nearby-boards';
import { useGeolocation, type GeolocationCoordinates } from '@/app/hooks/use-geolocation';
import type { Map as LeafletMap, LayerGroup as LeafletLayerGroup } from 'leaflet';

const BOARD_TYPE_COLORS: Record<string, string> = {
  kilter: '#ED1D24',
  tension: '#000000',
  moonboard: '#FEB91E',
};

const BOARD_TYPE_LABELS: Record<string, string> = {
  kilter: 'Kilter',
  tension: 'Tension',
  moonboard: 'MoonBoard',
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

interface BoardMapViewProps {
  onBoardSelect: (board: UserBoard) => void;
}

function MapContent({
  boards,
  userLocation,
  onBoardSelect,
}: {
  boards: UserBoard[];
  userLocation: GeolocationCoordinates | null;
  onBoardSelect: (board: UserBoard) => void;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LeafletLayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onBoardSelectRef = useRef(onBoardSelect);
  onBoardSelectRef.current = onBoardSelect;
  // Keep latest boards in a ref so the map init callback can access them
  const boardsRef = useRef(boards);
  boardsRef.current = boards;

  const updateMarkers = useCallback((boardList: UserBoard[]) => {
    const L = leafletRef.current;
    const markerLayer = markersRef.current;
    if (!L || !markerLayer) return;

    markerLayer.clearLayers();

    for (const board of boardList) {
      if (board.latitude == null || board.longitude == null) continue;

      const color = BOARD_TYPE_COLORS[board.boardType] || '#666';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;background:${color};border:2px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const typeLabel = BOARD_TYPE_LABELS[board.boardType] || board.boardType;
      const distanceStr = board.distanceMeters != null ? ` · ${formatDistance(board.distanceMeters)}` : '';

      const marker = L.marker([board.latitude, board.longitude], { icon });

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '160px';

      const info = document.createElement('div');
      info.innerHTML = `
        <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${board.name}</div>
        <div style="font-size:12px;color:#666;margin-bottom:8px;">${typeLabel} · ${board.angle}°${distanceStr}</div>
      `;
      popupContent.appendChild(info);

      const selectBtn = document.createElement('button');
      selectBtn.textContent = 'Select Board';
      selectBtn.style.cssText = 'width:100%;padding:6px 12px;background:#8C4A52;color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;';
      selectBtn.addEventListener('click', () => onBoardSelectRef.current(board));
      popupContent.appendChild(selectBtn);

      marker.bindPopup(popupContent);
      marker.addTo(markerLayer);
    }
  }, []);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current) return;

    // Guard against React strict mode double-mount
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markersRef.current = null;
      leafletRef.current = null;
    }

    // @ts-expect-error — CSS dynamic import handled by Next.js bundler
    Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]).then(([L]) => {
      if (!containerRef.current) return;

      const center: [number, number] = userLocation
        ? [userLocation.latitude, userLocation.longitude]
        : [40, -95];
      const zoom = userLocation ? 12 : 3;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      // User location marker
      if (userLocation) {
        const userIcon = L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(66,133,244,0.5);"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup('Your location');
      }

      leafletRef.current = L;
      markersRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      // Add any boards that arrived before the map finished initializing
      updateMarkers(boardsRef.current);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = null;
        leafletRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update board markers whenever boards change
  useEffect(() => {
    updateMarkers(boards);
  }, [boards, updateMarkers]);

  // Fly to user location when it becomes available
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 12);
    }
  }, [userLocation]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
  );
}

export default function BoardMapView({ onBoardSelect }: BoardMapViewProps) {
  const { coordinates } = useGeolocation();
  const { boards, isLoading, permissionState, requestPermission } = useNearbyBoards({
    enabled: true,
    radiusKm: 50,
    limit: 50,
  });

  // Show enable button when permission is unknown (null — iOS Safari doesn't
  // support the Permissions API), prompt, or denied (on iOS, calling
  // getCurrentPosition() can still trigger the native prompt even when the
  // Permissions API reports 'denied').
  if (!coordinates && permissionState !== 'granted') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 2, textAlign: 'center', px: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {permissionState === 'denied'
            ? 'Location access was denied. Tap below to try again, or enable location in your browser settings.'
            : 'Enable location access to see boards on the map'}
        </Typography>
        <Button variant="contained" onClick={requestPermission}>
          Enable Location
        </Button>
      </Box>
    );
  }

  if (isLoading && boards.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(85dvh - 120px)', minHeight: 300 }}>
      <MapContent
        boards={boards}
        userLocation={coordinates}
        onBoardSelect={onBoardSelect}
      />
    </Box>
  );
}

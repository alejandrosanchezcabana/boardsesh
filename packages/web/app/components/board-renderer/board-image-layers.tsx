import React, { useMemo } from 'react';
import type { BoardDetails } from '@/app/lib/types';
import { getImageUrl, buildOverlayUrl } from './util';

const layerStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

const layerContainStyle: React.CSSProperties = {
  ...layerStyle,
  objectFit: 'contain',
};

export interface BoardImageLayersProps {
  boardDetails: BoardDetails;
  frames: string;
  mirrored: boolean;
  thumbnail?: boolean;
  /** Use object-fit: contain (for swipe carousel where container controls sizing) */
  contain?: boolean;
  /** Additional styles for the container div */
  style?: React.CSSProperties;
}

/**
 * Renders a board as layered images:
 * - Background: static board images (cached per board config, shared across all climbs)
 * - Overlay: transparent WebP with hold circles from the WASM renderer (cached per climb)
 * - Mirroring: CSS scaleX(-1) on the container (no separate render needed)
 */
const BoardImageLayers = React.memo(function BoardImageLayers({
  boardDetails,
  frames,
  mirrored,
  thumbnail,
  contain,
  style,
}: BoardImageLayersProps) {
  const overlayUrl = buildOverlayUrl(boardDetails, frames, thumbnail);
  const backgroundUrls = useMemo(
    () => Object.keys(boardDetails.images_to_holds).map((img) => getImageUrl(img, boardDetails.board_name, thumbnail)),
    [boardDetails.images_to_holds, boardDetails.board_name, thumbnail],
  );

  const containerStyle = useMemo<React.CSSProperties>(() => ({
    position: 'relative',
    ...style,
    transform: mirrored ? 'scaleX(-1)' : style?.transform,
  }), [style, mirrored]);

  const imgStyle = contain ? layerContainStyle : layerStyle;

  return (
    <div style={containerStyle}>
      {backgroundUrls.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={url} src={url} alt="" style={imgStyle} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={overlayUrl} alt="" style={imgStyle} />
    </div>
  );
});

export default BoardImageLayers;

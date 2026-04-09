import { AURORA_BOARDS } from '@boardsesh/shared-schema';
import type { BoardName } from '@boardsesh/shared-schema';
import {
  AURORA_PRODUCT_SIZES,
  HOLE_PLACEMENTS,
  IMAGE_FILENAMES,
  LAYOUTS,
  SETS,
} from './generated/product-sizes-data';
import type {
  HoldTuple,
  LayoutData,
  ProductSizeData,
  SetData,
  SizeEdges,
} from './types';

export type { HoldTuple, LayoutData, ProductSizeData, SetData, SizeEdges } from './types';

const MOONBOARD_PRODUCT_SIZES: Record<number, ProductSizeData> = {
  1: {
    id: 1,
    name: 'Standard',
    description: '11x18 Grid',
    edgeLeft: 0,
    edgeRight: 11,
    edgeBottom: 0,
    edgeTop: 18,
    productId: 1,
  },
};

export const PRODUCT_SIZES: Record<BoardName, Record<number, ProductSizeData>> = {
  ...AURORA_PRODUCT_SIZES,
  moonboard: MOONBOARD_PRODUCT_SIZES,
};

export { LAYOUTS, SETS, IMAGE_FILENAMES, HOLE_PLACEMENTS };

export const getSizeEdges = (boardName: BoardName, sizeId: number): SizeEdges | null => {
  const size = PRODUCT_SIZES[boardName]?.[sizeId];
  if (!size) return null;

  return {
    edgeLeft: size.edgeLeft,
    edgeRight: size.edgeRight,
    edgeBottom: size.edgeBottom,
    edgeTop: size.edgeTop,
  };
};

export const getProductSize = (boardName: BoardName, sizeId: number): ProductSizeData | null => {
  return PRODUCT_SIZES[boardName]?.[sizeId] ?? null;
};

export const getLayout = (boardName: BoardName, layoutId: number): LayoutData | null => {
  return LAYOUTS[boardName]?.[layoutId] ?? null;
};

export const getAllLayouts = (boardName: BoardName): LayoutData[] => {
  const layouts = LAYOUTS[boardName];
  return layouts ? Object.values(layouts) : [];
};

export const getSizesForLayoutId = (boardName: BoardName, layoutId: number): ProductSizeData[] => {
  const layout = LAYOUTS[boardName]?.[layoutId];
  if (!layout) return [];

  const sizes = PRODUCT_SIZES[boardName];
  return Object.values(sizes).filter((size) => {
    // Basic product ID check
    if (size.productId !== layout.productId) return false;

    // Special filtering for Grasshopper:
    // Hide 'GrandMaster' (id: 1) in favor of 'GrandMaster with Tweeners' (id: 4)
    if (boardName === 'grasshopper' && size.id === 1) return false;

    return true;
  });
};

export const getSizesForProduct = (boardName: BoardName, productId: number): ProductSizeData[] => {
  const sizes = PRODUCT_SIZES[boardName];
  return Object.values(sizes).filter((size) => {
    if (size.productId !== productId) return false;

    // Special filtering for Grasshopper:
    // Hide 'GrandMaster' (id: 1) in favor of 'GrandMaster with Tweeners' (id: 4)
    if (boardName === 'grasshopper' && size.id === 1) return false;

    return true;
  });
};

export const getSetsForLayoutAndSize = (boardName: BoardName, layoutId: number, sizeId: number): SetData[] => {
  const key = `${layoutId}-${sizeId}`;
  return SETS[boardName]?.[key] ?? [];
};

export const getDefaultSizeForLayout = (boardName: BoardName, layoutId: number): number | null => {
  const sizes = getSizesForLayoutId(boardName, layoutId);
  return sizes.length > 0 ? sizes[0].id : null;
};

export const getBoardSelectorOptions = () => {
  const layouts: Record<BoardName, { id: number; name: string }[]> = {
    kilter: [],
    tension: [],
    moonboard: [],
    decoy: [],
    touchstone: [],
    grasshopper: [],
  };
  const sizes: Record<string, { id: number; name: string; description: string }[]> = {};
  const sets: Record<string, { id: number; name: string }[]> = {};

  for (const boardName of AURORA_BOARDS) {
    layouts[boardName] = getAllLayouts(boardName).map((layout) => ({ id: layout.id, name: layout.name }));

    for (const layout of layouts[boardName]) {
      const layoutSizes = getSizesForLayoutId(boardName, layout.id);
      const sizeKey = `${boardName}-${layout.id}`;
      sizes[sizeKey] = layoutSizes.map((size) => ({
        id: size.id,
        name: size.name,
        description: size.description,
      }));

      for (const size of layoutSizes) {
        const setKey = `${boardName}-${layout.id}-${size.id}`;
        sets[setKey] = getSetsForLayoutAndSize(boardName, layout.id, size.id);
      }
    }
  }

  return { layouts, sizes, sets };
};

export const getImageFilename = (
  boardName: BoardName,
  layoutId: number,
  sizeId: number,
  setId: number,
): string | null => {
  const key = `${layoutId}-${sizeId}-${setId}`;
  return IMAGE_FILENAMES[boardName]?.[key] ?? null;
};

export const getHolePlacements = (
  boardName: BoardName,
  layoutId: number,
  setId: number,
): HoldTuple[] => {
  const key = `${layoutId}-${setId}`;
  return HOLE_PLACEMENTS[boardName]?.[key] ?? [];
};

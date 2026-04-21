import type { BoardName } from "@boardsesh/shared-schema";

export type { BoardName };

export interface ProductSizeData {
  id: number;
  name: string;
  description: string;
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
  productId: number;
}

export interface LayoutData {
  id: number;
  name: string;
  productId: number;
}

export interface SetData {
  id: number;
  name: string;
}

export interface SizeEdges {
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
}

export type HoldTuple = [number, number | null, number, number];

export interface LedPositionWithColor {
  position: number;
  r: number;
  g: number;
  b: number;
  role?: number;
}

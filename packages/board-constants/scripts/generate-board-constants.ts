/**
 * Generate shared board constants from the development database.
 *
 * Usage:
 *   bun run --filter=@boardsesh/board-constants generate
 */

import { execFileSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const ENV_PATHS = [
  join(__dirname, '../.env.local'),
  join(__dirname, '../../web/.env.local'),
  join(__dirname, '../../backend/.env.development'),
];

for (const envPath of ENV_PATHS) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}

type PostgresConfig = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

type ProductSize = {
  id: number;
  name: string;
  description: string;
  edgeLeft: number;
  edgeRight: number;
  edgeBottom: number;
  edgeTop: number;
  productId: number;
};

type Layout = {
  id: number;
  name: string;
  productId: number;
};

type SetMapping = {
  setId: number;
  setName: string;
  layoutId: number;
  sizeId: number;
};

type ImageFilenameMapping = {
  layoutId: number;
  sizeId: number;
  setId: number;
  imageFilename: string;
};

type LedPlacement = {
  placementId: number;
  position: number;
  layoutId: number;
  sizeId: number;
};

type HolePlacement = {
  placementId: number;
  mirroredPlacementId: number | null;
  x: number;
  y: number;
  setId: number;
  layoutId: number;
};

type GeneratedBoardData = {
  sizes: ProductSize[];
  layouts: Layout[];
  sets: SetMapping[];
  imageFilenames: ImageFilenameMapping[];
  ledPlacements: LedPlacement[];
  holePlacements: HolePlacement[];
};

const BOARD_NAMES = ['kilter', 'tension', 'decoy', 'touchstone', 'grasshopper'] as const;
type GeneratedBoardName = (typeof BOARD_NAMES)[number];

const PRODUCT_OUTPUT_PATH = join(__dirname, '../src/generated/product-sizes-data.ts');
const LED_OUTPUT_PATH = join(__dirname, '../src/generated/led-placements-data.ts');

function getPostgresConfig(): PostgresConfig {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    const url = new URL(connectionString);
    return {
      host: url.hostname || process.env.POSTGRES_HOST || 'localhost',
      port: url.port || process.env.POSTGRES_PORT || '5432',
      user: decodeURIComponent(url.username || process.env.POSTGRES_USER || 'postgres'),
      password: decodeURIComponent(url.password || process.env.POSTGRES_PASSWORD || 'password'),
      database: url.pathname.replace(/^\//, '') || process.env.POSTGRES_DATABASE || 'main',
    };
  }

  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || '5432',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DATABASE || 'main',
  };
}

const postgresConfig = getPostgresConfig();

function runPsqlQuery(query: string): string {
  return execFileSync(
    'psql',
    [
      '-h',
      postgresConfig.host,
      '-p',
      postgresConfig.port,
      '-U',
      postgresConfig.user,
      '-d',
      postgresConfig.database,
      '-t',
      '-A',
      '-F',
      '|',
      '-R',
      '~~~',
      '-c',
      query,
    ],
    {
      encoding: 'utf-8',
      env: {
        ...process.env,
        PGPASSWORD: postgresConfig.password,
      },
    },
  );
}

function parseRows<T>(result: string, mapRow: (parts: string[]) => T): T[] {
  return result
    .trim()
    .split('~~~')
    .filter((line) => line.length > 0 && !line.startsWith('\n'))
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => mapRow(line.split('|')));
}

function querySizes(boardName: GeneratedBoardName): ProductSize[] {
  const result = runPsqlQuery(
    `SELECT id, REPLACE(name, E'\\n', ' '), COALESCE(REPLACE(description, E'\\n', ' '), ''), edge_left, edge_right, edge_bottom, edge_top, product_id FROM board_product_sizes WHERE board_type = '${boardName}' ORDER BY id;`,
  );

  return parseRows(result, ([id, name, description, edgeLeft, edgeRight, edgeBottom, edgeTop, productId]) => ({
    id: parseInt(id, 10),
    name: name.trim(),
    description: description.trim(),
    edgeLeft: parseInt(edgeLeft, 10),
    edgeRight: parseInt(edgeRight, 10),
    edgeBottom: parseInt(edgeBottom, 10),
    edgeTop: parseInt(edgeTop, 10),
    productId: parseInt(productId, 10),
  }));
}

function queryLayouts(boardName: GeneratedBoardName): Layout[] {
  const result = runPsqlQuery(
    `SELECT id, REPLACE(name, E'\\n', ' '), product_id FROM board_layouts WHERE board_type = '${boardName}' AND is_listed = true AND password IS NULL ORDER BY id;`,
  );

  return parseRows(result, ([id, name, productId]) => ({
    id: parseInt(id, 10),
    name: name.trim(),
    productId: parseInt(productId, 10),
  }));
}

function querySets(boardName: GeneratedBoardName): SetMapping[] {
  const result = runPsqlQuery(
    `SELECT sets.id, REPLACE(sets.name, E'\\n', ' '), psls.layout_id, psls.product_size_id FROM board_sets sets INNER JOIN board_product_sizes_layouts_sets psls ON sets.board_type = psls.board_type AND sets.id = psls.set_id WHERE sets.board_type = '${boardName}' ORDER BY psls.layout_id, psls.product_size_id, sets.id;`,
  );

  return parseRows(result, ([setId, setName, layoutId, sizeId]) => ({
    setId: parseInt(setId, 10),
    setName: setName.trim(),
    layoutId: parseInt(layoutId, 10),
    sizeId: parseInt(sizeId, 10),
  }));
}

function queryImageFilenames(boardName: GeneratedBoardName): ImageFilenameMapping[] {
  const result = runPsqlQuery(
    `SELECT layout_id, product_size_id, set_id, image_filename FROM board_product_sizes_layouts_sets WHERE board_type = '${boardName}' AND image_filename IS NOT NULL ORDER BY layout_id, product_size_id, set_id;`,
  );

  return parseRows(result, ([layoutId, sizeId, setId, imageFilename]) => ({
    layoutId: parseInt(layoutId, 10),
    sizeId: parseInt(sizeId, 10),
    setId: parseInt(setId, 10),
    imageFilename: imageFilename.trim(),
  }));
}

function queryLedPlacements(boardName: GeneratedBoardName): LedPlacement[] {
  const result = runPsqlQuery(
    `SELECT placements.id, leds.position, placements.layout_id, leds.product_size_id FROM board_placements placements INNER JOIN board_leds leds ON placements.board_type = leds.board_type AND placements.hole_id = leds.hole_id WHERE placements.board_type = '${boardName}' ORDER BY placements.layout_id, leds.product_size_id, placements.id;`,
  );

  return parseRows(result, ([placementId, position, layoutId, sizeId]) => ({
    placementId: parseInt(placementId, 10),
    position: parseInt(position, 10),
    layoutId: parseInt(layoutId, 10),
    sizeId: parseInt(sizeId, 10),
  }));
}

function queryHolePlacements(boardName: GeneratedBoardName): HolePlacement[] {
  const result = runPsqlQuery(
    `SELECT placements.id, mirrored_placements.id, holes.x, holes.y, placements.set_id, placements.layout_id FROM board_holes holes INNER JOIN board_placements placements ON placements.board_type = holes.board_type AND placements.hole_id = holes.id LEFT JOIN board_placements mirrored_placements ON mirrored_placements.board_type = holes.board_type AND mirrored_placements.hole_id = holes.mirrored_hole_id AND mirrored_placements.set_id = placements.set_id AND mirrored_placements.layout_id = placements.layout_id WHERE holes.board_type = '${boardName}' ORDER BY placements.layout_id, placements.set_id, placements.id;`,
  );

  return parseRows(result, ([placementId, mirroredId, x, y, setId, layoutId]) => ({
    placementId: parseInt(placementId, 10),
    mirroredPlacementId: mirroredId ? parseInt(mirroredId, 10) : null,
    x: parseInt(x, 10),
    y: parseInt(y, 10),
    setId: parseInt(setId, 10),
    layoutId: parseInt(layoutId, 10),
  }));
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function assertBoardDataIsComplete(boardName: GeneratedBoardName, data: GeneratedBoardData): void {
  const missing: string[] = [];

  if (data.sizes.length === 0) missing.push('product sizes');
  if (data.layouts.length === 0) missing.push('layouts');
  if (data.sets.length === 0) missing.push('set mappings');
  if (data.imageFilenames.length === 0) missing.push('image filenames');
  if (data.ledPlacements.length === 0) missing.push('LED placements');
  if (data.holePlacements.length === 0) missing.push('hole placements');

  if (missing.length > 0) {
    throw new Error(
      `Refusing to generate board constants with incomplete ${boardName} data. Missing: ${missing.join(', ')}.`,
    );
  }
}

function generateSizesTypeScript(boardName: GeneratedBoardName, sizes: ProductSize[]): string {
  const entries = sizes
    .map(
      (size) =>
        `    ${size.id}: { id: ${size.id}, name: '${escapeString(size.name)}', description: '${escapeString(size.description)}', edgeLeft: ${size.edgeLeft}, edgeRight: ${size.edgeRight}, edgeBottom: ${size.edgeBottom}, edgeTop: ${size.edgeTop}, productId: ${size.productId} },`,
    )
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateLayoutsTypeScript(boardName: GeneratedBoardName, layouts: Layout[]): string {
  const entries = layouts
    .map(
      (layout) =>
        `    ${layout.id}: { id: ${layout.id}, name: '${escapeString(layout.name)}', productId: ${layout.productId} },`,
    )
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateSetsTypeScript(boardName: GeneratedBoardName, sets: SetMapping[]): string {
  const grouped: Record<string, Array<{ id: number; name: string }>> = {};

  for (const set of sets) {
    const key = `${set.layoutId}-${set.sizeId}`;
    grouped[key] ??= [];
    grouped[key].push({ id: set.setId, name: set.setName });
  }

  const entries = Object.entries(grouped)
    .map(([key, setList]) => {
      const setArray = setList.map((set) => `{ id: ${set.id}, name: '${escapeString(set.name)}' }`).join(', ');
      return `    '${key}': [${setArray}],`;
    })
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateImageFilenamesTypeScript(boardName: GeneratedBoardName, mappings: ImageFilenameMapping[]): string {
  const entries = mappings
    .map(
      (mapping) =>
        `    '${mapping.layoutId}-${mapping.sizeId}-${mapping.setId}': '${escapeString(mapping.imageFilename)}',`,
    )
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateHolePlacementsTypeScript(boardName: GeneratedBoardName, placements: HolePlacement[]): string {
  const grouped: Record<string, Array<[number, number | null, number, number]>> = {};

  for (const placement of placements) {
    const key = `${placement.layoutId}-${placement.setId}`;
    grouped[key] ??= [];
    grouped[key].push([placement.placementId, placement.mirroredPlacementId, placement.x, placement.y]);
  }

  const entries = Object.entries(grouped)
    .map(([key, holds]) => {
      const holdsArray = holds
        .map(([id, mirrorId, x, y]) => `[${id}, ${mirrorId === null ? 'null' : mirrorId}, ${x}, ${y}]`)
        .join(', ');
      return `    '${key}': [${holdsArray}],`;
    })
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateLedPlacementsTypeScript(boardName: GeneratedBoardName, placements: LedPlacement[]): string {
  const grouped: Record<string, Record<number, number>> = {};

  for (const placement of placements) {
    const key = `${placement.layoutId}-${placement.sizeId}`;
    grouped[key] ??= {};
    grouped[key][placement.placementId] = placement.position;
  }

  const entries = Object.entries(grouped)
    .map(([key, ledMap]) => {
      const ledEntries = Object.entries(ledMap)
        .map(([placementId, position]) => `${placementId}: ${position}`)
        .join(', ');
      return `    '${key}': { ${ledEntries} },`;
    })
    .join('\n');

  return `  ${boardName}: {\n${entries}\n  }`;
}

function generateProductDataFile(boardData: Record<GeneratedBoardName, GeneratedBoardData>): string {
  const generatedAt = new Date().toISOString();

  return `/**
 * ⚠️ DO NOT EDIT THIS FILE MANUALLY ⚠️
 *
 * This file is auto-generated by running:
 *   bun run --filter=@boardsesh/board-constants generate
 *
 * Shared board configuration data for Aurora boards.
 * MoonBoard-specific data stays in handwritten helpers because it is not sourced
 * from the Aurora database tables used by this generator.
 *
 * Generated at: ${generatedAt}
 */

import type { BoardName } from '@boardsesh/shared-schema';
import type { HoldTuple, LayoutData, ProductSizeData, SetData } from '../types';

export const AURORA_PRODUCT_SIZES: Record<BoardName, Record<number, ProductSizeData>> = {
${generateSizesTypeScript('kilter', boardData.kilter.sizes)},
${generateSizesTypeScript('tension', boardData.tension.sizes)},
${generateSizesTypeScript('decoy', boardData.decoy.sizes)},
${generateSizesTypeScript('touchstone', boardData.touchstone.sizes)},
${generateSizesTypeScript('grasshopper', boardData.grasshopper.sizes)},
  moonboard: {},
};

export const LAYOUTS: Record<BoardName, Record<number, LayoutData>> = {
${generateLayoutsTypeScript('kilter', boardData.kilter.layouts)},
${generateLayoutsTypeScript('tension', boardData.tension.layouts)},
${generateLayoutsTypeScript('decoy', boardData.decoy.layouts)},
${generateLayoutsTypeScript('touchstone', boardData.touchstone.layouts)},
${generateLayoutsTypeScript('grasshopper', boardData.grasshopper.layouts)},
  moonboard: {},
};

export const SETS: Record<BoardName, Record<string, SetData[]>> = {
${generateSetsTypeScript('kilter', boardData.kilter.sets)},
${generateSetsTypeScript('tension', boardData.tension.sets)},
${generateSetsTypeScript('decoy', boardData.decoy.sets)},
${generateSetsTypeScript('touchstone', boardData.touchstone.sets)},
${generateSetsTypeScript('grasshopper', boardData.grasshopper.sets)},
  moonboard: {},
};

export const IMAGE_FILENAMES: Record<BoardName, Record<string, string>> = {
${generateImageFilenamesTypeScript('kilter', boardData.kilter.imageFilenames)},
${generateImageFilenamesTypeScript('tension', boardData.tension.imageFilenames)},
${generateImageFilenamesTypeScript('decoy', boardData.decoy.imageFilenames)},
${generateImageFilenamesTypeScript('touchstone', boardData.touchstone.imageFilenames)},
${generateImageFilenamesTypeScript('grasshopper', boardData.grasshopper.imageFilenames)},
  moonboard: {},
};

export const HOLE_PLACEMENTS: Record<BoardName, Record<string, HoldTuple[]>> = {
${generateHolePlacementsTypeScript('kilter', boardData.kilter.holePlacements)},
${generateHolePlacementsTypeScript('tension', boardData.tension.holePlacements)},
${generateHolePlacementsTypeScript('decoy', boardData.decoy.holePlacements)},
${generateHolePlacementsTypeScript('touchstone', boardData.touchstone.holePlacements)},
${generateHolePlacementsTypeScript('grasshopper', boardData.grasshopper.holePlacements)},
  moonboard: {},
};
`;
}

function generateLedDataFile(boardData: Record<GeneratedBoardName, GeneratedBoardData>): string {
  const generatedAt = new Date().toISOString();

  return `/**
 * ⚠️ DO NOT EDIT THIS FILE MANUALLY ⚠️
 *
 * This file is auto-generated by running:
 *   bun run --filter=@boardsesh/board-constants generate
 *
 * LED placement data for Aurora boards.
 * Kept in a separate module so consumers can lazy-load it without pulling in the
 * larger product/layout/set constants.
 *
 * Generated at: ${generatedAt}
 */

import type { BoardName } from '@boardsesh/shared-schema';

export const LED_PLACEMENTS: Record<BoardName, Record<string, Record<number, number>>> = {
${generateLedPlacementsTypeScript('kilter', boardData.kilter.ledPlacements)},
${generateLedPlacementsTypeScript('tension', boardData.tension.ledPlacements)},
${generateLedPlacementsTypeScript('decoy', boardData.decoy.ledPlacements)},
${generateLedPlacementsTypeScript('touchstone', boardData.touchstone.ledPlacements)},
${generateLedPlacementsTypeScript('grasshopper', boardData.grasshopper.ledPlacements)},
  moonboard: {},
};
`;
}

function main(): void {
  const boardData = {} as Record<GeneratedBoardName, GeneratedBoardData>;

  for (const boardName of BOARD_NAMES) {
    console.info(`Querying ${boardName} board constants...`);
    boardData[boardName] = {
      sizes: querySizes(boardName),
      layouts: queryLayouts(boardName),
      sets: querySets(boardName),
      imageFilenames: queryImageFilenames(boardName),
      ledPlacements: queryLedPlacements(boardName),
      holePlacements: queryHolePlacements(boardName),
    };
    assertBoardDataIsComplete(boardName, boardData[boardName]);
  }

  console.info(`Writing ${PRODUCT_OUTPUT_PATH}...`);
  writeFileSync(PRODUCT_OUTPUT_PATH, generateProductDataFile(boardData), 'utf-8');

  console.info(`Writing ${LED_OUTPUT_PATH}...`);
  writeFileSync(LED_OUTPUT_PATH, generateLedDataFile(boardData), 'utf-8');

  console.info('Board constants generated.');
}

main();

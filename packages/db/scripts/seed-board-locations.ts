/**
 * Seed script: imports gym/board GPS location data from hangtime-climbing-boards
 * into user_boards and gyms tables. Creates a system user as the owner for all
 * seeded entries.
 *
 * Usage: bunx tsx scripts/seed-board-locations.ts
 */

import { eq, and, sql, isNull } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

import { users } from "../src/schema/auth/users.js";
import { userBoards } from "../src/schema/app/boards.js";
import { gyms } from "../src/schema/app/gyms.js";
import { createScriptDb, getScriptDatabaseUrl } from "./db-connection.js";

// =============================================================================
// Constants
// =============================================================================

const BATCH_SIZE = 50;

const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";
const SYSTEM_USER_EMAIL = "system@boardsesh.com";

const GEOJSON_PACKAGE = "@hangtime/climbing-boards";

// =============================================================================
// GeoJSON types
// =============================================================================

interface GeoJsonFeature<P> {
  type: "Feature";
  id?: string | number;
  properties: P;
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface GeoJsonFeatureCollection<P> {
  type: "FeatureCollection";
  features: GeoJsonFeature<P>[];
}

// =============================================================================
// Types for hangtime GeoJSON feature properties
// =============================================================================

interface KilterWall {
  id: string;
  wall_uuid: string;
  gym_uuid: string;
  name: string | null;
  product_name: string | null;
  product_layout_uuid: string | null;
  is_adjustable: number | null;
  angle: number | null;
  serial_number: string | null;
  accumulated_hold_set_value: number | null;
  is_listed: number | null;
}

interface KilterGym {
  id: string;
  gym_uuid: string;
  name: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  walls: KilterWall[];
}

interface TensionGym {
  id: number;
  username: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface MoonboardGym {
  Name: string;
  Description: string;
  Latitude: number;
  Longitude: number;
  IsCommercial: boolean;
  IsLed: boolean;
}

// =============================================================================
// Board configuration data (from product-sizes-data.ts)
// =============================================================================

interface SetMapping {
  id: number;
  name: string;
}

/** Layout ID lookup by Kilter product name */
const KILTER_PRODUCT_TO_LAYOUT: Record<string, number> = {
  "Kilter Board Original": 1,
  "Kilter Board Homewall": 8,
};

/** Product size IDs that belong to each layout */
const KILTER_LAYOUT_SIZES: Record<number, number[]> = {
  1: [7, 8, 10, 14, 27, 28],
  8: [17, 18, 19, 21, 22, 23, 24, 25, 26, 29],
};

/** Sets indexed by "layoutId-sizeId" */
const KILTER_SETS: Record<string, SetMapping[]> = {
  "1-7": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "1-8": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "1-10": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "1-14": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "1-27": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "1-28": [
    { id: 1, name: "Bolt Ons" },
    { id: 20, name: "Screw Ons" },
  ],
  "8-17": [
    { id: 26, name: "Mainline" },
    { id: 27, name: "Auxiliary" },
  ],
  "8-18": [{ id: 26, name: "Mainline" }],
  "8-19": [{ id: 27, name: "Auxiliary" }],
  "8-21": [
    { id: 26, name: "Mainline" },
    { id: 27, name: "Auxiliary" },
  ],
  "8-22": [{ id: 26, name: "Mainline" }],
  "8-23": [
    { id: 26, name: "Mainline" },
    { id: 27, name: "Auxiliary" },
    { id: 28, name: "Mainline Kickboard" },
    { id: 29, name: "Auxiliary Kickboard" },
  ],
  "8-24": [
    { id: 26, name: "Mainline" },
    { id: 28, name: "Mainline Kickboard" },
    { id: 29, name: "Auxiliary Kickboard" },
  ],
  "8-25": [
    { id: 26, name: "Mainline" },
    { id: 27, name: "Auxiliary" },
    { id: 28, name: "Mainline Kickboard" },
    { id: 29, name: "Auxiliary Kickboard" },
  ],
  "8-26": [
    { id: 26, name: "Mainline" },
    { id: 28, name: "Mainline Kickboard" },
    { id: 29, name: "Auxiliary Kickboard" },
  ],
  "8-29": [{ id: 27, name: "Auxiliary" }],
};

/** Default configs for boards without wall-level detail */
const DEFAULT_CONFIGS = {
  tension: { layoutId: 10, sizeId: 6, setIds: "12,13" },
  moonboard: { layoutId: 2, sizeId: 1, setIds: "2,3,4" },
};

// =============================================================================
// Helpers
// =============================================================================

/** Generate a deterministic UUID from a string key */
function deterministicUuid(key: string): string {
  const hash = createHash("sha256").update(key).digest("hex");
  // Format as UUID v4-compatible (set version nibble to 4 and variant bits)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

/** Generate a URL-safe slug from a name, using the board's deterministic UUID
 *  as a suffix to guarantee uniqueness across all seeded boards. */
function slugify(name: string, uuid: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  // Use last 8 chars of the deterministic UUID (no hyphens) as suffix
  const suffix = uuid.replace(/-/g, "").slice(-8);
  return `${base || "board"}-${suffix}`;
}

/**
 * Resolve setIds from accumulated_hold_set_value bitmask.
 * Each bit position maps to a set in the ordered KILTER_SETS array.
 */
function resolveKilterSetIds(
  layoutId: number,
  sizeId: number,
  accumulatedValue: number | null,
): string | null {
  const key = `${layoutId}-${sizeId}`;
  const availableSets = KILTER_SETS[key];
  if (!availableSets || availableSets.length === 0) return null;

  // If no bitmask or 0, use all available sets
  if (!accumulatedValue || accumulatedValue === 0) {
    return availableSets.map((s) => s.id).join(",");
  }

  const selectedIds: number[] = [];
  for (let i = 0; i < availableSets.length; i++) {
    if ((accumulatedValue & (1 << i)) !== 0) {
      selectedIds.push(availableSets[i].id);
    }
  }

  return selectedIds.length > 0 ? selectedIds.join(",") : availableSets.map((s) => s.id).join(",");
}

/** Validate lat/lon are reasonable values */
function isValidCoord(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat == null || lon == null) return false;
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

// =============================================================================
// Data loading (GeoJSON from @hangtime/climbing-boards package)
// =============================================================================

const require = createRequire(import.meta.url);

function loadGeoJson<P>(filename: string): GeoJsonFeatureCollection<P> {
  // The npm package exports "./*.geojson" → "./geojson/*.geojson"
  const filepath = require.resolve(`${GEOJSON_PACKAGE}/${filename}`);
  const raw = readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as GeoJsonFeatureCollection<P>;
}

// =============================================================================
// Board record builders
// =============================================================================

interface BoardRecord {
  uuid: string;
  slug: string;
  boardType: string;
  layoutId: number;
  sizeId: number;
  setIds: string;
  name: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
  angle: number;
  isAngleAdjustable: boolean;
  gymSourceKey: string; // used to group boards under the same gym
  gymName: string;
  gymAddress: string | null;
}

function buildKilterRecords(): BoardRecord[] {
  const fc = loadGeoJson<KilterGym>("kilterboardapp.geojson");
  const records: BoardRecord[] = [];

  for (const feature of fc.features) {
    const gym = feature.properties;
    if (!isValidCoord(gym.latitude, gym.longitude)) continue;
    if (!gym.walls || gym.walls.length === 0) continue;

    for (const wall of gym.walls) {
      if (!wall.product_name) continue;

      const layoutId = KILTER_PRODUCT_TO_LAYOUT[wall.product_name];
      if (layoutId == null) continue; // skip unsupported products (JUUL, BKB, etc.)

      // Despite its name, product_layout_uuid contains the numeric product_size_id
      // from Kilter's sync database, not a UUID or layout ID.
      const sizeId = wall.product_layout_uuid ? parseInt(wall.product_layout_uuid, 10) : null;
      if (sizeId == null || isNaN(sizeId)) continue;

      // Validate the sizeId belongs to this layout
      if (!KILTER_LAYOUT_SIZES[layoutId]?.includes(sizeId)) continue;

      const setIds = resolveKilterSetIds(layoutId, sizeId, wall.accumulated_hold_set_value);
      if (!setIds) continue;

      const gymName = gym.name || `Kilter Gym ${gym.gym_uuid}`;
      const locationParts = [gym.city, gym.country].filter(Boolean);
      const locationName = locationParts.length > 0 ? locationParts.join(", ") : null;

      const sourceKey = `kilter:${gym.gym_uuid}:${wall.wall_uuid}`;
      const boardUuid = deterministicUuid(sourceKey);
      records.push({
        uuid: boardUuid,
        slug: slugify(`${gymName}-kilter`, boardUuid),
        boardType: "kilter",
        layoutId,
        sizeId,
        setIds,
        name: `${gymName} - ${wall.product_name}`,
        locationName,
        latitude: gym.latitude!,
        longitude: gym.longitude!,
        angle: wall.angle ?? 40,
        isAngleAdjustable: wall.is_adjustable === 1,
        gymSourceKey: `kilter:${gym.gym_uuid}`,
        gymName,
        gymAddress: [gym.address, gym.city, gym.country].filter(Boolean).join(", ") || null,
      });
    }
  }

  return records;
}

function buildTensionRecords(): BoardRecord[] {
  const fc = loadGeoJson<TensionGym>("tensionboardapp2.geojson");
  const records: BoardRecord[] = [];
  const config = DEFAULT_CONFIGS.tension;

  for (const feature of fc.features) {
    const gym = feature.properties;
    if (!isValidCoord(gym.latitude, gym.longitude)) continue;

    const gymName = gym.name || `Tension Gym ${gym.id}`;
    const sourceKey = `tension:${gym.id}`;
    const boardUuid = deterministicUuid(sourceKey);

    records.push({
      uuid: boardUuid,
      slug: slugify(`${gymName}-tension`, boardUuid),
      boardType: "tension",
      layoutId: config.layoutId,
      sizeId: config.sizeId,
      setIds: config.setIds,
      name: `${gymName} - Tension Board`,
      locationName: null,
      latitude: gym.latitude,
      longitude: gym.longitude,
      angle: 40,
      isAngleAdjustable: true,
      gymSourceKey: sourceKey,
      gymName,
      gymAddress: null,
    });
  }

  return records;
}

function buildMoonboardRecords(): BoardRecord[] {
  const fc = loadGeoJson<MoonboardGym>("moonboard.geojson");
  const records: BoardRecord[] = [];
  const config = DEFAULT_CONFIGS.moonboard;

  for (const feature of fc.features) {
    const gym = feature.properties;
    if (!isValidCoord(gym.Latitude, gym.Longitude)) continue;

    const gymName = gym.Name || "MoonBoard Gym";
    // Use name + coords as source key since moonboard has no numeric IDs
    const sourceKey = `moonboard:${gymName}:${gym.Latitude}:${gym.Longitude}`;
    const boardUuid = deterministicUuid(sourceKey);

    records.push({
      uuid: boardUuid,
      slug: slugify(`${gymName}-moonboard`, boardUuid),
      boardType: "moonboard",
      layoutId: config.layoutId,
      sizeId: config.sizeId,
      setIds: config.setIds,
      name: `${gymName} - MoonBoard`,
      locationName: null,
      latitude: gym.Latitude,
      longitude: gym.Longitude,
      angle: 40,
      isAngleAdjustable: false,
      gymSourceKey: sourceKey,
      gymName,
      gymAddress: null,
    });
  }

  return records;
}

// =============================================================================
// Main seed function
// =============================================================================

async function seedBoardLocations() {
  const databaseUrl = getScriptDatabaseUrl();
  const { db, close } = createScriptDb(databaseUrl);

  try {
    console.log("Starting board location seed...");

    // Step 1: Ensure system user exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, SYSTEM_USER_ID))
      .limit(1);

    if (!existingUser) {
      await db.insert(users).values({
        id: SYSTEM_USER_ID,
        email: SYSTEM_USER_EMAIL,
        name: "Boardsesh",
      });
      console.log("Created system user");
    }

    // Step 2: Build all board records
    console.log("Loading Kilter data...");
    const kilterRecords = buildKilterRecords();
    console.log(`  ${kilterRecords.length} Kilter boards`);

    console.log("Loading Tension data...");
    const tensionRecords = buildTensionRecords();
    console.log(`  ${tensionRecords.length} Tension boards`);

    console.log("Loading MoonBoard data...");
    const moonboardRecords = buildMoonboardRecords();
    console.log(`  ${moonboardRecords.length} MoonBoard boards`);

    const allRecords = [...kilterRecords, ...tensionRecords, ...moonboardRecords];
    console.log(`Total: ${allRecords.length} boards to seed`);

    // Step 3: Create gym entries (deduplicated by gymSourceKey)
    const gymsBySource = new Map<string, BoardRecord>();
    for (const rec of allRecords) {
      if (!gymsBySource.has(rec.gymSourceKey)) {
        gymsBySource.set(rec.gymSourceKey, rec);
      }
    }

    console.log(`Creating ${gymsBySource.size} gym entries...`);
    const gymIdMap = new Map<string, number>();
    const gymEntries = [...gymsBySource.entries()];

    for (let i = 0; i < gymEntries.length; i += BATCH_SIZE) {
      const batch = gymEntries.slice(i, i + BATCH_SIZE);
      for (const [sourceKey, rec] of batch) {
        const gymUuid = deterministicUuid(`gym:${sourceKey}`);
        const gymSlug = slugify(
          rec.gymName,
          createHash("md5").update(sourceKey).digest("hex").slice(0, 6),
        );

        // Upsert gym: insert or update on UUID conflict
        const result = await db
          .insert(gyms)
          .values({
            uuid: gymUuid,
            slug: gymSlug,
            ownerId: SYSTEM_USER_ID,
            name: rec.gymName,
            address: rec.gymAddress,
            latitude: rec.latitude,
            longitude: rec.longitude,
            isPublic: true,
          })
          .onConflictDoUpdate({
            target: gyms.uuid,
            set: {
              name: sql`excluded.name`,
              address: sql`excluded.address`,
              latitude: sql`excluded.latitude`,
              longitude: sql`excluded.longitude`,
              updatedAt: sql`NOW()`,
            },
          })
          .returning({ id: gyms.id });

        if (result[0]) {
          gymIdMap.set(sourceKey, result[0].id);
        }
      }
    }
    console.log(`  Created/updated ${gymIdMap.size} gyms`);

    // Step 4: Upsert board entries using raw SQL to target the uuid unique
    // constraint specifically. The ORM's onConflictDoNothing would also trigger
    // on the (ownerId, boardType, layoutId, sizeId, setIds) partial unique index,
    // silently dropping boards with common configs across different gyms.
    console.log("Upserting board entries...");
    let upserted = 0;

    for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
      const batch = allRecords.slice(i, i + BATCH_SIZE);

      for (const rec of batch) {
        const gymId = gymIdMap.get(rec.gymSourceKey) ?? null;

        await db.execute(sql`
          INSERT INTO user_boards (
            uuid, slug, owner_id, board_type, layout_id, size_id, set_ids,
            name, location_name, latitude, longitude, location,
            is_public, is_owned, angle, is_angle_adjustable, gym_id,
            created_at, updated_at
          ) VALUES (
            ${rec.uuid}, ${rec.slug}, ${SYSTEM_USER_ID},
            ${rec.boardType}, ${rec.layoutId}, ${rec.sizeId}, ${rec.setIds},
            ${rec.name}, ${rec.locationName}, ${rec.latitude}, ${rec.longitude},
            ST_MakePoint(${rec.longitude}, ${rec.latitude})::geography,
            true, false, ${rec.angle}, ${rec.isAngleAdjustable}, ${gymId},
            NOW(), NOW()
          )
          ON CONFLICT (uuid) DO UPDATE SET
            name = EXCLUDED.name,
            location_name = EXCLUDED.location_name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            location = EXCLUDED.location,
            angle = EXCLUDED.angle,
            is_angle_adjustable = EXCLUDED.is_angle_adjustable,
            gym_id = EXCLUDED.gym_id,
            updated_at = NOW(),
            deleted_at = NULL
        `);
        upserted++;
      }

      if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= allRecords.length) {
        console.log(
          `  Progress: ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length}`,
        );
      }
    }

    console.log(`\nSeed complete:`);
    console.log(`  Upserted: ${upserted} boards`);
    console.log(`  Total gyms: ${gymIdMap.size}`);
  } finally {
    await close();
  }
}

seedBoardLocations().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

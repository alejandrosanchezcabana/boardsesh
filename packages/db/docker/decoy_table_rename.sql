-- Rename tables with decoy_ prefix
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        and tablename not like 'kilter_%'
        AND tablename not like 'tension_%'
        AND tablename not like 'decoy_%'
        AND tablename not like 'touchstone_%'
        AND tablename not like 'grasshopper_%'
        AND tablename not like 'boardsesh_%'
        AND tablename not like 'board_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident('decoy_' || r.tablename) || ' CASCADE';
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) ||
                ' RENAME TO ' || quote_ident('decoy_' || r.tablename);
    END LOOP;
END $$;

-- Migrate Decoy data to unified tables
-- Level 0: Tables with no foreign key dependencies
-- -----------------------------------------------------------------------------

-- Migrate attempts data
INSERT INTO board_attempts (board_type, id, position, name)
SELECT 'decoy', id, position, name FROM decoy_attempts
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate difficulty grades data
INSERT INTO board_difficulty_grades (board_type, difficulty, boulder_name, route_name, is_listed)
SELECT 'decoy', difficulty, boulder_name, route_name, is_listed FROM decoy_difficulty_grades
ON CONFLICT (board_type, difficulty) DO NOTHING;

-- Migrate products data
INSERT INTO board_products (board_type, id, name, is_listed, password, min_count_in_frame, max_count_in_frame)
SELECT 'decoy', id, name, is_listed, password, min_count_in_frame, max_count_in_frame FROM decoy_products
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate sets data
INSERT INTO board_sets (board_type, id, name, hsm)
SELECT 'decoy', id, name, hsm FROM decoy_sets
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate users data
INSERT INTO board_users (board_type, id, username, created_at)
SELECT 'decoy', id, username, created_at FROM decoy_users
ON CONFLICT (board_type, id) DO NOTHING;

-- Level 1: Tables that depend on Level 0
-- -----------------------------------------------------------------------------

-- Migrate layouts data
INSERT INTO board_layouts (board_type, id, product_id, name, instagram_caption, is_mirrored, is_listed, password, created_at)
SELECT 'decoy', id, product_id, name, instagram_caption, is_mirrored, is_listed, password, created_at FROM decoy_layouts
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate product sizes data
INSERT INTO board_product_sizes (board_type, id, product_id, edge_left, edge_right, edge_bottom, edge_top, name, description, image_filename, position, is_listed)
SELECT 'decoy', id, product_id, edge_left, edge_right, edge_bottom, edge_top, name, description, image_filename, position, is_listed FROM decoy_product_sizes
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate holes data
INSERT INTO board_holes (board_type, id, product_id, name, x, y, mirrored_hole_id, mirror_group)
SELECT 'decoy', id, product_id, name, x, y, mirrored_hole_id, mirror_group FROM decoy_holes
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate placement roles data
INSERT INTO board_placement_roles (board_type, id, product_id, position, name, full_name, led_color, screen_color)
SELECT 'decoy', id, product_id, position, name, full_name, led_color, screen_color FROM decoy_placement_roles
ON CONFLICT (board_type, id) DO NOTHING;

-- Level 2: Tables that depend on Level 1
-- -----------------------------------------------------------------------------

-- Migrate LEDs data
INSERT INTO board_leds (board_type, id, product_size_id, hole_id, position)
SELECT 'decoy', id, product_size_id, hole_id, position FROM decoy_leds
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate placements data
INSERT INTO board_placements (board_type, id, layout_id, hole_id, set_id, default_placement_role_id)
SELECT 'decoy', id, layout_id, hole_id, set_id, default_placement_role_id FROM decoy_placements
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate product_sizes_layouts_sets data
INSERT INTO board_product_sizes_layouts_sets (board_type, id, product_size_id, layout_id, set_id, image_filename, is_listed)
SELECT 'decoy', id, product_size_id, layout_id, set_id, image_filename, is_listed FROM decoy_product_sizes_layouts_sets
ON CONFLICT (board_type, id) DO NOTHING;

-- Migrate climbs data
INSERT INTO board_climbs (uuid, board_type, layout_id, setter_id, setter_username, name, description, hsm, edge_left, edge_right, edge_bottom, edge_top, angle, frames_count, frames_pace, frames, is_draft, is_listed, created_at, synced, sync_error)
SELECT uuid, 'decoy', layout_id, setter_id, setter_username, name, description, hsm, edge_left, edge_right, edge_bottom, edge_top, angle, frames_count, frames_pace, frames, is_draft, is_listed, created_at, true, NULL
FROM decoy_climbs
ON CONFLICT (uuid) DO NOTHING;

-- Migrate walls data
INSERT INTO board_walls (board_type, uuid, user_id, name, product_id, is_adjustable, angle, layout_id, product_size_id, hsm, serial_number, created_at)
SELECT 'decoy', uuid, user_id, name, product_id, is_adjustable, angle, layout_id, product_size_id, hsm, serial_number, created_at FROM decoy_walls
ON CONFLICT (board_type, uuid) DO NOTHING;

-- Level 3: Tables that depend on Level 2
-- -----------------------------------------------------------------------------

-- Migrate climb stats data
INSERT INTO board_climb_stats (board_type, climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, difficulty_average, quality_average, fa_username, fa_at)
SELECT 'decoy', climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, difficulty_average, quality_average, fa_username, fa_at
FROM decoy_climb_stats
ON CONFLICT (board_type, climb_uuid, angle) DO NOTHING;

-- Migrate beta links data
INSERT INTO board_beta_links (board_type, climb_uuid, link, foreign_username, angle, thumbnail, is_listed, created_at)
SELECT 'decoy', climb_uuid, link, foreign_username, angle, thumbnail, is_listed, created_at
FROM decoy_beta_links
ON CONFLICT (board_type, climb_uuid, link) DO NOTHING;

-- Migrate shared syncs data
INSERT INTO board_shared_syncs (board_type, table_name, last_synchronized_at)
SELECT 'decoy', table_name, last_synchronized_at FROM decoy_shared_syncs
ON CONFLICT (board_type, table_name) DO NOTHING;

-- Note: climb_holds, circuits, circuits_climbs, tags, user_syncs tables may not exist in all board databases
-- Add them conditionally if they exist

-- Clean up: Drop the prefixed tables after migration
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'decoy_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Rename tables with grasshopper_ prefix
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
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident('grasshopper_' || r.tablename) || ' CASCADE';
        EXECUTE 'ALTER TABLE ' || quote_ident(r.tablename) ||
                ' RENAME TO ' || quote_ident('grasshopper_' || r.tablename);
    END LOOP;
END $$;

-- Migrate Grasshopper data to unified tables
-- Level 0: Tables with no foreign key dependencies
-- -----------------------------------------------------------------------------

INSERT INTO board_attempts (board_type, id, position, name)
SELECT 'grasshopper', id, position, name FROM grasshopper_attempts
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_difficulty_grades (board_type, difficulty, boulder_name, route_name, is_listed)
SELECT 'grasshopper', difficulty, boulder_name, route_name, is_listed FROM grasshopper_difficulty_grades
ON CONFLICT (board_type, difficulty) DO NOTHING;

INSERT INTO board_products (board_type, id, name, is_listed, password, min_count_in_frame, max_count_in_frame)
SELECT 'grasshopper', id, name, is_listed, password, min_count_in_frame, max_count_in_frame FROM grasshopper_products
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_sets (board_type, id, name, hsm)
SELECT 'grasshopper', id, name, hsm FROM grasshopper_sets
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_users (board_type, id, username, created_at)
SELECT 'grasshopper', id, username, created_at FROM grasshopper_users
ON CONFLICT (board_type, id) DO NOTHING;

-- Level 1: Tables that depend on Level 0
-- -----------------------------------------------------------------------------

INSERT INTO board_layouts (board_type, id, product_id, name, instagram_caption, is_mirrored, is_listed, password, created_at)
SELECT 'grasshopper', id, product_id, name, instagram_caption, is_mirrored, is_listed, password, created_at FROM grasshopper_layouts
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_product_sizes (board_type, id, product_id, edge_left, edge_right, edge_bottom, edge_top, name, description, image_filename, position, is_listed)
SELECT 'grasshopper', id, product_id, edge_left, edge_right, edge_bottom, edge_top, name, description, image_filename, position, is_listed FROM grasshopper_product_sizes
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_holes (board_type, id, product_id, name, x, y, mirrored_hole_id, mirror_group)
SELECT 'grasshopper', id, product_id, name, x, y, mirrored_hole_id, mirror_group FROM grasshopper_holes
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_placement_roles (board_type, id, product_id, position, name, full_name, led_color, screen_color)
SELECT 'grasshopper', id, product_id, position, name, full_name, led_color, screen_color FROM grasshopper_placement_roles
ON CONFLICT (board_type, id) DO NOTHING;

-- Level 2: Tables that depend on Level 1
-- -----------------------------------------------------------------------------

INSERT INTO board_leds (board_type, id, product_size_id, hole_id, position)
SELECT 'grasshopper', id, product_size_id, hole_id, position FROM grasshopper_leds
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_placements (board_type, id, layout_id, hole_id, set_id, default_placement_role_id)
SELECT 'grasshopper', id, layout_id, hole_id, set_id, default_placement_role_id FROM grasshopper_placements
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_product_sizes_layouts_sets (board_type, id, product_size_id, layout_id, set_id, image_filename, is_listed)
SELECT 'grasshopper', id, product_size_id, layout_id, set_id, image_filename, is_listed FROM grasshopper_product_sizes_layouts_sets
ON CONFLICT (board_type, id) DO NOTHING;

INSERT INTO board_climbs (uuid, board_type, layout_id, setter_id, setter_username, name, description, hsm, edge_left, edge_right, edge_bottom, edge_top, angle, frames_count, frames_pace, frames, is_draft, is_listed, created_at, synced, sync_error)
SELECT uuid, 'grasshopper', layout_id, setter_id, setter_username, name, description, hsm, edge_left, edge_right, edge_bottom, edge_top, angle, frames_count, frames_pace, frames, is_draft, is_listed, created_at, true, NULL
FROM grasshopper_climbs
ON CONFLICT (uuid) DO NOTHING;

INSERT INTO board_walls (board_type, uuid, user_id, name, product_id, is_adjustable, angle, layout_id, product_size_id, hsm, serial_number, created_at)
SELECT 'grasshopper', uuid, user_id, name, product_id, is_adjustable, angle, layout_id, product_size_id, hsm, serial_number, created_at FROM grasshopper_walls
ON CONFLICT (board_type, uuid) DO NOTHING;

-- Level 3: Tables that depend on Level 2
-- -----------------------------------------------------------------------------

INSERT INTO board_climb_stats (board_type, climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, difficulty_average, quality_average, fa_username, fa_at)
SELECT 'grasshopper', climb_uuid, angle, display_difficulty, benchmark_difficulty, ascensionist_count, difficulty_average, quality_average, fa_username, fa_at
FROM grasshopper_climb_stats
ON CONFLICT (board_type, climb_uuid, angle) DO NOTHING;

INSERT INTO board_beta_links (board_type, climb_uuid, link, foreign_username, angle, thumbnail, is_listed, created_at)
SELECT 'grasshopper', climb_uuid, link, foreign_username, angle, thumbnail, is_listed, created_at
FROM grasshopper_beta_links
ON CONFLICT (board_type, climb_uuid, link) DO NOTHING;

INSERT INTO board_shared_syncs (board_type, table_name, last_synchronized_at)
SELECT 'grasshopper', table_name, last_synchronized_at FROM grasshopper_shared_syncs
ON CONFLICT (board_type, table_name) DO NOTHING;

-- Clean up: Drop the prefixed tables after migration
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'grasshopper_%'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

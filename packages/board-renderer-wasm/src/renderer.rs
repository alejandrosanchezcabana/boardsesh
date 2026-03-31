use std::collections::HashMap;
use tiny_skia::{
    Color as SkiaColor, FillRule, Paint, PathBuilder, Pixmap, Stroke, Transform,
};

use crate::frames_parser::parse_frames;
use crate::types::{HoldData, RenderConfig};

/// Render a transparent overlay with hold circles drawn on it.
/// Returns RGBA pixel data and dimensions (width, height).
pub fn render_overlay(config: &RenderConfig) -> Result<(Vec<u8>, u32, u32), String> {
    let output_width = config.output_width;
    let output_height =
        (output_width as f32 * config.board_height / config.board_width).round() as u32;

    if output_width == 0 || output_height == 0 {
        return Err("Output dimensions must be non-zero".into());
    }

    let mut pixmap = Pixmap::new(output_width, output_height)
        .ok_or("Failed to create pixmap")?;

    // Scale factors from SVG viewBox coords to pixel coords
    let scale_x = output_width as f32 / config.board_width;
    let scale_y = output_height as f32 / config.board_height;

    // Parse the frames string to get lit holds
    let parsed_holds = parse_frames(&config.frames, &config.hold_state_map);

    // Build a lookup map from hold ID to HoldData for mirroring
    let mut holds_by_id: HashMap<u32, &HoldData> = HashMap::with_capacity(config.holds.len());
    for h in &config.holds {
        holds_by_id.insert(h.id, h);
    }

    // Lift constant state out of the per-hold loop
    let transform = Transform::identity();
    let stroke_width = if config.thumbnail { 8.0 } else { 6.0 } * scale_x;

    let mut paint = Paint::default();
    paint.anti_alias = true;

    let mut stroke_style = Stroke::default();
    stroke_style.width = stroke_width;

    for parsed in &parsed_holds {
        let hold = match holds_by_id.get(&parsed.hold_id) {
            Some(h) => *h,
            None => continue,
        };

        // Handle mirroring: use mirrored hold's coordinates
        let render_hold = if config.mirrored {
            if let Some(mirrored_id) = hold.mirrored_hold_id {
                match holds_by_id.get(&mirrored_id) {
                    Some(h) => *h,
                    None => hold,
                }
            } else {
                hold
            }
        } else {
            hold
        };

        // Scale SVG coords to pixel coords
        let cx = render_hold.cx * scale_x;
        let cy = render_hold.cy * scale_y;
        let r = render_hold.r * scale_x;

        let path = match PathBuilder::from_circle(cx, cy, r) {
            Some(p) => p,
            None => continue,
        };

        let color = parsed.color;

        // Thumbnail: filled circle with 0.3 opacity + stroke
        // Full size: stroke only, no fill
        if config.thumbnail {
            paint.set_color(SkiaColor::from_rgba8(color.r, color.g, color.b, 77)); // 0.3 * 255 ≈ 77
            pixmap.fill_path(&path, &paint, FillRule::Winding, transform, None);
        }

        paint.set_color(SkiaColor::from_rgba8(color.r, color.g, color.b, 255));
        pixmap.stroke_path(&path, &paint, &stroke_style, transform, None);
    }

    let data = pixmap.data().to_vec();
    Ok((data, output_width, output_height))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::HoldStateInfo;

    fn test_config() -> RenderConfig {
        let mut hold_state_map = HashMap::new();
        hold_state_map.insert(42, HoldStateInfo { color: "#00FF00".into() });
        hold_state_map.insert(43, HoldStateInfo { color: "#00FFFF".into() });
        hold_state_map.insert(44, HoldStateInfo { color: "#FF00FF".into() });

        RenderConfig {
            board_width: 1080.0,
            board_height: 1350.0,
            output_width: 300,
            frames: "p1r42p2r43p3r44".into(),
            mirrored: false,
            thumbnail: false,
            holds: vec![
                HoldData { id: 1, mirrored_hold_id: None, cx: 200.0, cy: 300.0, r: 20.0 },
                HoldData { id: 2, mirrored_hold_id: None, cx: 500.0, cy: 600.0, r: 20.0 },
                HoldData { id: 3, mirrored_hold_id: None, cx: 800.0, cy: 900.0, r: 20.0 },
            ],
            hold_state_map,
        }
    }

    #[test]
    fn test_render_produces_correct_dimensions() {
        let config = test_config();
        let (_, width, height) = render_overlay(&config).unwrap();
        assert_eq!(width, 300);
        assert_eq!(height, 375); // 300 * 1350/1080
    }

    #[test]
    fn test_render_has_non_transparent_pixels() {
        let config = test_config();
        let (data, _, _) = render_overlay(&config).unwrap();
        // Check that at least some pixels have non-zero alpha
        let has_colored_pixels = data.chunks(4).any(|pixel| pixel[3] > 0);
        assert!(has_colored_pixels, "Overlay should have non-transparent pixels");
    }

    #[test]
    fn test_render_empty_frames() {
        let mut config = test_config();
        config.frames = String::new();
        let (data, _, _) = render_overlay(&config).unwrap();
        // All pixels should be fully transparent
        let all_transparent = data.chunks(4).all(|pixel| pixel[3] == 0);
        assert!(all_transparent, "Empty frames should produce fully transparent image");
    }

    #[test]
    fn test_render_zero_dimensions_fails() {
        let mut config = test_config();
        config.output_width = 0;
        assert!(render_overlay(&config).is_err());
    }
}

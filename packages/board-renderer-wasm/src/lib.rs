mod frames_parser;
pub mod renderer;
pub mod types;

use wasm_bindgen::prelude::*;

use crate::renderer::render_overlay as render_overlay_impl;
use crate::types::RenderConfig;

/// Render a transparent overlay image with hold circles.
///
/// Takes a JSON config string with board dimensions, frames string, holds data,
/// and hold state color mapping. Returns raw RGBA pixel data prefixed with
/// width (u32 LE) and height (u32 LE) as the first 8 bytes.
///
/// The caller is responsible for encoding to the desired image format (e.g. WebP via sharp).
#[wasm_bindgen]
pub fn render_overlay(config_json: &str) -> Result<Vec<u8>, JsValue> {
    let config: RenderConfig = serde_json::from_str(config_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse config: {e}")))?;

    let (rgba_data, width, height) = render_overlay_impl(&config)
        .map_err(|e| JsValue::from_str(&format!("Render failed: {e}")))?;

    // Pack dimensions as header: [width_u32_le, height_u32_le, rgba_bytes...]
    let mut result = Vec::with_capacity(8 + rgba_data.len());
    result.extend_from_slice(&width.to_le_bytes());
    result.extend_from_slice(&height.to_le_bytes());
    result.extend_from_slice(&rgba_data);

    Ok(result)
}

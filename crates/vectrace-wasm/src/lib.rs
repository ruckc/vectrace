//! WebAssembly bindings around [`vtracer`] for vectrace.
//!
//! The interesting part is [`TraceSession`]: it holds a `vtracer::Session` alive across
//! calls, so vtracer re-uses its cached segmentation whenever the changed parameters do
//! not affect clustering. That is what makes slider-dragging in the UI cheap.

use serde::{Deserialize, Serialize};
use visioncortex::{Color, ColorImage};
use vtracer::{
    Clustering, Config, FitMode, Hierarchical, Preset, Progress, Session, progress::CancelToken,
    svg::SvgWriter,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// The JS-facing configuration.
///
/// Deliberately a mirror of `vtracer::Config` rather than the type itself: upstream is on
/// a 1.0 alpha and derives no serde impls, so this struct is the stable contract with the
/// TypeScript side. Enums cross the boundary as lowercase strings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TraceConfig {
    /// `"color"` | `"binary"` | `"watershed"`
    pub clustering: String,
    /// `"stacked"` | `"cutout"`
    pub hierarchical: String,
    /// `"pixel"` | `"polygon"` | `"spline"`
    pub mode: String,
    pub filter_speckle: usize,
    pub color_precision: i32,
    pub layer_difference: i32,
    pub corner_threshold: i32,
    pub length_threshold: f64,
    pub max_iterations: usize,
    pub splice_threshold: i32,
    /// Curve simplification tolerance in px; `null` = off.
    pub simplify: Option<f64>,
    /// Coordinate decimal places; `null` = full precision.
    pub path_precision: Option<u32>,
    /// Fixed palette as `#rrggbb` strings. Takes priority over `maxColors`.
    pub palette: Vec<String>,
    pub max_colors: Option<usize>,
    pub optimize: u8,
    pub binary_threshold: u8,
    pub binary_adaptive: bool,
    pub binary_adaptive_window: u32,
    pub binary_adaptive_t: f64,
    pub watershed_detail: u8,
    /// Emit relative path commands where they serialize shorter.
    pub svg_relative: bool,
    /// Emit `H`/`V`/`S` shorthands and `<g fill>` grouping.
    pub svg_shorthands: bool,
}

impl Default for TraceConfig {
    fn default() -> Self {
        Self::from_vtracer(&Config::default())
    }
}

impl TraceConfig {
    fn from_vtracer(c: &Config) -> Self {
        let w = SvgWriter::default();
        Self {
            clustering: match c.clustering {
                Clustering::ColorCluster => "color",
                Clustering::Binary => "binary",
                Clustering::Watershed => "watershed",
            }
            .into(),
            hierarchical: match c.hierarchical {
                Hierarchical::Stacked => "stacked",
                Hierarchical::Cutout => "cutout",
            }
            .into(),
            mode: match c.mode {
                FitMode::Pixel => "pixel",
                FitMode::Polygon => "polygon",
                FitMode::Spline => "spline",
            }
            .into(),
            filter_speckle: c.filter_speckle,
            color_precision: c.color_precision,
            layer_difference: c.layer_difference,
            corner_threshold: c.corner_threshold,
            length_threshold: c.length_threshold,
            max_iterations: c.max_iterations,
            splice_threshold: c.splice_threshold,
            simplify: c.simplify,
            path_precision: c.path_precision,
            palette: c.palette.iter().map(|p| p.to_hex_string()).collect(),
            max_colors: c.max_colors,
            optimize: c.optimize,
            binary_threshold: c.binary_threshold,
            binary_adaptive: c.binary_adaptive,
            binary_adaptive_window: c.binary_adaptive_window,
            binary_adaptive_t: c.binary_adaptive_t,
            watershed_detail: c.watershed_detail,
            svg_relative: w.relative,
            svg_shorthands: w.shorthands,
        }
    }

    // Start from Config::default() and overwrite, rather than a struct literal: vtracer is
    // on a 1.0 alpha and fields still come and go, so anything we do not know about should
    // keep its upstream default instead of failing to compile.
    #[allow(clippy::field_reassign_with_default)]
    fn to_vtracer(&self) -> Result<Config, String> {
        let mut c = Config::default();
        c.clustering = match self.clustering.as_str() {
            "color" => Clustering::ColorCluster,
            "binary" => Clustering::Binary,
            "watershed" => Clustering::Watershed,
            other => return Err(format!("unknown clustering: {other}")),
        };
        c.hierarchical = match self.hierarchical.as_str() {
            "stacked" => Hierarchical::Stacked,
            "cutout" => Hierarchical::Cutout,
            other => return Err(format!("unknown hierarchical: {other}")),
        };
        c.mode = match self.mode.as_str() {
            "pixel" => FitMode::Pixel,
            "polygon" => FitMode::Polygon,
            "spline" => FitMode::Spline,
            other => return Err(format!("unknown mode: {other}")),
        };
        c.filter_speckle = self.filter_speckle;
        c.color_precision = self.color_precision;
        c.layer_difference = self.layer_difference;
        c.corner_threshold = self.corner_threshold;
        c.length_threshold = self.length_threshold;
        c.max_iterations = self.max_iterations;
        c.splice_threshold = self.splice_threshold;
        c.simplify = self.simplify;
        c.path_precision = self.path_precision;
        c.palette = self
            .palette
            .iter()
            .map(|s| parse_hex(s))
            .collect::<Result<_, _>>()?;
        c.max_colors = self.max_colors;
        c.optimize = self.optimize;
        c.binary_threshold = self.binary_threshold;
        c.binary_adaptive = self.binary_adaptive;
        c.binary_adaptive_window = self.binary_adaptive_window;
        c.binary_adaptive_t = self.binary_adaptive_t;
        c.watershed_detail = self.watershed_detail;
        Ok(c)
    }

    fn writer(&self) -> SvgWriter {
        SvgWriter {
            relative: self.svg_relative,
            shorthands: self.svg_shorthands,
            precision: self.path_precision,
        }
    }
}

fn parse_hex(s: &str) -> Result<Color, String> {
    let h = s.strip_prefix('#').unwrap_or(s);
    if h.len() != 6 {
        return Err(format!("expected a #rrggbb colour, got {s:?}"));
    }
    let byte = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).map_err(|e| e.to_string());
    Ok(Color::new(byte(0)?, byte(2)?, byte(4)?))
}

/// What a render produced: the SVG plus the numbers the UI reports.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TraceResult {
    svg: String,
    width: u32,
    height: u32,
    shape_count: usize,
}

/// A reusable converter over one image.
///
/// Construct it once per loaded image and call `render` as often as you like; clustering
/// is only redone when a parameter that affects it changes.
#[wasm_bindgen]
pub struct TraceSession {
    inner: Session,
}

#[wasm_bindgen]
impl TraceSession {
    /// `rgba` must be `width * height * 4` bytes, as produced by `ImageData`.
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize, rgba: &[u8]) -> Result<TraceSession, JsError> {
        let expected = width
            .checked_mul(height)
            .and_then(|n| n.checked_mul(4))
            .ok_or_else(|| JsError::new("image dimensions overflow"))?;
        if rgba.len() != expected {
            return Err(JsError::new(&format!(
                "expected {expected} bytes for {width}x{height}, got {}",
                rgba.len()
            )));
        }
        let img = ColorImage {
            pixels: rgba.to_vec(),
            width,
            height,
        };
        Ok(TraceSession {
            inner: Session::new(img),
        })
    }

    /// Trace with the given config and return `{ svg, width, height, shapeCount }`.
    #[wasm_bindgen(js_name = render)]
    pub fn render(&mut self, config: JsValue) -> Result<JsValue, JsError> {
        let cfg: TraceConfig = serde_wasm_bindgen::from_value(config)?;
        self.render_inner(&cfg, None)
    }

    /// As [`Self::render`], but calls `on_progress(phase, fraction)` as work proceeds.
    ///
    /// `phase` is `"segment"`, `"compose"` or `"optimize"`; `fraction` is 0..=1 *within*
    /// that phase. Returning `true` from the callback cancels the render, which then
    /// rejects with a `"cancelled"` error.
    #[wasm_bindgen(js_name = renderWithProgress)]
    pub fn render_with_progress(
        &mut self,
        config: JsValue,
        on_progress: &js_sys::Function,
    ) -> Result<JsValue, JsError> {
        let cfg: TraceConfig = serde_wasm_bindgen::from_value(config)?;
        self.render_inner(&cfg, Some(on_progress))
    }

    fn render_inner(
        &mut self,
        cfg: &TraceConfig,
        on_progress: Option<&js_sys::Function>,
    ) -> Result<JsValue, JsError> {
        let vcfg = cfg.to_vtracer().map_err(|e| JsError::new(&e))?;

        let doc = match on_progress {
            None => self.inner.render(&vcfg)?,
            Some(f) => {
                let cancel = CancelToken::new();
                let mut report = |p: Progress| {
                    let phase = match p.phase {
                        vtracer::progress::Phase::Segment => "segment",
                        vtracer::progress::Phase::Compose => "compose",
                        vtracer::progress::Phase::Optimize => "optimize",
                    };
                    // A callback that throws, or asks to stop, cancels the render.
                    match f.call2(&JsValue::NULL, &phase.into(), &p.fraction.into()) {
                        Ok(v) => {
                            if v.as_bool() == Some(true) {
                                cancel.cancel();
                            }
                        }
                        Err(_) => cancel.cancel(),
                    }
                };
                self.inner
                    .render_with_progress(&vcfg, &cancel, &mut report)?
            }
        };

        let result = TraceResult {
            svg: cfg.writer().write(&doc),
            width: doc.width,
            height: doc.height,
            shape_count: doc.shapes.len(),
        };
        Ok(serde_wasm_bindgen::to_value(&result)?)
    }

    /// Width of the source image.
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> usize {
        self.inner.image().width
    }

    /// Height of the source image.
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> usize {
        self.inner.image().height
    }
}

/// The default config, or a named preset: `"bw"`, `"poster"` or `"photo"`.
#[wasm_bindgen(js_name = defaultConfig)]
pub fn default_config(preset: Option<String>) -> Result<JsValue, JsError> {
    let cfg = match preset.as_deref() {
        None | Some("default") => Config::default(),
        Some("bw") => Config::from_preset(Preset::Bw),
        Some("poster") => Config::from_preset(Preset::Poster),
        Some("photo") => Config::from_preset(Preset::Photo),
        Some(other) => return Err(JsError::new(&format!("unknown preset: {other}"))),
    };
    Ok(serde_wasm_bindgen::to_value(&TraceConfig::from_vtracer(
        &cfg,
    ))?)
}

/// The version of the underlying vtracer crate, for the about box.
#[wasm_bindgen(js_name = vtracerVersion)]
pub fn vtracer_version() -> String {
    "1.0.0-alpha.3".into()
}

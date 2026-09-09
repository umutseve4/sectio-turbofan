<p align="center">
  <img src="https://github.com/user-attachments/assets/3bee6485-38ba-44e2-aab6-772f0a720e95" alt="SECTIO: the live cutaway of a turbofan engine, with the gas path coloured by temperature" width="900">
</p>

<h1 align="center">SECTIO Turbofan</h1>

<p align="center">
  A <b>live cutaway</b> of a turbofan engine. Move the cutting plane and the cut surface<br>
  is actually computed. No pre drawn image is being revealed.
</p>

<p align="center">
  <a href="https://umutseve4.github.io/sectio-turbofan/"><b>Live demo</b></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/external%20resources-0-FF4D4F?style=flat-square" alt="Zero external resources">
  <img src="https://img.shields.io/badge/engine%20parts-15-FF4D4F?style=flat-square" alt="15 engine parts">
  <img src="https://img.shields.io/badge/CI%20checks-29-FF4D4F?style=flat-square" alt="29 CI checks">
</p>

---

## What happens in the first 30 seconds

The engine is not a picture. Every frame is ray marched as a solid out of signed distance fields. When you slide the cutting plane, the cut surface is computed on the spot and shaded separately, with scan lines and a heat glow. Push the throttle and a simplified Brayton cycle runs: OPR, T4, thrust, TSFC and the nozzle velocities are printed on the panel and also drive the temperature colouring of the gas path. The name of the part under the cursor, together with its station temperature and pressure, is written on screen, and that information is read back from the GPU in a separate 1x1 pixel pass.

## How to open it

Fastest route: the [live demo](https://umutseve4.github.io/sectio-turbofan/).

To run it locally:

```
1. download index.html
2. double click it
```

There is no third step. The application code never reaches for an external resource: no CDN, no font, no analytics, no `fetch`, XHR or WebSocket.

## Shortcuts

| Key | Effect |
|---|---|
| Drag | Orbit, `⇧`+drag to pan, wheel to zoom |
| `alt`+wheel | Push the cutting plane |
| `X` `Y` `Z` `V` | Pick the plane normal (`V`: perpendicular to the camera) |
| `C` | Toggle cutting on and off |
| `⇧` (held) | Hold the plane where it is |
| `F` | Freeze the image |
| `[` `]` | Slice thickness |
| `O` | Transparent (optical) mode |
| `H` | Hide the interface, three levels |
| `1` `2` `3` | Quality |
| `Space` / `P` | Play, pause |
| `R` | Reset |

If `prefers-reduced-motion: reduce` is set, the scene starts stationary.

## What is inside

| Layer | What it does |
|---|---|
| **Geometry** | 15 parts: nacelle, core cowl, spinner, 20 blade fan, OGV, 3 stage booster, rotor drum, 9 stage HP compressor, annular combustor, HP turbine, LP turbine, two concentric shafts (LP and HP), exhaust cone, pylon |
| **Cutting plane** | X / Y / Z / free plane, either a half space or a slice of adjustable thickness. The cut surface is shaded separately |
| **Thermodynamics** | A cruise Brayton cycle tied to N1 through the throttle: OPR, T4, thrust, TSFC, nozzle velocities, N2 |
| **Readout** | The part under the cursor is read back from the GPU in a separate 1x1 pixel pass |
| **Fallback** | Without WebGL2, or on a narrow screen, a 2D meridional section takes over, drawn pixel by pixel from **a JS port of the same distance field** |

## Verification

This was built in an environment where no browser could be opened, so everything that can be checked without one runs in CI through `verify.mjs`: **29 checks**.

```
node verify.mjs
```

- that the file really is self contained (no external resources, no `fetch`, XHR or WebSocket)
- that every `<script>` block parses
- the structural health of the GLSL: `#version 300 es`, balanced brackets, no ES 1.00 leftovers, functions declared before they are used, and **a two way exact match between the uniform set in the shader and the set the JS binds**
- the physics of the cycle: monotonicity against the throttle, station temperature ordering (T2 &lt; T13 &lt; T25 &lt; T3 &lt; T4 &gt; T45 &gt; T5), the T4 ceiling, OPR / thrust / TSFC / fuel air ratio staying inside their class range, and no NaN at any throttle setting
- geometry: 7 landmarks that must be solid are solid and 4 points that must be empty are empty, the bypass duct and the core gas path stay open at every station, the model does not leave the ray marching bounds, and the gradient magnitude of the distance field does not exceed 1 at the sampled points

The number 29 is not typed by hand: on every run CI counts the checks that actually executed and compares that count against the README. If they disagree, the job turns red.

The geometry was additionally rewritten and ray marched offline in NumPy for comparison, and the bounding bands used to skip blade rows were measured empirically at 1.5 million sample points to confirm they really do contain the geometry. That is a wide sample, not a proof.

## Limits

**Accuracy.** The cycle model is **at a teaching level**: the orders of magnitude and the trends are right, it is not certification data. The flight condition is fixed at M 0.82, 11 km, ISA, so the thrust you read is a *cruise* thrust and not a takeoff figure. Blade and stage counts were chosen in the order of magnitude of a high bypass narrowbody engine. No specific engine from any specific manufacturer is modelled.

**What the verification does not cover.** The 29 checks above do not measure whether the shader compiles on a real GPU, the frame rate, the pick pass or the placement of the 3D labels. Those can only be tested by opening the file, and the screenshot above is evidence that this test was carried out.

**Language.** The interface copy inside the page is Turkish on purpose and stays that way. This README is the English entry point to it.

---

MIT, see [LICENSE](LICENSE).

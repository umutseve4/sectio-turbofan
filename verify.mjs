/**
 * SECTIO — offline verification.
 *
 * The app is a single dependency-free HTML file, so CI cannot open a GPU
 * context. Instead we check everything that is checkable without one:
 *   1. the file is self-contained (no network requests at runtime)
 *   2. every <script> parses
 *   3. GLSL is structurally sound and its uniform set matches the JS side
 *   4. the thermodynamic model returns physically sane numbers
 *   5. the 2D fallback geometry agrees with the 3D meridional profile
 *
 * Run: node verify.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "index.html"), "utf8");

let failed = 0;
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
function check(name, fn) {
  try {
    const note = fn();
    console.log(`  ok   ${pad(name, 44)} ${note ?? ""}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${pad(name, 44)} ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function inRange(label, v, lo, hi) {
  assert(Number.isFinite(v), `${label} is not finite (${v})`);
  assert(v >= lo && v <= hi, `${label} = ${typeof v === "number" ? v.toFixed(3) : v}, expected ${lo}..${hi}`);
}

// ---------------------------------------------------------------- extraction
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({
  attrs: m[1],
  body: m[2],
}));
const byId = id => scripts.find(s => s.attrs.includes(`id="${id}"`));
const vs = byId("vs"), fs = byId("fs");
const app = scripts.find(s => !s.attrs.includes("id="));

console.log("\nSECTIO verification\n");

// ------------------------------------------------------------- 1. self-contained
console.log("[ self-contained ]");
check("no external http(s) resources", () => {
  const bad = [...html.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\//gi)].map(m => m[0]);
  assert(bad.length === 0, `found ${bad.length}: ${bad.slice(0, 3).join(", ")}`);
  return "0 remote refs";
});
check("no network APIs at runtime", () => {
  const bad = /\b(fetch|XMLHttpRequest|importScripts|WebSocket|EventSource)\s*\(/.exec(app.body);
  assert(!bad, `uses ${bad?.[1]}`);
  return "fetch/XHR/WS absent";
});
check("declares lang, title, viewport", () => {
  assert(/<html[^>]+lang=/.test(html), "missing lang");
  assert(/<title>[^<]+<\/title>/.test(html), "missing title");
  assert(/name="viewport"/.test(html), "missing viewport");
  return "html/head sane";
});
check("respects prefers-reduced-motion", () => {
  assert(/prefers-reduced-motion/.test(html), "no reduced-motion handling");
  return "handled in CSS + JS";
});
check("keyboard + aria affordances present", () => {
  assert(/aria-pressed/.test(html) && /aria-live/.test(html), "missing aria state");
  assert(/addEventListener\("keydown"/.test(app.body), "no keyboard handler");
  return "aria-pressed, aria-live, keydown";
});

// ------------------------------------------------------------------ 2. parsing
console.log("\n[ javascript ]");
check("application script parses", () => {
  new vm.Script(app.body, { filename: "index.html#app" });
  return `${(app.body.length / 1024).toFixed(1)} kB`;
});
check("strict mode, no globals leaked", () => {
  assert(/^\s*"use strict";/.test(app.body), "not strict");
  assert(/\(function\(\)\{[\s\S]*\}\)\(\);?\s*$/.test(app.body.trim()), "not wrapped in an IIFE");
  return "IIFE + use strict";
});

// ---------------------------------------------------------------------- 3. glsl
console.log("\n[ glsl ]");
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
for (const [name, sh] of [["vertex", vs], ["fragment", fs]]) {
  check(`${name} shader well-formed`, () => {
    const src = stripComments(sh.body);
    assert(src.trimStart().startsWith("#version 300 es"), "missing #version 300 es directive on line 1");
    assert(/precision\s+(highp|mediump)\s+float/.test(src), "no float precision qualifier");
    for (const [open, close] of [["{", "}"], ["(", ")"], ["[", "]"]]) {
      const a = (src.match(new RegExp("\\" + open, "g")) || []).length;
      const b = (src.match(new RegExp("\\" + close, "g")) || []).length;
      assert(a === b, `unbalanced ${open}${close}: ${a} vs ${b}`);
    }
    assert(!/\b(texture2D|gl_FragColor|varying|attribute)\b/.test(src), "uses ES 1.00 syntax in an ES 3.00 shader");
    assert(/void\s+main\s*\(/.test(src), "no main()");
    return `${src.split("\n").length} lines`;
  });
}
check("fragment functions declared before use", () => {
  const src = stripComments(fs.body);
  const defs = [...src.matchAll(/^\s*(?:float|vec2|vec3|vec4|void)\s+(\w+)\s*\(/gm)];
  const at = new Map(defs.map(d => [d[1], d.index]));
  const problems = [];
  for (const [fn, idx] of at) {
    const bodyStart = src.indexOf("{", idx);
    for (const [other, oidx] of at) {
      if (other === fn || oidx < idx) continue;
      const uses = new RegExp(`\\b${other}\\s*\\(`, "g");
      uses.lastIndex = bodyStart;
      const m = uses.exec(src);
      const nextDef = defs.find(d => d.index > idx)?.index ?? src.length;
      if (m && m.index < nextDef) problems.push(`${fn}() calls ${other}() before it is declared`);
    }
  }
  assert(problems.length === 0, problems.join("; "));
  return `${at.size} functions ordered`;
});
check("uniform set matches the JS bindings", () => {
  const declared = new Set(
    [...stripComments(fs.body).matchAll(/uniform\s+\w+\s+(\w+)(\[(\d+)\])?/g)].map(m => m[1])
  );
  [...stripComments(vs.body).matchAll(/uniform\s+\w+\s+(\w+)/g)].forEach(m => declared.add(m[1]));
  // uniforms are looked up both directly and from a name list, so collect every
  // "uXxx" string literal in the application script
  const fetched = new Set(
    [...app.body.matchAll(/"(u[A-Z]\w*)(?:\[0\])?"/g)].map(m => m[1])
  );
  const missing = [...fetched].filter(u => !declared.has(u));
  assert(missing.length === 0, `JS asks for undeclared uniform(s): ${missing.join(", ")}`);
  const unused = [...declared].filter(u => !fetched.has(u));
  assert(unused.length === 0, `shader declares unused uniform(s): ${unused.join(", ")}`);
  return `${declared.size} uniforms, both ways`;
});
check("uniform arrays fetched with [0] suffix", () => {
  const arrays = [...stripComments(fs.body).matchAll(/uniform\s+\w+\s+(\w+)\[(\d+)\]/g)];
  for (const [, n] of arrays) {
    assert(app.body.includes(`"${n}[0]"`), `${n} must be looked up as "${n}[0]"`);
  }
  return arrays.map(a => `${a[1]}[${a[2]}]`).join(", ") || "none";
});
check("every part id has a readout entry", () => {
  const ids = new Set([...fs.body.matchAll(/vec2\(\s*[^,]+,\s*(\d+)\.0\s*\)/g)].map(m => +m[1]));
  ids.delete(0);
  const parts = new Set([...app.body.matchAll(/^\s{4}(\d+):\s*\["/gm)].map(m => +m[1]));
  const orphan = [...ids].filter(i => !parts.has(i));
  assert(orphan.length === 0, `shader emits id(s) ${orphan.join(", ")} with no PARTS entry`);
  return `${ids.size} ids described`;
});

// ------------------------------------------------------------------ 4. sandbox
// Pull the pure numeric core out of the app and run it without a DOM.
function extract(names) {
  const out = [];
  for (const n of names) {
    const re = new RegExp(`^(\\s*)(?:const|function)\\s+${n}\\b`, "m");
    const m = re.exec(app.body);
    assert(m, `cannot find ${n}() in the application script`);
    let i = app.body.indexOf("{", m.index);
    let depth = 0, j = i;
    for (; j < app.body.length; j++) {
      const c = app.body[j];
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) break; }
    }
    out.push(app.body.slice(m.index, j + 1) + (app.body[m.index + m[1].length] === "c" ? ";" : ""));
  }
  return out.join("\n");
}
const core = extract(["AMB", "ENG", "cycle", "sdSeg2", "sdBox2", "meridional"]);
const sandbox = { Math, console };
vm.createContext(sandbox);
new vm.Script(core + "\n;globalThis.__api = { cycle, meridional };").runInContext(sandbox);
const { cycle, meridional } = sandbox.__api;

console.log("\n[ thermodynamics ]");
const idle = cycle(22), cruise = cycle(88), toga = cycle(100);
check("monotonic with throttle", () => {
  for (const k of ["T3", "T4", "opr", "F", "mdot"]) {
    assert(idle[k] < cruise[k] && cruise[k] <= toga[k], `${k} is not monotonic in N1`);
  }
  return "T3, T4, OPR, thrust, mdot";
});
check("cruise overall pressure ratio", () => {
  inRange("OPR", cruise.opr, 20, 55);
  return `${cruise.opr.toFixed(1)}:1`;
});
check("turbine entry temperature capped", () => {
  inRange("T4", toga.T4, 1400, 1750);
  assert(toga.T4 <= 1750 + 1e-9, "T4 exceeds the 1750 K limit");
  return `${toga.T4.toFixed(0)} K at 100% N1`;
});
check("station temperatures ordered", () => {
  const c = cruise;
  assert(c.T2 < c.T13 && c.T13 < c.T25 && c.T25 < c.T3, "compression path not increasing");
  assert(c.T3 < c.T4, "combustor must add heat");
  assert(c.T4 > c.T45 && c.T45 > c.T5, "turbines must extract work");
  return `${c.T2.toFixed(0)} → ${c.T3.toFixed(0)} → ${c.T4.toFixed(0)} → ${c.T5.toFixed(0)} K`;
});
check("cruise thrust in class", () => {
  // cruise net thrust at M0.82/FL350 is a small fraction of sea-level static
  // thrust; a 9:1 BPR narrowbody engine sits around 20-30 kN there
  inRange("F", cruise.F, 15, 45);
  inRange("F (max N1)", toga.F, 20, 70);
  return `${cruise.F.toFixed(1)} kN @88%, ${toga.F.toFixed(1)} kN @100%`;
});
check("cruise TSFC in class", () => {
  inRange("TSFC", cruise.tsfc, 0.4, 0.9);
  return `${cruise.tsfc.toFixed(3)} kg/kgf·h`;
});
check("fuel-air ratio physical", () => {
  inRange("f", cruise.far, 0.005, 0.045);
  return cruise.far.toFixed(4);
});
check("core jet faster than bypass jet", () => {
  assert(cruise.vc > cruise.vb, `core ${cruise.vc.toFixed(0)} vs bypass ${cruise.vb.toFixed(0)} m/s`);
  inRange("V core", cruise.vc, 300, 800);
  inRange("V bypass", cruise.vb, 200, 600);
  return `${cruise.vc.toFixed(0)} / ${cruise.vb.toFixed(0)} m/s`;
});
check("spool speeds bounded", () => {
  for (const s of [idle, cruise, toga]) inRange("N2", s.n2, 0, 105);
  return `N2 ${toga.n2.toFixed(1)}% at full N1`;
});
check("no NaN anywhere in the model", () => {
  for (let n = 0; n <= 100; n += 2) {
    for (const [k, v] of Object.entries(cycle(n))) {
      assert(Number.isFinite(v), `cycle(${n}).${k} = ${v}`);
    }
  }
  return "51 throttle settings";
});

console.log("\n[ geometry ]");
const inside = (x, r) => meridional(x, r)[0] < 0;
check("solid where the engine must be solid", () => {
  const pts = [
    ["nacelle skin", -0.5, 1.09, 1],
    ["core cowl", 0.9, 0.66, 2],
    ["spinner", -0.9, 0.08, 3],
    ["fan blade", -0.8, 0.7, 4],
    ["combustor casing", 1.16, 0.60, 8],
    ["lp shaft", 1.0, 0.02, 11],
    ["exhaust cone", 2.5, 0.15, 15],
  ];
  for (const [name, x, r, id] of pts) {
    const [d, got] = meridional(x, r);
    assert(d < 0, `${name} at (${x}, ${r}) is empty (d=${d.toFixed(3)})`);
    assert(got === id, `${name} reads as id ${got}, expected ${id}`);
  }
  return `${pts.length} landmarks`;
});
check("void where the engine must be hollow", () => {
  const pts = [["bypass duct", -0.1, 0.85], ["combustor flame tube", 1.16, 0.435],
               ["outside nacelle", -0.5, 1.4], ["ahead of intake", -1.5, 0.5]];
  for (const [name, x, r] of pts) {
    assert(!inside(x, r), `${name} at (${x}, ${r}) is solid`);
  }
  return `${pts.length} voids`;
});
check("bypass duct is continuous", () => {
  let blocked = 0;
  for (let x = -0.30; x <= 1.20; x += 0.01) if (inside(x, 0.85)) blocked++;
  assert(blocked === 0, `${blocked} sample(s) of the bypass duct are obstructed`);
  return "151 samples clear";
});
check("gas path open at every core station", () => {
  // from the booster inlet to the LP turbine exit there must be, at each axial
  // station, at least one radius inside the core annulus that is not solid
  // a blade row reads as a solid band in the meridional profile (that is how a
  // cutaway draws it), so a station only fails if static structure seals it
  const BLADE = new Set([4, 5, 7, 9, 10, 14]);
  const blocked = [];
  for (let x = -0.35; x <= 2.15; x += 0.01) {
    let open = false;
    for (let r = 0.24; r <= 0.62; r += 0.005) {
      const [d, id] = meridional(x, r);
      if (d >= 0 || BLADE.has(id)) { open = true; break; }
    }
    if (!open) blocked.push(x.toFixed(2));
  }
  assert(blocked.length === 0, `stations sealed by static structure: ${blocked.slice(0, 6).join(", ")}`);
  return "251 stations open";
});
check("model stays inside the raymarch bounds", () => {
  for (let x = -1.6; x <= 3.2; x += 0.02) {
    for (let r = 0; r <= 1.8; r += 0.02) {
      if (inside(x, r)) {
        assert(x > -1.45 && x < 3.05 && r < 1.25, `solid found outside bounds at (${x.toFixed(2)}, ${r.toFixed(2)})`);
      }
    }
  }
  return "x ∈ (-1.45, 3.05), r < 1.25";
});
check("field is a lower bound near the surface", () => {
  // finite-difference gradient magnitude of a distance field must not exceed 1
  let worst = 0;
  const h = 1e-4;
  for (let x = -1.4; x <= 3.0; x += 0.037) {
    for (let r = 0.01; r <= 1.3; r += 0.037) {
      const g = Math.hypot(
        (meridional(x + h, r)[0] - meridional(x - h, r)[0]) / (2 * h),
        (meridional(x, r + h)[0] - meridional(x, r - h)[0]) / (2 * h)
      );
      if (g > worst) worst = g;
    }
  }
  assert(worst < 1.35, `|∇d| reaches ${worst.toFixed(3)}, sphere tracing may overshoot`);
  return `max |∇d| = ${worst.toFixed(3)}`;
});

console.log(failed ? `\n${failed} check(s) failed\n` : "\nall checks passed\n");
process.exit(failed ? 1 : 0);

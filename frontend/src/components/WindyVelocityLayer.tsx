import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

interface WindyVelocityLayerProps {
  map: maplibregl.Map | null;
  activeCycloneCenter: [number, number] | null;
  peakWindSpeed: number;
  activeCyclonePressure?: number;
  activeCycloneCategory?: string;
  gisLayers: any[];
}

// ── Wind Grid Data Store ───────────────────────────────────────────────
// Uses Open-Meteo free API for real global wind data (no API key required).
// Fallback to GFS-derived analytical synoptic model if API is unavailable.

interface WindGridNode {
  u: number;
  v: number;
  speed: number;
}

interface WindGrid {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  latStep: number;
  lonStep: number;
  latCount: number;
  lonCount: number;
  data: Float32Array; // interleaved [u, v, u, v, ...]
}

// ── Shader Sources ─────────────────────────────────────────────────────
const VS = `
attribute vec2 a_pos;
attribute vec4 a_col;
varying vec4 v_col;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  gl_PointSize = 1.8;
  v_col = a_col;
}
`;
const FS = `
precision mediump float;
varying vec4 v_col;
void main() {
  gl_FragColor = v_col;
}
`;

// ── Build analytical synoptic wind grid (fallback) ─────────────────────
function buildSynopticGrid(): WindGrid {
  const latMin = -10, latMax = 35, lonMin = 40, lonMax = 110;
  const step = 2;
  const latCount = Math.floor((latMax - latMin) / step) + 1;
  const lonCount = Math.floor((lonMax - lonMin) / step) + 1;
  const data = new Float32Array(latCount * lonCount * 2);

  for (let j = 0; j < latCount; j++) {
    const lat = latMin + j * step;
    for (let i = 0; i < lonCount; i++) {
      const lon = lonMin + i * step;
      const idx = (j * lonCount + i) * 2;

      // Trade wind / monsoon sigmoid transition
      const wm = 1.0 / (1.0 + Math.exp(-(lat - 8.0) / 2.0));
      const uTrade = -7.5 + Math.sin(lon / 5.0) * 1.5;
      const vTrade = -1.0 + Math.cos(lon / 6.0) * 1.0;
      const uMons = 13.0 + Math.sin(lat / 4.0) * 2.5;
      const vMons = 9.0 + Math.cos(lon / 5.0) * 2.0;

      let u = uTrade * (1 - wm) + uMons * wm;
      let v = vTrade * (1 - wm) + vMons * wm;

      // Subtropical high perturbation
      const dxH = lon - 45, dyH = lat - 25;
      const dH = Math.sqrt(dxH * dxH + dyH * dyH);
      if (dH > 0) {
        const hf = 12.0 * Math.exp(-dH / 22.0);
        u += (dyH / dH) * hf;
        v += (-dxH / dH) * hf;
      }

      // Micro-eddies
      u += 2.0 * Math.sin(lat / 2.0) * Math.cos(lon / 3.0);
      v += 1.8 * Math.cos(lat / 3.0) * Math.sin(lon / 2.0);

      data[idx] = u;
      data[idx + 1] = v;
    }
  }

  return { latMin, latMax, lonMin, lonMax, latStep: step, lonStep: step, latCount, lonCount, data };
}

// ── Fetch real wind data from Open-Meteo ───────────────────────────────
async function fetchOpenMeteoGrid(): Promise<WindGrid | null> {
  try {
    // Build a grid request: 5°N to 25°N, 65°E to 95°E, step 2.5° => 9x13 = 117 points
    const latMin = 5, latMax = 25, lonMin = 65, lonMax = 95;
    const step = 2.5;
    const lats: number[] = [];
    const lons: number[] = [];
    for (let lat = latMin; lat <= latMax; lat += step) lats.push(lat);
    for (let lon = lonMin; lon <= lonMax; lon += step) lons.push(lon);

    const latStr = lats.join(',');
    const lonStr = lons.join(',');

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latStr}&longitude=${lonStr}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&forecast_days=1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();

    // Open-Meteo returns array of results for multi-coordinate queries
    const results = Array.isArray(json) ? json : [json];

    const latCount = lats.length;
    const lonCount = lons.length;
    const data = new Float32Array(latCount * lonCount * 2);

    for (let j = 0; j < latCount; j++) {
      for (let i = 0; i < lonCount; i++) {
        const rIdx = j * lonCount + i;
        const dIdx = rIdx * 2;

        if (rIdx < results.length && results[rIdx]?.current) {
          const cur = results[rIdx].current;
          const spd = cur.wind_speed_10m ?? 10;
          const dir = cur.wind_direction_10m ?? 270; // degrees (meteorological)
          const dirRad = ((270 - dir) * Math.PI) / 180; // convert to math angle
          data[dIdx] = spd * Math.cos(dirRad);     // u component
          data[dIdx + 1] = spd * Math.sin(dirRad); // v component
        } else {
          // Fallback: light easterly trade wind
          data[dIdx] = -5;
          data[dIdx + 1] = 1;
        }
      }
    }

    return { latMin, latMax, lonMin, lonMax, latStep: step, lonStep: step, latCount, lonCount, data };
  } catch (e) {
    console.warn('Open-Meteo wind fetch failed, using synoptic fallback:', e);
    return null;
  }
}

// ── Bilinear interpolation on the grid ─────────────────────────────────
function sampleGrid(grid: WindGrid, lat: number, lon: number): WindGridNode {
  const { latMin, latMax, lonMin, lonMax, latStep, lonStep, latCount, lonCount, data } = grid;

  if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) {
    return { u: 0, v: 0, speed: 0 };
  }

  const fj = (lat - latMin) / latStep;
  const fi = (lon - lonMin) / lonStep;

  const j0 = Math.max(0, Math.min(latCount - 2, Math.floor(fj)));
  const i0 = Math.max(0, Math.min(lonCount - 2, Math.floor(fi)));
  const j1 = j0 + 1;
  const i1 = i0 + 1;

  const fx = fi - i0;
  const fy = fj - j0;

  const idx00 = (j0 * lonCount + i0) * 2;
  const idx10 = (j0 * lonCount + i1) * 2;
  const idx01 = (j1 * lonCount + i0) * 2;
  const idx11 = (j1 * lonCount + i1) * 2;

  const u = data[idx00] * (1 - fx) * (1 - fy) + data[idx10] * fx * (1 - fy) +
            data[idx01] * (1 - fx) * fy + data[idx11] * fx * fy;
  const v = data[idx00 + 1] * (1 - fx) * (1 - fy) + data[idx10 + 1] * fx * (1 - fy) +
            data[idx01 + 1] * (1 - fx) * fy + data[idx11 + 1] * fx * fy;

  return { u, v, speed: Math.sqrt(u * u + v * v) };
}

// ── Main Component ─────────────────────────────────────────────────────
export const WindyVelocityLayer: React.FC<WindyVelocityLayerProps> = ({
  map,
  activeCycloneCenter,
  peakWindSpeed,
  activeCyclonePressure = 1008,
  activeCycloneCategory = '',
  gisLayers
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const gridRef = useRef<WindGrid | null>(null);
  const cycloneCenterRef = useRef(activeCycloneCenter);
  const peakWindRef = useRef(peakWindSpeed);

  // Keep refs updated without re-triggering effect
  useEffect(() => { cycloneCenterRef.current = activeCycloneCenter; }, [activeCycloneCenter]);
  useEffect(() => { peakWindRef.current = peakWindSpeed; }, [peakWindSpeed]);

  const windLayer = gisLayers?.find(l => l.id === 'wind');
  const windVisible = windLayer ? windLayer.visible : true;
  const windOpacity = windLayer ? windLayer.opacity : 0.85;

  // Fetch wind data once, refresh every 10 minutes
  useEffect(() => {
    if (!windVisible) return;
    let cancelled = false;

    const load = async () => {
      // Try real data first, fall back to analytical
      const realGrid = await fetchOpenMeteoGrid();
      if (!cancelled) {
        gridRef.current = realGrid ?? buildSynopticGrid();
      }
    };

    load();
    const interval = setInterval(load, 600_000); // 10 min

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [windVisible]);

  // Main render effect
  useEffect(() => {
    if (!map || !canvasRef.current || !windVisible) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = 0;
      const c = canvasRef.current;
      if (c) {
        const gl = c.getContext('webgl');
        if (gl) gl.clear(gl.COLOR_BUFFER_BIT);
      }
      return;
    }

    // Ensure we have a grid ready (start with synoptic immediately)
    if (!gridRef.current) {
      gridRef.current = buildSynopticGrid();
    }

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: true });
    if (!gl) return;

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const resize = () => {
      const r = map.getContainer().getBoundingClientRect();
      canvas.width = r.width;
      canvas.height = r.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    // Compile shaders
    const compile = (src: string, type: number) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };

    const vs = compile(VS, gl.VERTEX_SHADER);
    const fs = compile(FS, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // ── Particles ──────────────────────────────────────────────────────
    const N = 12000; // Reduced from 25k for stability

    interface Particle { lat: number; lon: number; age: number; maxAge: number; sp: number; }

    const resetP = (p: Particle) => {
      const b = map.getBounds();
      p.lat = b.getSouth() + Math.random() * (b.getNorth() - b.getSouth());
      p.lon = b.getWest() + Math.random() * (b.getEast() - b.getWest());
      p.age = 0;
      p.maxAge = 35 + Math.random() * 45;
      p.sp = 0.5 + Math.random() * 0.6;
    };

    const particles: Particle[] = [];
    for (let i = 0; i < N; i++) {
      const p: Particle = { lat: 0, lon: 0, age: 0, maxAge: 50, sp: 0.5 };
      resetP(p);
      particles.push(p);
    }

    const posBuf = gl.createBuffer()!;
    const colBuf = gl.createBuffer()!;
    const posArr = new Float32Array(N * 2);
    const colArr = new Float32Array(N * 4);

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const aCol = gl.getAttribLocation(prog, 'a_col');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ── Get flow with cyclone overlay ─────────────────────────────────
    const getFlow = (lat: number, lon: number): WindGridNode => {
      const grid = gridRef.current;
      if (!grid) return { u: 0, v: 0, speed: 0 };

      const base = sampleGrid(grid, lat, lon);
      let u = base.u, v = base.v;

      // Cyclone vortex overlay
      const center = cycloneCenterRef.current;
      if (center) {
        const dx = lon - center[1];
        const dy = lat - center[0];
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r > 0.05 && r < 6.5) {
          const tx = -dy / r, ty = dx / r;
          const rx = -dx / r, ry = -dy / r;
          const uV = tx * 0.82 + rx * 0.18;
          const vV = ty * 0.82 + ry * 0.18;
          const scale = Math.max(2.0, peakWindRef.current * Math.min(2.2, 0.6 / r));
          u += uV * scale * 0.12;
          v += vV * scale * 0.12;
        }
      }

      return { u, v, speed: Math.sqrt(u * u + v * v) };
    };

    // ── Color from speed ──────────────────────────────────────────────
    const colorFromSpeed = (spd: number): [number, number, number, number] => {
      if (spd > 80) return [0.95, 0.2, 0.2, 0.8];
      if (spd > 50) return [0.95, 0.55, 0.1, 0.78];
      if (spd > 30) return [0.1, 0.85, 0.45, 0.72];
      return [0.25, 0.65, 0.95, 0.65];
    };

    // ── Render loop (throttled to ~30fps for stability) ───────────────
    let lastFrameTime = 0;
    const FRAME_INTERVAL = 33; // ms (~30fps)

    const render = (now: number) => {
      animRef.current = requestAnimationFrame(render);

      if (now - lastFrameTime < FRAME_INTERVAL) return;
      lastFrameTime = now;

      gl.clearColor(0.01, 0.02, 0.07, 0.12);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const bounds = map.getBounds();
      const bS = bounds.getSouth(), bN = bounds.getNorth();
      const bW = bounds.getWest(), bE = bounds.getEast();
      const cw = canvas.width, ch = canvas.height;

      for (let i = 0; i < N; i++) {
        const p = particles[i];
        const flow = getFlow(p.lat, p.lon);

        p.lat += flow.v * p.sp * 0.003;
        p.lon += flow.u * p.sp * 0.003;
        p.age++;

        if (p.lon < bW || p.lon > bE || p.lat < bS || p.lat > bN || p.age > p.maxAge) {
          resetP(p);
          posArr[i * 2] = -9;
          posArr[i * 2 + 1] = -9;
          continue;
        }

        const pt = map.project(new maplibregl.LngLat(p.lon, p.lat));
        posArr[i * 2] = (pt.x / cw) * 2.0 - 1.0;
        posArr[i * 2 + 1] = -((pt.y / ch) * 2.0 - 1.0);

        const [r, g, b, a] = colorFromSpeed(flow.speed);
        colArr[i * 4] = r;
        colArr[i * 4 + 1] = g;
        colArr[i * 4 + 2] = b;
        colArr[i * 4 + 3] = a;
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, colArr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, N);
    };

    animRef.current = requestAnimationFrame(render);

    // ── On map move: resize + scatter particles ───────────────────────
    const onMove = () => {
      resize();
      for (let i = 0; i < N; i++) resetP(particles[i]);
    };

    map.on('moveend', onMove);
    map.on('resize', resize);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = 0;
      map.off('moveend', onMove);
      map.off('resize', resize);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(colBuf);
      gl.deleteProgram(prog);
    };
  }, [map, windVisible]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none z-[400] w-full h-full"
      style={{ opacity: windOpacity, display: windVisible ? 'block' : 'none' }}
    />
  );
};

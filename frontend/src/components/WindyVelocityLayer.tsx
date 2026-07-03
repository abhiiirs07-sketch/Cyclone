import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

interface WindyVelocityLayerProps {
  map: maplibregl.Map | null;
  activeCycloneCenter: [number, number] | null;
  peakWindSpeed: number;
  gisLayers: any[];
}

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;
  attribute vec4 a_color;
  varying vec4 v_color;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    gl_PointSize = 2.0;
    v_color = a_color;
  }
`;

const FRAGMENT_SHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_color;
  void main() {
    gl_FragColor = v_color;
  }
`;

export const WindyVelocityLayer: React.FC<WindyVelocityLayerProps> = ({
  map,
  activeCycloneCenter,
  peakWindSpeed,
  gisLayers
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const gridDataRef = useRef<any>(null);

  const windLayer = gisLayers?.find(l => l.id === 'wind');
  const windVisible = windLayer ? windLayer.visible : true;
  const windOpacity = windLayer ? windLayer.opacity : 0.85;

  let layerType: any = 'wind';
  if (gisLayers?.find(l => l.id === 'rain')?.visible) layerType = 'rain';
  else if (gisLayers?.find(l => l.id === 'surge')?.visible) layerType = 'surge';
  else if (gisLayers?.find(l => l.id === 'wave')?.visible) layerType = 'wave';

  // Fetch live weather vector grid from backend API
  useEffect(() => {
    if (!windVisible) return;
    
    const fetchLiveGrid = async () => {
      try {
        const idParam = activeCycloneCenter ? "?cyclone_id=1" : "";
        const apiBase = window.location.origin.includes('localhost') ? "http://127.0.0.1:8000" : window.location.origin;
        const res = await fetch(`${apiBase}/api/weather/live${idParam}`);
        const data = await res.json();
        
        const gridMap: { [key: string]: any } = {};
        data.grid.forEach((node: any) => {
          gridMap[`${node.lat}_${node.lon}`] = node;
        });
        
        gridDataRef.current = {
          lat_range: data.lat_range,
          lon_range: data.lon_range,
          nodes: gridMap
        };
      } catch (err) {
        console.warn("Using local mathematical vortex fallback.", err);
        gridDataRef.current = null;
      }
    };
    
    fetchLiveGrid();
    const timer = setInterval(fetchLiveGrid, 30000);
    return () => clearInterval(timer);
  }, [activeCycloneCenter, windVisible]);

  useEffect(() => {
    if (!map || !canvasRef.current || !windVisible) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const gl = canvas.getContext('webgl');
        if (gl) gl.clear(gl.COLOR_BUFFER_BIT);
      }
      return;
    }

    const canvas = canvasRef.current;
    
    // Request preserveDrawingBuffer: true to allow fading trails
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: true });
    if (!gl) {
      console.warn("WebGL not supported, rendering disabled.");
      return;
    }

    // Set styling
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const resizeCanvas = () => {
      const rect = map.getContainer().getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    };
    resizeCanvas();

    // Compile Shaders
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error: ", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(VERTEX_SHADER_SOURCE, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(FRAGMENT_SHADER_SOURCE, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error: ", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Initialize 25,000 particles
    const particleCount = 25000;
    const particles: Array<{
      lat: number;
      lon: number;
      age: number;
      maxAge: number;
      speedScale: number;
    }> = [];

    // Helper: Get random lat/lon bounds from map view
    const getRandomLocation = () => {
      const bounds = map.getBounds();
      const lat = bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth());
      const lon = bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest());
      return { lat, lon };
    };

    const initParticle = (p: any = {}) => {
      const loc = getRandomLocation();
      p.lat = loc.lat;
      p.lon = loc.lon;
      p.age = 0;
      p.maxAge = 40 + Math.random() * 50;
      p.speedScale = 0.55 + Math.random() * 0.65;
      return p;
    };

    for (let i = 0; i < particleCount; i++) {
      particles.push(initParticle());
    }

    // Grid Bilinear Interpolation
    const interpolateGridValue = (lat: number, lon: number): { u: number; v: number; speed: number; sst: number; pressure: number; humidity: number; salinity: number } => {
      const grid = gridDataRef.current;
      if (!grid) return { u: 0, v: 0, speed: 0, sst: 0, pressure: 0, humidity: 0, salinity: 0 };
      
      const { lat_range, lon_range, nodes } = grid;
      
      const minLat = lat_range[0];
      const maxLat = lat_range[lat_range.length - 1];
      const minLon = lon_range[0];
      const maxLon = lon_range[lon_range.length - 1];
      
      if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) {
        return { u: 0, v: 0, speed: 0, sst: 0, pressure: 0, humidity: 0, salinity: 0 };
      }
      
      const latIndex = Math.floor(lat / 2.0);
      const lonIndex = Math.floor((lon - 60.0) / 2.0);
      
      const lat0 = latIndex * 2;
      const lat1 = Math.min(maxLat, lat0 + 2);
      const lon0 = 60 + lonIndex * 2;
      const lon1 = Math.min(maxLon, lon0 + 2);
      
      const x_frac = (lon - lon0) / 2.0;
      const y_frac = (lat - lat0) / 2.0;
      
      const n00 = nodes[`${lat0}_${lon0}`];
      const n10 = nodes[`${lat0}_${lon1}`];
      const n01 = nodes[`${lat1}_${lon0}`];
      const n11 = nodes[`${lat1}_${lon1}`];
      
      if (!n00 || !n10 || !n01 || !n11) {
        return { u: 0, v: 0, speed: 0, sst: 0, pressure: 0, humidity: 0, salinity: 0 };
      }
      
      const interpolate = (p: string) => {
        const v1 = n00[p] * (1 - x_frac) + n10[p] * x_frac;
        const v2 = n01[p] * (1 - x_frac) + n11[p] * x_frac;
        return v1 * (1 - y_frac) + v2 * y_frac;
      };
      
      let paramU = 'u', paramV = 'v';
      if (layerType === 'rain') {
        paramU = 'rain'; 
        paramV = 'rain';
      } else if (layerType === 'surge') {
        paramU = 'surge_u';
        paramV = 'surge_v';
      }
      
      if (layerType === 'rain') {
        const rainVal = interpolate('rain');
        return {
          u: -rainVal * 0.12 - 0.8,
          v: rainVal * 0.55 + 1.8,
          speed: rainVal,
          sst: 0, pressure: 0, humidity: 0, salinity: 0
        };
      }
      
      const u = interpolate(paramU);
      const v = interpolate(paramV);
      let multiplier = 1.0;
      if (layerType === 'current') multiplier = 0.25;
      if (layerType === 'wave') multiplier = 0.45;
      
      return {
        u: u * multiplier,
        v: v * multiplier,
        speed: Math.sqrt(u * u + v * v),
        sst: interpolate('sst'),
        pressure: interpolate('pressure'),
        humidity: interpolate('humidity'),
        salinity: interpolate('salinity')
      };
    };

    const getFlowVector = (lat: number, lon: number) => {
      let baseVector = { u: 0, v: 0, speed: 0, sst: 28.0, pressure: 1008, humidity: 80, salinity: 32.5 };

      if (gridDataRef.current) {
        const gridVal = interpolateGridValue(lat, lon);
        if (gridVal.speed > 0 || gridVal.sst > 0) {
          baseVector = gridVal;
        }
      } else {
        // Fallback trade flow
        const baseU = lat < 10 ? -0.8 : 1.2;
        const baseV = Math.sin(lon * 0.15) * 0.25;
        baseVector = {
          u: baseU,
          v: baseV,
          speed: Math.sqrt(baseU * baseU + baseV * baseV),
          sst: 28.0,
          pressure: 1008,
          humidity: 80,
          salinity: 32.5
        };
      }

      // Layer cyclonic vortex overlay (spiraling inward circulation scaling by storm intensity)
      if (activeCycloneCenter) {
        const dx = lon - activeCycloneCenter[1]; // lon diff
        const dy = lat - activeCycloneCenter[0]; // lat diff
        const r = Math.sqrt(dx * dx + dy * dy);

        if (r > 0.05 && r < 6.5) { // Cyclone influence radius (up to 650km)
          const tx = -dy / r; // tangential U component
          const ty = dx / r;  // tangential V component
          const rx = -dx / r; // radial inwards U component
          const ry = -dy / r; // radial inwards V component

          // Swirl vector (82% tangential swirl, 18% radial spiral inflow)
          const u_vort = tx * 0.82 + rx * 0.18;
          const v_vort = ty * 0.82 + ry * 0.18;

          // Swirl speed profiles (peaks around eye-wall RMW, then falls off with 1/r)
          const scale = Math.max(2.0, peakWindSpeed * Math.min(2.2, 0.6 / r));

          // Combine baseline vector with storm swirl velocity
          baseVector.u += u_vort * scale * 0.12;
          baseVector.v += v_vort * scale * 0.12;
          baseVector.speed = Math.sqrt(baseVector.u * baseVector.u + baseVector.v * baseVector.v);
        }
      }

      return baseVector;
    };

    // Shaders positions & colors attributes buffers
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();

    const positionData = new Float32Array(particleCount * 2);
    const colorData = new Float32Array(particleCount * 4);

    const aPositionLoc = gl.getAttribLocation(program, "a_position");
    const aColorLoc = gl.getAttribLocation(program, "a_color");

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Render loop
    const render = () => {
      // Clear WebGL color buffer slightly to maintain fading trails
      // We clear with high alpha black to fade existing pixels in preserveDrawingBuffer
      gl.clearColor(0.01, 0.02, 0.07, 0.12);
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        const vec = getFlowVector(p.lat, p.lon);
        
        // Move particle coordinate
        p.lat += vec.v * p.speedScale * 0.0035;
        p.lon += vec.u * p.speedScale * 0.0035;
        p.age++;

        // Project coordinate to screen pixel
        const pt = map.project(new maplibregl.LngLat(p.lon, p.lat));
        
        // Verify bounds or reset
        const bounds = map.getBounds();
        if (
          p.lon < bounds.getWest() || p.lon > bounds.getEast() ||
          p.lat < bounds.getSouth() || p.lat > bounds.getNorth() ||
          p.age > p.maxAge
        ) {
          initParticle(p);
          positionData[i * 2] = -999.0;
          positionData[i * 2 + 1] = -999.0;
          continue;
        }

        // Translate to WebGL clip space: -1.0 to 1.0
        const clipX = (pt.x / canvas.width) * 2.0 - 1.0;
        const clipY = -((pt.y / canvas.height) * 2.0 - 1.0);

        positionData[i * 2] = clipX;
        positionData[i * 2 + 1] = clipY;

        // Dynamic coloring matching speeds or temperatures
        let r = 0.5, g = 0.5, b = 1.0, a = 0.75; // Default cyan/blue

        if (layerType === 'wind') {
          const speed = vec.speed;
          if (speed > 80) { r = 0.95; g = 0.2; b = 0.2; }      // Red
          else if (speed > 50) { r = 0.95; g = 0.55; b = 0.1; } // Orange
          else if (speed > 30) { r = 0.1; g = 0.85; b = 0.45; } // Green
          else { r = 0.2; g = 0.65; b = 0.95; }                 // Cyan
        } else if (layerType === 'rain') {
          r = 0.12; g = 0.75; b = 0.95; a = 0.55; // rain sky-blue
        } else if (layerType === 'surge') {
          r = 0.05; g = 0.85; b = 0.75; a = 0.8; // deep turquoise
        } else if (layerType === 'wave') {
          r = 0.7; g = 0.4; b = 0.95; a = 0.7; // waves violet
        } else if (layerType === 'sst') {
          // Heat colors
          const norm = Math.max(0, Math.min(1, (vec.sst - 25.0) / 6.0));
          r = norm; g = 0.5 - norm * 0.3; b = 1.0 - norm;
        } else if (layerType === 'pressure') {
          const norm = Math.max(0, Math.min(1, (vec.pressure - 920.0) / 90.0));
          r = 1.0 - norm; g = 0.2; b = norm;
        } else if (layerType === 'humidity') {
          const norm = Math.max(0, Math.min(1, (vec.humidity - 70.0) / 30.0));
          r = 0.1; g = 0.8 * norm; b = 0.95;
        } else if (layerType === 'salinity') {
          const norm = Math.max(0, Math.min(1, (vec.salinity - 31.0) / 3.0));
          r = 0.1 + norm * 0.4; g = 0.9; b = 0.5 - norm * 0.3;
        }

        colorData[i * 4] = r;
        colorData[i * 4 + 1] = g;
        colorData[i * 4 + 2] = b;
        colorData[i * 4 + 3] = a;
      }

      // Upload Buffers
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positionData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colorData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(aColorLoc);
      gl.vertexAttribPointer(aColorLoc, 4, gl.FLOAT, false, 0, 0);

      // WebGL points drawing call
      gl.drawArrays(gl.POINTS, 0, particleCount);

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    const onMapChange = () => {
      resizeCanvas();
      particles.forEach(p => initParticle(p));
    };

    map.on('move', onMapChange);
    map.on('resize', onMapChange);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      map.off('move', onMapChange);
      map.off('resize', onMapChange);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(colorBuffer);
      gl.deleteProgram(program);
    };
  }, [map, activeCycloneCenter, peakWindSpeed, windVisible, layerType]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 pointer-events-none z-[400] w-full h-full"
      style={{ opacity: windOpacity, display: windVisible ? 'block' : 'none' }}
    />
  );
};

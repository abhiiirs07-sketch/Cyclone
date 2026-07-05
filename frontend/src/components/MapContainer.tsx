import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { WindyVelocityLayer } from './WindyVelocityLayer';
import { Eye, Map as MapIcon, Layers, Maximize2, Compass, PencilLine, Trash2, Sliders, Split, Ruler, Square, Play, ShieldAlert, Sparkles, Navigation, ZoomIn, ZoomOut, Camera, FileJson } from 'lucide-react';

export type WeatherLayerType = 'wind' | 'rain' | 'sst' | 'surge' | 'wave' | 'current' | 'pressure' | 'humidity' | 'visibility' | 'salinity' | null;

import { type GisLayer } from './GisLayerManager';

interface MapContainerProps {
  cycloneTrack: any[];
  forecastTrack: any[]; // Can be single track or ensemble dict
  districtGeoJSON: any;
  gisLayers: GisLayer[];
  drawingMode: boolean;
  setDrawingMode: (mode: boolean) => void;
  drawnPoints: any[];
  setDrawnPoints: (points: any[]) => void;
  onDrawComplete: () => void;
  safeCorridorsPlotted: boolean;
  compareTrack?: any[];
  compareMode?: boolean;
}

const generateUncertaintyCone = (path: any[]): any => {
  if (!path || path.length < 2) return null;
  const leftCoords: [number, number][] = [];
  const rightCoords: [number, number][] = [];
  const kmPerDegreeLat = 111.32;
  
  path.forEach((pt, idx) => {
    // Uncertainty cone radius starts at 30km and widens by 20km per step
    const radiusKm = 30 + idx * 20;
    const lat = pt.lat;
    const lon = pt.lon;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    
    let angle = 0;
    if (idx < path.length - 1) {
      const nextPt = path[idx + 1];
      angle = Math.atan2(nextPt.lat - lat, nextPt.lon - lon) + Math.PI / 2;
    } else {
      const prevPt = path[idx - 1];
      angle = Math.atan2(lat - prevPt.lat, lon - prevPt.lon) + Math.PI / 2;
    }
    
    const dLatL = (radiusKm * Math.sin(angle)) / kmPerDegreeLat;
    const dLonL = (radiusKm * Math.cos(angle)) / (kmPerDegreeLat * cosLat);
    leftCoords.push([lon + dLonL, lat + dLatL]);
    
    const dLatR = (radiusKm * Math.sin(angle + Math.PI)) / kmPerDegreeLat;
    const dLonR = (radiusKm * Math.cos(angle + Math.PI)) / (kmPerDegreeLat * cosLat);
    rightCoords.push([lon + dLonR, lat + dLatR]);
  });
  
  const coordinates = [...leftCoords, ...rightCoords.reverse(), leftCoords[0]];
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };
};

const BASEMAPS: { [key: string]: { name: string; url: string | null } } = {
  dark: { name: 'CartoDB Dark Matter (Vector)', url: null },
  osm: { name: 'OpenStreetMap (Raster)', url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png' },
  satellite: { name: 'ESRI World Imagery (Satellite)', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
  hybrid: { name: 'Google Hybrid (Satellite + Labels)', url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' },
  terrain: { name: 'USGS Terrain Relief', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}' }
};

export const MapContainer: React.FC<MapContainerProps> = ({
  cycloneTrack,
  forecastTrack,
  districtGeoJSON,
  gisLayers,
  drawingMode,
  setDrawingMode,
  drawnPoints,
  setDrawnPoints,
  onDrawComplete,
  safeCorridorsPlotted,
  compareTrack = [],
  compareMode = false
}) => {
  const leftMapContainerRef = useRef<HTMLDivElement | null>(null);
  const rightMapContainerRef = useRef<HTMLDivElement | null>(null);
  
  const [leftMap, setLeftMap] = useState<maplibregl.Map | null>(null);
  const [rightMap, setRightMap] = useState<maplibregl.Map | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  // Basemap config
  const [leftBasemap, setLeftBasemap] = useState<string>('dark');
  const [rightBasemap, setRightBasemap] = useState<string>('satellite');
  const [showBasemapMenu, setShowBasemapMenu] = useState<boolean>(false);
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);

  // Swipe Comparison state
  const [swipeActive, setSwipeActive] = useState<boolean>(false);
  const [swipePercent, setSwipePercent] = useState<number>(50);
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSwipe = useRef<boolean>(false);

  // GIS Tool States
  const [gisTool, setGisTool] = useState<'none' | 'measure' | 'aoi'>('none');
  const [measurePoints, setMeasurePoints] = useState<maplibregl.LngLat[]>([]);
  const [aoiPoints, setAoiPoints] = useState<maplibregl.LngLat[]>([]);
  const [cumulativeDistance, setCumulativeDistance] = useState<number>(0);
  const [showBuffers, setShowBuffers] = useState<boolean>(true);

  const handleZoomIn = () => {
    if (leftMap) leftMap.zoomIn();
    if (rightMap) rightMap.zoomIn();
  };

  const handleZoomOut = () => {
    if (leftMap) leftMap.zoomOut();
    if (rightMap) rightMap.zoomOut();
  };

  const handleCompassReset = () => {
    if (leftMap) leftMap.easeTo({ bearing: 0, pitch: 15, duration: 800 });
    if (rightMap) rightMap.easeTo({ bearing: 0, pitch: 15, duration: 800 });
  };

  const handle3DTiltToggle = () => {
    if (!leftMap) return;
    const curPitch = leftMap.getPitch();
    const targetPitch = curPitch > 30 ? 0 : 60;
    leftMap.easeTo({ pitch: targetPitch, duration: 800 });
    if (rightMap) rightMap.easeTo({ pitch: targetPitch, duration: 800 });
  };

  const handleCaptureScreenshot = () => {
    if (!leftMap) return;
    const canvas = leftMap.getCanvas();
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `GeoCyclone_Map_Snapshot.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportGeoJSON = () => {
    let geojson;
    if (drawnPoints && drawnPoints.length > 0) {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: drawnPoints.map(pt => [pt.lon, pt.lat])
          },
          properties: { name: 'Simulated Path' }
        }]
      };
    } else if (cycloneTrack && cycloneTrack.length > 0) {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: cycloneTrack.map(pt => [pt.lon, pt.lat])
          },
          properties: { name: 'Observed Track' }
        }]
      };
    } else {
      alert("No track coordinates available to export.");
      return;
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cyclone_track.geojson`;
    link.click();
  };

  // Force swipe active when compareMode is enabled
  useEffect(() => {
    if (compareMode) {
      setSwipeActive(true);
    }
  }, [compareMode]);

  // 1. Initialize MapLibre Instances
  useEffect(() => {
    if (!leftMapContainerRef.current) return;

    // Use Carto Dark Matter GL Style as the underlying vector baseline
    const map1 = new maplibregl.Map({
      container: leftMapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [82.5, 15.5],
      zoom: 5.0,
      pitch: 15,
      bearing: 0,
      preserveDrawingBuffer: true
    } as any);

    map1.on('mousemove', (e) => {
      setCoords({ lat: e.lngLat.lat, lon: e.lngLat.lng });
    });

    setLeftMap(map1);

    return () => {
      map1.remove();
    };
  }, []);

  // Initialize secondary map for swipe comparative viewing
  useEffect(() => {
    if (!rightMapContainerRef.current || !swipeActive) {
      if (rightMap) {
        rightMap.remove();
        setRightMap(null);
      }
      return;
    }

    const map2 = new maplibregl.Map({
      container: rightMapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: leftMap ? leftMap.getCenter() : [82.5, 15.5],
      zoom: leftMap ? leftMap.getZoom() : 5.0,
      pitch: leftMap ? leftMap.getPitch() : 15,
      bearing: leftMap ? leftMap.getBearing() : 0,
      preserveDrawingBuffer: true
    } as any);

    setRightMap(map2);

    return () => {
      map2.remove();
    };
  }, [swipeActive]);

  // 2. Synchronize Dual Maps (Move / Pitch / Bearing)
  useEffect(() => {
    if (!leftMap || !rightMap || !swipeActive) return;

    let isSyncing = false;

    const onLeftMove = () => {
      if (isSyncing) return;
      isSyncing = true;
      rightMap.jumpTo({
        center: leftMap.getCenter(),
        zoom: leftMap.getZoom(),
        bearing: leftMap.getBearing(),
        pitch: leftMap.getPitch()
      });
      isSyncing = false;
    };

    const onRightMove = () => {
      if (isSyncing) return;
      isSyncing = true;
      leftMap.jumpTo({
        center: rightMap.getCenter(),
        zoom: rightMap.getZoom(),
        bearing: rightMap.getBearing(),
        pitch: rightMap.getPitch()
      });
      isSyncing = false;
    };

    leftMap.on('move', onLeftMove);
    rightMap.on('move', onRightMove);

    return () => {
      leftMap.off('move', onLeftMove);
      rightMap.off('move', onRightMove);
    };
  }, [leftMap, rightMap, swipeActive]);

  // 3. Dynamically Swap Basemap Tile Layers
  const updateBasemap = (mapInstance: maplibregl.Map, tileUrl: string | null, layerId: string) => {
    if (!mapInstance.isStyleLoaded()) return;

    // Remove existing layer/source
    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(layerId)) mapInstance.removeSource(layerId);

    if (!tileUrl) return; // CartoDB Dark Matter GL style default

    mapInstance.addSource(layerId, {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256
    });

    // Add underneath text labels
    const layers = mapInstance.getStyle().layers;
    let firstLabelLayerId: string | undefined;
    for (const layer of layers) {
      if (layer.type === 'symbol') {
        firstLabelLayerId = layer.id;
        break;
      }
    }

    mapInstance.addLayer(
      {
        id: layerId,
        type: 'raster',
        source: layerId
      },
      firstLabelLayerId
    );
  };

  const createDynamicLayer = (mapInstance: maplibregl.Map, layer: GisLayer) => {
    if (layer.id === 'rivers') {
      const riverCoords = [
        [[84.0, 19.5], [85.0, 19.8], [86.2, 20.15]],
        [[81.0, 16.2], [81.8, 16.5], [82.2, 16.8]],
        [[79.5, 15.5], [80.1, 15.8], [80.5, 16.0]],
      ];
      
      mapInstance.addSource('rivers-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: riverCoords.map((coords, i) => ({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: { id: i }
          }))
        }
      });

      mapInstance.addLayer({
        id: 'river-layer',
        type: 'line',
        source: 'rivers-src',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2.0,
          'line-opacity': layer.opacity
        }
      });
      return;
    }

    const layerSrcId = `${layer.id}-src`;
    const layerId = `${layer.id}-layer`;

    // 1. Real-time RainViewer Meteorological Radar
    if (layer.id === 'rain') {
      mapInstance.addSource(layerSrcId, {
        type: 'raster',
        tiles: ['https://tilecache.rainviewer.com/v2/radar/newest/256/{z}/{x}/{y}/2/1_1.png'],
        tileSize: 256
      });
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: layerSrcId,
        paint: { 'raster-opacity': layer.opacity }
      }, mapInstance.getLayer('district-layer') ? 'district-layer' : undefined);
      return;
    }

    // 2. Real-time NASA GIBS Sea Surface Temperature (SST)
    if (layer.id === 'sst') {
      mapInstance.addSource(layerSrcId, {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png'],
        tileSize: 256
      });
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: layerSrcId,
        paint: { 'raster-opacity': layer.opacity }
      }, mapInstance.getLayer('district-layer') ? 'district-layer' : undefined);
      return;
    }

    // 3. Real-time NASA GIBS Satellite Clouds Imagery (Visible and Infrared fallback)
    if (['cloud', 'insat_vis', 'insat_ir'].includes(layer.id)) {
      mapInstance.addSource(layerSrcId, {
        type: 'raster',
        tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg'],
        tileSize: 256
      });
      mapInstance.addLayer({
        id: layerId,
        type: 'raster',
        source: layerSrcId,
        paint: { 'raster-opacity': layer.opacity }
      }, mapInstance.getLayer('district-layer') ? 'district-layer' : undefined);
      return;
    }

    // 4. Fallback Simulated Layers (Pressure, CAPE, Surge, Flood, Wind Risk)
    if (['surge', 'cape', 'pressure', 'flood', 'wind_risk'].includes(layer.id)) {
      const features = [];
      const startLat = 5.0;
      const endLat = 25.0;
      const startLon = 70.0;
      const endLon = 95.0;
      const step = 2.0;

      for (let lat = startLat; lat < endLat; lat += step) {
        for (let lon = startLon; lon < endLon; lon += step) {
          let valueColor = '#ffffff';
          if (layer.id === 'surge') {
            const isCoastal = (lon > 80 && lon < 87 && lat > 10 && lat < 22);
            valueColor = isCoastal ? '#a855f7' : 'transparent';
          } else if (layer.id === 'cape') {
            valueColor = lat < 12 ? '#ef4444' : '#eab308';
          } else if (layer.id === 'pressure') {
            valueColor = '#475569';
          } else if (layer.id === 'flood') {
            const highFlood = lat > 18 && lon > 84 && lon < 88;
            valueColor = highFlood ? '#22c55e' : '#86efac';
          } else {
            valueColor = '#f59e0b';
          }

          if (valueColor !== 'transparent') {
            features.push({
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [[
                  [lon, lat],
                  [lon + step, lat],
                  [lon + step, lat + step],
                  [lon, lat + step],
                  [lon, lat]
                ]]
              },
              properties: { color: valueColor }
            });
          }
        }
      }

      mapInstance.addSource(layerSrcId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features }
      });

      mapInstance.addLayer(
        {
          id: layerId,
          type: 'fill',
          source: layerSrcId,
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': layer.opacity
          }
        },
        mapInstance.getLayer('district-layer') ? 'district-layer' : undefined
      );
    }
  };

  // Sync visibilities and opacities across all active viewport maps
  useEffect(() => {
    const activeMaps = [leftMap, rightMap].filter(Boolean) as maplibregl.Map[];
    if (activeMaps.length === 0) return;

    const syncLayers = () => {
      activeMaps.forEach(mapInstance => {
        if (!mapInstance.isStyleLoaded()) return;

        gisLayers.forEach(layer => {
          const mapLayerId = layer.id === 'districts' ? 'district-layer' :
                             layer.id === 'shelters' ? 'shelter-layer' :
                             layer.id === 'rivers' ? 'river-layer' : `${layer.id}-layer`;

          const layerObj = mapInstance.getLayer(mapLayerId);
          if (layerObj) {
            mapInstance.setLayoutProperty(mapLayerId, 'visibility', layer.visible ? 'visible' : 'none');
            
            try {
              const type = layerObj.type;
              if (type === 'fill') {
                mapInstance.setPaintProperty(mapLayerId, 'fill-opacity', layer.opacity);
              } else if (type === 'line') {
                mapInstance.setPaintProperty(mapLayerId, 'line-opacity', layer.opacity);
              } else if (type === 'circle') {
                mapInstance.setPaintProperty(mapLayerId, 'circle-opacity', layer.opacity);
              } else if (type === 'raster') {
                mapInstance.setPaintProperty(mapLayerId, 'raster-opacity', layer.opacity);
              }
            } catch (e) {
              console.warn('Sync opacity failed for', mapLayerId, e);
            }
          } else if (layer.visible) {
            createDynamicLayer(mapInstance, layer);
          }
        });
      });
    };

    leftMap?.on('styledata', syncLayers);
    rightMap?.on('styledata', syncLayers);

    syncLayers();

    return () => {
      leftMap?.off('styledata', syncLayers);
      rightMap?.off('styledata', syncLayers);
    };
  }, [leftMap, rightMap, gisLayers]);

  useEffect(() => {
    if (!leftMap) return;
    const applyLeftBasemap = () => {
      const b = BASEMAPS[leftBasemap];
      updateBasemap(leftMap, b.url, 'left-raster-basemap');
    };

    if (leftMap.isStyleLoaded()) applyLeftBasemap();
    else leftMap.once('load', applyLeftBasemap);
  }, [leftMap, leftBasemap]);

  useEffect(() => {
    if (!rightMap || !swipeActive) return;
    const applyRightBasemap = () => {
      const b = BASEMAPS[rightBasemap];
      updateBasemap(rightMap, b.url, 'right-raster-basemap');
    };

    if (rightMap.isStyleLoaded()) applyRightBasemap();
    else rightMap.once('load', applyRightBasemap);
  }, [rightMap, rightBasemap, swipeActive]);

  // Helper: Geodesic Circle Generator
  const generateGeodesicCircle = (center: [number, number], radiusKm: number, steps = 64): any => {
    const [lat, lon] = center;
    const coordinates: [number, number][] = [];
    const kmPerDegreeLat = 111.32;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    
    for (let i = 0; i <= steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      const dLat = (radiusKm * Math.cos(angle)) / kmPerDegreeLat;
      const dLon = (radiusKm * Math.sin(angle)) / (kmPerDegreeLat * cosLat);
      coordinates.push([lon + dLon, lat + dLat]);
    }
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {}
    };
  };

  // Helper: Rainbands Generator
  const generateRainbands = (center: [number, number], radiusKm = 220): any => {
    const [lat, lon] = center;
    const features: any[] = [];
    const kmPerDegreeLat = 111.32;
    const cosLat = Math.cos((lat * Math.PI) / 180);

    for (let arm = 0; arm < 3; arm++) {
      const coords: [number, number][] = [];
      const baseAngle = (arm * 2 * Math.PI) / 3;
      
      for (let i = 0; i < 60; i++) {
        const theta = baseAngle + (i * 0.14);
        const r = 18 + i * (radiusKm / 60);
        const dLat = (r * Math.cos(theta)) / kmPerDegreeLat;
        const dLon = (r * Math.sin(theta)) / (kmPerDegreeLat * cosLat);
        coords.push([lon + dLon, lat + dLat]);
      }
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  };

  // 4. Render Active Cyclone Vectors, Buffers, Eye & Rainbands
  useEffect(() => {
    if (!leftMap) return;

    const renderCycloneLayers = () => {
      if (!leftMap.isStyleLoaded()) return;

      // Clean old sources/layers
      const oldLayers = [
        'cone-layer', 'cone-outline', 'radii-64', 'radii-50', 'radii-34',
        'eyewall-layer', 'eye-layer', 'rainbands-layer', 'track-line', 'track-dots'
      ];
      oldLayers.forEach(l => { if (leftMap.getLayer(l)) leftMap.removeLayer(l); });

      const oldSources = ['cone-source', 'radii-64-src', 'radii-50-src', 'radii-34-src', 'eyewall-src', 'eye-src', 'rainbands-src', 'track-src'];
      oldSources.forEach(s => { if (leftMap.getSource(s)) leftMap.removeSource(s); });

      if (cycloneTrack.length === 0) return;

      // Setup track GeoJSON (solid blue lines and points with queryable metadata)
      const trackCoordinates = cycloneTrack.map(pt => [pt.lon, pt.lat]);
      const trackPoints = cycloneTrack.map((pt, idx) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
        properties: {
          nodeIndex: idx + 1,
          timestamp: pt.timestamp,
          windSpeed: pt.wind_speed,
          pressure: pt.pressure,
          category: pt.category
        }
      }));

      leftMap.addSource('track-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: trackCoordinates },
              properties: {}
            },
            ...trackPoints
          ]
        }
      });

      leftMap.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track-src',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': '#2563eb', 'line-width': 4.0, 'line-opacity': 0.9 } // Solid Blue line
      });

      // Track dots
      leftMap.addLayer({
        id: 'track-dots',
        type: 'circle',
        source: 'track-src',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5.5,
          'circle-color': '#2563eb', // Solid Blue dots
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });

      // Show operational HUD popup on click of track dots
      leftMap.on('click', 'track-dots', (e) => {
        const features = leftMap.queryRenderedFeatures(e.point, { layers: ['track-dots'] });
        if (!features || !features.length) return;
        
        const props = features[0].properties as any;
        const coords = (features[0].geometry as any).coordinates;
        
        new maplibregl.Popup()
          .setLngLat(coords)
          .setHTML(`
            <div style="background-color: #0f172a; color: #f1f5f9; border: 1px solid #3b82f6; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; line-height: 1.5; min-width: 170px;">
              <strong style="color: #60a5fa; border-bottom: 1px solid #334155; display: block; padding-bottom: 5px; margin-bottom: 5px; font-size: 12px;">Node #${props.nodeIndex} (Observed)</strong>
              Time: <b>${new Date(props.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</b><br/>
              Coords: <b>${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E</b><br/>
              Winds: <b style="color: #ef4444;">${props.windSpeed} kt</b><br/>
              Pressure: <b style="color: #38bdf8;">${props.pressure} hPa</b><br/>
              Category: <span style="background-color: rgba(245, 158, 11, 0.2); color: #fbbf24; padding: 1px 4px; border-radius: 3px; font-weight: bold;">${props.category}</span>
            </div>
          `)
          .addTo(leftMap);
      });

      leftMap.on('mouseenter', 'track-dots', () => {
        leftMap.getCanvas().style.cursor = 'pointer';
      });
      leftMap.on('mouseleave', 'track-dots', () => {
        leftMap.getCanvas().style.cursor = '';
      });

      const activePt = cycloneTrack[cycloneTrack.length - 1];
      const center: [number, number] = [activePt.lat, activePt.lon];

      // Eyewall & Core Eye
      leftMap.addSource('eyewall-src', { type: 'geojson', data: generateGeodesicCircle(center, 22) });
      leftMap.addLayer({
        id: 'eyewall-layer',
        type: 'fill',
        source: 'eyewall-src',
        paint: { 'fill-color': '#ef4444', 'fill-opacity': 0.2, 'fill-outline-color': '#ef4444' }
      });

      leftMap.addSource('eye-src', { type: 'geojson', data: generateGeodesicCircle(center, 8) });
      leftMap.addLayer({
        id: 'eye-layer',
        type: 'fill',
        source: 'eye-src',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.6 }
      });

      // Wind Radii Circles (34 kt, 50 kt, 64 kt)
      if (showBuffers) {
        leftMap.addSource('radii-64-src', { type: 'geojson', data: generateGeodesicCircle(center, 50) });
        leftMap.addLayer({
          id: 'radii-64',
          type: 'line',
          source: 'radii-64-src',
          paint: { 'line-color': '#dc2626', 'line-width': 2, 'line-dasharray': [2, 2] }
        });

        leftMap.addSource('radii-50-src', { type: 'geojson', data: generateGeodesicCircle(center, 90) });
        leftMap.addLayer({
          id: 'radii-50',
          type: 'line',
          source: 'radii-50-src',
          paint: { 'line-color': '#ea580c', 'line-width': 1.5, 'line-dasharray': [3, 2] }
        });

        leftMap.addSource('radii-34-src', { type: 'geojson', data: generateGeodesicCircle(center, 140) });
        leftMap.addLayer({
          id: 'radii-34',
          type: 'line',
          source: 'radii-34-src',
          paint: { 'line-color': '#eab308', 'line-width': 1.5, 'line-dasharray': [4, 2] }
        });
      }

      // Spiral rainbands
      leftMap.addSource('rainbands-src', { type: 'geojson', data: generateRainbands(center, 240) });
      leftMap.addLayer({
        id: 'rainbands-layer',
        type: 'line',
        source: 'rainbands-src',
        paint: { 'line-color': '#06b6d4', 'line-width': 2.5, 'line-opacity': 0.65 }
      });
    };

    if (leftMap.isStyleLoaded()) renderCycloneLayers();
    else leftMap.once('load', renderCycloneLayers);
  }, [leftMap, cycloneTrack, showBuffers]);

  // Render Comparative Cyclone Track on the Right Map (Map 2)
  useEffect(() => {
    if (!rightMap || !swipeActive || !compareMode || !compareTrack) return;

    const renderCompareTrack = () => {
      if (!rightMap.isStyleLoaded()) return;

      // Clean old layers/sources
      const oldLayers = ['comp-track-line', 'comp-track-dots', 'comp-eyewall-layer', 'comp-eye-layer'];
      oldLayers.forEach(l => { if (rightMap.getLayer(l)) rightMap.removeLayer(l); });
      const oldSources = ['comp-track-src', 'comp-eyewall-src', 'comp-eye-src'];
      oldSources.forEach(s => { if (rightMap.getSource(s)) rightMap.removeSource(s); });

      if (compareTrack.length === 0) return;

      const trackCoords = compareTrack.map(pt => [pt.lon, pt.lat]);
      rightMap.addSource('comp-track-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trackCoords }
        }
      });

      rightMap.addLayer({
        id: 'comp-track-line',
        type: 'line',
        source: 'comp-track-src',
        paint: { 'line-color': '#a855f7', 'line-width': 3.5, 'line-opacity': 0.85 }
      });

      rightMap.addLayer({
        id: 'comp-track-dots',
        type: 'circle',
        source: 'comp-track-src',
        paint: { 'circle-radius': 4.5, 'circle-color': '#c084fc', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' }
      });

      // Draw rings at final point
      const activePt = compareTrack[compareTrack.length - 1];
      const center: [number, number] = [activePt.lat, activePt.lon];

      rightMap.addSource('comp-eyewall-src', { type: 'geojson', data: generateGeodesicCircle(center, 22) });
      rightMap.addLayer({
        id: 'comp-eyewall-layer',
        type: 'fill',
        source: 'comp-eyewall-src',
        paint: { 'fill-color': '#a855f7', 'fill-opacity': 0.2, 'fill-outline-color': '#a855f7' }
      });

      rightMap.addSource('comp-eye-src', { type: 'geojson', data: generateGeodesicCircle(center, 8) });
      rightMap.addLayer({
        id: 'comp-eye-layer',
        type: 'fill',
        source: 'comp-eye-src',
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.6 }
      });
    };

    if (rightMap.isStyleLoaded()) renderCompareTrack();
    else rightMap.once('load', renderCompareTrack);
  }, [rightMap, compareTrack, swipeActive, compareMode]);

  // 5. Plot Multi-Model Ensemble Forecast paths
  useEffect(() => {
    if (!leftMap) return;

    const renderForecastPaths = () => {
      if (!leftMap.isStyleLoaded()) return;

      const layers = [
        'fc-cone-layer', 'fc-cone-outline',
        'fc-rf-layer', 'fc-dl-layer', 'fc-nwp-layer',
        'fc-rf-layer-dots', 'fc-dl-layer-dots', 'fc-nwp-layer-dots'
      ];
      layers.forEach(l => { if (leftMap.getLayer(l)) leftMap.removeLayer(l); });
      
      const sources = ['fc-cone-src', 'fc-rf-src', 'fc-dl-src', 'fc-nwp-src'];
      sources.forEach(s => { if (leftMap.getSource(s)) leftMap.removeSource(s); });

      if (!forecastTrack) return;

      const drawPath = (path: any[], srcId: string, layerId: string, color: string) => {
        if (!path || path.length === 0) return;
        const coords = path.map(pt => [pt.lon, pt.lat]);
        const ptsFeatures = path.map((pt, idx) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] },
          properties: {
            nodeIndex: idx + 1,
            timestamp: pt.timestamp,
            windSpeed: pt.wind_speed,
            pressure: pt.pressure,
            category: pt.category || 'Forecast'
          }
        }));

        leftMap.addSource(srcId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coords }
              },
              ...ptsFeatures
            ]
          }
        });

        // Line
        leftMap.addLayer({
          id: layerId,
          type: 'line',
          source: srcId,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': color, 'line-width': 3, 'line-dasharray': [4, 4], 'line-opacity': 0.85 }
        });

        // Dots
        leftMap.addLayer({
          id: `${layerId}-dots`,
          type: 'circle',
          source: srcId,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 4.5,
            'circle-color': color,
            'circle-stroke-width': 1.0,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Tooltip for forecast dots
        leftMap.on('click', `${layerId}-dots`, (e) => {
          const features = leftMap.queryRenderedFeatures(e.point, { layers: [`${layerId}-dots`] });
          if (!features || !features.length) return;
          const props = features[0].properties as any;
          const coords = (features[0].geometry as any).coordinates;
          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div style="background-color: #0f172a; color: #f1f5f9; border: 1px solid #f97316; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; line-height: 1.5; min-width: 170px;">
                <strong style="color: #f97316; border-bottom: 1px solid #334155; display: block; padding-bottom: 5px; margin-bottom: 5px; font-size: 12px;">Node #${props.nodeIndex} (Forecast)</strong>
                Time: <b>${new Date(props.timestamp).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</b><br/>
                Coords: <b>${coords[1].toFixed(3)}°N, ${coords[0].toFixed(3)}°E</b><br/>
                Winds: <b style="color: #ef4444;">${props.windSpeed} kt</b><br/>
                Pressure: <b style="color: #38bdf8;">${props.pressure} hPa</b><br/>
                Category: <span style="background-color: rgba(249, 115, 22, 0.2); color: #fdba74; padding: 1px 4px; border-radius: 3px; font-weight: bold;">${props.category}</span>
              </div>
            `)
            .addTo(leftMap);
        });

        leftMap.on('mouseenter', `${layerId}-dots`, () => {
          leftMap.getCanvas().style.cursor = 'pointer';
        });
        leftMap.on('mouseleave', `${layerId}-dots`, () => {
          leftMap.getCanvas().style.cursor = '';
        });
      };

      const isEnsemble = !Array.isArray(forecastTrack) && (forecastTrack as any).rf;

      // Draw uncertainty cone first to place underneath lines
      let primaryPath: any[] = [];
      if (isEnsemble) {
        primaryPath = (forecastTrack as any).rf || [];
      } else if (Array.isArray(forecastTrack)) {
        primaryPath = forecastTrack;
      }

      if (primaryPath.length > 1) {
        const coneGeo = generateUncertaintyCone(primaryPath);
        if (coneGeo) {
          leftMap.addSource('fc-cone-src', {
            type: 'geojson',
            data: coneGeo
          });
          
          leftMap.addLayer({
            id: 'fc-cone-layer',
            type: 'fill',
            source: 'fc-cone-src',
            paint: {
              'fill-color': '#f97316',
              'fill-opacity': 0.12
            }
          });

          leftMap.addLayer({
            id: 'fc-cone-outline',
            type: 'line',
            source: 'fc-cone-src',
            paint: {
              'line-color': '#ea580c',
              'line-width': 1.5,
              'line-dasharray': [4, 4]
            }
          });
        }
      }

      if (isEnsemble) {
        // Draw the three paths in shades of orange / amber
        drawPath((forecastTrack as any).rf, 'fc-rf-src', 'fc-rf-layer', '#f97316'); // Standard Orange
        drawPath((forecastTrack as any).deep_learning, 'fc-dl-src', 'fc-dl-layer', '#ea580c'); // Deep Orange
        drawPath((forecastTrack as any).nwp, 'fc-nwp-src', 'fc-nwp-layer', '#f59e0b'); // Amber/Orange
      } else if (Array.isArray(forecastTrack)) {
        drawPath(forecastTrack, 'fc-rf-src', 'fc-rf-layer', '#f97316');
      }
    };

    if (leftMap.isStyleLoaded()) renderForecastPaths();
    else leftMap.once('load', renderForecastPaths);
  }, [leftMap, forecastTrack]);

  // 6. Draw Evacuation Corridors & shelters
  useEffect(() => {
    if (!leftMap) return;

    const renderEmergencyShelters = () => {
      if (!leftMap.isStyleLoaded()) return;

      if (leftMap.getLayer('shelter-layer')) leftMap.removeLayer('shelter-layer');
      if (leftMap.getSource('shelter-src')) leftMap.removeSource('shelter-src');

      if (!safeCorridorsPlotted) return;

      const shelterLocations = [
        { lat: 20.25, lon: 86.67, name: "Paradeep Resiliency Center" },
        { lat: 19.80, lon: 85.82, name: "Puri Beach Resiliency Complex" },
        { lat: 21.05, lon: 86.82, name: "Dhamra Port Resiliency Hub" }
      ];

      leftMap.addSource('shelter-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: shelterLocations.map(s => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
            properties: { name: s.name }
          }))
        }
      });

      leftMap.addLayer({
        id: 'shelter-layer',
        type: 'circle',
        source: 'shelter-src',
        paint: { 'circle-radius': 8, 'circle-color': '#10b981', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 }
      });
    };

    if (leftMap.isStyleLoaded()) renderEmergencyShelters();
    else leftMap.once('load', renderEmergencyShelters);
  }, [leftMap, safeCorridorsPlotted]);

  // 7. Click Drag Divider Swipe Calculations
  const handleMouseDown = () => {
    isDraggingSwipe.current = true;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSwipe.current || !swipeContainerRef.current) return;
      const rect = swipeContainerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      setSwipePercent(pct);
    };

    const handleMouseUp = () => {
      isDraggingSwipe.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [swipeActive]);

  // Geodesic distance calculator in TypeScript
  const calculateDistance = (pts: maplibregl.LngLat[]): number => {
    if (pts.length < 2) return 0;
    let dist = 0;
    const R = 6371; // Earth radius in km
    for (let i = 0; i < pts.length - 1; i++) {
      const lat1 = pts[i].lat * Math.PI / 180;
      const lat2 = pts[i + 1].lat * Math.PI / 180;
      const dLat = (pts[i+1].lat - pts[i].lat) * Math.PI / 180;
      const dLon = (pts[i+1].lng - pts[i].lng) * Math.PI / 180;
      
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      dist += R * c;
    }
    return dist;
  };

  // Coordinate Area polygon calculator
  const calculatePolygonArea = (pts: maplibregl.LngLat[]): number => {
    if (pts.length < 3) return 0;
    let totalArea = 0;
    const R = 6378137; // radius in meters
    
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const lat1 = p1.lat * Math.PI / 180;
      const lat2 = p2.lat * Math.PI / 180;
      const lon1 = p1.lng * Math.PI / 180;
      const lon2 = p2.lng * Math.PI / 180;
      
      totalArea += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Math.abs(totalArea * R * R / 2) / 1000000.0; // km²
  };

  // Map Click triggers for tool collections
  useEffect(() => {
    if (!leftMap) return;

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const lngLat = e.lngLat;

      if (drawingMode) {
        const newPoint = {
          lat: parseFloat(lngLat.lat.toFixed(4)),
          lon: parseFloat(lngLat.lng.toFixed(4)),
          wind_speed: 35.0,
          pressure: 1000.0,
          timestamp: new Date().toISOString()
        };
        setDrawnPoints([...drawnPoints, newPoint]);
      } else if (gisTool === 'measure') {
        setMeasurePoints(prev => {
          const updated = [...prev, lngLat];
          setCumulativeDistance(calculateDistance(updated));
          return updated;
        });
      } else if (gisTool === 'aoi') {
        setAoiPoints(prev => [...prev, lngLat]);
      }
    };

    leftMap.on('click', onMapClick);
    return () => {
      leftMap.off('click', onMapClick);
    };
  }, [leftMap, drawingMode, gisTool, drawnPoints]);

  return (
    <div ref={swipeContainerRef} className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      
      {/* Primary Map Instance */}
      <div ref={leftMapContainerRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Swipe comparative mapping element */}
      {swipeActive && (
        <div
          ref={rightMapContainerRef}
          className="absolute inset-0 w-full h-full z-20 border-l-2 border-indigo-500 shadow-2xl"
          style={{ clipPath: `polygon(${swipePercent}% 0, 100% 0, 100% 100%, ${swipePercent}% 100%)` }}
        />
      )}

      {/* Slide bar handle */}
      {swipeActive && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute top-0 bottom-0 z-30 w-1 bg-indigo-500 cursor-ew-resize flex items-center justify-center shadow-lg transition-transform hover:scale-x-150"
          style={{ left: `${swipePercent}%` }}
        >
          <div className="bg-indigo-600 border border-white/20 p-1.5 rounded-full text-white pointer-events-none select-none shadow-glow-blue flex items-center justify-center">
            <Split className="w-4 h-4 rotate-90" />
          </div>
        </div>
      )}

      {/* Particle Wind Velocity Layer Overlays */}
      <WindyVelocityLayer
        map={leftMap}
        activeCycloneCenter={cycloneTrack.length > 0 ? [cycloneTrack[cycloneTrack.length - 1].lat, cycloneTrack[cycloneTrack.length - 1].lon] : null}
        peakWindSpeed={cycloneTrack.length > 0 ? cycloneTrack[cycloneTrack.length - 1].wind_speed : 45}
        activeCyclonePressure={cycloneTrack.length > 0 ? cycloneTrack[cycloneTrack.length - 1].pressure : 1008}
        activeCycloneCategory={cycloneTrack.length > 0 ? cycloneTrack[cycloneTrack.length - 1].category : ''}
        gisLayers={gisLayers}
      />

      {/* 8. floating GIS Tool overlays */}
      <div className="absolute top-20 right-4 z-40 flex flex-col gap-2 pointer-events-auto">
        
        {/* Navigation & Camera Controls */}
        <div className="bg-slate-900/85 backdrop-blur border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1 text-slate-300">
          <span className="font-semibold text-slate-400 block text-[9.5px] uppercase tracking-widest px-1 text-center py-1">Camera HUD</span>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={handleZoomIn}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-indigo-400" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-indigo-400" />
            </button>
            <button
              onClick={handle3DTiltToggle}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-semibold col-span-2"
              title="Toggle 3D Globe Pitch"
            >
              <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
              3D Terrain Pitch
            </button>
            <button
              onClick={handleCompassReset}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-semibold col-span-2"
              title="Reset Compass True North"
            >
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              True North
            </button>
            <button
              onClick={handleCaptureScreenshot}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-semibold col-span-2"
              title="Take Map Screenshot"
            >
              <Camera className="w-3.5 h-3.5 text-indigo-400" />
              Capture Map Image
            </button>
            <button
              onClick={handleExportGeoJSON}
              className="p-2 rounded bg-slate-950/60 border border-white/5 hover:border-white/15 hover:text-white flex items-center justify-center gap-1.5 text-[10px] font-semibold col-span-2"
              title="Export Track GeoJSON"
            >
              <FileJson className="w-3.5 h-3.5 text-indigo-400" />
              Export GeoJSON
            </button>
          </div>
        </div>

        {/* Basemaps Toggle Drawer */}
        <div className="relative">
          <button
            onClick={() => { setShowBasemapMenu(!showBasemapMenu); }}
            className="bg-slate-900/85 backdrop-blur border border-white/10 hover:border-white/25 rounded-lg p-2.5 shadow-2xl text-slate-300 hover:text-slate-100 flex items-center gap-2 text-xs font-semibold"
          >
            <MapIcon className="w-4 h-4 text-indigo-400" />
            <span>Basemaps</span>
          </button>
          
          {showBasemapMenu && (
            <div className="absolute right-0 mt-1.5 w-60 bg-slate-950/95 backdrop-blur border border-white/10 rounded-xl p-3 shadow-2xl space-y-3 z-50 text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-400 block text-[9.5px] uppercase tracking-wider">Left Viewport</span>
                {Object.entries(BASEMAPS).map(([key, item]) => (
                  <button
                    key={key}
                    onClick={() => setLeftBasemap(key)}
                    className={`w-full text-left p-1.5 rounded transition-all ${leftBasemap === key ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              
              {swipeActive && (
                <div className="space-y-1.5 border-t border-white/5 pt-2.5">
                  <span className="font-semibold text-slate-400 block text-[9.5px] uppercase tracking-wider">Right Viewport</span>
                  {Object.entries(BASEMAPS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => setRightBasemap(key)}
                      className={`w-full text-left p-1.5 rounded transition-all ${rightBasemap === key ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* swipe Split Screen mode toggle */}
        <button
          onClick={() => setSwipeActive(!swipeActive)}
          className={`border p-2.5 rounded-lg shadow-2xl text-xs font-semibold flex items-center gap-2 transition-all ${
            swipeActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-glow-blue' : 'bg-slate-900/85 backdrop-blur border border-white/10 text-slate-300 hover:border-white/25 hover:text-slate-100'
          }`}
        >
          <Split className="w-4 h-4" />
          <span>Swipe Map</span>
        </button>

        {/* GIS Tool panel */}
        <div className="bg-slate-900/85 backdrop-blur border border-white/10 rounded-xl p-2 shadow-2xl flex flex-col gap-1">
          <span className="font-semibold text-slate-400 block text-[9.5px] uppercase tracking-widest px-1 text-center py-1">GIS Tools</span>
          
          <button
            onClick={() => { setGisTool(gisTool === 'measure' ? 'none' : 'measure'); setMeasurePoints([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-xs transition-colors ${gisTool === 'measure' ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <Ruler className="w-4 h-4" />
            <span>Measure Track</span>
          </button>
          
          <button
            onClick={() => { setGisTool(gisTool === 'aoi' ? 'none' : 'aoi'); setAoiPoints([]); }}
            className={`p-2 rounded-lg flex items-center gap-2 text-xs transition-colors ${gisTool === 'aoi' ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <Square className="w-4 h-4" />
            <span>Draw AOI Bound</span>
          </button>

          <button
            onClick={() => setShowBuffers(!showBuffers)}
            className={`p-2 rounded-lg flex items-center gap-2 text-xs transition-colors ${showBuffers ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Eyewall Radii</span>
          </button>

          {(gisTool !== 'none' || measurePoints.length > 0 || aoiPoints.length > 0) && (
            <button
              onClick={() => { setGisTool('none'); setMeasurePoints([]); setAoiPoints([]); }}
              className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 text-center font-bold text-[10px] mt-1 uppercase border border-red-500/10"
            >
              Reset Tools
            </button>
          )}
        </div>

        {/* Custom Track drawing simulation controls */}
        <div className="bg-slate-900/85 backdrop-blur border border-white/10 rounded-xl p-2.5 shadow-2xl space-y-2 text-xs">
          <span className="font-semibold text-slate-400 block text-[9.5px] uppercase tracking-widest text-center">Simulation</span>
          
          <button
            onClick={() => { setDrawingMode(!drawingMode); if(!drawingMode) { setDrawnPoints([]); setGisTool('none'); } }}
            className={`w-full p-2 rounded-lg flex items-center justify-center gap-1.5 transition-all text-xs font-semibold ${
              drawingMode ? 'bg-amber-600 border border-amber-500 text-white shadow-glow-orange' : 'bg-slate-950 border border-white/10 text-slate-300 hover:border-white/20'
            }`}
          >
            <PencilLine className="w-4 h-4" />
            {drawingMode ? "Drawing Path..." : "Custom Track"}
          </button>

          {drawnPoints.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-mono text-center">Nodes: {drawnPoints.length} points</div>
              <div className="flex gap-1">
                <button
                  onClick={onDrawComplete}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"
                >
                  <Play className="w-3 h-3" /> Execute
                </button>
                <button
                  onClick={() => { setDrawnPoints([]); setDrawingMode(false); }}
                  className="bg-red-950/40 border border-red-500/20 text-red-400 hover:bg-red-500/10 p-1.5 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Measure Tool statistics box */}
        {gisTool === 'measure' && measurePoints.length > 0 && (
          <div className="bg-slate-950/85 backdrop-blur border border-indigo-500/25 rounded-xl p-3 shadow-2xl text-xs space-y-1 max-w-[240px]">
            <div className="font-semibold text-indigo-400 uppercase tracking-widest text-[9px] flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />
              Cumulative Distance
            </div>
            <div className="font-mono text-slate-100 text-base font-bold">
              ~{cumulativeDistance.toFixed(1)} km
            </div>
            <div className="text-[9px] text-slate-400">
              Click consecutive points along storm front to measure track corridors.
            </div>
          </div>
        )}

        {/* AOI Tool Area bounds details */}
        {gisTool === 'aoi' && aoiPoints.length > 2 && (
          <div className="bg-slate-950/85 backdrop-blur border border-violet-500/25 rounded-xl p-3 shadow-2xl text-xs space-y-1 max-w-[240px]">
            <div className="font-semibold text-violet-400 uppercase tracking-widest text-[9px] flex items-center gap-1">
              <Square className="w-3.5 h-3.5" />
              Area of Interest (AOI)
            </div>
            <div className="font-mono text-slate-100 text-base font-bold">
              ~{calculatePolygonArea(aoiPoints).toFixed(0)} km²
            </div>
            <div className="text-[9px] text-slate-400">
              Polygon bounds selected representing affected regional coverage.
            </div>
          </div>
        )}
      </div>

      {/* Coordinate HUD Indicator (bottom-left) */}
      <div className="absolute bottom-4 left-4 z-[500] bg-slate-950/85 backdrop-blur border border-white/10 rounded-lg px-3 py-1.5 flex gap-3.5 text-[10px] font-mono text-slate-300 shadow-md">
        {coords ? (
          <>
            <span className="flex items-center gap-1 font-semibold">
              <Compass className="w-3 h-3 text-indigo-400" />
              LAT: {coords.lat.toFixed(4)}°N
            </span>
            <span>
              LON: {coords.lon.toFixed(4)}°E
            </span>
            <span className="text-slate-500 border-l border-white/10 pl-3">
              EPSG:4326 WGS84
            </span>
            <span className="text-indigo-400 border-l border-white/10 pl-3">
              ZOOM: {leftMap ? leftMap.getZoom().toFixed(1) : 5.0}
            </span>
          </>
        ) : (
          <span>Hover map to inspect WGS84 coordinates</span>
        )}
      </div>
    </div>
  );
};

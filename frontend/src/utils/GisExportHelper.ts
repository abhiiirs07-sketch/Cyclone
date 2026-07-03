/**
 * Utility functions for exporting operational WebGIS and damage metrics.
 */

// 1. Export Drawn coordinates or AOI Polygons to GeoJSON file
export const exportToGeoJSON = (points: { lat: number; lon: number; [key: string]: any }[] | any[], filename = 'geocyclone_geometry.geojson') => {
  if (points.length === 0) return;

  const isPolygon = points.length > 2 && !points[0].hasOwnProperty('wind_speed');
  
  let geojson: any;

  if (isPolygon) {
    // Area of Interest (AOI) polygon shape
    const coordinates = [...points.map(pt => [pt.lng ?? pt.lon, pt.lat]), [points[0].lng ?? points[0].lon, points[0].lat]];
    geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          },
          properties: {
            exporter: 'GeoCyclone India',
            timestamp: new Date().toISOString(),
            dataType: 'Area of Interest'
          }
        }
      ]
    };
  } else {
    // Cyclone Track line shape
    const lineCoordinates = points.map(pt => [pt.lon ?? pt.lng, pt.lat]);
    geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lineCoordinates
          },
          properties: {
            exporter: 'GeoCyclone India',
            timestamp: new Date().toISOString(),
            dataType: 'Cyclone Track Line'
          }
        },
        ...points.map((pt, idx) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pt.lon ?? pt.lng, pt.lat]
          },
          properties: {
            nodeIndex: idx,
            windSpeedKnots: pt.wind_speed,
            pressureHpa: pt.pressure,
            timestamp: pt.timestamp
          }
        }))
      ]
    };
  }

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 2. Export Damage summaries as tabular CSV structure
export const exportToCSV = (data: any, filename = 'damage_assessment.csv') => {
  if (!data || !data.district_details) return;

  const header = ['District Name', 'State', 'Distance (km)', 'Vulnerability Score', 'Risk Classification', 'Estimated Financial Loss (USD Millions)'];
  const rows = data.district_details.map((d: any) => [
    d.district_name,
    d.state,
    d.distance_km,
    d.vulnerability_score.toFixed(3),
    d.risk_class,
    d.economic_loss_usd_millions
  ]);

  const csvContent = [header, ...rows].map(e => e.map((val: any) => `"${val}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 3. Simulated GeoTIFF / DEM download
export const exportToGeoTIFF = (filename = 'elevation_raster.tiff') => {
  // Generates dummy 16-bit raster grid block reflecting coastal topography elevations
  const width = 100;
  const height = 100;
  const buffer = new ArrayBuffer(width * height * 2 + 100); // 16-bit pixels + header space
  const blob = new Blob([buffer], { type: 'image/tiff' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// 4. Trigger print wrapper for PDF dashboard summary
export const triggerPrintPDF = () => {
  window.print();
};

export const exportRawGeoJSON = (geojson: any, filename = 'export.geojson') => {
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Client-side fallback database for CYCLONE AI
// Ensures 100% production stability on static hosting platforms like Vercel.

export const FALLBACK_STORMS = [
  {
    id: 1,
    name: "Odisha Super Cyclone",
    year: 1999,
    month: 10,
    basin: "Bay of Bengal",
    peak_category: "Super Cyclone",
    max_wind_speed: 140.0,
    min_pressure: 912.0,
    deaths: 9887,
    damage_usd: 4400.0,
    duration_hours: 96.0,
    landfall_state: "Odisha",
    start_coords: [12.0, 92.5] as [number, number],
    landfall_coords: [20.25, 86.67] as [number, number]
  },
  {
    id: 2,
    name: "Phailin",
    year: 2013,
    month: 10,
    basin: "Bay of Bengal",
    peak_category: "Extremely Severe",
    max_wind_speed: 140.0,
    min_pressure: 940.0,
    deaths: 44,
    damage_usd: 696.0,
    duration_hours: 120.0,
    landfall_state: "Odisha",
    start_coords: [11.5, 93.0] as [number, number],
    landfall_coords: [19.31, 84.79] as [number, number]
  },
  {
    id: 3,
    name: "Hudhud",
    year: 2014,
    month: 10,
    basin: "Bay of Bengal",
    peak_category: "Extremely Severe",
    max_wind_speed: 115.0,
    min_pressure: 950.0,
    deaths: 124,
    damage_usd: 3400.0,
    duration_hours: 108.0,
    landfall_state: "Andhra Pradesh",
    start_coords: [11.0, 92.5] as [number, number],
    landfall_coords: [17.7, 83.3] as [number, number]
  },
  {
    id: 4,
    name: "Fani",
    year: 2019,
    month: 5,
    basin: "Bay of Bengal",
    peak_category: "Extremely Severe",
    max_wind_speed: 115.0,
    min_pressure: 937.0,
    deaths: 89,
    damage_usd: 8100.0,
    duration_hours: 144.0,
    landfall_state: "Odisha",
    start_coords: [5.0, 88.5] as [number, number],
    landfall_coords: [19.8, 85.8] as [number, number]
  },
  {
    id: 5,
    name: "Amphan",
    year: 2020,
    month: 5,
    basin: "Bay of Bengal",
    peak_category: "Super Cyclone",
    max_wind_speed: 130.0,
    min_pressure: 920.0,
    deaths: 128,
    damage_usd: 13000.0,
    duration_hours: 132.0,
    landfall_state: "West Bengal",
    start_coords: [11.0, 86.5] as [number, number],
    landfall_coords: [21.7, 88.3] as [number, number]
  },
  {
    id: 6,
    name: "Tauktae",
    year: 2021,
    month: 5,
    basin: "Arabian Sea",
    peak_category: "Extremely Severe",
    max_wind_speed: 100.0,
    min_pressure: 950.0,
    deaths: 174,
    damage_usd: 2100.0,
    duration_hours: 120.0,
    landfall_state: "Gujarat",
    start_coords: [10.0, 72.0] as [number, number],
    landfall_coords: [20.9, 71.1] as [number, number]
  },
  {
    id: 7,
    name: "Biparjoy",
    year: 2023,
    month: 6,
    basin: "Arabian Sea",
    peak_category: "Extremely Severe",
    max_wind_speed: 100.0,
    min_pressure: 950.0,
    deaths: 17,
    damage_usd: 150.0,
    duration_hours: 216.0,
    landfall_state: "Gujarat",
    start_coords: [12.0, 66.0] as [number, number],
    landfall_coords: [23.5, 68.6] as [number, number]
  },
  {
    id: 8,
    name: "Remal",
    year: 2024,
    month: 5,
    basin: "Bay of Bengal",
    peak_category: "Severe",
    max_wind_speed: 60.0,
    min_pressure: 978.0,
    deaths: 84,
    damage_usd: 600.0,
    duration_hours: 72.0,
    landfall_state: "West Bengal",
    start_coords: [15.0, 88.0] as [number, number],
    landfall_coords: [21.9, 89.2] as [number, number]
  }
];

function math_intensity(fraction: number): number {
  if (fraction <= 0.8) {
    return Math.sin((fraction / 0.8) * (Math.PI / 2.0));
  } else {
    const decay_frac = (fraction - 0.8) / 0.2;
    return 1.0 - (decay_frac * 0.4);
  }
}

export function generateFallbackTrack(id: number) {
  const storm = FALLBACK_STORMS.find(s => s.id === id) || FALLBACK_STORMS[3];
  const [start_lat, start_lon] = storm.start_coords;
  const [land_lat, land_lon] = storm.landfall_coords;
  const duration = storm.duration_hours || 72.0;
  const steps = Math.max(6, Math.floor(duration / 6));
  
  const track = [];
  const start_time = new Date(storm.year, storm.month - 1, 10, 0, 0);
  const peak_wind = storm.max_wind_speed;
  const peak_pressure = storm.min_pressure;
  
  for (let i = 0; i <= steps; i++) {
    const fraction = i / steps;
    const lat = start_lat + (land_lat - start_lat) * fraction + Math.sin(fraction * Math.PI * 2) * 0.12;
    const lon = start_lon + (land_lon - start_lon) * fraction + Math.sin(fraction * Math.PI * 2) * 0.12;
    
    const intensity = math_intensity(fraction);
    const wind = 15.0 + (peak_wind - 15.0) * intensity;
    const pressure = 1008.0 - (1008.0 - peak_pressure) * intensity;
    
    let cat = "Depression";
    if (wind >= 120.0) cat = "Super Cyclone";
    else if (wind >= 90.0) cat = "Extremely Severe";
    else if (wind >= 64.0) cat = "Very Severe";
    else if (wind >= 48.0) cat = "Severe";
    else if (wind >= 34.0) cat = "Cyclonic Storm";
    else if (wind >= 28.0) cat = "Deep Depression";
    
    const date = new Date(start_time.getTime() + i * 6 * 3600 * 1000);
    
    track.push({
      timestamp: date.toISOString(),
      lat: parseFloat(lat.toFixed(4)),
      lon: parseFloat(lon.toFixed(4)),
      pressure: parseFloat(pressure.toFixed(1)),
      wind_speed: parseFloat(wind.toFixed(1)),
      category: cat
    });
  }
  return track;
}

export function generateFallbackAssessment(id: number) {
  const storm = FALLBACK_STORMS.find(s => s.id === id) || FALLBACK_STORMS[3];
  
  const stateDistricts: { [key: string]: string[] } = {
    "Odisha": ["Jagatsinghpur", "Puri", "Ganjam", "Balasore", "Bhadrak", "Kendrapara"],
    "West Bengal": ["East Midnapore", "South 24 Parganas"],
    "Andhra Pradesh": ["Visakhapatnam", "Nellore", "Krishna"],
    "Tamil Nadu": ["Nagapattinam", "Cuddalore", "Chennai"],
    "Gujarat": ["Kutch", "Devbhumi Dwarka", "Gir Somnath"],
    "Maharashtra": ["Raigad", "Mumbai City"]
  };
  
  const affected = stateDistricts[storm.landfall_state] || ["Jagatsinghpur", "Puri"];
  const district_details = affected.map((dist, idx) => {
    const isCore = idx === 0;
    const distance_km = isCore ? 12.5 + Math.random() * 20 : 45.0 + Math.random() * 80;
    const vuln = 0.5 + Math.random() * 0.45;
    const risk = vuln > 0.8 ? "Critical" : vuln > 0.65 ? "High" : "Medium";
    const loss = storm.damage_usd * (isCore ? 0.35 : 0.12) * vuln;
    return {
      district_name: dist,
      state: storm.landfall_state,
      distance_km: parseFloat(distance_km.toFixed(1)),
      vulnerability_score: parseFloat(vuln.toFixed(3)),
      risk_class: risk,
      economic_loss_usd_millions: parseFloat(loss.toFixed(1))
    };
  });
  
  return {
    damage: {
      storm_name: storm.name,
      peak_category: storm.peak_category,
      landfall_state: storm.landfall_state,
      estimated_financial_loss_usd_m: storm.damage_usd,
      fatalities: storm.deaths,
      affected_population_millions: parseFloat((storm.deaths * 0.0012 + 0.5).toFixed(2)),
      infrastructure_damage_score: 82.5,
      district_details
    },
    geojson: {
      type: "FeatureCollection",
      features: district_details.map((d, i) => ({
        type: "Feature",
        id: i,
        properties: {
          name: d.district_name,
          state: d.state,
          risk: d.risk_class,
          loss: d.economic_loss_usd_millions
        },
        geometry: {
          type: "Polygon",
          coordinates: [[
            [storm.landfall_coords[1] + (i * 0.2) - 0.3, storm.landfall_coords[0] + (i * 0.1) - 0.3],
            [storm.landfall_coords[1] + (i * 0.2) + 0.3, storm.landfall_coords[0] + (i * 0.1) - 0.3],
            [storm.landfall_coords[1] + (i * 0.2) + 0.3, storm.landfall_coords[0] + (i * 0.1) + 0.3],
            [storm.landfall_coords[1] + (i * 0.2) - 0.3, storm.landfall_coords[0] + (i * 0.1) + 0.3],
            [storm.landfall_coords[1] + (i * 0.2) - 0.3, storm.landfall_coords[0] + (i * 0.1) - 0.3],
          ]]
        }
      }))
    }
  };
}

export function generateFallbackForecast(track: any[]) {
  if (track.length === 0) return [];
  const lastPt = track[track.length - 1];
  const steps = 8;
  const forecast = [];
  const start_time = new Date(lastPt.timestamp);
  
  for (let i = 1; i <= steps; i++) {
    const lat = lastPt.lat + i * 0.45;
    const lon = lastPt.lon - i * 0.25;
    const wind = Math.max(15.0, lastPt.wind_speed * Math.exp(-i * 0.12));
    const pressure = 1008.0 - (1008.0 - lastPt.pressure) * Math.exp(-i * 0.12);
    const date = new Date(start_time.getTime() + i * 6 * 3600 * 1000);
    
    let cat = "Depression";
    if (wind >= 120.0) cat = "Super Cyclone";
    else if (wind >= 90.0) cat = "Extremely Severe";
    else if (wind >= 64.0) cat = "Very Severe";
    else if (wind >= 48.0) cat = "Severe";
    else if (wind >= 34.0) cat = "Cyclonic Storm";
    else if (wind >= 28.0) cat = "Deep Depression";
    
    forecast.push({
      timestamp: date.toISOString(),
      lat: parseFloat(lat.toFixed(4)),
      lon: parseFloat(lon.toFixed(4)),
      pressure: parseFloat(pressure.toFixed(1)),
      wind_speed: parseFloat(wind.toFixed(1)),
      category: cat
    });
  }
  return forecast;
}

import os
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import shutil

from database import engine, get_db, init_db, CycloneMetadata, CycloneTrack, DistrictData, InfrastructureAsset
from seed_data import seed_database
from gis_processing import calculate_ahp_vulnerability, estimate_damage, generate_district_geojson
from forecasting import train_forecasting_models, predict_cyclone_forecast, predict_cyclone_ensemble
from report_generator import generate_cyclone_pdf

app = FastAPI(title="GeoCyclone India API", description="AI-Powered Cyclone Monitoring & Damage Assessment System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event: Initialize database, seed it, and train ML models
@app.on_event("startup")
def startup_event():
    print("Starting GeoCyclone Backend Server...")
    # Initialize DB tables
    init_db()
    
    # Seed database
    seed_database()
    
    # Train forecasting models using seeded tracks
    db = next(get_db())
    try:
        train_forecasting_models(db)
    finally:
        db.close()

# Pydantic Schemas for response and request validation
class TrackPointSchema(BaseModel):
    timestamp: str
    lat: float
    lon: float
    pressure: float
    wind_speed: float
    category: str
    is_forecast: bool
    confidence_radius: float

class CycloneMetadataSchema(BaseModel):
    id: int
    name: str
    year: int
    month: int
    basin: str
    peak_category: str
    max_wind_speed: float
    min_pressure: float
    deaths: int
    damage_usd: float
    duration_hours: float
    landfall_state: Optional[str]

    class Config:
        from_attributes = True

class CustomTrackInput(BaseModel):
    points: List[dict] # List of {"lat": float, "lon": float, "wind_speed": float, "pressure": float, "timestamp": str}
    month: int
    basin: str

# Endpoints
@app.get("/api/cyclones", response_model=List[CycloneMetadataSchema])
def get_cyclones(
    year: Optional[int] = None,
    month: Optional[int] = None,
    basin: Optional[str] = None,
    category: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CycloneMetadata)
    if year:
        query = query.filter(CycloneMetadata.year == year)
    if month:
        query = query.filter(CycloneMetadata.month == month)
    if basin:
        query = query.filter(CycloneMetadata.basin == basin)
    if category:
        query = query.filter(CycloneMetadata.peak_category.ilike(f"%{category}%"))
    if state:
        query = query.filter(CycloneMetadata.landfall_state.ilike(f"%{state}%"))
        
    return query.order_by(CycloneMetadata.year.desc(), CycloneMetadata.name).all()

@app.get("/api/cyclones/{cyclone_id}")
def get_cyclone_details(cyclone_id: int, db: Session = Depends(get_db)):
    cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
    if not cyclone:
        raise HTTPException(status_code=404, detail="Cyclone not found")
        
    # Sort track chronologically
    tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
    
    track_list = []
    for t in tracks:
        track_list.append({
            "timestamp": t.timestamp.isoformat() + "Z",
            "lat": t.lat,
            "lon": t.lon,
            "pressure": t.pressure,
            "wind_speed": t.wind_speed,
            "category": t.category,
            "is_forecast": t.is_forecast,
            "confidence_radius": t.confidence_radius
        })
        
    return {
        "metadata": {
            "id": cyclone.id,
            "name": cyclone.name,
            "year": cyclone.year,
            "month": cyclone.month,
            "basin": cyclone.basin,
            "peak_category": cyclone.peak_category,
            "max_wind_speed": cyclone.max_wind_speed,
            "min_pressure": cyclone.min_pressure,
            "deaths": cyclone.deaths,
            "damage_usd": cyclone.damage_usd,
            "duration_hours": cyclone.duration_hours,
            "landfall_state": cyclone.landfall_state
        },
        "track": track_list
    }

@app.get("/api/districts")
def get_districts(db: Session = Depends(get_db)):
    districts = db.query(DistrictData).all()
    return districts

@app.get("/api/infrastructure")
def get_infrastructure(db: Session = Depends(get_db)):
    assets = db.query(InfrastructureAsset).all()
    return assets

@app.post("/api/cyclones/{cyclone_id}/forecast")
def predict_forecast_track(cyclone_id: int, db: Session = Depends(get_db)):
    """
    Run ML prediction forward for a historical or active cyclone, returning ensemble projections
    """
    cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
    if not cyclone:
        raise HTTPException(status_code=404, detail="Cyclone not found")
        
    tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
    if len(tracks) < 2:
        raise HTTPException(status_code=400, detail="Insufficient track points to run prediction")
        
    recent_tracks = []
    for t in tracks:
        recent_tracks.append({
            "lat": t.lat,
            "lon": t.lon,
            "wind_speed": t.wind_speed,
            "pressure": t.pressure,
            "timestamp": t.timestamp
        })
        
    predictions = predict_cyclone_ensemble(recent_tracks, cyclone.month)
    return predictions

@app.post("/api/forecast/custom")
def predict_custom_track(input_data: CustomTrackInput, db: Session = Depends(get_db)):
    """
    Predicts trajectory ensemble forward for a custom drawn track,
    calculates vulnerability indices, exposure, and physical damage.
    """
    points = input_data.points
    if len(points) < 2:
        raise HTTPException(status_code=400, detail="Minimum 2 coordinates are required to compute forecast vector")
        
    # Get ensemble predictions
    predictions = predict_cyclone_ensemble(points, input_data.month)
    
    # Calculate GIS assessment for combined track using RF baseline
    all_points = points + predictions["rf"]
    track_coords = [(p["lat"], p["lon"]) for p in all_points]
    wind_speeds = [p["wind_speed"] for p in all_points]
    
    districts = db.query(DistrictData).all()
    assets = db.query(InfrastructureAsset).all()
    
    vuln_results = calculate_ahp_vulnerability(districts, track_coords, wind_speeds)
    dmg_results = estimate_damage(vuln_results, assets)
    
    return {
        "forecast": predictions,
        "vulnerability": vuln_results,
        "damage": dmg_results
    }

@app.get("/api/cyclones/{cyclone_id}/assessment")
def get_cyclone_damage_assessment(cyclone_id: int, db: Session = Depends(get_db)):
    """
    Combines track history with district profiles to run GIS buffering, AHP Weighted Overlay,
    and returns comprehensive vulnerability classifications and economic loss details.
    """
    cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
    if not cyclone:
        raise HTTPException(status_code=404, detail="Cyclone not found")
        
    tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
    track_coords = [(t.lat, t.lon) for t in tracks]
    wind_speeds = [t.wind_speed for t in tracks]
    
    districts = db.query(DistrictData).all()
    assets = db.query(InfrastructureAsset).all()
    
    vuln_results = calculate_ahp_vulnerability(districts, track_coords, wind_speeds)
    dmg_results = estimate_damage(vuln_results, assets)
    geojson = generate_district_geojson(vuln_results)
    
    return {
        "vulnerability": vuln_results,
        "damage": dmg_results,
        "geojson": geojson
    }

@app.get("/api/gis/analysis")
def perform_gis_analysis(
    cyclone_id: Optional[int] = None,
    buffer_distance_km: float = Query(100.0, ge=10.0, le=300.0),
    db: Session = Depends(get_db)
):
    """
    Perform multi-criteria GIS spatial overlay:
    Buffer generation, Intersect with district boundaries & infra nodes,
    NDVI/NDWI Index calculations, and Coastal Inundation Slope mapping.
    """
    if cyclone_id:
        cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
        if not cyclone:
            raise HTTPException(status_code=404, detail="Cyclone not found")
        tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
        track_coords = [(t.lat, t.lon) for t in tracks]
        peak_wind = max([t.wind_speed for t in tracks]) if tracks else 60.0
    else:
        # Default fallback coordinates (Bay of Bengal projection line)
        track_coords = [(15.0, 88.0), (18.0, 86.5), (20.2, 86.4)]
        peak_wind = 90.0

    districts = db.query(DistrictData).all()
    assets = db.query(InfrastructureAsset).all()

    # Dynamic spatial buffer intersection
    from gis_processing import track_distance_to_district, haversine_distance
    
    affected_districts = []
    total_exposed_population = 0
    total_exposed_buildings = 0
    
    # Coordinate centroids mapping (matching seed coords)
    centroids = {
        "Jagatsinghpur": (20.20, 86.40), "Puri": (19.80, 85.82), "Ganjam": (19.40, 84.80),
        "Balasore": (21.49, 86.93), "Bhadrak": (21.05, 86.50), "Kendrapara": (20.50, 86.55),
        "East Midnapore": (21.90, 87.75), "South 24 Parganas": (22.00, 88.60),
        "Visakhapatnam": (17.70, 83.20), "Nellore": (14.44, 79.98), "Krishna": (16.20, 81.10),
        "Nagapattinam": (10.76, 79.84), "Cuddalore": (11.75, 79.75), "Chennai": (13.08, 80.27),
        "Kutch": (23.25, 69.66), "Devbhumi Dwarka": (22.15, 69.20), "Gir Somnath": (20.90, 70.40),
        "Raigad": (18.50, 73.00), "Mumbai City": (18.96, 72.82)
    }
    
    for dist in districts:
        lat, lon = centroids.get(dist.name, (20.0, 80.0))
        dist_km = track_distance_to_district((lat, lon), track_coords)
        
        if dist_km <= buffer_distance_km:
            affected_districts.append(dist.name)
            total_exposed_population += dist.population
            total_exposed_buildings += dist.buildings_count

    # Intersect infrastructure assets
    exposed_infrastructure = []
    for asset in assets:
        min_d = float('inf')
        for i in range(len(track_coords) - 1):
            from gis_processing import point_to_segment_distance
            d = point_to_segment_distance(asset.lat, asset.lon, track_coords[i][0], track_coords[i][1], track_coords[i+1][0], track_coords[i+1][1])
            if d < min_d:
                min_d = d
                
        if min_d <= buffer_distance_km:
            exposed_infrastructure.append({
                "id": asset.id,
                "name": asset.name,
                "type": asset.type,
                "lat": asset.lat,
                "lon": asset.lon,
                "vulnerability": asset.vulnerability_score,
                "distance_km": round(min_d, 2)
            })

    # Raster simulator calculations
    lulc_dist = {
        "Agricultural": 58.4,
        "Water Body / Wetlands": 18.2,
        "Urban built-up": 11.5,
        "Forest Cover": 8.4,
        "Barren Sandy Land": 3.5
    }
    
    base_ndvi = 0.62
    base_ndwi = 0.08
    if peak_wind > 100:
        base_ndvi -= 0.15 # canopy damage
        base_ndwi += 0.22 # waterlogging
        
    return {
        "buffer_radius_km": buffer_distance_km,
        "exposed_summary": {
            "districts_count": len(affected_districts),
            "districts": affected_districts,
            "population": total_exposed_population,
            "buildings": total_exposed_buildings,
            "infrastructure_units": len(exposed_infrastructure)
        },
        "exposed_infrastructure": exposed_infrastructure[:15],
        "raster_indices": {
            "ndvi_mean": round(base_ndvi, 2),
            "ndwi_mean": round(base_ndwi, 2),
            "ndbi_mean": 0.06,
            "slope_degrees": 0.85,
            "aspect": "East-Southeast",
            "elevation_masl": 3.5
        },
        "land_cover": lulc_dist,
        "surge_simulation": {
            "peak_surge_height_m": round(0.02 * peak_wind + 1.2, 2),
            "inundation_depth_m": round(0.015 * peak_wind + 0.8, 2),
            "coastal_erosion_rate": "High",
            "evacuation_priority_zones": ["Zone A (0-5km coastal strip)", "Zone B (5-10km riverine buffers)"]
        }
    }

@app.get("/api/cyclones/{cyclone_id}/report")
def get_pdf_report(cyclone_id: int, db: Session = Depends(get_db)):
    """
    Compile and download the complete printable GIS report.
    """
    cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
    if not cyclone:
        raise HTTPException(status_code=404, detail="Cyclone not found")
        
    tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
    track_coords = [(t.lat, t.lon) for t in tracks]
    wind_speeds = [t.wind_speed for t in tracks]
    
    districts = db.query(DistrictData).all()
    assets = db.query(InfrastructureAsset).all()
    
    vuln_results = calculate_ahp_vulnerability(districts, track_coords, wind_speeds)
    dmg_results = estimate_damage(vuln_results, assets)
    
    # Map track points structure
    track_list = [{"lat": t.lat, "lon": t.lon, "wind_speed": t.wind_speed, "pressure": t.pressure} for t in tracks]
    
    # Compile metadata
    meta = {
        "year": cyclone.year,
        "peak_category": cyclone.peak_category,
        "max_wind_speed": cyclone.max_wind_speed,
        "min_pressure": cyclone.min_pressure,
        "duration_hours": cyclone.duration_hours,
        "basin": cyclone.basin,
        "landfall_state": cyclone.landfall_state
    }
    
    # Ensure temporary output folder
    os.makedirs("./temp_reports", exist_ok=True)
    pdf_filename = f"geocyclone_report_{cyclone.id}.pdf"
    pdf_path = f"./temp_reports/{pdf_filename}"
    
    generate_cyclone_pdf(cyclone.name, meta, track_list, dmg_results, pdf_path)
    
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{cyclone.name}_{cyclone.year}_Damage_Report.pdf"
    )

class ChatInput(BaseModel):
    message: str

@app.post("/api/assistant/chat")
def chat_assistant(input_data: ChatInput, db: Session = Depends(get_db)):
    """
    AI Assistant NLP query handler. Supports querying strongest storms,
    comparing tracks, forecasting landfall, and locating emergency shelters.
    """
    msg = input_data.message.lower()
    
    # 1. Handle "Strongest Cyclone" query
    if "strongest" in msg or "most intense" in msg:
        after_year = 1950
        if "after 1999" in msg:
            after_year = 1999
        elif "after 2010" in msg:
            after_year = 2010
            
        c = db.query(CycloneMetadata).filter(CycloneMetadata.year > after_year)\
              .order_by(CycloneMetadata.max_wind_speed.desc()).first()
              
        if c:
            return {
                "response": f"The strongest recorded cyclone in the study area after {after_year} is **{c.name} ({c.year})**.\n\n"
                            f"- **Peak Intensity**: {c.peak_category}\n"
                            f"- **Max Sustained Wind Speed**: {c.max_wind_speed} knots\n"
                            f"- **Minimum Central Pressure**: {c.min_pressure} hPa\n"
                            f"- **Reported Mortality**: {c.deaths:,} deaths\n"
                            f"- **Economic Loss**: ${c.damage_usd}M USD\n\n"
                            f"You can view its full historical track on the GIS map by searching '{c.name}' in the Archive panel."
            }
            
    # 2. Handle "Compare" query (e.g. Compare Amphan and Fani)
    if "compare" in msg:
        names = ["amphan", "fani", "hudhud", "phailin", "tauktae", "biparjoy", "remal", "odisha"]
        found = [n for n in names if n in msg]
        
        if len(found) >= 2:
            # Look up both in DB
            c1 = db.query(CycloneMetadata).filter(CycloneMetadata.name.ilike(found[0])).first()
            c2 = db.query(CycloneMetadata).filter(CycloneMetadata.name.ilike(found[1])).first()
            
            if c1 and c2:
                return {
                    "response": f"### Cyclone Comparative Report: **{c1.name}** vs **{c2.name}**\n\n"
                                f"| Metric | {c1.name} ({c1.year}) | {c2.name} ({c2.year}) |\n"
                                f"| :--- | :--- | :--- |\n"
                                f"| **Category** | {c1.peak_category.replace('Cyclonic Storm', 'CS')} | {c2.peak_category.replace('Cyclonic Storm', 'CS')} |\n"
                                f"| **Peak Wind** | {c1.max_wind_speed} knots | {c2.max_wind_speed} knots |\n"
                                f"| **Min Pressure** | {c1.min_pressure} hPa | {c2.min_pressure} hPa |\n"
                                f"| **Deaths** | {c1.deaths:,} | {c2.deaths:,} |\n"
                                f"| **Damage ($M)** | ${c1.damage_usd}M | ${c2.damage_usd}M |\n"
                                f"| **Landfall State** | {c1.landfall_state} | {c2.landfall_state} |\n\n"
                                f"Comparing tracks shows {c1.name} had a peak intensity of {c1.max_wind_speed} kt vs {c2.name}'s {c2.max_wind_speed} kt."
                }
                
    # 3. Handle "Landfall" or "Predict" query
    if "landfall" in msg or "predict" in msg or "forecast" in msg:
        # Check active cyclone
        c = db.query(CycloneMetadata).order_by(CycloneMetadata.id.desc()).first() # latest active
        if c:
            tracks = sorted(c.tracks, key=lambda t: t.timestamp)
            last_pt = tracks[-1]
            # Simple projected landfall state
            state = c.landfall_state or "Odisha coast"
            return {
                "response": f"### AI Forecast Projection: **{c.name}**\n\n"
                            f"- **Current Center**: {last_pt.lat}°N, {last_pt.lon}°E\n"
                            f"- **Maximum Wind Speed**: {last_pt.wind_speed} knots\n"
                            f"- **Projected Landfall Zone**: {state}\n"
                            f"- **ETA Landfall**: Next 24–36 hours\n"
                            f"- **Storm Surge Forecast**: 2.5m - 4.2m inundation waves\n\n"
                            f"To visualize the forecast uncertainty envelope and storm surge current vector fields, navigate to the **AI Forecast** panel and click **Execute Forecast**."
            }

    # 4. Handle "Evacuation" or "Shelter" query
    if "shelter" in msg or "evacuation" in msg or "hospital" in msg:
        return {
            "response": "### Emergency Response Support Unit\n\n"
                        "Based on critical asset indexing, the following secure shelters and response centers are designated for coastal evacuations:\n\n"
                        "1. **Paradeep Multipurpose Cyclone Shelter** (Jagatsinghpur, Odisha) - Capacity: 2,500 people.\n"
                        "2. **Puri Beach Shelter Complex** (Puri, Odisha) - Capacity: 1,800 people.\n"
                        "3. **Dhamra Port Resiliency Hub** (Bhadrak, Odisha) - Capacity: 4,000 people.\n"
                        "4. **NDRF Regional Response Center** (Bhubaneswar, Odisha) - Coordinates deployment of rescue vessels.\n\n"
                        "Evacuation corridors are active along national highway **NH-16**."
        }

    # Default fallback response
    return {
        "response": "Hello! I am the **GeoCyclone AI Decision Assistant**.\n\n"
                    "You can search the database using natural language. Try asking me:\n"
                    "- *'Show strongest cyclone after 1999'*\n"
                    "- *'Compare Amphan and Fani'*\n"
                    "- *'Predict landfall'*\n"
                    "- *'List evacuation shelters'*"
    }

@app.get("/api/weather/live")
def get_live_weather_grid(
    cyclone_id: Optional[int] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    wind_speed: Optional[float] = None,
    pressure: Optional[float] = None,
    category: Optional[str] = None,
    exclude_vortex: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Generate a 2D high-resolution meteorological flow field (velocity grid) over the Indian Ocean.
    Grid encompasses coordinates: Lat 0°N to 30°N, Lon 60°E to 100°E.
    Superimposes active cyclonic vortex spirals on top of background synoptic flows.
    """
    import math
    from gis_processing import haversine_distance

    # Higher resolution 1.0 degree grid step (total 31 * 41 = 1271 nodes)
    lat_range = list(range(0, 31, 1))
    lon_range = list(range(60, 101, 1))
    
    # Check if a cyclone eye center is active (prefer query params, fallback to DB metadata)
    eye_lat = lat
    eye_lon = lon
    peak_wind = wind_speed
    peak_pressure = pressure

    if eye_lat is None or eye_lon is None:
        if cyclone_id:
            cyclone = db.query(CycloneMetadata).filter(CycloneMetadata.id == cyclone_id).first()
            if cyclone and cyclone.tracks:
                # Use latest point
                tracks = sorted(cyclone.tracks, key=lambda t: t.timestamp)
                last_track = tracks[-1]
                eye_lat = last_track.lat
                eye_lon = last_track.lon
                if peak_wind is None:
                    peak_wind = last_track.wind_speed
                if peak_pressure is None:
                    peak_pressure = last_track.pressure

    if peak_wind is None:
        peak_wind = 30.0
    if peak_pressure is None:
        peak_pressure = 1008.0

    grid_points = []
    for lat_val in lat_range:
        for lon_val in lon_range:
            # 1. Multi-scale High-Fidelity Synoptic Flow Model
            # A. Latitudinal baseline: Southwesterly Monsoon vs. Easterly Trade winds
            # Smooth sigmoid transition between 5°N and 10°N
            weight_monsoon = 1.0 / (1.0 + math.exp(-(lat_val - 8.0) / 2.0))
            u_trade = -7.5 + math.sin(lon_val / 5.0) * 1.5
            v_trade = -1.0 + math.cos(lon_val / 6.0) * 1.0
            
            u_monsoon = 13.0 + math.sin(lat_val / 4.0) * 2.5
            v_monsoon = 9.0 + math.cos(lon_val / 5.0) * 2.0
            
            u_bg = u_trade * (1.0 - weight_monsoon) + u_monsoon * weight_monsoon
            v_bg = v_trade * (1.0 - weight_monsoon) + v_monsoon * weight_monsoon

            # B. Subtropical Arabian High-pressure ridge (clockwise circulation centered at 25°N, 45°E)
            dx_high = lon_val - 45.0
            dy_high = lat_val - 25.0
            dist_high = math.sqrt(dx_high**2 + dy_high**2)
            if dist_high > 0:
                high_u = (dy_high / dist_high) * 12.0 * math.exp(-dist_high / 22.0)
                high_v = (-dx_high / dist_high) * 12.0 * math.exp(-dist_high / 22.0)
                u_bg += high_u
                v_bg += high_v

            # C. Synoptic micro-eddies and shear turbulence
            u_bg += 2.0 * math.sin(lat_val / 2.0) * math.cos(lon_val / 3.0)
            v_bg += 1.8 * math.cos(lat_val / 3.0) * math.sin(lon_val / 2.0)

            rain_bg = max(0.0, 0.5 + math.sin(lon_val / 3.5) * 1.2 + math.cos(lat_val / 4.0) * 0.8)

            u, v, rain, surge_u, surge_v = u_bg, v_bg, rain_bg, u_bg * 0.02, v_bg * 0.02
            dist_eye = 9999.0

            # 2. Superimpose dynamic cyclonic vortex (Asymmetric Rankine swirl)
            if not exclude_vortex and eye_lat is not None and eye_lon is not None:
                dist_eye = haversine_distance(lat_val, lon_val, eye_lat, eye_lon)
                
                if dist_eye < 700.0:  # Active storm radius (700km)
                    theta = math.atan2(lat_val - eye_lat, lon_val - eye_lon)
                    
                    # 80% tangential swirl, 20% radial inflow (Northern Hemisphere counter-clockwise spiral)
                    su = -math.sin(theta) * 0.80 - math.cos(theta) * 0.20
                    sv = math.cos(theta) * 0.80 - math.sin(theta) * 0.20
                    
                    # Dynamic radius of max wind (Rmax shrinks as storm intensifies)
                    Rmax = max(35.0, 85.0 - 0.4 * peak_wind)
                    
                    # Rotational speed profile
                    if dist_eye <= Rmax:
                        spd = (dist_eye / Rmax) * peak_wind
                    else:
                        spd = peak_wind * math.pow(Rmax / dist_eye, 0.52)
                    
                    # Asymmetry: wind speed is stronger on the right side of direction of motion (typically North/East)
                    asymmetry = 1.0 + 0.15 * math.sin(theta - math.pi / 4.0)
                    spd *= asymmetry
                    
                    u_cyc = su * spd
                    v_cyc = sv * spd
                    
                    # Gaussian blending weight
                    weight = math.exp(-dist_eye / 200.0)
                    
                    u = u_bg * (1.0 - weight) + u_cyc * weight
                    v = v_bg * (1.0 - weight) + v_cyc * weight
                    
                    # Spiraling rain bands (sine wave of distance and theta)
                    spiral_bands = math.sin(dist_eye / 20.0 - theta * 3.0)
                    rain = rain_bg * (1.0 - weight) + (18.0 + 38.0 * weight * (spiral_bands + 1.0) / 2.0) * weight
                    
                    # Storm surge current (proportional to wind stress near storm core)
                    surge_u = u * 0.09 * weight
                    surge_v = v * 0.09 * weight

            # 3. Secondary Environmental Fields
            sst_val = 29.8 - 3.2 * math.exp(-dist_eye / 110.0) if dist_eye < 700.0 else 29.8 + 0.4 * math.sin(lat_val/8.0)
            local_wind_spd = math.sqrt(u*u + v*v)
            wave_val = 1.0 + 0.08 * local_wind_spd * math.exp(-dist_eye / 150.0) if dist_eye < 700.0 else 1.0 + 0.02 * local_wind_spd
            salinity_val = 33.6 - 2.5 * math.exp(-dist_eye / 80.0) if dist_eye < 700.0 else 33.6
            pressure_val = 1010.0 - (1010.0 - peak_pressure) * math.exp(-dist_eye / 130.0) if dist_eye < 700.0 else 1010.0 - 2.0 * math.sin(lat_val/5.0)
            humidity_val = 75.0 + 23.0 * math.exp(-dist_eye / 160.0) if dist_eye < 700.0 else 75.0 + 3.0 * math.sin(lon_val/6.0)
            visibility_val = 15.0 - 14.5 * math.exp(-dist_eye / 65.0) if dist_eye < 700.0 else 15.0

            grid_points.append({
                "lat": float(lat_val),
                "lon": float(lon_val),
                "u": float(u),
                "v": float(v),
                "rain": float(rain),
                "surge_u": float(surge_u),
                "surge_v": float(surge_v),
                "sst": float(sst_val),
                "wave": float(wave_val),
                "salinity": float(salinity_val),
                "pressure": float(pressure_val),
                "humidity": float(humidity_val),
                "visibility": float(visibility_val)
            })
            
    return {
        "lat_range": lat_range,
        "lon_range": lon_range,
        "grid": grid_points
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

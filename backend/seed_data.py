import random
from datetime import datetime, timedelta
from database import init_db, SessionLocal, CycloneMetadata, CycloneTrack, DistrictData, InfrastructureAsset

def seed_database():
    init_db()
    db = SessionLocal()
    
    # Check if database is already seeded
    if db.query(CycloneMetadata).count() > 0:
        print("Database already contains data. Skipping seeding.")
        db.close()
        return

    print("Seeding database...")
    
    # --- 1. SEED DISTRICT DATA ---
    # Coastal Indian districts with geographic and structural metrics
    districts = [
        # Odisha
        {"name": "Jagatsinghpur", "state": "Odisha", "population": 1136971, "area_sqkm": 1668.0, "road_density": 1.2, "coastal_exposure": 0.95, "agriculture_area_pct": 65.0, "buildings_count": 220000, "vulnerability_index": 0.85, "sensitivity": 0.82, "adaptive_capacity": 0.45, "exposure": 0.94, "social_vulnerability": 0.78, "infrastructure_vulnerability": 0.80},
        {"name": "Puri", "state": "Odisha", "population": 1698730, "area_sqkm": 3479.0, "road_density": 0.9, "coastal_exposure": 0.90, "agriculture_area_pct": 58.0, "buildings_count": 310000, "vulnerability_index": 0.78, "sensitivity": 0.75, "adaptive_capacity": 0.50, "exposure": 0.89, "social_vulnerability": 0.70, "infrastructure_vulnerability": 0.75},
        {"name": "Ganjam", "state": "Odisha", "population": 3529031, "area_sqkm": 8206.0, "road_density": 0.7, "coastal_exposure": 0.80, "agriculture_area_pct": 50.0, "buildings_count": 680000, "vulnerability_index": 0.72, "sensitivity": 0.70, "adaptive_capacity": 0.52, "exposure": 0.82, "social_vulnerability": 0.72, "infrastructure_vulnerability": 0.70},
        {"name": "Balasore", "state": "Odisha", "population": 2320529, "area_sqkm": 3806.0, "road_density": 1.1, "coastal_exposure": 0.88, "agriculture_area_pct": 72.0, "buildings_count": 450000, "vulnerability_index": 0.80, "sensitivity": 0.80, "adaptive_capacity": 0.48, "exposure": 0.88, "social_vulnerability": 0.74, "infrastructure_vulnerability": 0.78},
        {"name": "Bhadrak", "state": "Odisha", "population": 1506522, "area_sqkm": 2505.0, "road_density": 1.0, "coastal_exposure": 0.90, "agriculture_area_pct": 78.0, "buildings_count": 290000, "vulnerability_index": 0.82, "sensitivity": 0.81, "adaptive_capacity": 0.42, "exposure": 0.90, "social_vulnerability": 0.76, "infrastructure_vulnerability": 0.82},
        {"name": "Kendrapara", "state": "Odisha", "population": 1440361, "area_sqkm": 2644.0, "road_density": 0.9, "coastal_exposure": 0.98, "agriculture_area_pct": 70.0, "buildings_count": 280000, "vulnerability_index": 0.88, "sensitivity": 0.86, "adaptive_capacity": 0.38, "exposure": 0.97, "social_vulnerability": 0.82, "infrastructure_vulnerability": 0.85},
        
        # West Bengal
        {"name": "East Midnapore", "state": "West Bengal", "population": 5095875, "area_sqkm": 4736.0, "road_density": 1.5, "coastal_exposure": 0.85, "agriculture_area_pct": 68.0, "buildings_count": 980000, "vulnerability_index": 0.83, "sensitivity": 0.78, "adaptive_capacity": 0.55, "exposure": 0.86, "social_vulnerability": 0.70, "infrastructure_vulnerability": 0.76},
        {"name": "South 24 Parganas", "state": "West Bengal", "population": 8161961, "area_sqkm": 9960.0, "road_density": 0.8, "coastal_exposure": 0.99, "agriculture_area_pct": 45.0, "buildings_count": 1550000, "vulnerability_index": 0.92, "sensitivity": 0.90, "adaptive_capacity": 0.40, "exposure": 0.98, "social_vulnerability": 0.88, "infrastructure_vulnerability": 0.89},
        
        # Andhra Pradesh
        {"name": "Visakhapatnam", "state": "Andhra Pradesh", "population": 4290589, "area_sqkm": 11161.0, "road_density": 1.3, "coastal_exposure": 0.70, "agriculture_area_pct": 35.0, "buildings_count": 820000, "vulnerability_index": 0.55, "sensitivity": 0.50, "adaptive_capacity": 0.75, "exposure": 0.65, "social_vulnerability": 0.48, "infrastructure_vulnerability": 0.52},
        {"name": "Nellore", "state": "Andhra Pradesh", "population": 2963557, "area_sqkm": 13076.0, "road_density": 0.8, "coastal_exposure": 0.75, "agriculture_area_pct": 48.0, "buildings_count": 580000, "vulnerability_index": 0.65, "sensitivity": 0.62, "adaptive_capacity": 0.60, "exposure": 0.72, "social_vulnerability": 0.58, "infrastructure_vulnerability": 0.60},
        {"name": "Krishna", "state": "Andhra Pradesh", "population": 4517398, "area_sqkm": 8727.0, "road_density": 1.2, "coastal_exposure": 0.80, "agriculture_area_pct": 62.0, "buildings_count": 890000, "vulnerability_index": 0.70, "sensitivity": 0.68, "adaptive_capacity": 0.58, "exposure": 0.78, "social_vulnerability": 0.64, "infrastructure_vulnerability": 0.68},
        
        # Tamil Nadu
        {"name": "Nagapattinam", "state": "Tamil Nadu", "population": 1616450, "area_sqkm": 2715.0, "road_density": 1.4, "coastal_exposure": 0.92, "agriculture_area_pct": 55.0, "buildings_count": 340000, "vulnerability_index": 0.86, "sensitivity": 0.84, "adaptive_capacity": 0.40, "exposure": 0.92, "social_vulnerability": 0.78, "infrastructure_vulnerability": 0.82},
        {"name": "Cuddalore", "state": "Tamil Nadu", "population": 2605914, "area_sqkm": 3678.0, "road_density": 1.2, "coastal_exposure": 0.82, "agriculture_area_pct": 52.0, "buildings_count": 510000, "vulnerability_index": 0.75, "sensitivity": 0.72, "adaptive_capacity": 0.52, "exposure": 0.80, "social_vulnerability": 0.68, "infrastructure_vulnerability": 0.74},
        {"name": "Chennai", "state": "Tamil Nadu", "population": 4646732, "area_sqkm": 426.0, "road_density": 4.5, "coastal_exposure": 0.88, "agriculture_area_pct": 1.0, "buildings_count": 1100000, "vulnerability_index": 0.62, "sensitivity": 0.58, "adaptive_capacity": 0.85, "exposure": 0.85, "social_vulnerability": 0.45, "infrastructure_vulnerability": 0.50},
        
        # Gujarat
        {"name": "Kutch", "state": "Gujarat", "population": 2092739, "area_sqkm": 45674.0, "road_density": 0.3, "coastal_exposure": 0.75, "agriculture_area_pct": 30.0, "buildings_count": 410000, "vulnerability_index": 0.58, "sensitivity": 0.52, "adaptive_capacity": 0.62, "exposure": 0.70, "social_vulnerability": 0.55, "infrastructure_vulnerability": 0.58},
        {"name": "Devbhumi Dwarka", "state": "Gujarat", "population": 752484, "area_sqkm": 4051.0, "road_density": 0.6, "coastal_exposure": 0.85, "agriculture_area_pct": 45.0, "buildings_count": 140000, "vulnerability_index": 0.68, "sensitivity": 0.65, "adaptive_capacity": 0.55, "exposure": 0.82, "social_vulnerability": 0.62, "infrastructure_vulnerability": 0.64},
        {"name": "Gir Somnath", "state": "Gujarat", "population": 1217477, "area_sqkm": 3754.0, "road_density": 0.8, "coastal_exposure": 0.82, "agriculture_area_pct": 50.0, "buildings_count": 230000, "vulnerability_index": 0.70, "sensitivity": 0.68, "adaptive_capacity": 0.54, "exposure": 0.80, "social_vulnerability": 0.64, "infrastructure_vulnerability": 0.66},
        
        # Maharashtra
        {"name": "Raigad", "state": "Maharashtra", "population": 2634200, "area_sqkm": 7152.0, "road_density": 0.9, "coastal_exposure": 0.80, "agriculture_area_pct": 40.0, "buildings_count": 520000, "vulnerability_index": 0.66, "sensitivity": 0.62, "adaptive_capacity": 0.65, "exposure": 0.76, "social_vulnerability": 0.58, "infrastructure_vulnerability": 0.62},
        {"name": "Mumbai City", "state": "Maharashtra", "population": 3085411, "area_sqkm": 157.0, "road_density": 5.2, "coastal_exposure": 0.90, "agriculture_area_pct": 0.0, "buildings_count": 950000, "vulnerability_index": 0.60, "sensitivity": 0.55, "adaptive_capacity": 0.88, "exposure": 0.88, "social_vulnerability": 0.40, "infrastructure_vulnerability": 0.48}
    ]
    
    for dist in districts:
        db.add(DistrictData(**dist))
    db.commit()
    print(f"Seeded {len(districts)} districts.")

    # --- 2. SEED INFRASTRUCTURE ASSETS ---
    infra_types = ["Hospital", "School", "Power Grid", "Port", "Airport", "Water Supply", "Cyclone Shelter", "NDRF Base", "Evacuation Center"]
    coastal_coords = [
        # (Lat, Lon, District, NamePrefix)
        (20.25, 86.67, "Jagatsinghpur", "Paradeep"),
        (19.80, 85.82, "Puri", "Puri Beach"),
        (19.31, 84.79, "Ganjam", "Gopalpur"),
        (21.49, 86.93, "Balasore", "Chandipur"),
        (21.05, 86.82, "Bhadrak", "Dhamra"),
        (20.50, 86.75, "Kendrapara", "Bhitar Kanika"),
        (22.03, 88.06, "East Midnapore", "Haldia"),
        (21.68, 88.23, "South 24 Parganas", "Sagar Island"),
        (17.68, 83.21, "Visakhapatnam", "Vizag"),
        (14.44, 79.98, "Nellore", "Krishnapatnam"),
        (16.18, 81.13, "Krishna", "Machilipatnam"),
        (10.76, 79.84, "Nagapattinam", "Nagapattinam"),
        (11.75, 79.76, "Cuddalore", "Cuddalore"),
        (13.08, 80.27, "Chennai", "Chennai Central"),
        (22.84, 69.72, "Kutch", "Mundra"),
        (22.24, 68.96, "Devbhumi Dwarka", "Dwarka"),
        (20.90, 70.37, "Gir Somnath", "Veraval"),
        (18.96, 72.82, "Mumbai City", "Colaba"),
        (18.60, 72.87, "Raigad", "Alibag")
    ]
    
    infra_count = 0
    for lat, lon, dist_name, prefix in coastal_coords:
        for t in infra_types:
            # Shift slightly to create unique points
            offset_lat = lat + random.uniform(-0.08, 0.08)
            offset_lon = lon + random.uniform(-0.08, 0.08)
            db.add(InfrastructureAsset(
                name=f"{prefix} {t} Unit",
                type=t,
                lat=offset_lat,
                lon=offset_lon,
                vulnerability_score=round(random.uniform(0.3, 0.9), 2),
                district_name=dist_name
            ))
            infra_count += 1
            
    db.commit()
    print(f"Seeded {infra_count} infrastructure assets.")

    # --- 3. SEED CYCLONE METADATA AND TRACKS ---
    # Real historical cyclones & detailed track points
    historical_storms = [
        {
            "name": "Odisha Super Cyclone", "year": 1999, "month": 10, "basin": "Bay of Bengal",
            "peak_category": "Super Cyclone", "max_wind_speed": 140.0, "min_pressure": 912.0,
            "deaths": 9887, "damage_usd": 4400.0, "duration_hours": 96.0, "landfall_state": "Odisha",
            "start_coords": (12.0, 92.5), "landfall_coords": (20.25, 86.67), # Paradeep
            "path_type": "northwest"
        },
        {
            "name": "Phailin", "year": 2013, "month": 10, "basin": "Bay of Bengal",
            "peak_category": "Extremely Severe Cyclonic Storm", "max_wind_speed": 140.0, "min_pressure": 940.0,
            "deaths": 44, "damage_usd": 696.0, "duration_hours": 120.0, "landfall_state": "Odisha",
            "start_coords": (11.5, 93.0), "landfall_coords": (19.31, 84.79), # Gopalpur
            "path_type": "northwest"
        },
        {
            "name": "Hudhud", "year": 2014, "month": 10, "basin": "Bay of Bengal",
            "peak_category": "Extremely Severe Cyclonic Storm", "max_wind_speed": 115.0, "min_pressure": 950.0,
            "deaths": 124, "damage_usd": 3400.0, "duration_hours": 108.0, "landfall_state": "Andhra Pradesh",
            "start_coords": (11.0, 92.5), "landfall_coords": (17.7, 83.3), # Vizag
            "path_type": "northwest"
        },
        {
            "name": "Fani", "year": 2019, "month": 5, "basin": "Bay of Bengal",
            "peak_category": "Extremely Severe Cyclonic Storm", "max_wind_speed": 115.0, "min_pressure": 937.0,
            "deaths": 89, "damage_usd": 8100.0, "duration_hours": 144.0, "landfall_state": "Odisha",
            "start_coords": (5.0, 88.5), "landfall_coords": (19.8, 85.8), # Puri
            "path_type": "northwest"
        },
        {
            "name": "Amphan", "year": 2020, "month": 5, "basin": "Bay of Bengal",
            "peak_category": "Super Cyclone", "max_wind_speed": 130.0, "min_pressure": 920.0,
            "deaths": 128, "damage_usd": 13000.0, "duration_hours": 132.0, "landfall_state": "West Bengal",
            "start_coords": (11.0, 86.5), "landfall_coords": (21.7, 88.3), # Sagar Island
            "path_type": "north-northwest"
        },
        {
            "name": "Tauktae", "year": 2021, "month": 5, "basin": "Arabian Sea",
            "peak_category": "Extremely Severe Cyclonic Storm", "max_wind_speed": 100.0, "min_pressure": 950.0,
            "deaths": 174, "damage_usd": 2100.0, "duration_hours": 120.0, "landfall_state": "Gujarat",
            "start_coords": (10.0, 72.0), "landfall_coords": (20.9, 71.1), # Gir Somnath/Diu
            "path_type": "north-coast"
        },
        {
            "name": "Biparjoy", "year": 2023, "month": 6, "basin": "Arabian Sea",
            "peak_category": "Extremely Severe Cyclonic Storm", "max_wind_speed": 100.0, "min_pressure": 950.0,
            "deaths": 17, "damage_usd": 150.0, "duration_hours": 216.0, "landfall_state": "Gujarat",
            "start_coords": (12.0, 66.0), "landfall_coords": (23.5, 68.6), # Kutch / Jakhau Port
            "path_type": "north-slow"
        },
        {
            "name": "Remal", "year": 2024, "month": 5, "basin": "Bay of Bengal",
            "peak_category": "Severe Cyclonic Storm", "max_wind_speed": 60.0, "min_pressure": 978.0,
            "deaths": 84, "damage_usd": 600.0, "duration_hours": 72.0, "landfall_state": "West Bengal",
            "start_coords": (15.0, 88.0), "landfall_coords": (21.9, 89.2), # Sundarbans
            "path_type": "north"
        }
    ]
    
    for storm in historical_storms:
        meta = CycloneMetadata(
            name=storm["name"],
            year=storm["year"],
            month=storm["month"],
            basin=storm["basin"],
            peak_category=storm["peak_category"],
            max_wind_speed=storm["max_wind_speed"],
            min_pressure=storm["min_pressure"],
            deaths=storm["deaths"],
            damage_usd=storm["damage_usd"],
            duration_hours=storm["duration_hours"],
            landfall_state=storm["landfall_state"]
        )
        db.add(meta)
        db.flush() # Populate meta.id
        
        # Create track coordinates interpolation
        generate_track_points(db, meta.id, storm)

    # --- 4. GENERATE HISTORICAL BACKGROUND STORMS (1950 - 2026) ---
    # Create 35 simulated cyclones to give a robust database filterable across years and months
    basins = ["Bay of Bengal", "Arabian Sea"]
    categories = [
        ("Super Cyclone", 125.0, 140.0, 910.0, 930.0),
        ("Extremely Severe Cyclonic Storm", 90.0, 120.0, 930.0, 955.0),
        ("Very Severe Cyclonic Storm", 64.0, 89.0, 955.0, 970.0),
        ("Severe Cyclonic Storm", 48.0, 63.0, 970.0, 985.0),
        ("Cyclonic Storm", 34.0, 47.0, 985.0, 995.0),
        ("Deep Depression", 28.0, 33.0, 995.0, 1000.0),
        ("Depression", 17.0, 27.0, 1000.0, 1005.0)
    ]
    
    states_dict = {
        "Bay of Bengal": ["Odisha", "Andhra Pradesh", "West Bengal", "Tamil Nadu"],
        "Arabian Sea": ["Gujarat", "Maharashtra", "Karnataka", "Kerala"]
    }
    
    historical_names = [
        "Bhola", "BOB 01", "BOB 05", "Giri", "Jal", "Thane", "Helen", "Lehar", "Madi", "Nanauk", 
        "Nilofar", "Priya", "Ashobaa", "Komen", "Chapala", "Megh", "Roanu", "Kyant", "Nada", "Vardah",
        "Maarutha", "Mora", "Ockhi", "Sagar", "Mekunu", "Daye", "Luban", "Titli", "Gaja", "Pethai",
        "Vayu", "Hikaa", "Bulbul", "Pawan", "Nisarga", "Nivar", "Burevi", "Gulab", "Shaheen", "Jawad",
        "Asani", "Sitrang", "Mandous", "Mocha", "Hamoon", "Michaung", "Midhili", "Tej", "Akash"
    ]
    
    for i in range(40):
        year = random.randint(1950, 2025)
        month = random.choice([5, 6, 10, 11, 12]) # Cyclone seasons in North Indian Ocean
        basin = random.choice(basins)
        cat_info = random.choice(categories)
        name = random.choice(historical_names) + f"-{str(year)[2:]}"
        
        peak_cat, min_wind, max_wind, min_p, max_p = cat_info
        wind = round(random.uniform(min_wind, max_wind), 1)
        pressure = round(random.uniform(min_p, max_p), 1)
        deaths = random.randint(0, 150) if "Super" not in peak_cat else random.randint(200, 3000)
        damage = round(random.uniform(0.5, 300.0), 1) if "Super" not in peak_cat else round(random.uniform(500.0, 6000.0), 1)
        duration = round(random.uniform(36, 180), 1)
        land_state = random.choice(states_dict[basin])
        
        meta = CycloneMetadata(
            name=name,
            year=year,
            month=month,
            basin=basin,
            peak_category=peak_cat,
            max_wind_speed=wind,
            min_pressure=pressure,
            deaths=deaths,
            damage_usd=damage,
            duration_hours=duration,
            landfall_state=land_state
        )
        db.add(meta)
        db.flush()
        
        # Simple track generator
        start_lat = random.uniform(6.0, 13.0)
        start_lon = random.uniform(85.0, 93.0) if basin == "Bay of Bengal" else random.uniform(62.0, 71.0)
        
        if land_state == "Odisha":
            land_lat, land_lon = random.uniform(19.0, 21.0), random.uniform(85.0, 87.0)
        elif land_state == "Andhra Pradesh":
            land_lat, land_lon = random.uniform(14.0, 18.0), random.uniform(80.0, 83.5)
        elif land_state == "West Bengal":
            land_lat, land_lon = random.uniform(21.5, 22.2), random.uniform(87.5, 89.0)
        elif land_state == "Tamil Nadu":
            land_lat, land_lon = random.uniform(9.0, 13.5), random.uniform(79.0, 80.5)
        elif land_state == "Gujarat":
            land_lat, land_lon = random.uniform(20.5, 23.5), random.uniform(68.5, 72.5)
        elif land_state == "Maharashtra":
            land_lat, land_lon = random.uniform(16.0, 20.0), random.uniform(72.5, 73.0)
        else:
            land_lat, land_lon = start_lat + 5.0, start_lon + (5.0 if basin == "Bay of Bengal" else -5.0)
            
        storm_dict = {
            "start_coords": (start_lat, start_lon),
            "landfall_coords": (land_lat, land_lon),
            "duration_hours": duration,
            "max_wind_speed": wind,
            "min_pressure": pressure,
            "path_type": "standard"
        }
        generate_track_points(db, meta.id, storm_dict)

    db.commit()
    print("Database seeding completed successfully.")
    db.close()

def generate_track_points(db, cyclone_id, storm):
    start_lat, start_lon = storm["start_coords"]
    land_lat, land_lon = storm["landfall_coords"]
    duration = storm.get("duration_hours", 72.0)
    
    # Track points at 6-hour intervals
    steps = int(duration / 6)
    if steps < 4:
        steps = 6
        
    start_time = datetime(storm.get("year", 2020), storm.get("month", 5), random.randint(5, 25), 0, 0)
    
    categories = [
        "Depression", "Deep Depression", "Cyclonic Storm", "Severe Cyclonic Storm", 
        "Very Severe Cyclonic Storm", "Extremely Severe Cyclonic Storm", "Super Cyclone"
    ]
    
    peak_wind = storm.get("max_wind_speed", 100.0)
    peak_pressure = storm.get("min_pressure", 950.0)
    
    for i in range(steps + 1):
        fraction = i / steps
        # Linear + slight sinusoidal noise coordinate interpolation
        lat = start_lat + (land_lat - start_lat) * fraction + random.uniform(-0.15, 0.15) * math_wobble(fraction)
        lon = start_lon + (land_lon - start_lon) * fraction + random.uniform(-0.15, 0.15) * math_wobble(fraction)
        
        # Intensity curve: strengthens in the middle, peaks near landfall, decays after
        intensity_factor = math_intensity(fraction)
        current_wind = 15.0 + (peak_wind - 15.0) * intensity_factor
        current_pressure = 1008.0 - (1008.0 - peak_pressure) * intensity_factor
        
        # Determine category based on current wind speed (knots)
        cat = "Depression"
        if current_wind >= 120.0:
            cat = "Super Cyclone"
        elif current_wind >= 90.0:
            cat = "Extremely Severe Cyclonic Storm"
        elif current_wind >= 64.0:
            cat = "Very Severe Cyclonic Storm"
        elif current_wind >= 48.0:
            cat = "Severe Cyclonic Storm"
        elif current_wind >= 34.0:
            cat = "Cyclonic Storm"
        elif current_wind >= 28.0:
            cat = "Deep Depression"
            
        timestamp = start_time + timedelta(hours=i*6)
        
        db.add(CycloneTrack(
            cyclone_id=cyclone_id,
            timestamp=timestamp,
            lat=round(lat, 4),
            lon=round(lon, 4),
            pressure=round(current_pressure, 1),
            wind_speed=round(current_wind, 1),
            category=cat,
            is_forecast=False
        ))

def math_wobble(fraction):
    import math
    return math.sin(fraction * math.pi * 2.0)

def math_intensity(fraction):
    # Sine curve peaking around 0.8 fraction (just before landfall) then drops slightly
    import math
    if fraction <= 0.8:
        return math.sin(fraction / 0.8 * (math.pi / 2.0))
    else:
        # Landfall decay
        decay_frac = (fraction - 0.8) / 0.2
        return 1.0 - (decay_frac * 0.4) # drops to 60% intensity

if __name__ == "__main__":
    seed_database()

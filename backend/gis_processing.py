import math
import json
from database import DistrictData, InfrastructureAsset

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two lat/lon coordinates."""
    R = 6371.0 # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def point_to_segment_distance(lat, lon, start_lat, start_lon, end_lat, end_lon):
    """
    Find distance from a point to a line segment in km.
    Approximated by sampling 10 points along the segment for haversine accuracy.
    """
    min_dist = float('inf')
    for i in range(11):
        fraction = i / 10.0
        seg_lat = start_lat + (end_lat - start_lat) * fraction
        seg_lon = start_lon + (end_lon - start_lon) * fraction
        dist = haversine_distance(lat, lon, seg_lat, seg_lon)
        if dist < min_dist:
            min_dist = dist
    return min_dist

def track_distance_to_district(district_centroid, track_coords):
    """
    Find minimum distance from district centroid (lat, lon) to the track line.
    track_coords is a list of (lat, lon) tuples.
    """
    if not track_coords:
        return float('inf')
    if len(track_coords) == 1:
        return haversine_distance(district_centroid[0], district_centroid[1], track_coords[0][0], track_coords[0][1])
    
    min_dist = float('inf')
    for i in range(len(track_coords) - 1):
        start_pt = track_coords[i]
        end_pt = track_coords[i+1]
        dist = point_to_segment_distance(district_centroid[0], district_centroid[1], start_pt[0], start_pt[1], end_pt[0], end_pt[1])
        if dist < min_dist:
            min_dist = dist
    return min_dist

# Try importing geopandas and shapely. If failure, use fallback
SPATIAL_AVAILABLE = False
try:
    import geopandas as gpd
    from shapely.geometry import Point, LineString, Polygon
    SPATIAL_AVAILABLE = True
except ImportError:
    pass

def calculate_ahp_vulnerability(districts_data, track_coords, wind_speeds):
    """
    MCDA Weighted Overlay using Analytic Hierarchy Process (AHP) weights:
    - Distance to Track: 35% (Weight: 0.35)
    - Wind Intensity: 25% (Weight: 0.25)
    - Coastal Exposure: 20% (Weight: 0.20)
    - Population Density: 10% (Weight: 0.10)
    - Infrastructure/Road Density: 10% (Weight: 0.10)
    """
    results = []
    
    # Pre-calculate track points & peak wind speed
    peak_wind = max(wind_speeds) if wind_speeds else 30.0
    
    # We mock district centroids for distance calculations
    # Coordinates mapping for districts seeded
    centroids = {
        "Jagatsinghpur": (20.20, 86.40),
        "Puri": (19.80, 85.82),
        "Ganjam": (19.40, 84.80),
        "Balasore": (21.49, 86.93),
        "Bhadrak": (21.05, 86.50),
        "Kendrapara": (20.50, 86.55),
        "East Midnapore": (21.90, 87.75),
        "South 24 Parganas": (22.00, 88.60),
        "Visakhapatnam": (17.70, 83.20),
        "Nellore": (14.44, 79.98),
        "Krishna": (16.20, 81.10),
        "Nagapattinam": (10.76, 79.84),
        "Cuddalore": (11.75, 79.75),
        "Chennai": (13.08, 80.27),
        "Kutch": (23.25, 69.66),
        "Devbhumi Dwarka": (22.15, 69.20),
        "Gir Somnath": (20.90, 70.40),
        "Raigad": (18.50, 73.00),
        "Mumbai City": (18.96, 72.82)
    }
    
    for dist in districts_data:
        # 1. Distance factor (0 to 1 scaling, 0 at >=150km, 1 at 0km)
        lat, lon = centroids.get(dist.name, (20.0, 80.0))
        dist_to_track = track_distance_to_district((lat, lon), track_coords)
        
        distance_score = max(0.0, 1.0 - (dist_to_track / 150.0))
        
        # 2. Wind Speed factor (0 to 1 scaling based on peak wind speed relative to category)
        wind_score = min(1.0, peak_wind / 140.0) if distance_score > 0 else 0.0
        
        # 3. Coastal Exposure (from database seed, already 0 to 1)
        coastal_score = dist.coastal_exposure
        
        # 4. Population Density factor (scaled up to 1000 ppl/sqkm)
        pop_density = dist.population / dist.area_sqkm
        density_score = min(1.0, pop_density / 1000.0)
        
        # 5. Infrastructure score (road density scaled up to 3.0 km/sqkm)
        infra_score = min(1.0, dist.road_density / 3.0)
        
        # Weighted sum (AHP Weighted Overlay)
        v_idx = (
            (distance_score * 0.35) +
            (wind_score * 0.25) +
            (coastal_score * 0.20) +
            (density_score * 0.10) +
            (infra_score * 0.10)
        )
        
        # Classify risk
        if v_idx < 0.15:
            risk_class = "Very Low"
        elif v_idx < 0.35:
            risk_class = "Low"
        elif v_idx < 0.55:
            risk_class = "Moderate"
        elif v_idx < 0.75:
            risk_class = "High"
        elif v_idx < 0.90:
            risk_class = "Very High"
        else:
            risk_class = "Extreme"
            
        results.append({
            "district_name": dist.name,
            "state": dist.state,
            "distance_km": round(dist_to_track, 1),
            "vulnerability_score": round(v_idx, 3),
            "risk_class": risk_class,
            "population_exposed": dist.population if dist_to_track < 100 else int(dist.population * 0.3) if dist_to_track < 150 else 0,
            "sensitivity": getattr(dist, "sensitivity", 0.5),
            "adaptive_capacity": getattr(dist, "adaptive_capacity", 0.5),
            "exposure": getattr(dist, "exposure", 0.5),
            "social_vulnerability": getattr(dist, "social_vulnerability", 0.5),
            "infrastructure_vulnerability": getattr(dist, "infrastructure_vulnerability", 0.5)
        })
        
    return results

def estimate_damage(district_analysis, infrastructure_assets):
    """
    Compute estimated physical and economic losses based on MCDA vulnerability index.
    """
    total_economic_loss_usd = 0.0
    total_crop_loss_usd = 0.0
    total_infra_loss_usd = 0.0
    
    district_reports = []
    
    # Replacement costs & assets scales
    avg_building_cost_usd = 5000 # Average rural/semi-urban home value in USD
    avg_road_cost_per_km = 80000
    avg_powerline_cost_per_km = 45000
    avg_crop_val_per_ha = 1500
    
    # Map district list by name
    analysis_by_dist = {item["district_name"]: item for item in district_analysis}
    
    infra_exposed_count = 0
    infra_damaged_count = 0
    
    for dist_name, analysis in analysis_by_dist.items():
        v_score = analysis["vulnerability_score"]
        risk_class = analysis["risk_class"]
        dist_distance = analysis["distance_km"]
        
        if dist_distance > 150.0:
            continue
            
        # Get matching district data
        # Fetching values based on baseline data
        pop = analysis["population_exposed"]
        
        # Scaling damage ratios
        if risk_class == "Extreme":
            dmg_ratio = 0.85
            crop_ratio = 0.95
            road_dmg_ratio = 0.60
        elif risk_class == "Very High":
            dmg_ratio = 0.65
            crop_ratio = 0.80
            road_dmg_ratio = 0.40
        elif risk_class == "High":
            dmg_ratio = 0.40
            crop_ratio = 0.55
            road_dmg_ratio = 0.25
        elif risk_class == "Moderate":
            dmg_ratio = 0.20
            crop_ratio = 0.30
            road_dmg_ratio = 0.10
        elif risk_class == "Low":
            dmg_ratio = 0.08
            crop_ratio = 0.12
            road_dmg_ratio = 0.03
        else:
            dmg_ratio = 0.01
            crop_ratio = 0.02
            road_dmg_ratio = 0.0
            
        # Estimations
        est_buildings_damaged = int(pop * 0.22 * dmg_ratio) # 22% of population is estimate of household units
        building_loss = est_buildings_damaged * avg_building_cost_usd
        
        # Roads damaged (scaled by total district road length & damage ratio)
        est_roads_km = 300.0 * road_dmg_ratio # Assumed 300km total major local roads
        road_loss = est_roads_km * avg_road_cost_per_km
        
        # Crop damaged (assumed 80,000 hectares of crop land)
        est_crops_ha = 80000.0 * crop_ratio * (pop / 2000000.0) # scaled by population exposure
        crop_loss = est_crops_ha * avg_crop_val_per_ha
        
        # Infrastructure assets damage estimation
        dist_assets = [a for a in infrastructure_assets if a.district_name == dist_name]
        dist_infra_loss = 0.0
        
        for asset in dist_assets:
            infra_exposed_count += 1
            # Check if asset is close enough to be damaged
            # AHP vulnerability index increases the probability of asset damage
            asset_dmg_prob = asset.vulnerability_score * v_score
            if asset_dmg_prob > 0.3:
                infra_damaged_count += 1
                # Damage scale in USD
                asset_base_cost = 250000.0 if asset.type in ["Port", "Airport", "Power Grid"] else 80000.0
                dist_infra_loss += asset_base_cost * asset_dmg_prob
                
        dist_total_loss = building_loss + road_loss + crop_loss + dist_infra_loss
        
        total_economic_loss_usd += dist_total_loss
        total_crop_loss_usd += crop_loss
        total_infra_loss_usd += (road_loss + dist_infra_loss)
        
        district_reports.append({
            "district_name": dist_name,
            "state": analysis["state"],
            "risk_class": risk_class,
            "vulnerability_score": v_score,
            "buildings_damaged": est_buildings_damaged,
            "roads_damaged_km": round(est_roads_km, 1),
            "crops_damaged_ha": round(est_crops_ha, 1),
            "economic_loss_usd_millions": round(dist_total_loss / 1000000.0, 2)
        })
        
    return {
        "summary": {
            "total_economic_loss_usd_millions": round(total_economic_loss_usd / 1000000.0, 2),
            "crop_loss_usd_millions": round(total_crop_loss_usd / 1000000.0, 2),
            "infrastructure_loss_usd_millions": round(total_infra_loss_usd / 1000000.0, 2),
            "assets_exposed": infra_exposed_count,
            "assets_damaged": infra_damaged_count
        },
        "district_details": district_reports
    }

def generate_district_geojson(district_analysis):
    """
    Constructs a GeoJSON FeatureCollection of coastal districts,
    annotating each district with calculated risk metrics for Leaflet map displays.
    """
    # Simple coordinates mappings (districts border boxes / circles for rendering)
    centroids = {
        "Jagatsinghpur": (20.20, 86.40), "Puri": (19.80, 85.82), "Ganjam": (19.40, 84.80),
        "Balasore": (21.49, 86.93), "Bhadrak": (21.05, 86.50), "Kendrapara": (20.50, 86.55),
        "East Midnapore": (21.90, 87.75), "South 24 Parganas": (22.00, 88.60),
        "Visakhapatnam": (17.70, 83.20), "Nellore": (14.44, 79.98), "Krishna": (16.20, 81.10),
        "Nagapattinam": (10.76, 79.84), "Cuddalore": (11.75, 79.75), "Chennai": (13.08, 80.27),
        "Kutch": (23.25, 69.66), "Devbhumi Dwarka": (22.15, 69.20), "Gir Somnath": (20.90, 70.40),
        "Raigad": (18.50, 73.00), "Mumbai City": (18.96, 72.82)
    }
    
    features = []
    
    for analysis in district_analysis:
        name = analysis["district_name"]
        lat, lon = centroids.get(name, (20.0, 80.0))
        
        # Define a small hexagon around the centroid to show as the GIS district polygon
        hexagon_coords = []
        r = 0.25 # radius in degrees (~28km size)
        for d in range(0, 360, 60):
            rad = math.radians(d)
            hexagon_coords.append([lon + r * math.cos(rad), lat + r * math.sin(rad)])
        hexagon_coords.append(hexagon_coords[0]) # Close the loop
        
        feature = {
            "type": "Feature",
            "properties": {
                "name": name,
                "state": analysis["state"],
                "distance_km": analysis["distance_km"],
                "vulnerability": analysis["vulnerability_score"],
                "risk_class": analysis["risk_class"],
                "exposed_population": analysis["population_exposed"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [hexagon_coords]
            }
        }
        features.append(feature)
        
    return {
        "type": "FeatureCollection",
        "features": features
    }

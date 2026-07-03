import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = "sqlite:///./geocyclone.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CycloneMetadata(Base):
    __tablename__ = "cyclone_metadata"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    year = Column(Integer, index=True)
    month = Column(Integer)
    basin = Column(String) # Arabian Sea, Bay of Bengal, etc.
    peak_category = Column(String) # Super Cyclone, Extremely Severe, etc.
    max_wind_speed = Column(Float) # in knots
    min_pressure = Column(Float) # in hPa
    deaths = Column(Integer, default=0)
    damage_usd = Column(Float, default=0.0) # in millions
    duration_hours = Column(Float, default=0.0)
    landfall_state = Column(String, nullable=True)
    
    tracks = relationship("CycloneTrack", back_populates="cyclone", cascade="all, delete-orphan")

class CycloneTrack(Base):
    __tablename__ = "cyclone_tracks"
    
    id = Column(Integer, primary_key=True, index=True)
    cyclone_id = Column(Integer, ForeignKey("cyclone_metadata.id"))
    timestamp = Column(DateTime)
    lat = Column(Float)
    lon = Column(Float)
    pressure = Column(Float) # in hPa
    wind_speed = Column(Float) # in knots
    category = Column(String) # Cyclone classification at this step
    is_forecast = Column(Boolean, default=False)
    confidence_radius = Column(Float, default=0.0) # For forecast cone (km)
    
    cyclone = relationship("CycloneMetadata", back_populates="tracks")

class DistrictData(Base):
    __tablename__ = "district_data"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    state = Column(String, index=True)
    population = Column(Integer)
    area_sqkm = Column(Float)
    road_density = Column(Float) # km per sqkm
    coastal_exposure = Column(Float) # 0 to 1 scaling factor
    agriculture_area_pct = Column(Float) # percentage
    buildings_count = Column(Integer)
    vulnerability_index = Column(Float, default=0.0) # base index (0 to 1)
    sensitivity = Column(Float, default=0.0) # 0 to 1
    adaptive_capacity = Column(Float, default=0.0) # 0 to 1
    exposure = Column(Float, default=0.0) # 0 to 1
    social_vulnerability = Column(Float, default=0.0) # 0 to 1
    infrastructure_vulnerability = Column(Float, default=0.0) # 0 to 1

class InfrastructureAsset(Base):
    __tablename__ = "infrastructure_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    type = Column(String) # Hospital, School, Power Grid, Port, Airport, Water Supply
    lat = Column(Float)
    lon = Column(Float)
    vulnerability_score = Column(Float) # 0 to 1
    district_name = Column(String)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    Base.metadata.create_all(bind=engine)

import { useState, useEffect } from 'react';
import { MapContainer } from './components/MapContainer';
import { HistoricalExplorer } from './components/HistoricalExplorer';
import { AIForecastPanel } from './components/AIForecastPanel';
import { DamageAssessment } from './components/DamageAssessment';
import { EmergencyDecision } from './components/EmergencyDecision';
import { MapComparisonPanel } from './components/MapComparisonPanel';
import { LoginScreen } from './components/LoginScreen';
import { GisLayerManager, type GisLayer } from './components/GisLayerManager';
import { exportToCSV, exportToGeoJSON, exportToGeoTIFF, exportRawGeoJSON } from './utils/GisExportHelper';
import { AIAssistantChat } from './components/AIAssistantChat';
import { Shield, Cpu, Calendar, ShieldAlert, Layers } from 'lucide-react';

const API_BASE = window.location.origin.includes('localhost') ? "http://127.0.0.1:8000" : window.location.origin;

const INITIAL_GIS_LAYERS: GisLayer[] = [
  { id: 'wind', name: 'Wind Velocity Flow (WebGL)', visible: true, opacity: 0.85, category: 'met' },
  { id: 'pressure', name: 'Barometric Isobars (MSLP)', visible: false, opacity: 0.7, category: 'met' },
  { id: 'rain', name: 'Radar Rainfall Precipitation', visible: false, opacity: 0.75, category: 'met', legend: { colors: ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8'], labels: ['Light', 'Moderate', 'Heavy', 'Torrential'] } },
  { id: 'cloud', name: 'Cloud Cover Coverage', visible: false, opacity: 0.5, category: 'met' },
  { id: 'cape', name: 'Convective Instability (CAPE)', visible: false, opacity: 0.6, category: 'met' },
  { id: 'sst', name: 'Sea Surface Temperature (SST)', visible: false, opacity: 0.8, category: 'ocean', legend: { colors: ['#3b82f6', '#eab308', '#f97316', '#ef4444'], labels: ['24°C', '26°C', '28°C', '30°C+'] } },
  { id: 'wave', name: 'Significant Wave Height', visible: false, opacity: 0.7, category: 'ocean' },
  { id: 'surge', name: 'Storm Surge Inundation', visible: false, opacity: 0.85, category: 'ocean', legend: { colors: ['#c084fc', '#a855f7', '#7e22ce'], labels: ['0.5m', '1.5m', '3.0m+'] } },
  { id: 'insat_ir', name: 'INSAT IR (Cloud Top Temp)', visible: false, opacity: 0.8, category: 'sat' },
  { id: 'insat_vis', name: 'INSAT Visible Spectrum', visible: false, opacity: 0.75, category: 'sat' },
  { id: 'districts', name: 'District Administrative Boundaries', visible: true, opacity: 0.6, category: 'admin' },
  { id: 'rivers', name: 'River Channels & Watersheds', visible: true, opacity: 0.5, category: 'admin' },
  { id: 'shelters', name: 'Resiliency Shelters & Camps', visible: true, opacity: 0.9, category: 'admin' },
  { id: 'flood', name: 'Flood Susceptibility Zone', visible: false, opacity: 0.7, category: 'hazard', legend: { colors: ['#86efac', '#4ade80', '#22c55e'], labels: ['Low', 'Medium', 'High'] } },
  { id: 'wind_risk', name: 'Wind Inundation Susceptibility', visible: false, opacity: 0.65, category: 'hazard' }
];

function App() {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  // Load session from localStorage on startup
  useEffect(() => {
    const savedUser = localStorage.getItem('geocyclone_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (email: string, name: string) => {
    const userObj = { email, name };
    localStorage.setItem('geocyclone_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const handleLogout = () => {
    localStorage.removeItem('geocyclone_user');
    setUser(null);
  };

  const [activeTab, setActiveTab] = useState<'historical' | 'forecast' | 'layers' | 'damage' | 'emergency'>('historical');
  const [selectedCycloneId, setSelectedCycloneId] = useState<number | null>(null);
  const [activeCycloneName, setActiveCycloneName] = useState<string | null>(null);
  
  // Track and spatial states
  const [cycloneTrack, setCycloneTrack] = useState<any[]>([]);
  const [forecastTrack, setForecastTrack] = useState<any[]>([]);
  const [districtGeoJSON, setDistrictGeoJSON] = useState<any>(null);
  const [assessmentData, setAssessmentData] = useState<any>(null);
  
  // Compare slot states
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareCycloneId, setCompareCycloneId] = useState<number | null>(null);
  const [cycloneTrack2, setCycloneTrack2] = useState<any[]>([]);
  const [assessmentData2, setAssessmentData2] = useState<any>(null);
  const [cycloneA, setCycloneA] = useState<any>(null);
  const [cycloneB, setCycloneB] = useState<any>(null);
  
  // Custom draw states
  const [drawingMode, setDrawingMode] = useState<boolean>(false);
  const [drawnPoints, setDrawnPoints] = useState<any[]>([]);
  
  // GIS and responsive states
  const [gisLayers, setGisLayers] = useState<GisLayer[]>(INITIAL_GIS_LAYERS);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [loadingForecast, setLoadingForecast] = useState<boolean>(false);
  const [loadingAssessment, setLoadingAssessment] = useState<boolean>(false);
  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);
  const [safeCorridorsPlotted, setSafeCorridorsPlotted] = useState<boolean>(false);

  const [timelineIndex, setTimelineIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    let interval: any = null;
    if (isPlaying && cycloneTrack.length > 0) {
      interval = setInterval(() => {
        setTimelineIndex((prev) => {
          if (prev >= cycloneTrack.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, cycloneTrack]);

  // Fetch cyclone details (track) and run baseline assessment on selection
  const handleSelectCyclone = async (id: number) => {
    setDrawingMode(false);
    setDrawnPoints([]);
    
    if (compareMode) {
      if (selectedCycloneId === id) {
        setSelectedCycloneId(null);
        setCycloneTrack([]);
        setAssessmentData(null);
        setCycloneA(null);
      } else if (compareCycloneId === id) {
        setCompareCycloneId(null);
        setCycloneTrack2([]);
        setAssessmentData2(null);
        setCycloneB(null);
      } else if (!selectedCycloneId) {
        setSelectedCycloneId(id);
        fetchCycloneDataSlot(id, 1);
      } else {
        setCompareCycloneId(id);
        fetchCycloneDataSlot(id, 2);
      }
    } else {
      setSelectedCycloneId(id);
      setCompareCycloneId(null);
      setCycloneTrack2([]);
      setAssessmentData2(null);
      setCycloneB(null);
      fetchCycloneDataSlot(id, 1);
      
      // Auto switch tabs
      setActiveTab('damage');
    }
  };

  const fetchCycloneDataSlot = async (id: number, slot: 1 | 2) => {
    setLoadingAssessment(true);
    try {
      const trackRes = await fetch(`${API_BASE}/api/cyclones/${id}`);
      const trackData = await trackRes.json();
      
      const assessRes = await fetch(`${API_BASE}/api/cyclones/${id}/assessment`);
      const assessData = await assessRes.json();
      
      if (slot === 1) {
        setCycloneTrack(trackData.track);
        setTimelineIndex(trackData.track.length - 1);
        setIsPlaying(false);
        setActiveCycloneName(trackData.metadata.name);
        setAssessmentData(assessData.damage);
        setDistrictGeoJSON(assessData.geojson);
        setCycloneA(trackData.metadata);
      } else {
        setCycloneTrack2(trackData.track);
        setAssessmentData2(assessData.damage);
        setCycloneB(trackData.metadata);
      }
    } catch (err) {
      console.error("Error loading slot data:", err);
    } finally {
      setLoadingAssessment(false);
    }
  };

  // Run AI model prediction
  const handleTriggerForecast = async () => {
    if (!selectedCycloneId) return;
    setLoadingForecast(true);
    try {
      const res = await fetch(`${API_BASE}/api/cyclones/${selectedCycloneId}/forecast`, {
        method: 'POST'
      });
      const data = await res.json();
      setForecastTrack(data);
      
      // Navigate to forecast panel
      setActiveTab('forecast');
    } catch (err) {
      console.error("Error generating AI forecast:", err);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Forecast custom drawn track path
  const handleDrawComplete = async () => {
    if (drawnPoints.length < 2) return;
    
    setLoadingForecast(true);
    setLoadingAssessment(true);
    setSelectedCycloneId(null);
    setCycloneTrack([]); // Clear real tracks
    setActiveCycloneName("Simulated Path");
    
    try {
      const res = await fetch(`${API_BASE}/api/forecast/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: drawnPoints,
          month: new Date().getMonth() + 1,
          basin: drawnPoints[0].lon > 80 ? "Bay of Bengal" : "Arabian Sea"
        })
      });
      const data = await res.json();
      
      // Plot projections
      setForecastTrack(data.forecast);
      
      // Plot GIS layers
      setAssessmentData(data.damage);
      // Generate geojson shapes
      const geojsonRes = await fetch(`${API_BASE}/api/cyclones/1/assessment`); // standard template
      const geojsonData = await geojsonRes.json();
      // Apply risk scores calculated dynamically
      const customGeojson = { ...geojsonData.geojson };
      customGeojson.features = customGeojson.features.map((f: any) => {
        const match = data.vulnerability.find((v: any) => v.district_name === f.properties.name);
        if (match) {
          f.properties.risk_class = match.risk_class;
          f.properties.vulnerability = match.vulnerability_score;
          f.properties.distance_km = match.distance_km;
          f.properties.exposed_population = match.population_exposed;
        } else {
          f.properties.risk_class = "Very Low";
          f.properties.vulnerability = 0.0;
          f.properties.distance_km = 999.0;
        }
        return f;
      });
      
      setDistrictGeoJSON(customGeojson);
      setDrawingMode(false);
      
      setActiveTab('forecast');
    } catch (err) {
      console.error("Error processing custom simulation path:", err);
    } finally {
      setLoadingForecast(false);
      setLoadingAssessment(false);
    }
  };

  const handleClearCustom = () => {
    setDrawnPoints([]);
    setForecastTrack([]);
    setDistrictGeoJSON(null);
    setAssessmentData(null);
    setActiveCycloneName(null);
  };

  const handleExportLayer = (layerId: string) => {
    if (layerId === 'districts') {
      exportRawGeoJSON({ type: 'FeatureCollection', features: districtGeoJSON?.features || [] }, 'districts.geojson');
    } else if (layerId === 'surge' || layerId === 'flood') {
      exportToCSV(assessmentData, `${layerId}_risk_grids.csv`);
    } else {
      exportToGeoTIFF(`${layerId}_raster.tiff`);
    }
  };

  // Compile and download PDF summary
  const handleDownloadReport = async () => {
    if (!selectedCycloneId && activeCycloneName !== "Simulated Path") return;
    setDownloadingReport(true);
    try {
      // Use cyclone 1 as default container for custom drawn path reports
      const targetId = selectedCycloneId || 1;
      const response = await fetch(`${API_BASE}/api/cyclones/${targetId}/report`);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeCycloneName || 'Cyclone'}_Assessment_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err) {
      console.error("Error compiling PDF report:", err);
    } finally {
      setDownloadingReport(false);
    }
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cyber-dark text-slate-100 select-none">
      {/* 1. Main map container (full background screen) */}
      <div className="absolute inset-0 w-full h-full z-10">
        <MapContainer
          cycloneTrack={cycloneTrack.slice(0, timelineIndex + 1)}
          forecastTrack={forecastTrack}
          districtGeoJSON={districtGeoJSON}
          gisLayers={gisLayers}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          drawnPoints={drawnPoints}
          setDrawnPoints={setDrawnPoints}
          onDrawComplete={handleDrawComplete}
          safeCorridorsPlotted={safeCorridorsPlotted}
          compareTrack={cycloneTrack2}
          compareMode={compareMode}
        />
      </div>

      {/* 2. Floating Title Panel */}
      <div className="absolute top-4 left-4 z-40 bg-slate-950/85 backdrop-blur border border-white/10 rounded-lg px-4 py-3 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600/30 p-2 rounded border border-indigo-500/30">
            <Shield className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">GeoCyclone India</h1>
            <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-widest mt-0.5">Real-Time Risk Decision System</p>
          </div>
        </div>
      </div>

      {/* 2.5. Top-Right User profile HUD */}
      <div className="absolute top-4 right-4 z-40 bg-slate-950/85 backdrop-blur border border-white/10 rounded-lg px-3 py-2 flex items-center gap-3.5 shadow-2xl pointer-events-auto text-xs text-slate-300">
        <div className="flex flex-col items-end">
          <span className="font-semibold text-slate-100">{user.name}</span>
          <span className="text-[9px] text-indigo-300 font-mono">{user.email}</span>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-950/40 hover:bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1.5 rounded text-[10px] font-semibold transition-all"
        >
          Sign Out
        </button>
      </div>

      {/* 3. Floating Control Panels Sidebar (slide-out, left-aligned) - Desktop Only */}
      {!isMobile && (
        <div className="absolute top-24 left-4 bottom-16 z-40 w-96 flex flex-col pointer-events-auto transition-sidebar glass-panel rounded-xl shadow-2xl">
          {/* Horizontal Navigation Tabs */}
          <div className="grid grid-cols-5 border-b border-white/5 bg-slate-950/40 rounded-t-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('historical')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9.5px] font-semibold gap-0.5 transition-all ${
                activeTab === 'historical' ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 shadow-inner' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Archive
            </button>
            
            <button
              onClick={() => setActiveTab('forecast')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9.5px] font-semibold gap-0.5 transition-all ${
                activeTab === 'forecast' ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 shadow-inner' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Forecast
            </button>

            <button
              onClick={() => setActiveTab('layers')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9.5px] font-semibold gap-0.5 transition-all ${
                activeTab === 'layers' ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 shadow-inner' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Layers
            </button>
            
            <button
              onClick={() => setActiveTab('damage')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9.5px] font-semibold gap-0.5 transition-all ${
                activeTab === 'damage' ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/25 shadow-inner' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Impact
            </button>

            <button
              onClick={() => setActiveTab('emergency')}
              className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9.5px] font-semibold gap-0.5 transition-all ${
                activeTab === 'emergency' ? 'bg-red-500/20 text-red-400 border border-red-500/25 shadow-inner animate-pulse' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Dispatch
            </button>
          </div>

          {/* Dynamic sub-panels */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'historical' && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <HistoricalExplorer
                    onSelectCyclone={handleSelectCyclone}
                    selectedCycloneId={selectedCycloneId}
                    compareCycloneId={compareCycloneId}
                    compareMode={compareMode}
                    setCompareMode={setCompareMode}
                    API_BASE={API_BASE}
                  />
                </div>
                {compareMode && (
                  <div className="p-3 border-t border-white/5 bg-slate-950/40">
                    <MapComparisonPanel
                      cycloneA={cycloneA}
                      cycloneB={cycloneB}
                      assessmentA={assessmentData}
                      assessmentB={assessmentData2}
                    />
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'forecast' && (
              <AIForecastPanel
                forecastPoints={forecastTrack}
                onTriggerForecast={handleTriggerForecast}
                loadingForecast={loadingForecast}
                activeCycloneName={activeCycloneName}
                customMode={activeCycloneName === "Simulated Path"}
                onClearCustom={handleClearCustom}
              />
            )}

            {activeTab === 'layers' && (
              <GisLayerManager
                layers={gisLayers}
                onChange={setGisLayers}
                onExport={handleExportLayer}
              />
            )}
            
            {activeTab === 'damage' && (
              <DamageAssessment
                assessmentData={assessmentData}
                loading={loadingAssessment}
                onDownloadReport={handleDownloadReport}
                downloadingReport={downloadingReport}
              />
            )}

            {activeTab === 'emergency' && (
              <EmergencyDecision
                activeCycloneName={activeCycloneName}
                landfallState={assessmentData?.district_details?.[0]?.state || "Odisha"}
                onPlotSafeCorridors={() => setSafeCorridorsPlotted(!safeCorridorsPlotted)}
                safeCorridorsPlotted={safeCorridorsPlotted}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile Swipeable Bottom Sheet */}
      {isMobile && mobilePanelOpen && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-slate-950/95 backdrop-blur-lg border-t border-white/10 rounded-t-2xl max-h-[75vh] flex flex-col pointer-events-auto transition-transform duration-300">
          <div className="w-full flex justify-center py-3 cursor-pointer" onClick={() => setMobilePanelOpen(false)}>
            <div className="w-12 h-1 bg-white/20 rounded-full" />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-20">
            {activeTab === 'historical' && (
              <HistoricalExplorer
                onSelectCyclone={handleSelectCyclone}
                selectedCycloneId={selectedCycloneId}
                compareCycloneId={compareCycloneId}
                compareMode={compareMode}
                setCompareMode={setCompareMode}
                API_BASE={API_BASE}
              />
            )}
            {activeTab === 'forecast' && (
              <AIForecastPanel
                forecastPoints={forecastTrack}
                onTriggerForecast={handleTriggerForecast}
                loadingForecast={loadingForecast}
                activeCycloneName={activeCycloneName}
                customMode={activeCycloneName === "Simulated Path"}
                onClearCustom={handleClearCustom}
              />
            )}
            {activeTab === 'layers' && (
              <GisLayerManager
                layers={gisLayers}
                onChange={setGisLayers}
                onExport={handleExportLayer}
              />
            )}
            {activeTab === 'damage' && (
              <DamageAssessment
                assessmentData={assessmentData}
                loading={loadingAssessment}
                onDownloadReport={handleDownloadReport}
                downloadingReport={downloadingReport}
              />
            )}
            {activeTab === 'emergency' && (
              <EmergencyDecision
                activeCycloneName={activeCycloneName}
                landfallState={assessmentData?.district_details?.[0]?.state || "Odisha"}
                onPlotSafeCorridors={() => setSafeCorridorsPlotted(!safeCorridorsPlotted)}
                safeCorridorsPlotted={safeCorridorsPlotted}
              />
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Minimum Touch Target 48px) */}
      {isMobile && (
        <div className="absolute bottom-0 inset-x-0 z-40 bg-slate-950/90 backdrop-blur-md border-t border-white/10 h-16 grid grid-cols-5 pointer-events-auto items-center">
          {[
            { id: 'historical', label: 'Archive', icon: Calendar },
            { id: 'forecast', label: 'Forecast', icon: Cpu },
            { id: 'layers', label: 'Layers', icon: Layers },
            { id: 'damage', label: 'Damage', icon: ShieldAlert },
            { id: 'emergency', label: 'Response', icon: Shield }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setMobilePanelOpen(true);
                }}
                className={`flex flex-col items-center justify-center h-full gap-1 text-[9px] font-semibold transition-colors ${
                  activeTab === tab.id && mobilePanelOpen ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
                style={{ minHeight: '48px' }}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Floating Time Travel Player Toolbar - Desktop Only */}
      {!isMobile && cycloneTrack.length > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 w-[650px] glass-panel rounded-xl px-5 py-3 shadow-2xl flex items-center justify-between gap-4 pointer-events-auto border border-white/10">
          {/* Play/Pause Button */}
          <button
            onClick={() => {
              if (timelineIndex >= cycloneTrack.length - 1) {
                setTimelineIndex(0);
              }
              setIsPlaying(!isPlaying);
            }}
            className={`p-2 rounded-lg text-white font-semibold transition-all ${
              isPlaying ? 'bg-red-600/35 border border-red-500/30' : 'bg-indigo-600 hover:bg-indigo-500 shadow-glow-blue'
            }`}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            )}
          </button>

          {/* Timeline Slider */}
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              <span>Evolution Timeline</span>
              <span className="text-indigo-400">
                Step {timelineIndex + 1} of {cycloneTrack.length}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max={cycloneTrack.length - 1}
              value={timelineIndex}
              onChange={(e) => {
                setTimelineIndex(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono">
              <span>{new Date(cycloneTrack[0]?.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit'})}</span>
              <span>{new Date(cycloneTrack[cycloneTrack.length - 1]?.timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit'})}</span>
            </div>
          </div>

          {/* Live Phase Classification Display */}
          <div className="border-l border-white/10 pl-4 py-1 flex flex-col gap-0.5 justify-center min-w-[170px]">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Cyclone Phase</span>
            <span className={`text-xs font-bold leading-tight ${
              cycloneTrack[timelineIndex]?.category.includes('Super') ? 'text-red-400' :
              cycloneTrack[timelineIndex]?.category.includes('Extremely') ? 'text-orange-400' :
              cycloneTrack[timelineIndex]?.category.includes('Very Severe') ? 'text-amber-400' : 'text-sky-400'
            }`}>
              {cycloneTrack[timelineIndex]?.category.replace('Cyclonic Storm', 'CS')}
            </span>
            <div className="flex gap-2 text-[9px] text-slate-500 font-mono mt-0.5">
              <span>Wind: {cycloneTrack[timelineIndex]?.wind_speed.toFixed(0)} kt</span>
              <span>P: {cycloneTrack[timelineIndex]?.pressure.toFixed(0)} hPa</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Floating AI Assistant Chatbot Overlay - Desktop Only */}
      {!isMobile && <AIAssistantChat API_BASE={API_BASE} />}
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import { Shield, Home, AlertTriangle, Truck, PhoneCall, CheckSquare, Zap, Eye, Download, Info } from 'lucide-react';

interface EmergencyDecisionProps {
  activeCycloneName: string | null;
  landfallState: string | null;
  onPlotSafeCorridors: () => void;
  safeCorridorsPlotted: boolean;
  onDownloadReport?: () => void;
  downloadingReport?: boolean;
}

export const EmergencyDecision: React.FC<EmergencyDecisionProps> = ({
  activeCycloneName,
  landfallState,
  onPlotSafeCorridors,
  safeCorridorsPlotted,
  onDownloadReport,
  downloadingReport = false
}) => {
  const [subTab, setSubTab] = useState<'pre' | 'during' | 'post'>('pre');
  
  // Interactive checklist state
  const [checklist, setChecklist] = useState([
    { id: 1, text: "Verify Emergency Shelter power backup", checked: true },
    { id: 2, text: "Plot evacuation routing corridors on WGS84 map", checked: safeCorridorsPlotted },
    { id: 3, text: "Distribute satellite phones to NDRF battalion HQs", checked: false },
    { id: 4, text: "Coordinate Ham radio channels in coastal zones", checked: false },
    { id: 5, text: "Activate water purification units in evacuation camps", checked: false }
  ]);

  const toggleCheck = (id: number) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const shelters = [
    { name: "Paradeep Resiliency Center", location: "Jagatsinghpur", capacity: "2,500/3,000", status: "Active", type: "Multipurpose Shelter" },
    { name: "Puri Beach Resiliency Complex", location: "Puri", capacity: "1,800/2,000", status: "Active", type: "Multipurpose Shelter" },
    { name: "Dhamra Port Resiliency Hub", location: "Bhadrak", capacity: "3,800/4,000", status: "Full", type: "Port Shelter" },
    { name: "Konark Cyclone Safe House", location: "Puri", capacity: "450/1,000", status: "Active", type: "School Conversion" }
  ];

  const ndrfUnits = [
    { unit: "NDRF Battalion 03", HQ: "Bhubaneswar", deployed: "14 teams", status: "Deployed", area: "Kendrapara, Bhadrak" },
    { unit: "SDRF Coastal Unit", HQ: "Cuttack", deployed: "12 teams", status: "Deployed", area: "Puri, Jagatsinghpur" }
  ];

  const corridors = [
    { route: "NH-16 Expressway", status: "Open - Evacuation Active", flow: "Northbound priority" },
    { route: "SH-5 Coastal Highway", status: "Closed - Storm Surge Risk", flow: "No entry" }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-base">Emergency Management</h2>
        </div>
        <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
          Alert Active
        </span>
      </div>

      {/* Tri-stage Tabs */}
      <div className="grid grid-cols-3 border-b border-white/5 bg-slate-900/40 p-1 gap-1 text-[10px] font-bold uppercase tracking-wider">
        <button
          onClick={() => setSubTab('pre')}
          className={`py-1.5 rounded-lg text-center transition-all ${subTab === 'pre' ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Pre-Disaster
        </button>
        <button
          onClick={() => setSubTab('during')}
          className={`py-1.5 rounded-lg text-center transition-all ${subTab === 'during' ? 'bg-amber-600/25 text-amber-300 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          During
        </button>
        <button
          onClick={() => setSubTab('post')}
          className={`py-1.5 rounded-lg text-center transition-all ${subTab === 'post' ? 'bg-teal-600/25 text-teal-300 border border-teal-500/20' : 'text-slate-400 hover:text-slate-200'}`}
        >
          Post-Disaster
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* PRE-DISASTER TAB */}
        {subTab === 'pre' && (
          <div className="space-y-4">
            {/* Checklist */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3.5 space-y-2.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                Preparedness Checklist
              </h3>
              <div className="space-y-2 text-xs">
                {checklist.map(item => (
                  <label key={item.id} className="flex items-start gap-2.5 cursor-pointer select-none text-slate-300 hover:text-slate-200">
                    <input
                      type="checkbox"
                      checked={item.id === 2 ? safeCorridorsPlotted : item.checked}
                      onChange={() => toggleCheck(item.id)}
                      className="mt-0.5 rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span className={item.checked ? "line-through text-slate-500" : ""}>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Evacuation plotting trigger */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3.5 space-y-2">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Routing & Shelters Plotter</h3>
              <button
                onClick={onPlotSafeCorridors}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  safeCorridorsPlotted 
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/25' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow-blue'
                }`}
              >
                {safeCorridorsPlotted ? "Evacuation Vectors Visualized" : "Plot Evacuation Channels"}
              </button>
            </div>

            {/* Shelters list */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-4 h-4 text-indigo-400" />
                Emergency Resiliency Shelters
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {shelters.map((s, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2 flex items-center justify-between text-[11px]">
                    <div>
                      <div className="font-semibold text-slate-200">{s.name}</div>
                      <div className="text-[9px] text-slate-400">{s.location} • {s.type}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${s.status === 'Full' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {s.status} ({s.capacity.split('/')[0]})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DURING-DISASTER TAB */}
        {subTab === 'during' && (
          <div className="space-y-4">
            {/* Live alerts banner */}
            <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 animate-pulse" />
                Live Inundation Alerts
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Extremely high storm surge inundation (2.5m - 4.2m) reported in coastal areas. Outer rainbands causing heavy precipitation (&gt;35mm/hr).
              </p>
            </div>

            {/* Power grid outages */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3.5 space-y-2.5">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Utility Grid Status
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/40 p-2 rounded border border-white/5 space-y-0.5">
                  <div className="text-[9px] text-slate-500 uppercase">Power Lines Outages</div>
                  <div className="font-bold text-amber-400 text-sm">84.5% Offline</div>
                </div>
                <div className="bg-slate-950/40 p-2 rounded border border-white/5 space-y-0.5">
                  <div className="text-[9px] text-slate-500 uppercase">Telecom Cells</div>
                  <div className="font-bold text-red-400 text-sm">62.0% Offline</div>
                </div>
              </div>
            </div>

            {/* Road conditions */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Coastal Corridors</h3>
              <div className="space-y-1.5">
                {corridors.map((c, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2 flex items-center justify-between text-[11px]">
                    <div>
                      <div className="font-semibold text-slate-200">{c.route}</div>
                      <div className="text-[9px] text-slate-400">{c.flow}</div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${c.status.includes('Closed') ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {c.status.split(' - ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* NDRF Dispatches */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-indigo-400" />
                NDRF Active Battalions
              </h3>
              <div className="space-y-1.5">
                {ndrfUnits.map((n, idx) => (
                  <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{n.unit}</span>
                      <span className="bg-indigo-500/10 text-indigo-300 text-[8px] px-1 py-0.5 rounded border border-indigo-500/20 uppercase font-bold">{n.deployed}</span>
                    </div>
                    <div className="text-[9px] text-slate-400">Deployed sectors: {n.area}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* POST-DISASTER TAB */}
        {subTab === 'post' && (
          <div className="space-y-4">
            {/* Swipe prompt */}
            <div className="bg-indigo-950/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-indigo-300 leading-relaxed">
              <Eye className="w-4 h-4 shrink-0 mt-0.5 text-indigo-400" />
              <span>Use the <b>Swipe Map</b> control to overlay pre-disaster true color satellite maps with post-disaster flooding and vegetation loss raster indices.</span>
            </div>

            {/* Change detection metrics */}
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3.5 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                Sentinel-2 Change Detection
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/40 p-2 rounded border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase">Flooded Areas</div>
                  <div className="font-bold text-slate-200 text-sm mt-0.5">850 sqkm</div>
                </div>
                <div className="bg-slate-950/40 p-2 rounded border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase">Canopy Defoliation</div>
                  <div className="font-bold text-slate-200 text-sm mt-0.5">14.8% NDVI Loss</div>
                </div>
                <div className="bg-slate-950/40 p-2 rounded border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase">Buildings Damaged</div>
                  <div className="font-bold text-slate-200 text-sm mt-0.5">~12,400 structures</div>
                </div>
                <div className="bg-slate-950/40 p-2 rounded border border-white/5">
                  <div className="text-[9px] text-slate-500 uppercase">Road Corridors Blocked</div>
                  <div className="font-bold text-slate-200 text-sm mt-0.5">120 km</div>
                </div>
              </div>
            </div>

            {/* Damage report download */}
            {onDownloadReport && (
              <div className="bg-slate-900/50 border border-white/10 rounded-xl p-3.5 space-y-2">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compile Damage Summary</h3>
                <button
                  onClick={onDownloadReport}
                  disabled={downloadingReport}
                  className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-teal-800/40 text-white rounded-lg py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-glow-blue"
                >
                  {downloadingReport ? (
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white animate-spin rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {downloadingReport ? "Compiling PDF..." : "Download Damage Report PDF"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Emergency contacts card */}
        <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 text-xs space-y-2">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <PhoneCall className="w-4 h-4 text-indigo-400" />
            National Resiliency Helplines
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-500 font-mono">
            <div>NDMA Line: 011-26701728</div>
            <div>Toll-Free Rescue: 1078</div>
          </div>
        </div>
      </div>
    </div>
  );
};

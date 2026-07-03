import React from 'react';
import { Shield, MapPin, Truck, AlertTriangle, CheckCircle, Navigation, ShieldCheck, Home, PhoneCall } from 'lucide-react';

interface EmergencyDecisionProps {
  activeCycloneName: string | null;
  landfallState: string | null;
  onPlotSafeCorridors: () => void;
  safeCorridorsPlotted: boolean;
}

export const EmergencyDecision: React.FC<EmergencyDecisionProps> = ({
  activeCycloneName,
  landfallState,
  onPlotSafeCorridors,
  safeCorridorsPlotted
}) => {
  const shelters = [
    { name: "Paradeep Resiliency Center", location: "Jagatsinghpur", capacity: "2,500/3,000", status: "Active", type: "Multipurpose Shelter" },
    { name: "Puri Beach Resiliency Complex", location: "Puri", capacity: "1,800/2,000", status: "Active", type: "Multipurpose Shelter" },
    { name: "Dhamra Port Resiliency Hub", location: "Bhadrak", capacity: "3,800/4,000", status: "Full", type: "Port Shelter" },
    { name: "Konark Cyclone Safe House", location: "Puri", capacity: "450/1,000", status: "Active", type: "School Conversion" },
    { name: "Chandipur Emergency Shelter", location: "Balasore", capacity: "120/1,500", status: "Standby", type: "Community Hall" }
  ];

  const ndrfUnits = [
    { unit: "NDRF Battalion 03", HQ: "Bhubaneswar", deployed: "14 teams", status: "Deployed", area: "Kendrapara, Bhadrak" },
    { unit: "NDRF Battalion 10", HQ: "Vijayawada", deployed: "8 teams", status: "Standby", area: "Visakhapatnam, Nellore" },
    { unit: "SDRF Coastal Unit", HQ: "Cuttack", deployed: "12 teams", status: "Deployed", area: "Puri, Jagatsinghpur" }
  ];

  const corridors = [
    { route: "NH-16 Expressway", status: "Open - Evacuation Active", flow: "Northbound priority" },
    { route: "SH-5 Coastal Highway", status: "Closed - High Inundation Risk", flow: "No entry" },
    { route: "Puri-Bhubaneswar Bypass", status: "Open - Clear", flow: "Standard bidirectional" }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-base">Emergency Decision Support</h2>
        </div>
        <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase animate-pulse">
          Alert Active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Action button */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Evacuation Dispatch</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure safe routing vectors and highlight designated Multipurpose Cyclone Shelters (MCS) relative to the projected storm landfall zone ({landfallState || "Coastal Area"}).
          </p>
          <button
            onClick={onPlotSafeCorridors}
            className={`w-full py-2.5 rounded-lg text-xs font-semibold transition-all shadow-glow-blue flex items-center justify-center gap-1.5 ${
              safeCorridorsPlotted 
                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-glow-blue'
            }`}
          >
            {safeCorridorsPlotted ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Evacuation Corridors Rendered
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4" />
                Plot Safe Corridors & Shelters
              </>
            )}
          </button>
        </div>

        {/* Shelters list */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Home className="w-4 h-4 text-indigo-400" />
            Cyclone Shelter Status
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {shelters.map((s, idx) => (
              <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-white/10 transition-colors">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200">{s.name}</div>
                  <div className="text-[9px] text-slate-400">{s.location} • {s.type}</div>
                </div>
                <div className="text-right space-y-1">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    s.status === 'Full' ? 'bg-red-500/20 text-red-300' :
                    s.status === 'Active' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-slate-500/20 text-slate-400'
                  }`}>
                    {s.status}
                  </span>
                  <div className="text-[9.5px] font-mono text-slate-400">Cap: {s.capacity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* NDRF Deployment */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-indigo-400" />
            National Disaster Response Force (NDRF)
          </h3>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {ndrfUnits.map((n, idx) => (
              <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 flex flex-col gap-1.5 text-xs hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">{n.unit}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    n.status === 'Deployed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {n.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 text-[10px] text-slate-400 gap-1 border-t border-white/5 pt-1.5">
                  <span>HQ: {n.HQ}</span>
                  <span>Strength: {n.deployed}</span>
                  <span className="col-span-2">Sector: {n.area}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evacuation Corridors & Road Closures */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-indigo-400" />
            Coastal Road Conditions
          </h3>
          <div className="space-y-1.5">
            {corridors.map((c, idx) => (
              <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-200">{c.route}</div>
                  <div className="text-[9px] text-slate-400">{c.flow}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[9px] font-semibold text-right ${
                  c.status.includes('Closed') ? 'bg-red-500/20 text-red-300 border border-red-500/20' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                }`}>
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Helplines */}
        <div className="bg-slate-950/40 border border-indigo-500/10 rounded-xl p-3 text-xs space-y-2">
          <div className="font-semibold text-indigo-300 flex items-center gap-1.5">
            <PhoneCall className="w-4 h-4 text-indigo-400" />
            National Disaster Response Contact
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400">
            <div>NDMA Control: <b>011-26701728</b></div>
            <div>Disaster Toll-Free: <b>1078</b></div>
            <div>ODRAF Control: <b>0674-2534177</b></div>
            <div>West Bengal Control: <b>1070</b></div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Shield, ShieldAlert, FileText, Building, Landmark, Activity, BarChart3, Star, Compass } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface DamageAssessmentProps {
  assessmentData: any;
  loading: boolean;
  onDownloadReport: () => void;
  downloadingReport: boolean;
}

export const DamageAssessment: React.FC<DamageAssessmentProps> = ({
  assessmentData,
  loading,
  onDownloadReport,
  downloadingReport
}) => {
  const [selectedDistrictName, setSelectedDistrictName] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-slate-950/20">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 animate-spin rounded-full" />
          <span className="text-xs font-semibold animate-pulse tracking-wider">Running GIS spatial overlays...</span>
        </div>
      </div>
    );
  }

  if (!assessmentData || !assessmentData.summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-500 gap-3 bg-slate-950/10">
        <ShieldAlert className="w-10 h-10 text-slate-600 animate-pulse" />
        <p className="text-xs max-w-[280px] leading-relaxed">
          Select a cyclone track from the Archive list or draw a custom simulation path to execute the GIS Multi-Criteria Decision Overlays.
        </p>
      </div>
    );
  }

  const { summary, district_details } = assessmentData;

  // Find currently selected district for the spider/radar chart
  const currentDistrict = district_details.find((d: any) => d.district_name === selectedDistrictName) || district_details[0];

  // Radar data
  const radarData = currentDistrict ? [
    { subject: 'Exposure', Value: Math.round((currentDistrict.exposure || 0.5) * 100) },
    { subject: 'Sensitivity', Value: Math.round((currentDistrict.sensitivity || 0.5) * 100) },
    { subject: 'Social Risk', Value: Math.round((currentDistrict.social_vulnerability || 0.5) * 100) },
    { subject: 'Infra Risk', Value: Math.round((currentDistrict.infrastructure_vulnerability || 0.5) * 100) },
    { subject: 'Vulnerability', Value: Math.round((currentDistrict.vulnerability_score || 0.5) * 100) },
    { subject: 'Sensitivity (Env)', Value: Math.round((1.0 - (currentDistrict.adaptive_capacity || 0.5)) * 100) } // Higher means lower adaptive capacity
  ] : [];

  // Financial breakdown data
  const buildingLoss = Math.max(0, summary.total_economic_loss_usd_millions - summary.crop_loss_usd_millions - summary.infrastructure_loss_usd_millions);
  const financialData = [
    { name: 'Crops', Loss: summary.crop_loss_usd_millions, color: '#f59e0b' },
    { name: 'Infra', Loss: summary.infrastructure_loss_usd_millions, color: '#06b6d4' },
    { name: 'Housing', Loss: roundDecimals(buildingLoss, 2), color: '#ef4444' }
  ];

  function roundDecimals(val: number, places: number) {
    return Number(Math.round(Number(val + "e" + places)) + "e-" + places);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-base">Impact Assessment</h2>
        </div>
        <button
          onClick={onDownloadReport}
          disabled={downloadingReport}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 text-white rounded px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-glow-blue"
        >
          {downloadingReport ? (
            <span className="w-3 h-3 border-2 border-white/20 border-t-white animate-spin rounded-full" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          GIS PDF
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Economic Loss Card */}
        <div className="bg-gradient-to-br from-red-950/20 to-slate-950/40 border border-red-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Financial Loss Assessment</span>
            <span className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold border border-red-500/20 uppercase">
              AHP Overlay
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold font-mono text-red-500">
              ${summary.total_economic_loss_usd_millions.toFixed(1)}M
            </span>
            <span className="text-xs text-slate-400">USD Direct Damages</span>
          </div>
          
          {/* Recharts Bar Chart */}
          <div className="h-32 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialData} layout="vertical" margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
                <XAxis type="number" stroke="#64748b" fontSize={8} />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                  itemStyle={{ fontSize: '11px' }}
                />
                <Bar dataKey="Loss" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exposed Assets */}
        <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            Critical Nodes Exposed
          </h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-white/5 flex items-center gap-2">
              <Building className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[9px]">Exposed Assets</span>
                <span className="font-semibold font-mono text-slate-200">{summary.assets_exposed} nodes</span>
              </div>
            </div>
            <div className="bg-slate-950/40 p-2.5 rounded-lg border border-white/5 flex items-center gap-2">
              <Landmark className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="text-slate-400 block text-[9px]">Damaged Nodes</span>
                <span className="font-semibold font-mono text-red-400">{summary.assets_damaged} nodes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Spider/Radar Vulnerability Analysis */}
        {currentDistrict && (
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" />
                Vulnerability Profile
              </h3>
              <select
                className="bg-slate-950 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none focus:border-indigo-500"
                value={currentDistrict.district_name}
                onChange={(e) => setSelectedDistrictName(e.target.value)}
              >
                {district_details.map((d: any) => (
                  <option key={d.district_name} value={d.district_name}>{d.district_name}</option>
                ))}
              </select>
            </div>
            
            <div className="text-[11px] text-slate-400">
              Analysis for <span className="text-indigo-400 font-semibold">{currentDistrict.district_name}</span>: Risk index <span className="text-slate-200 font-semibold">{currentDistrict.vulnerability_score.toFixed(3)}</span>.
            </div>

            {/* Radar Chart */}
            <div className="h-44 flex justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={8} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" fontSize={7} />
                  <Radar name={currentDistrict.district_name} dataKey="Value" stroke="#818cf8" fill="#818cf8" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* District Breakdown List */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Affected Coastal Districts</h3>
          
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {district_details.map((dist: any, idx: number) => {
              const isSelected = currentDistrict.district_name === dist.district_name;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDistrictName(dist.district_name)}
                  className={`cursor-pointer border rounded-lg p-2.5 flex items-center justify-between text-xs transition-all ${
                    isSelected ? 'bg-indigo-950/20 border-indigo-500/40 shadow-inner' : 'bg-slate-950/40 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-200">{dist.district_name}</div>
                    <div className="text-[9px] text-slate-400">{dist.state} • dist: {dist.distance_km}km</div>
                  </div>
                  
                  <div className="text-right space-y-1">
                    <span className={`px-2 py-0.5 rounded text-[9px] inline-block font-semibold ${
                      dist.risk_class === 'Extreme' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                      dist.risk_class === 'Very High' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/20' :
                      dist.risk_class === 'High' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' :
                      dist.risk_class === 'Moderate' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20' :
                      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {dist.risk_class}
                    </span>
                    
                    <div className="text-[10px] font-mono text-slate-400">
                      Loss: ${dist.economic_loss_usd_millions}M
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

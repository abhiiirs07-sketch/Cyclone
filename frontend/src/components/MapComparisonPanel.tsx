import React from 'react';
import { Columns, ArrowRight, ShieldAlert, BarChart3, TrendingDown } from 'lucide-react';

interface MapComparisonPanelProps {
  cycloneA: any;
  cycloneB: any;
  assessmentA: any;
  assessmentB: any;
}

export const MapComparisonPanel: React.FC<MapComparisonPanelProps> = ({
  cycloneA,
  cycloneB,
  assessmentA,
  assessmentB
}) => {
  if (!cycloneA || !cycloneB) {
    return (
      <div className="bg-slate-900/90 backdrop-blur border border-indigo-500/20 rounded-xl p-4 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
        <Columns className="w-6 h-6 text-indigo-400 animate-pulse" />
        <span>Compare Mode active. Select a secondary storm from the Archive list to see side-by-side stats.</span>
      </div>
    );
  }

  const lossDiff = Math.abs((assessmentA?.summary?.total_economic_loss_usd_millions || 0) - (assessmentB?.summary?.total_economic_loss_usd_millions || 0));

  return (
    <div className="bg-slate-950/90 backdrop-blur border border-indigo-500/30 rounded-xl p-4 shadow-2xl space-y-4 text-xs text-slate-200">
      
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <Columns className="w-4 h-4 text-indigo-400" />
        <span className="font-bold uppercase tracking-wider text-[10px]">Comparative Diagnostics</span>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        
        {/* Storm A Card */}
        <div className="bg-slate-900/50 border border-indigo-500/20 rounded-lg p-2.5 space-y-1.5">
          <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wide">Left Map</span>
          <h4 className="font-bold text-sm text-slate-100">{cycloneA.name} ({cycloneA.year})</h4>
          <div className="space-y-1 text-[10.5px] font-mono text-slate-400">
            <div>Cat: <span className="text-slate-200">{cycloneA.peak_category}</span></div>
            <div>Winds: <span className="text-slate-200">{cycloneA.max_wind_speed.toFixed(0)} kt</span></div>
            <div>Pres: <span className="text-slate-200">{cycloneA.min_pressure.toFixed(0)} hPa</span></div>
            <div>Loss: <span className="text-slate-200">${assessmentA?.summary?.total_economic_loss_usd_millions?.toFixed(1) || cycloneA.damage_usd}M</span></div>
            <div>Deaths: <span className="text-slate-200">{cycloneA.deaths}</span></div>
          </div>
        </div>

        {/* Storm B Card */}
        <div className="bg-slate-900/50 border border-purple-500/20 rounded-lg p-2.5 space-y-1.5">
          <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wide">Right Map</span>
          <h4 className="font-bold text-sm text-slate-100">{cycloneB.name} ({cycloneB.year})</h4>
          <div className="space-y-1 text-[10.5px] font-mono text-slate-400">
            <div>Cat: <span className="text-slate-200">{cycloneB.peak_category}</span></div>
            <div>Winds: <span className="text-slate-200">{cycloneB.max_wind_speed.toFixed(0)} kt</span></div>
            <div>Pres: <span className="text-slate-200">{cycloneB.min_pressure.toFixed(0)} hPa</span></div>
            <div>Loss: <span className="text-slate-200">${assessmentB?.summary?.total_economic_loss_usd_millions?.toFixed(1) || cycloneB.damage_usd}M</span></div>
            <div>Deaths: <span className="text-slate-200">{cycloneB.deaths}</span></div>
          </div>
        </div>
      </div>

      {/* Analytical Differential Card */}
      <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-lg p-3 space-y-1.5">
        <h4 className="text-[10px] font-semibold text-indigo-300 uppercase tracking-widest flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5" />
          Landfall Impact delta
        </h4>
        <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
          Differential direct economic damages: <span className="text-slate-200 font-bold">${lossDiff.toFixed(1)}M USD</span>.
          {cycloneA.max_wind_speed > cycloneB.max_wind_speed ? ` ${cycloneA.name} peak winds exceed ${cycloneB.name} by ${(cycloneA.max_wind_speed - cycloneB.max_wind_speed).toFixed(0)} kt.` : ` ${cycloneB.name} peak winds exceed ${cycloneA.name} by ${(cycloneB.name - cycloneA.max_wind_speed).toFixed(0)} kt.`}
        </p>
      </div>
    </div>
  );
};

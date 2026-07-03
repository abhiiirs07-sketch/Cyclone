import React, { useState } from 'react';
import { Cpu, Navigation, Wind, Compass, AlertCircle, ShieldAlert, Table, Activity, TrendingDown } from 'lucide-react';

interface AIForecastPanelProps {
  forecastPoints: any; // Can be array or ensemble dictionary
  onTriggerForecast: () => void;
  loadingForecast: boolean;
  activeCycloneName: string | null;
  customMode: boolean;
  onClearCustom: () => void;
}

export const AIForecastPanel: React.FC<AIForecastPanelProps> = ({
  forecastPoints,
  onTriggerForecast,
  loadingForecast,
  activeCycloneName,
  customMode,
  onClearCustom
}) => {
  const [activeModelTab, setActiveModelTab] = useState<'rf' | 'deep_learning' | 'nwp'>('rf');

  const isEnsemble = forecastPoints && !Array.isArray(forecastPoints) && forecastPoints.rf;
  
  // Extract list of points depending on state
  const getCurrentPoints = () => {
    if (!forecastPoints) return [];
    if (isEnsemble) {
      return forecastPoints[activeModelTab] || [];
    }
    return Array.isArray(forecastPoints) ? forecastPoints : [];
  };

  const currentPoints = getCurrentPoints();

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-base">AI Forecasting</h2>
        </div>
        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
          Ensemble Engine v3.1
        </span>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* Model Control Unit Card */}
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Model Control Room</h3>
          
          {customMode ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-yellow-400 text-xs bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Custom simulation track active. Draw coordinate points on the map, then click <b>Forecast Path</b>.</span>
              </div>
              <button
                onClick={onClearCustom}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-lg text-xs py-2 font-semibold transition-colors"
              >
                Reset Custom Simulation
              </button>
            </div>
          ) : activeCycloneName ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 leading-relaxed">
                Compute predictive trajectory grids and pressure drops for <span className="text-indigo-400 font-semibold">{activeCycloneName}</span> using our deep ensemble meteorological suite.
              </p>
              
              <button
                onClick={onTriggerForecast}
                disabled={loadingForecast}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800/40 disabled:text-slate-500 text-white rounded-lg text-xs py-2.5 font-semibold transition-all shadow-glow-blue flex items-center justify-center gap-1.5"
              >
                <Cpu className="w-4 h-4 animate-pulse" />
                {loadingForecast ? "Simulating Ensemble Models..." : "Run Ensemble Track Forecast"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-950/40 rounded-lg p-3 text-center justify-center">
              <span>Select a cyclone from the Archive or draw a custom simulation path to execute.</span>
            </div>
          )}
        </div>

        {/* Ensemble spaghetti paths model selector */}
        {isEnsemble && (
          <div className="space-y-3">
            {/* Tabs */}
            <div className="grid grid-cols-3 bg-slate-950/50 border border-white/5 rounded-lg p-0.5 gap-1 text-[10px] font-semibold">
              <button
                onClick={() => setActiveModelTab('rf')}
                className={`py-1.5 rounded transition-all ${activeModelTab === 'rf' ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/20 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                RF Baseline
              </button>
              <button
                onClick={() => setActiveModelTab('deep_learning')}
                className={`py-1.5 rounded transition-all ${activeModelTab === 'deep_learning' ? 'bg-purple-600/35 text-purple-300 border border-purple-500/20 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                AI Deep Learning
              </button>
              <button
                onClick={() => setActiveModelTab('nwp')}
                className={`py-1.5 rounded transition-all ${activeModelTab === 'nwp' ? 'bg-blue-600/35 text-blue-300 border border-blue-500/20 shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                NWP Physical
              </button>
            </div>

            {/* Model stats block */}
            <div className="bg-slate-950/40 border border-white/5 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Model Specifications</span>
                <span className={`text-[9px] px-2 py-0.5 rounded font-mono ${
                  activeModelTab === 'rf' ? 'bg-indigo-500/20 text-indigo-400' :
                  activeModelTab === 'deep_learning' ? 'bg-purple-500/20 text-purple-400' :
                  'bg-blue-500/20 text-blue-400'
                }`}>
                  {activeModelTab === 'rf' ? 'Random Forest Regressor' :
                   activeModelTab === 'deep_learning' ? 'CNN LSTM Dynamics' :
                   'Numerical Weather Model'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {activeModelTab === 'rf' ? 'RF models analyze historical coordinate changes and sea surface heat anomalies to predict baseline corridors.' :
                 activeModelTab === 'deep_learning' ? 'Deep Learning networks simulate thermodynamic conversions to model recurving trajectories.' :
                 'NWP models integrate fluid equations and baroclinic instabilities to simulate boundary friction drops.'}
              </p>
            </div>

            {/* Dynamic Forecast Point Cards */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                Forecast Sequence
              </h4>
              
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {currentPoints.map((pt: any, idx: number) => (
                  <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-300">
                        +{ (idx + 1) * 12 }h Projection
                      </span>
                      <span className="text-slate-400 text-[9px] font-mono">
                        { new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) }
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 rounded-lg px-2.5 py-1">
                        <Compass className="w-3.5 h-3.5 text-sky-400" />
                        <span className="font-mono">{pt.lat.toFixed(3)}°N, {pt.lon.toFixed(3)}°E</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 rounded-lg px-2.5 py-1">
                        <Wind className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="font-mono">{pt.wind_speed.toFixed(0)} kt • {pt.pressure.toFixed(0)} hPa</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-[9px]">
                      <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-semibold">
                        {pt.category}
                      </span>
                      <span className="text-slate-500 font-mono">
                        Cone Radius: ±{pt.confidence_radius} km
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Standard forecasting list when ensemble is not available yet */}
        {!isEnsemble && Array.isArray(forecastPoints) && forecastPoints.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-indigo-400" />
              Forecast Sequence
            </h4>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {forecastPoints.map((pt, idx) => (
                <div key={idx} className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2 hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-300">
                      +{ (idx + 1) * 12 }h Projection
                    </span>
                    <span className="text-slate-400 text-[9px] font-mono">
                      { new Date(pt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) }
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 rounded-lg px-2 py-1">
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-mono">{pt.lat.toFixed(2)}°N, {pt.lon.toFixed(2)}°E</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 rounded-lg px-2 py-1">
                      <Wind className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono">{pt.wind_speed.toFixed(0)} kt • {pt.pressure.toFixed(0)} hPa</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical Specification details */}
        <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-xl p-4 space-y-2.5">
          <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-indigo-400" />
            Decision Support Specs
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Models are trained on historical database iterations (1950–2026) using features like:
          </p>
          <ul className="text-[10px] text-slate-400 list-disc pl-4 space-y-1">
            <li>Dynamic coordinate vectors & 6h displacement velocities</li>
            <li>Thermodynamic sea surface gradients & upwellings</li>
            <li>Central pressure gradients & eyewall radii rates</li>
          </ul>
          <p className="text-[10px] text-slate-500 italic">
            Disclaimer: AI models provide guidance only. Refer to official India Meteorological Department (IMD) bulletins for storm safety decisions.
          </p>
        </div>
      </div>
    </div>
  );
};

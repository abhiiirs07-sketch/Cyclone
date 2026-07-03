import React from 'react';
import { Layers, Sliders, Eye, EyeOff, Info, Download } from 'lucide-react';

export interface GisLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  category: 'met' | 'ocean' | 'sat' | 'admin' | 'hazard';
  legend?: {
    colors: string[];
    labels: string[];
  };
}

interface GisLayerManagerProps {
  layers: GisLayer[];
  onChange: (layers: GisLayer[]) => void;
  onExport: (layerId: string) => void;
}

export const GisLayerManager: React.FC<GisLayerManagerProps> = ({ layers, onChange, onExport }) => {
  const categories = [
    { id: 'met', name: 'Real-Time Meteorological Overlays' },
    { id: 'ocean', name: 'Oceanographic & Marine Layers' },
    { id: 'sat', name: 'Satellite Raster Feeds (INSAT)' },
    { id: 'admin', name: 'Administrative Boundaries & Infrastructure' },
    { id: 'hazard', name: 'Hazard Zones & Inundation Risk' }
  ];

  const handleToggle = (id: string) => {
    const updated = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l);
    onChange(updated);
  };

  const handleOpacityChange = (id: string, val: number) => {
    const updated = layers.map(l => l.id === id ? { ...l, opacity: val } : l);
    onChange(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/20 text-slate-200 p-4 space-y-4 font-sans select-none overflow-y-auto">
      
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <Layers className="w-5 h-5 text-indigo-400" />
        <h2 className="text-sm font-bold tracking-wider uppercase text-slate-100">Operational GIS Layer Manager</h2>
      </div>

      <div className="space-y-4">
        {categories.map(cat => {
          const catLayers = layers.filter(l => l.category === cat.id);
          if (catLayers.length === 0) return null;

          return (
            <div key={cat.id} className="space-y-2">
              {/* Category Header */}
              <div className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase border-l-2 border-indigo-500 pl-2">
                {cat.name}
              </div>

              {/* Layer Rows */}
              <div className="space-y-1 bg-slate-900/40 p-2 rounded-lg border border-white/5">
                {catLayers.map(layer => (
                  <div key={layer.id} className="space-y-2 border-b border-white/5 last:border-0 py-2.5">
                    
                    {/* Layer Header Controls */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(layer.id)}
                          className={`p-1 rounded transition-colors ${
                            layer.visible ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/20' : 'bg-slate-950/60 text-slate-500 border border-white/5'
                          }`}
                          title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-xs font-semibold text-slate-200">{layer.name}</span>
                      </div>

                      {/* Export trigger */}
                      <button
                        onClick={() => onExport(layer.id)}
                        className="p-1 rounded bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-400 transition-colors"
                        title="Export Layer Data"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Opacity range slider (only active if visible) */}
                    {layer.visible && (
                      <div className="flex items-center gap-3 pl-8 text-[10px] text-slate-400">
                        <Sliders className="w-3 h-3 text-slate-500" />
                        <span className="w-10">Opacity:</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={Math.round(layer.opacity * 100)}
                          onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value) / 100)}
                          className="w-full accent-indigo-500 h-1 rounded bg-slate-950 focus:outline-none"
                        />
                        <span className="w-8 text-right font-mono">{Math.round(layer.opacity * 100)}%</span>
                      </div>
                    )}

                    {/* Horizontal color strip legends */}
                    {layer.visible && layer.legend && (
                      <div className="pl-8 pt-1.5 flex flex-col gap-1">
                        <div className="h-2 rounded w-full flex overflow-hidden">
                          {layer.legend.colors.map((color, idx) => (
                            <div
                              key={idx}
                              style={{ backgroundColor: color }}
                              className="flex-1"
                            />
                          ))}
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>{layer.legend.labels[0]}</span>
                          <span>{layer.legend.labels[layer.legend.labels.length - 1]}</span>
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Informational overlay notice */}
      <div className="flex items-start gap-1.5 bg-indigo-950/20 border border-indigo-500/20 p-2.5 rounded-lg text-[10px] text-slate-400 leading-normal mt-auto">
        <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
        <span>Vector boundaries (districts, shelters, rivers) use geodesics; raster arrays (Rainfall, SST, Surge) use coordinate buffers.</span>
      </div>

    </div>
  );
};

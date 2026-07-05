import React from 'react';
import { Database } from 'lucide-react';

export const DataSourcesCard: React.FC = () => {
  const categories = [
    {
      title: "Models",
      items: ["ICON", "GFS", "ECMWF", "HRRR"]
    },
    {
      title: "Satellite",
      items: ["INSAT-3D", "Himawari", "GOES", "MODIS", "VIIRS"]
    },
    {
      title: "Radar",
      items: ["IMD Doppler", "NOAA NEXRAD", "EUMETNET"]
    },
    {
      title: "Tracks",
      items: ["IBTrACS", "JTWC", "NHC", "IMD RSMC"]
    },
    {
      title: "Socio-Environmental",
      items: ["Copernicus Marine", "WorldPop", "OSM Buildings", "ESA WorldCover"]
    }
  ];

  return (
    <div className="bg-slate-950/75 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl space-y-2 text-slate-300">
      <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
        <Database className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-200">Global Meteorological Feed & Data Integrations</span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {categories.map((cat, i) => (
          <div key={i} className="bg-slate-900/50 border border-white/5 rounded-lg p-2 flex flex-col gap-1">
            <span className="text-[8.5px] font-bold text-indigo-300 uppercase tracking-widest">{cat.title}</span>
            <div className="flex flex-wrap gap-1">
              {cat.items.map((item, j) => (
                <span key={j} className="text-[7.5px] bg-slate-950/80 border border-white/5 px-1 py-0.5 rounded text-slate-400 hover:text-indigo-200 transition-colors font-medium">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

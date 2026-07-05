import React, { useState, useEffect } from 'react';
import { FALLBACK_STORMS } from '../utils/fallbackData';
import { Search, Filter, Calendar, MapPin, Download, BarChart2, TrendingUp, AlertTriangle, Columns } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, AreaChart, Area, Legend } from 'recharts';

interface HistoricalExplorerProps {
  onSelectCyclone: (id: number) => void;
  selectedCycloneId: number | null;
  compareCycloneId: number | null;
  compareMode: boolean;
  setCompareMode: (val: boolean) => void;
  API_BASE: string;
}

export const HistoricalExplorer: React.FC<HistoricalExplorerProps> = ({
  onSelectCyclone,
  selectedCycloneId,
  compareCycloneId,
  compareMode,
  setCompareMode,
  API_BASE
}) => {
  const [cyclones, setCyclones] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filters state
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [basin, setBasin] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  
  // Charts visual state
  const [chartType, setChartType] = useState<'frequency' | 'damage'>('frequency');
  const [activeView, setActiveView] = useState<'list' | 'analytics'>('list');

  // Fetch cyclones
  const fetchCyclones = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (year) params.append('year', year);
      if (month) params.append('month', month);
      if (basin) params.append('basin', basin);
      if (category) params.append('category', category);
      if (state) params.append('state', state);
      
      const res = await fetch(`${API_BASE}/api/cyclones?${params.toString()}`);
      if (!res.ok) throw new Error("API network error");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("No data returned");
      
      // Client-side text search filter
      let filtered = data;
      if (search) {
        filtered = data.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()));
      }
      
      setCyclones(filtered);
    } catch (err) {
      console.warn("Using local fallback cyclone archive dataset:", err);
      let filtered = FALLBACK_STORMS;
      if (year) filtered = filtered.filter(c => c.year === parseInt(year));
      if (month) filtered = filtered.filter(c => c.month === parseInt(month));
      if (basin) filtered = filtered.filter(c => c.basin === basin);
      if (category) filtered = filtered.filter(c => c.peak_category.toLowerCase().includes(category.toLowerCase()) || category.toLowerCase().includes(c.peak_category.toLowerCase()));
      if (state) filtered = filtered.filter(c => c.landfall_state === state);
      if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
      setCyclones(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCyclones();
  }, [year, month, basin, category, state, search]);

  // Aggregate stats for charts
  const getFrequencyChartData = () => {
    const yearCounts: { [key: number]: number } = {};
    // Seed standard years for trend display
    const startYear = 1999;
    const endYear = 2026;
    for (let y = startYear; y <= endYear; y++) {
      yearCounts[y] = 0;
    }
    
    cyclones.forEach(c => {
      if (c.year >= startYear && c.year <= endYear) {
        yearCounts[c.year] = (yearCounts[c.year] || 0) + 1;
      }
    });

    return Object.keys(yearCounts).map(y => ({
      year: y,
      Count: yearCounts[parseInt(y)]
    })).sort((a,b) => parseInt(a.year) - parseInt(b.year));
  };

  const getDamageChartData = () => {
    // Top 8 cyclones by damage
    return [...cyclones]
      .filter(c => c.damage_usd > 0)
      .sort((a, b) => b.damage_usd - a.damage_usd)
      .slice(0, 8)
      .map(c => ({
        name: c.name,
        "Damage ($M)": c.damage_usd,
        "Deaths": c.deaths
      }));
  };

  const yearsList = Array.from({ length: 77 }, (_, i) => 2026 - i);
  const statesList = ["Odisha", "Andhra Pradesh", "West Bengal", "Tamil Nadu", "Gujarat", "Maharashtra"];

  return (
    <div className="flex flex-col h-full overflow-hidden text-slate-200">
      {/* Header section */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-400" />
          <h2 className="font-semibold text-lg">Historical Archive</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all ${compareMode ? 'bg-indigo-600/35 text-indigo-300 border border-indigo-500/30 font-bold' : 'bg-slate-900 border border-white/10 text-slate-400'}`}
          >
            <Columns className="w-3.5 h-3.5" />
            Compare Mode
          </button>
          <div className="text-[10px] text-slate-400">{cyclones.length} logs</div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="p-3 border-b border-white/5 bg-slate-900/40 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
        {/* Search */}
        <div className="col-span-2 relative">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search cyclone name..."
            className="w-full bg-slate-950/60 border border-white/10 rounded px-2 py-1.5 pl-7 text-slate-200 focus:outline-none focus:border-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Year */}
        <div>
          <select
            className="w-full bg-slate-950/60 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-300"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            <option value="">All Years</option>
            {yearsList.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Basin */}
        <div>
          <select
            className="w-full bg-slate-950/60 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-300"
            value={basin}
            onChange={(e) => setBasin(e.target.value)}
          >
            <option value="">All Basins</option>
            <option value="Bay of Bengal">Bay of Bengal</option>
            <option value="Arabian Sea">Arabian Sea</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <select
            className="w-full bg-slate-950/60 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500 text-slate-300"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Intensities</option>
            <option value="Super Cyclone">Super Cyclone</option>
            <option value="Extremely Severe">Extremely Severe</option>
            <option value="Very Severe">Very Severe</option>
            <option value="Severe">Severe</option>
            <option value="Cyclonic Storm">Cyclonic Storm</option>
            <option value="Depression">Depression</option>
          </select>
        </div>
      </div>

      {/* View Switcher segment */}
      <div className="px-3 py-2 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
        <div className="flex bg-slate-950 border border-white/10 rounded p-0.5 text-[10px] font-semibold">
          <button
            onClick={() => setActiveView('list')}
            className={`px-3 py-1 rounded transition-colors ${activeView === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Cyclone List ({cyclones.length})
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-3 py-1 rounded transition-colors ${activeView === 'analytics' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Archive Charts
          </button>
        </div>
        <div className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">
          Query Filters Applied
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'list' ? (
          <div className="h-full overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                <span className="animate-pulse">Querying database...</span>
              </div>
            ) : cyclones.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2">
                <AlertTriangle className="w-8 h-8" />
                <span>No cyclones match current criteria.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-white/10 text-slate-400 font-medium z-10">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Year/Month</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Max Wind</th>
                    <th className="p-3 text-right">Pressure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cyclones.map((c) => {
                    const isSelected = selectedCycloneId === c.id;
                    const isCompareSelected = compareCycloneId === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => onSelectCyclone(c.id)}
                        className={`cursor-pointer hover:bg-white/5 transition-colors ${
                          isSelected ? 'bg-indigo-600/25 text-white font-medium border-l-2 border-indigo-500' : 
                          isCompareSelected ? 'bg-purple-600/25 text-white font-medium border-l-2 border-purple-500' : ''
                        }`}
                      >
                        <td className="p-3 font-semibold">{c.name}</td>
                        <td className="p-3 text-slate-400">
                          {c.year}-{c.month < 10 ? `0${c.month}` : c.month}
                        </td>
                        <td className="p-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            c.peak_category.includes('Super') ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                            c.peak_category.includes('Extremely') ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                            c.peak_category.includes('Very Severe') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          }`}>
                            {c.peak_category.replace('Cyclonic Storm', 'CS')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono">{c.max_wind_speed} kt</td>
                        <td className="p-3 text-right font-mono text-slate-400">{c.min_pressure} hPa</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col p-4 bg-slate-950/30 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-slate-300">
                <BarChart2 className="w-4 h-4 text-indigo-400" />
                Interactive Analytics
              </h3>
              <div className="flex bg-slate-900 border border-white/10 rounded p-0.5 text-[10px]">
                <button
                  className={`px-2 py-1 rounded transition-colors ${chartType === 'frequency' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setChartType('frequency')}
                >
                  Frequency Trend
                </button>
                <button
                  className={`px-2 py-1 rounded transition-colors ${chartType === 'damage' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  onClick={() => setChartType('damage')}
                >
                  Impact Stats
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-[220px]">
              {chartType === 'frequency' ? (
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={getFrequencyChartData()} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="freqColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                      labelStyle={{ color: '#94a3b8', fontSize: '10px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="Count" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#freqColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={getDamageChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={8} tickFormatter={(tick) => tick.slice(0, 8)} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '9px', paddingTop: '5px' }} />
                    <Bar dataKey="Damage ($M)" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="Deaths" fill="#eab308" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div className="text-[10px] text-slate-500 leading-relaxed text-center">
              {chartType === 'frequency' 
                ? "Shows the yearly incidence count of severe cyclones in the Indian region."
                : "Highlights top severe historical events by reported direct economic losses and mortality."
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

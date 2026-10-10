import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { formatWeight } from '@/utils/fitness';

export interface VolumeDataPoint {
  date: string;
  volume: number;
  workoutType: string;
}

interface VolumeTrendChartProps {
  data: VolumeDataPoint[];
}

export const VolumeTrendChart: React.FC<VolumeTrendChartProps> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  if (data.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60 p-8 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-zinc-600" />
        <h3 className="mt-3 text-base font-semibold text-zinc-300">No volume data available</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Record workouts to track your training volume and tonnage progression.
        </p>
      </Card>
    );
  }

  // Chart dimensions
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const maxVolume = Math.max(...data.map((d) => d.volume), 100);
  const width = Math.max(500, data.length * 45 + padding.left + padding.right);

  // Scale helpers
  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;

  const getY = (val: number) => {
    return height - padding.bottom - (val / maxVolume) * chartHeight;
  };

  const getX = (idx: number) => {
    if (data.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (idx / (data.length - 1)) * chartWidth;
  };

  // Line path generator
  const linePoints = data
    .map((d, idx) => `${getX(idx)},${getY(d.volume)}`)
    .join(' L ');
  const linePath = `M ${linePoints}`;

  const areaPath = `${linePath} L ${getX(data.length - 1)},${height - padding.bottom} L ${getX(0)},${
    height - padding.bottom
  } Z`;

  // Total summary
  const totalVolume = data.reduce((acc, d) => acc + d.volume, 0);
  const avgVolume = Math.round(totalVolume / data.length);

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            <CardTitle>Training Volume Progression</CardTitle>
          </div>
          <CardDescription>
            Historical tonnage accumulation per workout session
          </CardDescription>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-zinc-400">
            <div>
              Total: <span className="text-amber-400 font-bold">{formatWeight(totalVolume)}</span>
            </div>
            <div>
              Avg: <span className="text-zinc-200 font-semibold">{formatWeight(avgVolume)}</span>
            </div>
          </div>

          <div className="flex rounded-lg bg-zinc-800 p-0.5 border border-zinc-700/60">
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === 'bar'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Bars
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === 'line'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Curve
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="relative overflow-x-auto pb-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[500px] h-[260px] overflow-visible select-none"
          >
            <defs>
              <linearGradient id="volumeAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>

              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.4" />
              </linearGradient>

              <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const yVal = height - padding.bottom - pct * chartHeight;
              const val = Math.round(pct * maxVolume);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={yVal}
                    x2={width - padding.right}
                    y2={yVal}
                    stroke="#27272a"
                    strokeDasharray={pct === 0 ? 'none' : '3 3'}
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 10}
                    y={yVal + 4}
                    textAnchor="end"
                    className="text-[10px] font-mono fill-zinc-500"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}t` : `${val}kg`}
                  </text>
                </g>
              );
            })}

            {/* Line / Area View */}
            {chartType === 'line' && (
              <>
                <path d={areaPath} fill="url(#volumeAreaGradient)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Data Elements (Bars or Points) */}
            {data.map((d, idx) => {
              const x = getX(idx);
              const y = getY(d.volume);
              const isHovered = hoveredIndex === idx;
              const barWidth = Math.min(28, (chartWidth / data.length) * 0.65);

              return (
                <g
                  key={idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {chartType === 'bar' ? (
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={Math.max(4, height - padding.bottom - y)}
                      rx="4"
                      fill={isHovered ? 'url(#barGradientActive)' : 'url(#barGradient)'}
                      className="transition-all duration-200"
                    />
                  ) : (
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : 4}
                      fill={isHovered ? '#fbbf24' : '#f59e0b'}
                      stroke="#18181b"
                      strokeWidth="2"
                      className="transition-all duration-200"
                    />
                  )}

                  {/* X Axis Date Label */}
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className={`text-[10px] font-mono transition-colors ${
                      isHovered ? 'fill-amber-400 font-bold' : 'fill-zinc-500'
                    }`}
                  >
                    {d.date.length > 5 ? d.date.slice(5) : d.date}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Tooltip */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <div
              className="absolute z-20 pointer-events-none rounded-lg border border-amber-500/40 bg-zinc-950/95 p-2.5 shadow-xl backdrop-blur-sm transition-all"
              style={{
                left: `${Math.min(
                  width - 150,
                  Math.max(10, getX(hoveredIndex) - 60)
                )}px`,
                top: `${Math.max(10, getY(data[hoveredIndex].volume) - 70)}px`,
              }}
            >
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar className="h-3 w-3 text-amber-500" />
                <span>{data[hoveredIndex].date}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-mono text-sm font-bold text-amber-400">
                  {formatWeight(data[hoveredIndex].volume)}
                </span>
              </div>
              <div className="text-[11px] text-zinc-500 capitalize">
                {data[hoveredIndex].workoutType.replace('_', ' ')}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default VolumeTrendChart;

import React, { useState, memo } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { formatWeight } from '@/utils/fitness';
import { useLocaleStore } from '@/store/useLocaleStore';

export interface VolumeDataPoint {
  date: string;
  volume: number;
  workoutType: string;
}

interface VolumeTrendChartProps {
  data: VolumeDataPoint[];
}

export const VolumeTrendChart: React.FC<VolumeTrendChartProps> = memo(({ data }) => {
  const { t } = useLocaleStore();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  if (data.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60 p-8 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-zinc-600" />
        <h3 className="mt-3 text-base font-semibold text-zinc-300">{t('analytics.noVolumeData')}</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {t('analytics.noVolumeDesc')}
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
            <CardTitle>{t('analytics.trainingVolumeTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('analytics.trainingVolumeDesc')}
          </CardDescription>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-zinc-400">
            <div>
              {t('analytics.total')}: <span className="text-amber-400 font-bold">{formatWeight(totalVolume)}</span>
            </div>
            <div>
              {t('analytics.avg')}: <span className="text-zinc-200 font-semibold">{formatWeight(avgVolume)}</span>
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
              {t('analytics.bars')}
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                chartType === 'line'
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t('analytics.curve')}
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
              <linearGradient id="volumeBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="volumeLineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const val = Math.round(pct * maxVolume);
              const yVal = getY(val);
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
                    {formatWeight(val)}
                  </text>
                </g>
              );
            })}

            {/* Line / Area Representation */}
            {chartType === 'line' && (
              <>
                <path d={areaPath} fill="url(#volumeLineGradient)" />
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

            {/* Bars or Line Points */}
            {data.map((d, idx) => {
              const x = getX(idx);
              const y = getY(d.volume);
              const barWidth = Math.max(16, Math.min(36, (chartWidth / data.length) * 0.65));
              const barHeight = height - padding.bottom - y;
              const isHovered = hoveredIndex === idx;

              if (chartType === 'bar') {
                return (
                  <g key={idx}>
                    {/* Visual Bar */}
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={Math.max(2, barHeight)}
                      rx={4}
                      fill={isHovered ? '#fbbf24' : 'url(#volumeBarGradient)'}
                      stroke={isHovered ? '#f59e0b' : 'none'}
                      strokeWidth={isHovered ? 1.5 : 0}
                      className="transition-colors pointer-events-none"
                    />

                    {/* Date label */}
                    <text
                      x={x}
                      y={height - padding.bottom + 18}
                      textAnchor="middle"
                      className={`text-[10px] font-mono select-none pointer-events-none transition-colors ${
                        isHovered ? 'fill-amber-400 font-bold' : 'fill-zinc-500'
                      }`}
                    >
                      {d.date.length > 5 ? d.date.slice(5) : d.date}
                    </text>

                    {/* Wide Stable Hitbox */}
                    <rect
                      x={x - barWidth / 2 - 8}
                      y={padding.top}
                      width={barWidth + 16}
                      height={height - padding.top - padding.bottom}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  </g>
                );
              }

              // Line mode point
              return (
                <g key={idx}>
                  {/* Active Glow */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={y}
                      r={9}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      opacity="0.4"
                      pointerEvents="none"
                    />
                  )}

                  {/* Point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? '#fbbf24' : '#f59e0b'}
                    stroke="#18181b"
                    strokeWidth={isHovered ? 2 : 2.5}
                    pointerEvents="none"
                  />

                  {/* Date label */}
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className={`text-[10px] font-mono select-none pointer-events-none transition-colors ${
                      isHovered ? 'fill-amber-400 font-bold' : 'fill-zinc-500'
                    }`}
                  >
                    {d.date.length > 5 ? d.date.slice(5) : d.date}
                  </text>

                  {/* Wide Stable Hitbox */}
                  <circle
                    cx={x}
                    cy={y}
                    r={18}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                </g>
              );
            })}

            {/* In-SVG Vector Tooltip with pointer arrow & boundary safety */}
            {hoveredIndex !== null && data[hoveredIndex] && (() => {
              const pt = data[hoveredIndex];
              const px = getX(hoveredIndex);
              const py = getY(pt.volume);
              const tooltipWidth = 210;
              const tooltipHeight = 56;

              let tx = px - tooltipWidth / 2;
              if (tx < padding.left) tx = padding.left;
              if (tx + tooltipWidth > width - padding.right) tx = width - padding.right - tooltipWidth;

              const isAbove = py - tooltipHeight - 16 >= padding.top;
              const ty = isAbove
                ? py - tooltipHeight - 14
                : chartType === 'bar'
                ? py + 14
                : py + 16;
              const arrowX = Math.max(tx + 14, Math.min(px, tx + tooltipWidth - 14));
              const textCenterX = tx + tooltipWidth / 2;

              return (
                <g pointerEvents="none" className="transition-opacity duration-150">
                  {/* Vertical Crosshair Guideline */}
                  <line
                    x1={px}
                    y1={padding.top}
                    x2={px}
                    y2={height - padding.bottom}
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    opacity="0.35"
                  />

                  {/* Tooltip Background Card */}
                  <rect
                    x={tx}
                    y={ty}
                    width={tooltipWidth}
                    height={tooltipHeight}
                    rx={8}
                    fill="#09090b"
                    stroke="#f59e0b"
                    strokeWidth={1}
                    opacity={0.97}
                  />

                  {/* Pointer Arrow to target point */}
                  {isAbove ? (
                    <polygon
                      points={`${arrowX - 7},${ty + tooltipHeight} ${arrowX + 7},${ty + tooltipHeight} ${arrowX},${ty + tooltipHeight + 7}`}
                      fill="#09090b"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                  ) : (
                    <polygon
                      points={`${arrowX - 7},${ty} ${arrowX + 7},${ty} ${arrowX},${ty - 7}`}
                      fill="#09090b"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                  )}

                  {/* Line 1: Date */}
                  <text
                    x={textCenterX}
                    y={ty + 20}
                    textAnchor="middle"
                    fill="#a1a1aa"
                    fontSize="11"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                    className="select-none font-medium"
                  >
                    {pt.date}
                  </text>

                  {/* Line 2: Volume and Exercise Type */}
                  <text
                    x={textCenterX}
                    y={ty + 40}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize="12.5"
                    fontWeight="bold"
                    fontFamily="ui-monospace, monospace"
                    className="select-none"
                  >
                    {formatWeight(pt.volume)}{' '}
                    <tspan fill="#a1a1aa" fontSize="11" fontWeight="normal">
                      ({pt.workoutType.replace(/_/g, ' ')})
                    </tspan>
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
});

export default VolumeTrendChart;

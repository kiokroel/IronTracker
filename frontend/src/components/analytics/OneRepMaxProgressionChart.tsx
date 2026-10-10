import React, { useState, memo } from 'react';
import { TrendingUp, Dumbbell, Target } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { OneRepMaxFormula, calculate1RMByFormula } from '@/utils/fitness';
import { useLocaleStore } from '@/store/useLocaleStore';
import type { TranslationKey } from '@/locales';

export interface ExerciseSetRecord {
  date: string;
  weight: number;
  reps: number;
  workoutType: string;
}

interface OneRepMaxProgressionChartProps {
  records: Record<string, ExerciseSetRecord[]>;
}

interface ExerciseOption {
  id: string;
  key: TranslationKey;
}

export const OneRepMaxProgressionChart: React.FC<OneRepMaxProgressionChartProps> = memo(({ records }) => {
  const { t } = useLocaleStore();
  const [selectedExercise, setSelectedExercise] = useState<string>('bench_press');
  const [selectedFormula, setSelectedFormula] = useState<OneRepMaxFormula>('average');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const exercises: ExerciseOption[] = [
    { id: 'bench_press', key: 'workouts.bench_press' },
    { id: 'squat', key: 'workouts.squat' },
    { id: 'deadlift', key: 'workouts.deadlift' },
    { id: 'overhead_press', key: 'workouts.overhead_press' },
  ];

  const formulas: { id: OneRepMaxFormula; label: string }[] = [
    { id: 'average', label: t('analytics.formulaAverage') },
    { id: 'epley', label: 'Epley' },
    { id: 'brzycki', label: 'Brzycki' },
    { id: 'lander', label: 'Lander' },
    { id: 'wathan', label: 'Wathan' },
  ];

  const rawData = records[selectedExercise] || [];

  // Compute 1RM data points sorted by date
  const data = rawData
    .map((r) => ({
      date: r.date,
      weight: r.weight,
      reps: r.reps,
      oneRepMax: calculate1RMByFormula(selectedFormula, r.weight, r.reps),
    }))
    .filter((d) => d.oneRepMax > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const currentExerciseObj = exercises.find((e) => e.id === selectedExercise);
  const currentExerciseLabel = currentExerciseObj ? t(currentExerciseObj.key) : selectedExercise;

  if (data.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60 p-8 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-amber-500" />
            <CardTitle>{t('analytics.oneRepMaxTitle')}</CardTitle>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {exercises.map((ex) => (
              <button
                key={ex.id}
                onClick={() => setSelectedExercise(ex.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  selectedExercise === ex.id
                    ? 'bg-amber-500 text-zinc-950 font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t(ex.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="py-12 text-center">
          <Target className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-semibold text-zinc-300">
            {t('analytics.noHistoryFor', { exercise: currentExerciseLabel })}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            {t('analytics.logSetsDesc')}
          </p>
        </div>
      </Card>
    );
  }

  // Chart layout calculations
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 55 };
  const max1RM = Math.max(...data.map((d) => d.oneRepMax), 50);
  const min1RM = Math.max(0, Math.min(...data.map((d) => d.oneRepMax)) * 0.85);
  const width = Math.max(500, data.length * 55 + padding.left + padding.right);

  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;

  const getY = (val: number) => {
    if (max1RM === min1RM) return height / 2;
    return height - padding.bottom - ((val - min1RM) / (max1RM - min1RM)) * chartHeight;
  };

  const getX = (idx: number) => {
    if (data.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (idx / (data.length - 1)) * chartWidth;
  };

  const linePoints = data.map((d, idx) => `${getX(idx)},${getY(d.oneRepMax)}`).join(' L ');
  const linePath = `M ${linePoints}`;

  const areaPath = `${linePath} L ${getX(data.length - 1)},${height - padding.bottom} L ${getX(0)},${
    height - padding.bottom
  } Z`;

  const best1RM = Math.max(...data.map((d) => d.oneRepMax));
  const latest1RM = data[data.length - 1].oneRepMax;

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            <CardTitle>{t('analytics.oneRepMaxTitle')}</CardTitle>
          </div>
          <CardDescription>
            {t('analytics.subtitle')}
          </CardDescription>
        </div>

        {/* Exercise Selector */}
        <div className="flex flex-wrap gap-1.5">
          {exercises.map((ex) => (
            <button
              key={ex.id}
              onClick={() => setSelectedExercise(ex.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                selectedExercise === ex.id
                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {t(ex.key)}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sub-header: Formula switcher and Best/Current values */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-y border-zinc-800/80 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">{t('analytics.formula')}:</span>
            {formulas.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFormula(f.id)}
                className={`px-2 py-0.5 rounded text-xs transition-colors ${
                  selectedFormula === f.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-zinc-400">
              {t('analytics.estimatedMax')}:{' '}
              <span className="text-zinc-100 font-bold">{latest1RM} {t('common.kg')}</span>
            </div>
            <div className="text-zinc-400">
              {t('analytics.best1RM')}:{' '}
              <span className="text-amber-400 font-bold">{best1RM} {t('common.kg')}</span>
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="relative overflow-x-auto pb-2">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[500px] h-[260px] overflow-visible select-none"
          >
            <defs>
              <linearGradient id="progressionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const val = Math.round(min1RM + pct * (max1RM - min1RM));
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
                    {val}{t('common.kg')}
                  </text>
                </g>
              );
            })}

            {/* Curve and Gradient */}
            <path d={areaPath} fill="url(#progressionGradient)" />
            <path
              d={linePath}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Points */}
            {data.map((d, idx) => {
              const x = getX(idx);
              const y = getY(d.oneRepMax);
              const isBest = d.oneRepMax === best1RM;
              const isHovered = hoveredIndex === idx;

              return (
                <g key={idx}>
                  {/* Active Point Glow */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={y}
                      r={isBest ? 11 : 9.5}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2"
                      opacity="0.4"
                      pointerEvents="none"
                    />
                  )}

                  {/* Visible Point */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? (isBest ? 7.5 : 6.5) : (isBest ? 6 : 4.5)}
                    fill={isBest || isHovered ? '#fbbf24' : '#f59e0b'}
                    stroke="#18181b"
                    strokeWidth={isHovered ? 2 : 2.5}
                    pointerEvents="none"
                  />

                  {/* X Axis Label */}
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

                  {/* Wide Stable Hitbox (r=18) */}
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
              const py = getY(pt.oneRepMax);
              const tooltipWidth = 210;
              const tooltipHeight = 56;

              let tx = px - tooltipWidth / 2;
              if (tx < padding.left) tx = padding.left;
              if (tx + tooltipWidth > width - padding.right) tx = width - padding.right - tooltipWidth;

              const isAbove = py - tooltipHeight - 16 >= padding.top;
              const ty = isAbove ? py - tooltipHeight - 14 : py + 16;
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

                  {/* Line 2: 1RM and Set Breakdown */}
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
                    {pt.oneRepMax} {t('common.kg')} 1RM{' '}
                    <tspan fill="#a1a1aa" fontSize="11" fontWeight="normal">
                      ({pt.weight}{t('common.kg')} × {pt.reps})
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

export default OneRepMaxProgressionChart;

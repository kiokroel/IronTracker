import React, { useState } from 'react';
import { TrendingUp, Dumbbell, Calendar, Target } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { OneRepMaxFormula, calculate1RMByFormula } from '@/utils/fitness';

export interface ExerciseSetRecord {
  date: string;
  weight: number;
  reps: number;
  workoutType: string;
}

interface OneRepMaxProgressionChartProps {
  records: Record<string, ExerciseSetRecord[]>;
}

export const OneRepMaxProgressionChart: React.FC<OneRepMaxProgressionChartProps> = ({ records }) => {
  const [selectedExercise, setSelectedExercise] = useState<string>('bench_press');
  const [selectedFormula, setSelectedFormula] = useState<OneRepMaxFormula>('average');
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    weight: number;
    reps: number;
    oneRepMax: number;
    x: number;
    y: number;
  } | null>(null);

  const exercises = [
    { id: 'bench_press', label: 'Bench Press' },
    { id: 'squat', label: 'Squat' },
    { id: 'deadlift', label: 'Deadlift' },
    { id: 'overhead_press', label: 'Overhead Press' },
  ];

  const formulas: { id: OneRepMaxFormula; label: string }[] = [
    { id: 'average', label: 'Average' },
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

  if (data.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/60 p-8 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-amber-500" />
            <CardTitle>1RM Strength Progression</CardTitle>
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
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        <div className="py-12 text-center">
          <Target className="mx-auto h-10 w-10 text-zinc-600" />
          <h3 className="mt-3 text-base font-semibold text-zinc-300">
            No history for {exercises.find((e) => e.id === selectedExercise)?.label}
          </h3>
          <p className="mt-1 text-sm text-zinc-500">
            Log sets with weight and reps to generate scientific 1RM estimates.
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
            <CardTitle>1RM Strength Progression</CardTitle>
          </div>
          <CardDescription>
            Estimated one-rep maximum dynamics across training sessions
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
              {ex.label}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sub-header: Formula switcher and Best/Current values */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-y border-zinc-800/80 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Formula:</span>
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
              Current:{' '}
              <span className="text-zinc-100 font-bold">{latest1RM} kg</span>
            </div>
            <div className="text-zinc-400">
              Peak PR:{' '}
              <span className="text-amber-400 font-bold">{best1RM} kg</span>
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
                    {val}kg
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

              return (
                <g
                  key={idx}
                  className="cursor-pointer"
                  onMouseEnter={() =>
                    setHoveredPoint({
                      date: d.date,
                      weight: d.weight,
                      reps: d.reps,
                      oneRepMax: d.oneRepMax,
                      x,
                      y,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isBest ? 6 : 4.5}
                    fill={isBest ? '#fbbf24' : '#f59e0b'}
                    stroke="#18181b"
                    strokeWidth="2.5"
                    className="transition-transform hover:scale-125"
                  />

                  {/* X Axis Label */}
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className="text-[10px] font-mono fill-zinc-500"
                  >
                    {d.date.length > 5 ? d.date.slice(5) : d.date}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-20 pointer-events-none rounded-lg border border-amber-500/40 bg-zinc-950/95 p-2.5 shadow-xl backdrop-blur-sm"
              style={{
                left: `${Math.min(width - 160, Math.max(10, hoveredPoint.x - 70))}px`,
                top: `${Math.max(10, hoveredPoint.y - 75)}px`,
              }}
            >
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Calendar className="h-3 w-3 text-amber-500" />
                <span>{hoveredPoint.date}</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-amber-400">
                  {hoveredPoint.oneRepMax} kg 1RM
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  ({hoveredPoint.weight}kg × {hoveredPoint.reps})
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OneRepMaxProgressionChart;

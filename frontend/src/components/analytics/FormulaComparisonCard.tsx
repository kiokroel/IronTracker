import React, { useState } from 'react';
import { Calculator, Scale, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  calculateAllOneRepMaxes,
  calculateIntensityZones,
} from '@/utils/fitness';

export const FormulaComparisonCard: React.FC = () => {
  const [weight, setWeight] = useState<number>(100);
  const [reps, setReps] = useState<number>(5);

  const breakdown = calculateAllOneRepMaxes(weight, reps);
  const intensityZones = calculateIntensityZones(breakdown.average);

  const formulasMeta = [
    {
      id: 'epley',
      name: 'Epley (1985)',
      value: breakdown.epley,
      formula: 'w · (1 + r / 30)',
      description: 'Golden standard in powerlifting and strength sports',
    },
    {
      id: 'brzycki',
      name: 'Brzycki (1993)',
      value: breakdown.brzycki,
      formula: 'w / (1.0278 - 0.0278 · r)',
      description: 'Accurate for low-to-moderate repetitions (≤ 10 reps)',
    },
    {
      id: 'lander',
      name: 'Lander (1985)',
      value: breakdown.lander,
      formula: '100w / (101.3 - 2.671 · r)',
      description: 'Standard formula used in NSCA and exercise physiology',
    },
    {
      id: 'wathan',
      name: 'Wathan (1994)',
      value: breakdown.wathan,
      formula: '100w / (48.8 + 53.8 · e^(-0.075r))',
      description: 'Exponential decay curve for higher-rep sets',
    },
  ];

  return (
    <Card className="border-zinc-800 bg-zinc-900/60 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-500" />
          <CardTitle>Scientific 1RM Formula Comparison</CardTitle>
        </div>
        <CardDescription>
          Compare laboratory-validated 1-Rep Max estimation formulas for any working load
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Input Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-zinc-850/60 p-4 border border-zinc-800">
          <div>
            <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5">
              <span>Working Weight</span>
              <span className="font-mono text-amber-400 font-bold">{weight} kg</span>
            </div>
            <input
              type="range"
              min="20"
              max="350"
              step="2.5"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
              <span>20 kg</span>
              <span>150 kg</span>
              <span>350 kg</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1.5">
              <span>Repetitions Completed</span>
              <span className="font-mono text-amber-400 font-bold">{reps} reps</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={reps}
              onChange={(e) => setReps(parseInt(e.target.value, 10) || 1)}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-zinc-700 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500 mt-1">
              <span>1 rep</span>
              <span>10 reps</span>
              <span>20 reps</span>
            </div>
          </div>
        </div>

        {/* Big Average Result Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-zinc-950 font-black">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold">
                Consensus 1-Rep Maximum
              </div>
              <div className="text-sm text-zinc-300">
                Average across all 4 validated models
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-0 text-left sm:text-right">
            <span className="text-3xl font-black font-mono text-zinc-100">
              {breakdown.average}
            </span>
            <span className="text-sm font-bold text-amber-400 ml-1.5">kg</span>
          </div>
        </div>

        {/* 4 Models Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {formulasMeta.map((f) => {
            const diff = Math.round((f.value - breakdown.average) * 10) / 10;
            return (
              <div
                key={f.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">{f.name}</span>
                  <Badge
                    variant={diff === 0 ? 'default' : diff > 0 ? 'accent' : 'outline'}
                    size="sm"
                  >
                    {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : '0.0'} kg
                  </Badge>
                </div>

                <div className="mt-3 text-2xl font-black font-mono text-zinc-100">
                  {f.value}{' '}
                  <span className="text-xs font-normal text-zinc-400">kg</span>
                </div>

                <div className="mt-2 text-[10px] font-mono text-amber-400/80 bg-zinc-950/80 px-2 py-1 rounded">
                  {f.formula}
                </div>
                <p className="mt-2 text-[11px] text-zinc-500 leading-tight">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Intensity Zones Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-amber-400" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Prescribed Training Intensity Zones (Based on Consensus 1RM)
            </h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-800 text-zinc-400 font-mono">
                <tr>
                  <th className="py-2 pr-4">% 1RM</th>
                  <th className="py-2 pr-4">Calculated Load</th>
                  <th className="py-2">Repetition Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 font-mono">
                {intensityZones.map((z) => (
                  <tr key={z.percentage} className="hover:bg-zinc-850/40">
                    <td className="py-2 pr-4 font-bold text-amber-400">
                      {z.percentage}%
                    </td>
                    <td className="py-2 pr-4 text-zinc-200 font-bold">
                      {z.weight} kg
                    </td>
                    <td className="py-2 text-zinc-400">
                      {z.recommendedReps} reps
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormulaComparisonCard;

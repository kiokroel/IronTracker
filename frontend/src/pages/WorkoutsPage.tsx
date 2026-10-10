import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Calendar, Flame, Dumbbell, Filter } from 'lucide-react';
import { workoutsApi } from '@/api/workouts';
import { Workout, WorkoutCreate, WorkoutMetrics } from '@/types/workout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import { calculateOneRepMax, calculateSetTonnage, formatWeight } from '@/utils/fitness';

export const WorkoutsPage: React.FC = () => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [exerciseType, setExerciseType] = useState<'bench_press' | 'squats' | 'deadlift' | 'cardio'>('bench_press');
  const [weight, setWeight] = useState<string>('100');
  const [sets, setSets] = useState<string>('5');
  const [reps, setReps] = useState<string>('5');
  const [rpe, setRpe] = useState<string>('8');
  const [distanceKm, setDistanceKm] = useState<string>('5');
  const [durationMinutes, setDurationMinutes] = useState<string>('25');

  const fetchWorkouts = async () => {
    try {
      setIsLoading(true);
      const data = await workoutsApi.list();
      setWorkouts(data);
    } catch {
      // Keep empty if failed
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      let metrics: WorkoutMetrics;

      if (exerciseType === 'bench_press') {
        metrics = {
          exercise_type: 'bench_press',
          weight: parseFloat(weight),
          sets: parseInt(sets, 10),
          reps: parseInt(reps, 10),
          rpe: rpe ? parseFloat(rpe) : undefined,
        };
      } else if (exerciseType === 'squats') {
        metrics = {
          exercise_type: 'squats',
          weight: parseFloat(weight),
          sets: parseInt(sets, 10),
          reps: parseInt(reps, 10),
          rpe: rpe ? parseFloat(rpe) : undefined,
          stance: 'medium',
        };
      } else if (exerciseType === 'deadlift') {
        metrics = {
          exercise_type: 'deadlift',
          weight: parseFloat(weight),
          sets: parseInt(sets, 10),
          reps: parseInt(reps, 10),
          rpe: rpe ? parseFloat(rpe) : undefined,
          deadlift_style: 'conventional',
        };
      } else {
        metrics = {
          exercise_type: 'cardio',
          exercise_name: 'Cardio Run',
          distance_km: parseFloat(distanceKm),
          duration_minutes: parseFloat(durationMinutes),
        };
      }

      const payload: WorkoutCreate = {
        type: exerciseType,
        metrics,
        date: new Date().toISOString(),
      };

      await workoutsApi.create(payload);
      setIsModalOpen(false);
      await fetchWorkouts();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Failed to create workout');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this workout record?')) {
      return;
    }
    try {
      await workoutsApi.delete(id);
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      alert('Failed to delete workout record.');
    }
  };

  const filteredWorkouts = workouts.filter((w) => {
    if (selectedFilter === 'all') return true;
    const t = (w.type || w.metrics.exercise_type).toLowerCase();
    if (selectedFilter === 'bench_press') return t.includes('bench');
    if (selectedFilter === 'squat') return t.includes('squat');
    if (selectedFilter === 'deadlift') return t.includes('deadlift');
    if (selectedFilter === 'cardio') return t.includes('cardio') || t.includes('treadmill') || t.includes('run');
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Workouts Journal</h1>
          <p className="text-xs text-zinc-400">Log, review, and analyze your training sessions</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} variant="primary" size="md">
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Log Workout</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mr-2">
          <Filter className="w-3.5 h-3.5" />
          <span>Filter:</span>
        </div>
        {[
          { id: 'all', label: 'All Lifts' },
          { id: 'bench_press', label: 'Bench Press' },
          { id: 'squat', label: 'Squats' },
          { id: 'deadlift', label: 'Deadlift' },
          { id: 'cardio', label: 'Cardio' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedFilter === tab.id
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Workouts Grid */}
      {isLoading ? (
        <Loader text="Loading workout journal..." />
      ) : filteredWorkouts.length === 0 ? (
        <Card className="border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Dumbbell className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-white">No workouts found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1 mb-4">
            {selectedFilter === 'all'
              ? 'No workouts logged yet. Start crushing reps today!'
              : `No workouts found matching category "${selectedFilter}".`}
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="primary" size="sm">
            <Plus className="w-4 h-4 mr-1" />
            <span>Record Workout</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkouts.map((workout) => {
            const isStrength = 'weight' in workout.metrics && 'sets' in workout.metrics && 'reps' in workout.metrics;
            const tonnage = isStrength
              ? calculateSetTonnage(
                  (workout.metrics as { weight: number }).weight,
                  (workout.metrics as { sets: number }).sets,
                  (workout.metrics as { reps: number }).reps
                )
              : null;
            const oneRepMax = isStrength
              ? calculateOneRepMax(
                  (workout.metrics as { weight: number }).weight,
                  (workout.metrics as { reps: number }).reps
                )
              : null;

            return (
              <Card key={workout.id} className="border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="accent" size="sm">
                      {workout.type || workout.metrics.exercise_type}
                    </Badge>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded-md transition-colors"
                      title="Delete workout"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <CardTitle className="text-base capitalize mt-2">
                    {(workout.type || workout.metrics.exercise_type).replace('_', ' ')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isStrength ? (
                    <>
                      <div className="rounded-lg bg-zinc-950/60 p-3 flex justify-between items-center text-sm">
                        <span className="text-zinc-400 text-xs">Work Sets</span>
                        <span className="font-bold text-white font-mono">
                          {(workout.metrics as { sets: number }).sets} × {(workout.metrics as { reps: number }).reps} @ {(workout.metrics as { weight: number }).weight} kg
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-zinc-950/40 p-2.5">
                          <span className="text-zinc-500 block mb-0.5">Tonnage</span>
                          <span className="font-bold text-red-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 inline" />
                            {formatWeight(tonnage || 0)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-zinc-950/40 p-2.5">
                          <span className="text-zinc-500 block mb-0.5">Estimated 1RM</span>
                          <span className="font-bold text-amber-400">{oneRepMax} kg</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg bg-zinc-950/60 p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Distance</span>
                        <span className="font-bold text-white">
                          {'distance_km' in workout.metrics ? (workout.metrics as { distance_km: number }).distance_km : 0} km
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Duration</span>
                        <span className="font-bold text-white">
                          {'duration_minutes' in workout.metrics ? (workout.metrics as { duration_minutes: number }).duration_minutes : 0} min
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(workout.date || workout.created_at).toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Log Workout Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Workout Session"
        description="Enter telemetry for your completed lift or cardio"
      >
        <form onSubmit={handleCreateWorkout} className="space-y-4 mt-2">
          {formError && (
            <div className="p-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg">
              {formError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Exercise Type
            </label>
            <select
              value={exerciseType}
              onChange={(e) =>
                setExerciseType(e.target.value as 'bench_press' | 'squats' | 'deadlift' | 'cardio')
              }
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-zinc-900 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="bench_press">Bench Press</option>
              <option value="squats">Squats</option>
              <option value="deadlift">Deadlift</option>
              <option value="cardio">Cardio / Treadmill</option>
            </select>
          </div>

          {exerciseType !== 'cardio' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Weight (kg)"
                type="number"
                step="0.5"
                min="1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
              <Input
                label="Sets"
                type="number"
                min="1"
                value={sets}
                onChange={(e) => setSets(e.target.value)}
                required
              />
              <Input
                label="Reps per Set"
                type="number"
                min="1"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                required
              />
              <Input
                label="RPE (1-10)"
                type="number"
                min="1"
                max="10"
                step="0.5"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Distance (km)"
                type="number"
                step="0.1"
                min="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                required
              />
              <Input
                label="Duration (min)"
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Workout
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorkoutsPage;

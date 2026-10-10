import React from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, Home, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-4 text-center">
      <div className="max-w-md space-y-6">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
          <Dumbbell className="h-10 w-10 rotate-45" />
        </div>

        <div className="space-y-2">
          <h1 className="text-6xl font-black text-amber-500 tracking-tighter">404</h1>
          <h2 className="text-2xl font-bold text-white tracking-wide uppercase">
            Lift Out Of Bounds
          </h2>
          <p className="text-sm text-zinc-400">
            The page you are looking for has been dropped. Even the strongest deadlifter cannot pull
            this resource back.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <Link to="/dashboard">
            <Button variant="primary" size="md">
              <Home className="w-4 h-4 mr-1.5" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors px-3 py-2"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

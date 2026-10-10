import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Trophy, TrendingUp, User } from 'lucide-react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useLocaleStore } from '@/store/useLocaleStore';
import { cn } from '@/utils/cn';

export const MainLayout: React.FC = () => {
  const { t } = useLocaleStore();

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <Navbar />

      <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-3 py-2 flex items-center justify-around">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            )
          }
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>{t('nav.dashboard')}</span>
        </NavLink>
        <NavLink
          to="/workouts"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            )
          }
        >
          <Dumbbell className="w-4 h-4" />
          <span>{t('nav.workouts')}</span>
        </NavLink>
        <NavLink
          to="/leaderboard"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            )
          }
        >
          <Trophy className="w-4 h-4" />
          <span>{t('nav.leaderboard')}</span>
        </NavLink>
        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            )
          }
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t('nav.analytics')}</span>
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-2 rounded-lg transition-colors',
              isActive ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
            )
          }
        >
          <User className="w-4 h-4" />
          <span>{t('nav.profile')}</span>
        </NavLink>
      </nav>

      {/* Footer */}
      <footer className="hidden md:block border-t border-zinc-900 bg-zinc-950 px-6 py-4 text-center text-xs text-zinc-500">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <p>© 2026 IronTracker. Hardcore Microservice Telemetry Platform.</p>
          <p className="font-mono text-zinc-600">v1.1.0 • Node 20 / React 18 / Zustand</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;

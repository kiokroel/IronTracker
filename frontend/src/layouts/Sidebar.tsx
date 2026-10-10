import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Trophy, User, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Workouts', to: '/workouts', icon: Dumbbell },
  { label: 'Leaderboard', to: '/leaderboard', icon: Trophy },
  { label: 'Profile', to: '/profile', icon: User },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800 bg-zinc-950/60 p-4 flex flex-col justify-between hidden md:flex">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            Platform Menu
          </p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 border border-transparent'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
          <ShieldCheck className="w-4 h-4" />
          <span>Iron Protocol</span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
          Zero shortcuts. Every rep verified via microservice telemetry.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, LogOut, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 transition-colors group-hover:bg-amber-500 group-hover:text-zinc-950">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="text-lg font-black tracking-wider text-white">
              IRON<span className="text-amber-500">TRACKER</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <Link
              to="/profile"
              title="Личный кабинет / Профиль"
              className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 hover:bg-zinc-800 hover:border-amber-500/50 hover:text-white transition-all cursor-pointer group"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold text-zinc-200 group-hover:text-amber-400 transition-colors hidden sm:inline">
                {user.username}
              </span>
              <span className="text-zinc-500 hidden md:inline">({user.email})</span>
              <span className="hidden sm:inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5 ml-0.5 group-hover:bg-amber-500 group-hover:text-zinc-950 transition-colors">
                Профиль
              </span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

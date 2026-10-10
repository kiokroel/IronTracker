import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User as UserIcon,
  Mail,
  Calendar,
  Key,
  Shield,
  LogOut,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

export const ProfilePage: React.FC = () => {
  const { user, setUser, logout } = useAuthStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (username.trim().length < 2) {
      setProfileError('Имя атлета должно содержать минимум 2 символа.');
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const updatedUser = await authApi.updateMe({ username: username.trim() });
      setUser(updatedUser);
      setProfileSuccess('Профиль успешно обновлен!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setProfileError(err.message);
      } else {
        setProfileError('Не удалось обновить профиль.');
      }
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('Пароль должен содержать минимум 6 символов.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Пароли не совпадают.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      await authApi.updateMe({ password: newPassword });
      setPasswordSuccess('Пароль успешно изменен!');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Не удалось изменить пароль.');
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Вы действительно хотите выйти из системы?')) {
      logout();
      navigate('/login');
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.length > 0) {
      return name.slice(0, 2).toUpperCase();
    }
    if (email && email.length > 0) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'IT';
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Не указана';
    try {
      return new Date(isoString).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black tracking-wider text-white uppercase">
          Профиль <span className="text-amber-500">Атлета</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Управление учетными данными спортсмена и безопасность аккаунта
        </p>
      </div>

      {/* Athlete Overview Card */}
      <Card className="border-zinc-800 bg-zinc-900/60 overflow-hidden relative">
        <div className="absolute top-0 right-0 h-32 w-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="h-20 w-20 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-500 font-black text-2xl tracking-wider shrink-0 shadow-lg shadow-amber-500/5">
              {getInitials(user?.username, user?.email)}
            </div>

            {/* Info details */}
            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <h2 className="text-xl font-bold text-white">{user?.username || 'Спортсмен'}</h2>
                <Badge variant="accent">Активный атлет</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-zinc-400">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Mail className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>{user?.email}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span>Регистрация: {formatDate(user?.created_at)}</span>
                </div>
              </div>

              {/* User ID with Copy */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-zinc-500 font-mono">
                <span>ID: {user?.id}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 hover:text-amber-400 transition-colors rounded"
                  title="Скопировать ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Logout button */}
            <div className="shrink-0 self-center sm:self-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                <span>Выйти</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <UserIcon className="w-4 h-4" />
              <span>Данные профиля</span>
            </div>
            <CardTitle className="text-lg">Основная информация</CardTitle>
            <CardDescription>Изменение отображаемого имени спортсмена в рейтингах</CardDescription>
          </CardHeader>

          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-4">
              {profileSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <Input
                label="Имя атлета (Username)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Новое имя"
                required
              />

              <Input
                label="Email"
                value={user?.email || ''}
                disabled
                helperText="Email привязан к аккаунту и не подлежит изменению."
              />

              <div className="pt-2">
                <Button type="submit" size="md" isLoading={isUpdatingProfile} className="gap-2">
                  <Save className="w-4 h-4" />
                  <span>Сохранить изменения</span>
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>

        {/* Security Settings */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm">
              <Shield className="w-4 h-4" />
              <span>Безопасность</span>
            </div>
            <CardTitle className="text-lg">Смена пароля</CardTitle>
            <CardDescription>Обновление пароля доступа к тренировочной платформе</CardDescription>
          </CardHeader>

          <form onSubmit={handleUpdatePassword}>
            <CardContent className="space-y-4">
              {passwordSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <Input
                label="Новый пароль"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                required
              />

              <Input
                label="Подтверждение нового пароля"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                required
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  isLoading={isUpdatingPassword}
                  className="gap-2 text-zinc-100 hover:text-white"
                >
                  <Key className="w-4 h-4" />
                  <span>Обновить пароль</span>
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;

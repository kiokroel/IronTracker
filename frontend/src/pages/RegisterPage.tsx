import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, AlertCircle, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !username.trim() || !password) {
      setFormError('Все поля обязательны для заполнения.');
      return;
    }

    if (username.trim().length < 2) {
      setFormError('Имя атлета должно содержать не менее 2 символов.');
      return;
    }

    if (password.length < 6) {
      setFormError('Пароль должен содержать не менее 6 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Пароли не совпадают.');
      return;
    }

    try {
      await register({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      navigate('/dashboard', { replace: true });
    } catch {
      // Error is set in store
    }
  };

  const displayedError = formError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mb-2">
            <Dumbbell className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white">
            JOIN <span className="text-amber-500">IRONTRACKER</span>
          </h1>
          <p className="text-sm text-zinc-400">Регистрация профиля спортсмена</p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle>Создание профиля атлета</CardTitle>
            <CardDescription>Заполните форму для фиксации тренировочных показателей</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {displayedError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{displayedError}</span>
                </div>
              )}

              <Input
                label="Имя атлета (Username)"
                placeholder="IronLifter"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />

              <Input
                label="Email"
                type="email"
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label="Пароль"
                type={showPassword ? 'text' : 'password'}
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <Input
                label="Подтверждение пароля"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                error={passwordsMismatch ? 'Пароли не совпадают' : undefined}
                helperText={passwordsMatch ? 'Пароли совпадают' : undefined}
                rightElement={
                  <div className="flex items-center gap-1.5">
                    {passwordsMatch && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                }
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                <span>Создать аккаунт</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <p className="text-center text-xs text-zinc-400">
                Уже зарегистрированы?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Войти
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;

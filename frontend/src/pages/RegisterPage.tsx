import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dumbbell, AlertCircle, ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useLocaleStore } from '@/store/useLocaleStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, isLoading, error: authError } = useAuthStore();
  const { t } = useLocaleStore();

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
      setFormError(t('auth.allFieldsRequired'));
      return;
    }

    if (username.trim().length < 2) {
      setFormError(t('auth.usernameMinLength'));
      return;
    }

    if (password.length < 6) {
      setFormError(t('auth.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('auth.passwordsMismatch'));
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
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 p-4 sm:p-6">
      {/* Top right language switch */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <LanguageSwitcher variant="pill" />
      </div>

      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mb-2">
            <Dumbbell className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white">
            JOIN <span className="text-amber-500">IRONTRACKER</span>
          </h1>
          <p className="text-sm text-zinc-400">{t('auth.registerHeader')}</p>
        </div>

        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle>{t('auth.registerTitle')}</CardTitle>
            <CardDescription>{t('auth.registerDesc')}</CardDescription>
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
                label={t('auth.username')}
                placeholder="IronLifter"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />

              <Input
                label={t('auth.email')}
                type="email"
                placeholder="athlete@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label={t('auth.password')}
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
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              <Input
                label={t('auth.confirmPassword')}
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Повторите пароль"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                error={passwordsMismatch ? t('auth.passwordsMismatch') : undefined}
                helperText={passwordsMatch ? t('auth.passwordsMatch') : undefined}
                rightElement={
                  <div className="flex items-center gap-1.5">
                    {passwordsMatch && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-zinc-500 hover:text-zinc-300 focus:outline-none transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                }
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                <span>{t('auth.registerButton')}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <p className="text-center text-xs text-zinc-400">
                {t('auth.alreadyRegistered')}{' '}
                <Link
                  to="/login"
                  className="font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {t('auth.signInLink')}
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

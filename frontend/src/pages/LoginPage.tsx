import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Dumbbell, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error: authError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!email.trim() || !password.trim()) {
      setFormError('Please provide both email and password.');
      return;
    }

    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch {
      // Error handled and set in store
    }
  };

  const fillDemo = () => {
    setEmail('athlete@irontracker.io');
    setPassword('IronLifter123!');
    setFormError(null);
  };

  const displayedError = formError || authError;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mb-2">
            <Dumbbell className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white">
            IRON<span className="text-amber-500">TRACKER</span>
          </h1>
          <p className="text-sm text-zinc-400">Sign in to access your workout telemetry</p>
        </div>

        {/* Login Card */}
        <Card className="border-zinc-800 bg-zinc-900/90 shadow-2xl">
          <CardHeader>
            <CardTitle>Athlete Login</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
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
                label="Email"
                type="email"
                placeholder="athlete@irontracker.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={fillDemo}
                  className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors"
                >
                  Fill demo credentials
                </button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <p className="text-center text-xs text-zinc-400">
                New athlete?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Create an account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Sparkles } from 'lucide-react';
import Logo from '../components/common/Logo';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { redirectTo } = await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(t('auth.invalidCredentials'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="hidden overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 p-10 text-white shadow-soft lg:block">
          <div className="flex h-full flex-col justify-between gap-10">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-400/10 px-4 py-2 text-sm text-white">
                <Sparkles size={16} />
                {t('common.audioToMedicalReports')}
              </div>
              <h2 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-white">
                {t('auth.welcomeBack')}
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-8 text-white/90">
                Centralized consultation workflows, transcription review, and report generation in one calm workspace.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-5">
                <p className="text-sm text-white/80">Faster reporting</p>
                <p className="mt-2 text-2xl font-bold">AI-assisted</p>
              </div>
              <div className="rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-5">
                <p className="text-sm text-white/80">Secure access</p>
                <p className="mt-2 text-2xl font-bold">Role aware</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="page-card overflow-hidden p-8 sm:p-10">
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <Logo />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{t('auth.welcomeBack')}</h1>
              <p className="mt-2 text-slate-600">{t('auth.signInToAccount')}</p>
            </div>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-error-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span className="text-sm leading-6">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className="px-4"
                  required
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                    {t('auth.password')}
                  </label>
                  <a href="#forgot" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="px-4"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600">
              <p>
                If you don't have an account, please register{' '}
                <Link to="/register" className="font-semibold text-primary-600 hover:text-primary-700">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
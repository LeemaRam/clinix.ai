import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Sparkles } from 'lucide-react';
import Logo from '../components/common/Logo';
import { useTranslation } from 'react-i18next';

const Register = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        full_name: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { register, loading } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            return setError(t('auth.passwordsDoNotMatch'));
        }

        if (!formData.full_name) {
            return setError(t('auth.fullNameRequired'));
        }

        try {
            await register({
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                full_name: formData.full_name.trim()
            });
            navigate('/patients');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auth.registrationFailed'));
        }
    };

    return (
        <div className="min-h-screen bg-transparent px-4 py-10 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 p-10 text-white shadow-soft">
                    <div className="flex h-full flex-col justify-between gap-10">
                        <div>
                            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-400/10 px-4 py-2 text-sm text-white">
                                <Sparkles size={16} />
                                {t('auth.startMedicalTranscriptionJourney')}
                            </div>
                            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-white">{t('auth.createAccount')}</h1>
                            <p className="mt-4 max-w-lg text-lg leading-8 text-white/90">
                                Join a structured clinical workspace built for transcription review, reporting, and subscription management.
                            </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-5">
                                <p className="text-sm text-white/80">Centralized workflow</p>
                                <p className="mt-2 text-2xl font-bold">One platform</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-200/25 bg-emerald-400/10 p-5">
                                <p className="text-sm text-white/80">Built for clinicians</p>
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
                            <h2 className="text-3xl font-bold text-slate-900">{t('auth.createAccount')}</h2>
                            <p className="mt-2 text-slate-600">{t('auth.startMedicalTranscriptionJourney')}</p>
                        </div>

                        {error && (
                            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-error-700">
                                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                <span className="text-sm leading-6">{error}</span>
                            </div>
                        )}

                        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="full_name" className="mb-2 block text-sm font-semibold text-slate-700">
                                    {t('auth.fullName')}
                                </label>
                                <input
                                    id="full_name"
                                    name="full_name"
                                    type="text"
                                    required
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    className="px-4"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                                    {t('auth.email')}
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="px-4"
                                />
                            </div>

                            <div>
                                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-700">
                                    {t('auth.password')}
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="px-4"
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
                                    {t('auth.confirmPassword')}
                                </label>
                                <input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    autoComplete="new-password"
                                    required
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="px-4"
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-slate-600">
                            <p>
                                {t('auth.alreadyHaveAccount')}{' '}
                                <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                                    {t('auth.login')}
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register; 
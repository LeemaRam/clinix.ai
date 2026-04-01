import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, User, Mail, Lock } from 'lucide-react';
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
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { register } = useAuth();

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
                email: formData.email,
                password: formData.password,
                full_name: formData.full_name
            });
            navigate('/patients');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('auth.registrationFailed'));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Logo />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">{t('auth.createAccount')}</h1>
                    <p className="text-gray-600">{t('auth.startMedicalTranscriptionJourney')}</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center">
                        <AlertCircle size={18} className="mr-2" />
                        <span>{error}</span>
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('auth.fullName')}
                        </label>
                        <div className="relative">
                            <input
                                id="full_name"
                                name="full_name"
                                type="text"
                                required
                                value={formData.full_name}
                                onChange={handleChange}
                                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <User className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('auth.email')}
                        </label>
                        <div className="relative">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('auth.password')}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                            {t('auth.confirmPassword')}
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                            />
                            <Lock className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 px-4 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        {t('auth.alreadyHaveAccount')}{' '}
                        <Link to="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">
                            {t('auth.login')}
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register; 
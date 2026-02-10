import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
    const [isJudgeLogin, setIsJudgeLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { loginAdmin, loginWithCode } = useAuth();
    const navigate = useNavigate();

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await loginAdmin(email, password);
            navigate('/admin/dashboard');
        } catch (err: any) {
            setError(err.message || 'Failed to login as admin');
        } finally {
            setLoading(false);
        }
    };

    const handleCodeLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const role = await loginWithCode(code);
            if (role === 'judge') {
                navigate('/judge/dashboard');
            } else if (role === 'committee') {
                navigate('/committee/dashboard');
            } else {
                navigate('/');
            }
        } catch (err: any) {
            setError(err.message || 'Invalid access code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Tabulate
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Real-time Event Tabulation System
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <div className="mb-6 flex space-x-2 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setIsJudgeLogin(true)}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isJudgeLogin ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Judge / Committee
                        </button>
                        <button
                            onClick={() => setIsJudgeLogin(false)}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isJudgeLogin ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Admin
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {isJudgeLogin ? (
                        <form onSubmit={handleCodeLogin} className="space-y-6">
                            <Input
                                label="Access Code"
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="Enter 8-character code"
                                maxLength={8}
                                required
                            />
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Verifying...' : 'Enter Event'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleAdminLogin} className="space-y-6">
                            <Input
                                label="Email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <Input
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

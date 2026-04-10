import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SignupPage.css';

import InputField from '../components/InputField';
import PasswordField from '../components/PasswordField';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await loginUser(email, password, rememberMe);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div 
            className="auth-split-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="auth-left">
                <motion.div 
                    className="auth-left-content"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="auth-logo-large">🛍️</div>
                    <h2 className="auth-left-title">Welcome Back</h2>
                    <p className="auth-left-desc">Sign in to orchestrate your personalized shopping journey today.</p>
                </motion.div>
                <div className="auth-left-bg-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-container animate-in">
                    <div className="auth-header">
                        <Link to="/" className="auth-back-link">← Back to Store</Link>
                        <h1 className="auth-title">Sign In</h1>
                        <p className="auth-subtitle">Access your SmartCommerceAI account</p>
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div 
                                className="auth-error" 
                                id="login-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0, x: [-10, 10, -10, 10, 0] }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <span>⚠️</span> {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="auth-form" id="login-form">
                        <InputField
                            label="Email Address"
                            icon={Mail}
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoFocus
                        />

                        <div className="premium-form-group">
                            <PasswordField
                                label="Password"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={rememberMe} 
                                        onChange={(e) => setRememberMe(e.target.checked)} 
                                        style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    Remember me
                                </label>
                                <Link to="/forgot-password" className="auth-link" style={{ fontSize: '13px', fontWeight: 500 }}>
                                    Forgot password?
                                </Link>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading || !email || !password}
                            id="login-submit-btn"
                        >
                            {loading ? <span className="btn-spinner"></span> : 'Sign In'}
                        </motion.button>
                    </form>

                    <div className="auth-footer">
                        Don't have an account?{' '}
                        <Link to="/signup" className="auth-link" id="go-to-signup">
                            Create one now
                        </Link>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

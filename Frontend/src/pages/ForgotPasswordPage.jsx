import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BACKEND_URL from '../config';
import './SignupPage.css';

import InputField from '../components/InputField';
import PasswordField from '../components/PasswordField';
import OTPInput from '../components/OTPInput';

export default function ForgotPasswordPage() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    const navigate = useNavigate();

    const passwordRules = {
        length: password.length >= 6,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*]/.test(password),
    };

    const isMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

    // Mocks for API
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        // Mock API call
        setTimeout(() => {
            setLoading(false);
            if(email === 'fail@test.com') setError('Email not found.');
            else setStep(2);
        }, 1200);
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        // Mock API call
        setTimeout(() => {
            setLoading(false);
            if(otp !== '123456') setError('Invalid OTP code. Try 123456.');
            else {
                setSuccess('OTP verified successfully.');
                setTimeout(() => setStep(3), 800);
            }
        }, 1200);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        setTimeout(() => {
            setLoading(false);
            setSuccess('Password completely reset! You may now sign in.');
            setTimeout(() => navigate('/login'), 2500);
        }, 1200);
    };

    const pageTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', stiffness: 300, damping: 30 }
    };

    return (
        <motion.div 
            className="auth-split-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="auth-left">
                <motion.div className="auth-left-content" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                    <div className="auth-logo-large">🛍️</div>
                    <h2 className="auth-left-title">Secure Account Recovery</h2>
                    <p className="auth-left-desc">Regain access to your intelligent e-commerce dashboard securely in just a few steps.</p>
                </motion.div>
                <div className="auth-left-bg-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-container">
                    <div className="auth-header">
                        <Link to="/login" className="auth-back-link">← Back to Log In</Link>
                        
                        {/* Step Indicator */}
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
                            {[1, 2, 3].map(i => (
                                <motion.div 
                                    key={i}
                                    animate={{ 
                                        backgroundColor: step >= i ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                        width: step === i ? '24px' : '8px'
                                    }}
                                    style={{ height: '8px', borderRadius: '4px' }}
                                />
                            ))}
                        </div>

                        <h1 className="auth-title">
                            {step === 1 ? 'Forgot Password' : step === 2 ? 'Verify Email' : 'Set New Password'}
                        </h1>
                        <p className="auth-subtitle">
                            {step === 1 ? "Enter your email and we'll send you an OTP." : 
                             step === 2 ? `Enter the 6-digit code sent to ${email}` : 
                             "Create a robust replacement password."}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div 
                                key="error"
                                className="auth-error"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0, x: [-10, 10, -10, 10, 0] }}
                                exit={{ opacity: 0 }}
                            >
                                <span>⚠️</span> {error}
                            </motion.div>
                        )}
                        {success && (
                            <motion.div 
                                key="success"
                                className="auth-success"
                                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {success}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.form key="step1" onSubmit={handleSendOTP} className="auth-form" {...pageTransition}>
                                <InputField
                                    label="Email Address"
                                    icon={Mail}
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={loading || !email}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Send OTP Code'}
                                </motion.button>
                            </motion.form>
                        )}

                        {step === 2 && (
                            <motion.form key="step2" onSubmit={handleVerifyOTP} className="auth-form" {...pageTransition}>
                                <div className="premium-form-group">
                                    <OTPInput length={6} value={otp} onChange={setOtp} isError={!!error} />
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={loading || otp.length !== 6}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Verify Code'}
                                </motion.button>
                                <button type="button" className="resend-link" onClick={() => setStep(1)}>
                                    Change Email Address
                                </button>
                            </motion.form>
                        )}

                        {step === 3 && (
                            <motion.form key="step3" onSubmit={handleResetPassword} className="auth-form" {...pageTransition}>
                                <PasswordField
                                    label="New Password"
                                    placeholder="Enter new password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <PasswordField
                                    label="Confirm New Password"
                                    placeholder="Repeat password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                
                                <div className="password-rules">
                                    {[
                                        [passwordRules.length, 'Minimum 6 characters'],
                                        [passwordRules.uppercase, '1 uppercase letter'],
                                        [passwordRules.number, '1 number'],
                                        [passwordRules.special, '1 special character'],
                                        [isMatch, 'Passwords match']
                                    ].map(([valid, label], i) => (
                                        <motion.p 
                                            key={i} 
                                            className={`rule ${valid ? 'valid' : 'invalid'}`}
                                            animate={{ color: valid ? 'var(--success)' : 'var(--text-muted)' }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <motion.span 
                                                initial={false}
                                                animate={{ scale: valid ? [1, 1.5, 1] : 1 }}
                                                transition={{ duration: 0.4 }}
                                            >
                                                {valid ? '✅' : '○'}
                                            </motion.span>
                                            {' '}{label}
                                        </motion.p>
                                    ))}
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={loading || !Object.values(passwordRules).every(Boolean) || !isMatch}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Reset Password'}
                                </motion.button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}

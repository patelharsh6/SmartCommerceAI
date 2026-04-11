import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

// Assuming these are your local files/components
import './SignupPage.css';
import InputField from '../components/InputField';
import PasswordField from '../components/PasswordField';

// Placeholder for OTPInput if it's a custom component
// If you don't have one, replace with a standard input
const OTPInput = ({ length, value, onChange, isError }) => (
    <input
        className={`otp-input ${isError ? 'error' : ''}`}
        maxLength={length}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '24px' }}
    />
);

export default function LoginPage() {
    // --- State Management ---
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 = Login, 2 = OTP
    const [timer, setTimer] = useState(30);

    const { loginUser } = useAuth(); // From your AuthContext
    const navigate = useNavigate();

    const pageTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    // --- Effects ---

    // Timer for Resend OTP
    useEffect(() => {
        let interval;
        if (step === 2 && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [step, timer]);

    // Mask OTP after 1.5 seconds of completion
    useEffect(() => {
        if (otp.length === 6 && !otp.includes('*')) {
            const maskTimer = setTimeout(() => {
                setOtp("*".repeat(6));
            }, 1500);
            return () => clearTimeout(maskTimer);
        }
    }, [otp]);

    // --- Handlers ---

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await loginUser(email, password);
            navigate('/');
        } catch (err) {
            const msg = err.message || "Something went wrong";

            if (msg === "Please verify your email first" || msg.includes("verify")) {
                setStep(2);
                setTimer(30); // Start resend timer
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await api.verifyOTP(email, otp);

            // Auto-login after successful verification
            await loginUser(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message || "OTP verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        try {
            setResendLoading(true);
            await api.resendOTP(email);
            setTimer(30); // Reset timer
            setError(""); // Clear old errors
        } catch (err) {
            setError(err.message || "Failed to resend OTP");
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <motion.div 
            className="auth-split-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            {/* Left Side: Branding */}
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

            {/* Right Side: Form Content */}
            <div className="auth-right">
                <div className="auth-container animate-in">
                    <div className="auth-header">
                        <Link to="/" className="auth-back-link">← Back to Store</Link>
                        <h1 className="auth-title">{step === 1 ? 'Sign In' : 'Verify Email'}</h1>
                        <p className="auth-subtitle">
                            {step === 1 ? 'Access your SmartCommerceAI account' : `Code sent to ${email}`}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div 
                                className="auth-error" 
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0, x: [-10, 10, -10, 10, 0] }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                                style={{
                                    background: '#fef2f2',
                                    border: '1px solid #f87171',
                                    color: '#b91c1c',
                                    borderRadius: '8px',
                                    padding: '12px 16px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '24px'
                                }}
                            >
                                <span style={{ fontSize: '18px' }}>⚠️</span> {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                        {step === 1 ? (
                            <motion.form 
                                key="login-form"
                                onSubmit={handleLoginSubmit} 
                                className="auth-form"
                                {...pageTransition}
                            >
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
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'gray' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={rememberMe} 
                                                onChange={(e) => setRememberMe(e.target.checked)} 
                                            />
                                            Remember me
                                        </label>
                                        <Link to="/forgot-password" style={{ fontSize: '13px', fontWeight: 500 }}>
                                            Forgot password?
                                        </Link>
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={!loading && email && password ? { scale: 1.02, boxShadow: '0 8px 16px rgba(0,0,0,0.1)' } : {}}
                                    whileTap={!loading && email && password ? { scale: 0.98 } : {}}
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={loading || !email || !password}
                                    style={{
                                        background: loading || !email || !password 
                                            ? 'var(--border)' 
                                            : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                                        color: loading || !email || !password ? 'var(--text-muted)' : 'white',
                                        opacity: loading || !email || !password ? 0.7 : 1,
                                    }}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Sign In'}
                                </motion.button>
                            </motion.form>
                        ) : (
                            <motion.form 
                                key="otp-form" 
                                onSubmit={handleOTPSubmit} 
                                className="auth-form" 
                                {...pageTransition}
                            >
                                <div className="premium-form-group">
                                    <label className="premium-form-label" style={{ textAlign: 'center', display: 'block', marginBottom: '1rem' }}>
                                        Secure Verification Code
                                    </label>
                                    <OTPInput 
                                        length={6} 
                                        value={otp} 
                                        onChange={setOtp} 
                                        isError={!!error} 
                                    />
                                </div>
                                
                                <motion.button 
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit" 
                                    className="auth-submit-btn" 
                                    disabled={loading || otp.length !== 6}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Verify & Continue'}
                                </motion.button>

                                <button
                                    type="button"
                                    className="resend-link"
                                    style={{ background: 'none', border: 'none', color: 'blue', cursor: 'pointer', marginTop: '15px' }}
                                    onClick={handleResendOTP}
                                    disabled={resendLoading || timer > 0}
                                >
                                    {resendLoading ? "Sending..." : timer > 0 ? `Resend in ${timer}s` : "Resend OTP Code"}
                                </button>

                                <button 
                                    type="button" 
                                    onClick={() => setStep(1)}
                                    style={{ display: 'block', margin: '10px auto', background: 'none', border: 'none', fontSize: '12px' }}
                                >
                                    Change Email / Back to Login
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
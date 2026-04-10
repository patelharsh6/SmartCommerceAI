import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import BACKEND_URL from '../config';

// Assuming these are your local files/components
import './SignupPage.css';
import InputField from '../components/InputField';
import PasswordField from '../components/PasswordField';
// Assuming you have an API config file, if not, replace with strings
const API = {
    LOGIN: BACKEND_URL + '/auth/login',
   VERIFY_OTP: BACKEND_URL + '/auth/verify-otp',
    RESEND_OTP: BACKEND_URL + '/auth/resend-otp'
};

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
            // Option A: Using your Context (if it handles the unverified error)
            // await loginUser(email, password, rememberMe);
            // navigate('/');

            // Option B: Direct Axios call for finer control over OTP step
            const res = await axios.post(API.LOGIN, { email, password });

            if (res.data.message === "Login successful") {
                // If your context has a login method to save the token/user
                // loginUser(res.data.user); 
                navigate('/');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;

            if (msg === "Please verify your email first") {
                setStep(2);
                setTimer(30); // Start resend timer
            } else {
                setError(msg || "Something went wrong");
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
            const res = await axios.post(API.VERIFY_OTP, { email, otp });

            if (res.data.message === "Email verified successfully") {
                // Auto-login after successful verification
                await loginUser(email, password, rememberMe);
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.message || "OTP verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        try {
            setResendLoading(true);
            await axios.post(API.RESEND_OTP, { email });
            setTimer(30); // Reset timer
            setError(""); // Clear old errors
        } catch (err) {
            setError(err.response?.data?.message || "Failed to resend OTP");
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
                            >
                                <span>⚠️</span> {error}
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
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    className="auth-submit-btn"
                                    disabled={loading || !email || !password}
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
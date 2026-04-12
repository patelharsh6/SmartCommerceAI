import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, ChevronLeft, ShieldCheck, Key, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import './SignupPage.css';

// ─── Premium Reusable UI Components ───

const PremiumInput = ({ icon: Icon, label, ...props }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {label && <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</label>}
        <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', pointerEvents: 'none', transition: 'color 0.2s', zIndex: 1 }}>
                <Icon size={18} />
            </div>
            <input
                {...props}
                style={{
                    width: '100%', padding: '14px 16px 14px 44px',
                    borderRadius: '12px', border: '1.5px solid rgba(0,0,0,0.08)',
                    background: 'var(--bg-primary)', fontSize: '15px', color: 'var(--text-primary)',
                    outline: 'none', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)', ...(props.style || {})
                }}
                onFocus={(e) => {
                    e.target.style.borderColor = 'var(--accent-primary)';
                    e.target.style.background = 'var(--bg-card)';
                    e.target.style.boxShadow = '0 0 0 4px var(--accent-glow)';
                    e.target.previousSibling.style.color = 'var(--accent-primary)';
                }}
                onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(0,0,0,0.08)';
                    e.target.style.background = 'var(--bg-primary)';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)';
                    e.target.previousSibling.style.color = '#9CA3AF';
                }}
            />
        </div>
    </div>
);

const PremiumOTPInput = ({ length, value, onChange }) => (
    <div style={{ marginBottom: '24px' }}>
        <input
            maxLength={length}
            value={value}
            placeholder="......"
            onChange={(e) => onChange(e.target.value)}
            style={{
                width: '100%', letterSpacing: '20px', fontSize: '28px', fontWeight: 800,
                textAlign: 'center', padding: '16px', borderRadius: '16px',
                border: '2px solid rgba(0,0,0,0.08)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', outline: 'none', transition: 'all 0.3s ease',
                fontFamily: 'monospace'
            }}
            onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-primary)';
                e.target.style.boxShadow = '0 0 0 4px var(--accent-glow)';
                e.target.style.transform = 'translateY(-2px)';
            }}
            onBlur={(e) => {
                e.target.style.borderColor = 'rgba(0,0,0,0.08)';
                e.target.style.boxShadow = 'none';
                e.target.style.transform = 'none';
            }}
        />
    </div>
);

const GlassCard = ({ children, className }) => (
    <div className={className} style={{
        background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)',
        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: '0 24px 48px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.02)',
        padding: '48px', width: '100%', maxWidth: '440px', position: 'relative', overflow: 'hidden'
    }}>
        {/* Subtle inner highlight */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }} />
        {children}
    </div>
);

export default function LoginPage() {
    // ─── State ───
    const [view, setView] = useState('login'); // login | verify-otp | forgot | reset-otp | new-password | success
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Auth context
    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // ─── Handlers ───
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const ADMIN_EMAIL = "admin@gmail.com";
            const ADMIN_PASSWORD = "admin@1234";
            if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
                localStorage.setItem('role', 'admin');
                navigate('/admin');
                return;
            }
            await loginUser(email, password);
            localStorage.setItem('role', 'user');
            navigate('/');

        } catch (err) {
            const msg = err.message || "Invalid credentials.";
            if (msg.includes("verify") || msg.includes("OTP")) {
                setView('verify-otp');
                api.resendOTP(email).catch(() => { });
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await api.verifyOTP(email, otp);
            await loginUser(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message || 'Invalid code.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotRequest = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            // Simulate sending reset OTP (if backend supports, replace with actual call: api.requestPasswordReset(email))
            await api.resendOTP(email);
            setView('reset-otp');
        } catch (err) {
            setError(err.message || 'Failed to send reset code.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotVerify = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            if (otp.length !== 6) throw new Error('Code must be 6 digits');
            // Move to next step; validation happens on final submit.
            // (A dedicated check-otp endpoint could be added, but passing the OTP to the final reset handles security).
            setView('new-password');
        } catch (err) {
            setError(err.message || 'Invalid reset code format.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await api.resetPassword(email, otp, newPassword);
            setView('success');
        } catch (err) {
            setError(err.message || 'Failed to update password.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Animations ───
    const fadeVariants = {
        hidden: { opacity: 0, y: 15, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
        exit: { opacity: 0, y: -15, scale: 0.98, transition: { duration: 0.3 } }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>

            {/* ─── Premium Left Branding (Apple / Stripe inspired) ─── */}
            <div style={{
                flex: 1, position: 'relative', overflow: 'hidden', display: 'flex',
                flexDirection: 'column', justifyContent: 'center', padding: '60px',
                background: '#0A0A0A', color: 'white'
            }} className="auth-left-hide-mobile">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
                    {/* Beautiful background mesh gradient */}
                    <div style={{
                        position: 'absolute', top: '-20%', left: '-10%', width: '70%', height: '70%',
                        background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)'
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-20%', right: '-10%', width: '70%', height: '70%',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)'
                    }} />
                    {/* Animated grid lines */}
                    <div style={{
                        position: 'absolute', width: '200%', height: '200%',
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '40px 40px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
                    }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1, maxWidth: '440px' }}>
                    <div style={{
                        width: '48px', height: '48px', background: 'linear-gradient(135deg, #fff 0%, #a5b4fc 100%)',
                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px',
                        boxShadow: '0 0 20px rgba(165, 180, 252, 0.4)'
                    }}>
                        <span style={{ fontSize: '24px', color: '#000' }}>🛍️</span>
                    </div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '24px' }}
                    >
                        Welcome to the <br />Future of Retail.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        style={{ fontSize: '18px', color: '#9CA3AF', lineHeight: 1.6 }}
                    >
                        Sign in to access unparalleled AI-driven dynamic pricing, real-time analytics, and personalized shopping experiences.
                    </motion.p>
                </div>
            </div>

            {/* ─── Right Form Area ─── */}
            <div style={{ flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative' }}>
                <Link to="/" style={{ position: 'absolute', top: '40px', left: '40px', display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', textDecoration: 'none', fontSize: '14px', fontWeight: 600, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#111'} onMouseLeave={e => e.currentTarget.style.color = '#6B7280'}>
                    <ChevronLeft size={16} /> Back to Store
                </Link>

                <GlassCard>
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}
                            >
                                ⚠️ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">

                        {/* ════════════════════════════════════════════
                            VIEW 1: LOGIN 
                            ════════════════════════════════════════════ */}
                        {view === 'login' && (
                            <motion.form key="login" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleLogin}>
                                <div style={{ marginBottom: '32px' }}>
                                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Sign In</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px' }}>Enter your details to access your account.</p>
                                </div>

                                <PremiumInput icon={Mail} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />

                                <div style={{ position: 'relative' }}>
                                    <PremiumInput icon={Lock} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', marginTop: '-8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
                                        <input type="checkbox" style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }} /> Remember me
                                    </label>
                                    <button type="button" onClick={() => { setView('forgot'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                        Forgot password?
                                    </button>
                                </div>

                                <button type="submit" disabled={loading} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }} onMouseEnter={e => !loading && (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseLeave={e => !loading && (e.currentTarget.style.transform = 'none')}>
                                    {loading ? <span className="btn-spinner"></span> : 'Sign in securely'}
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
                                    Don't have an account? <Link to="/signup" style={{ color: '#111', fontWeight: 700, textDecoration: 'none' }}>Sign up</Link>
                                </div>
                            </motion.form>
                        )}


                        {/* ════════════════════════════════════════════
                            VIEW 2: FORGOT PASSWORD (EMAIL INPUT) 
                            ════════════════════════════════════════════ */}
                        {view === 'forgot' && (
                            <motion.form key="forgot" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleForgotRequest}>
                                <button type="button" onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', marginBottom: '24px', padding: 0, display: 'flex' }}><ChevronLeft size={20} /></button>

                                <div style={{ marginBottom: '32px' }}>
                                    <div style={{ width: '56px', height: '56px', background: 'var(--accent-glow)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: 'var(--accent-primary)' }}>
                                        <Key size={28} />
                                    </div>
                                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Reset password</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.5 }}>Enter the email address associated with your account and we'll send you a recovery code.</p>
                                </div>

                                <PremiumInput icon={Mail} type="email" placeholder="example@company.com" value={email} onChange={e => setEmail(e.target.value)} required />

                                <button type="submit" disabled={loading || !email} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                                    color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || !email) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: (loading || !email) ? 0.7 : 1,
                                    boxShadow: '0 8px 24px var(--accent-glow)'
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Send recovery code'}
                                </button>
                            </motion.form>
                        )}


                        {/* ════════════════════════════════════════════
                            VIEW 3: FORGOT PASSWORD (OTP INPUT) 
                            ════════════════════════════════════════════ */}
                        {view === 'reset-otp' && (
                            <motion.form key="reset-otp" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleForgotVerify}>
                                <button type="button" onClick={() => setView('forgot')} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', marginBottom: '24px', padding: 0, display: 'flex' }}><ChevronLeft size={20} /></button>

                                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                    <div style={{ width: '64px', height: '64px', background: 'var(--accent-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent-primary)' }}>
                                        <Mail size={30} />
                                    </div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Check your email</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.5 }}>We sent a 6-digit verification code to<br /><strong style={{ color: '#111' }}>{email}</strong></p>
                                </div>

                                <PremiumOTPInput length={6} value={otp} onChange={setOtp} />

                                <button type="submit" disabled={loading || otp.length !== 6} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Verify Code'}
                                </button>

                                <button type="button" onClick={() => api.resendOTP(email)} style={{ width: '100%', padding: '14px', marginTop: '12px', background: 'none', border: 'none', color: '#6B7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                                    Didn't receive it? <span style={{ color: 'var(--accent-primary)' }}>Resend code</span>
                                </button>
                            </motion.form>
                        )}


                        {/* ════════════════════════════════════════════
                            VIEW 4: NEW PASSWORD 
                            ════════════════════════════════════════════ */}
                        {view === 'new-password' && (
                            <motion.form key="new-password" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleResetPassword}>
                                <div style={{ marginBottom: '32px' }}>
                                    <div style={{ width: '56px', height: '56px', background: 'rgba(11, 184, 138, 0.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', color: '#0bb88a' }}>
                                        <ShieldCheck size={28} />
                                    </div>
                                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Set new password</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.5 }}>Your new password must be uniquely different from previously used passwords.</p>
                                </div>

                                <PremiumInput icon={Lock} type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />

                                <div style={{ background: '#F3F4F6', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password must contain:</p>
                                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#6B7280', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <li style={{ color: newPassword.length >= 8 ? '#0bb88a' : '#6B7280' }}>At least 8 characters</li>
                                        <li style={{ color: /[A-Z]/.test(newPassword) ? '#0bb88a' : '#6B7280' }}>At least 1 uppercase letter</li>
                                        <li style={{ color: /[0-9]/.test(newPassword) ? '#0bb88a' : '#6B7280' }}>At least 1 number</li>
                                    </ul>
                                </div>

                                <button type="submit" disabled={loading || newPassword.length < 8} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || newPassword.length < 8) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: (loading || newPassword.length < 8) ? 0.7 : 1
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Reset Password & Login'}
                                </button>
                            </motion.form>
                        )}


                        {/* ════════════════════════════════════════════
                            VIEW 5: SUCCESS 🎉 
                            ════════════════════════════════════════════ */}
                        {view === 'success' && (
                            <motion.div key="success" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" style={{ textAlign: 'center', padding: '20px 0' }}>
                                <motion.div
                                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.1 }}
                                    style={{ width: '80px', height: '80px', background: '#0bb88a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white' }}
                                >
                                    <CheckCircle size={40} />
                                </motion.div>
                                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '12px' }}>Password Reset!</h2>
                                <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: 1.5, marginBottom: '32px' }}>Your password has been successfully reset. You can now securely log into your account.</p>

                                <button onClick={() => { setView('login'); setPassword(''); setOtp(''); setNewPassword(''); }} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600, cursor: 'pointer'
                                }}>
                                    Continue to Login
                                </button>
                            </motion.div>
                        )}


                        {/* ════════════════════════════════════════════
                            VIEW 6: STANDARD OTP (For login verification)
                            ════════════════════════════════════════════ */}
                        {view === 'verify-otp' && (
                            <motion.form key="verify-otp" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleVerifyOtp}>
                                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                    <div style={{ width: '64px', height: '64px', background: 'var(--accent-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent-primary)' }}>
                                        <Mail size={30} />
                                    </div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Verify your email</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.5 }}>Please enter the code we sent to<br /><strong style={{ color: '#111' }}>{email}</strong></p>
                                </div>

                                <PremiumOTPInput length={6} value={otp} onChange={setOtp} />

                                <button type="submit" disabled={loading || otp.length !== 6} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Verify Code'}
                                </button>

                                <button type="button" onClick={() => setView('login')} style={{ width: '100%', padding: '14px', marginTop: '12px', background: 'none', border: 'none', color: '#6B7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                                    Back to Login
                                </button>
                            </motion.form>
                        )}

                    </AnimatePresence>
                </GlassCard>
            </div>

            {/* Inline CSS just for hiding the left side on small screens */}
            <style>{`
                @media (max-width: 900px) {
                    .auth-left-hide-mobile { display: none !important; }
                }
            `}</style>
        </div>
    );
}
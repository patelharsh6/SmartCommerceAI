import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, MapPin, ChevronLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import './SignupPage.css';

// ─── Premium Reusable UI Components ───

const PremiumInput = ({
    icon: Icon,
    label,
    isPassword = false,
    show = false,
    toggleVisibility = () => { },
    ...props
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>

        {label && (
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {label}
            </label>
        )}

        <div style={{ position: 'relative' }}>

            {/* LEFT ICON */}
            <div
                style={{
                    position: 'absolute',
                    left: '16px',
                    top: '57%',
                    transform: 'translateY(-50%)',
                    color: '#9CA3AF',
                    pointerEvents: 'none',
                    transition: 'color 0.2s',
                    zIndex: 1
                }}
            >
                <Icon size={18} />
            </div>

            {/* INPUT FIELD */}
            <input
                {...props}
                type={isPassword ? (show ? "text" : "password") : props.type}
                style={{
                    width: '100%',
                    padding: isPassword ? '14px 44px 14px 44px' : '14px 16px 14px 44px',
                    borderRadius: '12px',
                    border: '1.5px solid rgba(0,0,0,0.08)',
                    background: 'var(--bg-primary)',
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    ...(props.style || {})
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

            {/* 👁️ EYE ICON (ONLY FOR PASSWORD) */}
            {isPassword && (
                <div
                    onClick={toggleVisibility}
                    style={{
                        position: 'absolute',
                        right: '16px',
                        top: '57%',
                        transform: 'translateY(-50%)',
                        cursor: 'pointer',
                        color: '#9CA3AF',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#111'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </div>
            )}

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
        padding: '48px', width: '100%', maxWidth: '480px', position: 'relative', overflow: 'hidden'
    }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)' }} />
        {children}
    </div>
);

export default function SignupPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        address: '',
    });

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 = form, 2 = Verify OTP, 3 = Success
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();
    const { loginUser } = useAuth();

    const passwordRules = {
        length: formData.password.length >= 6,
        uppercase: /[A-Z]/.test(formData.password),
        lowercase: /[a-z]/.test(formData.password),
        number: /[0-9]/.test(formData.password),
        special: /[!@#$%^&*]/.test(formData.password),
    };

    const isMatch =
        formData.password.length > 0 &&
        formData.confirmPassword.length > 0 &&
        formData.password === formData.confirmPassword;

    const allRulesMet = Object.values(passwordRules).every(Boolean) && isMatch && formData.name && formData.email;

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!allRulesMet) {
            return setError('Please fill all required fields and match password requirements.');
        }

        setLoading(true);
        try {
            await api.signup(
                formData.name,
                formData.email,
                formData.password,
                formData.phone,
                formData.address
            );
            setStep(2);
        } catch (err) {
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.verifyOTP(formData.email, otp);
            await loginUser(formData.email, formData.password);

            setStep(3);
            setTimeout(() => navigate('/'), 2000); // Wait in success view before redirecting

        } catch (err) {
            setOtp('');
            setError(err.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        setResendLoading(true);

        try {
            await api.resendOTP(formData.email);
            setOtp('');
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.');
        } finally {
            setResendLoading(false);
        }
    };

    const fadeVariants = {
        hidden: { opacity: 0, y: 15, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } },
        exit: { opacity: 0, y: -15, scale: 0.98, transition: { duration: 0.3 } }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Inter, sans-serif' }}>

            {/* ─── Premium Left Branding ─── */}
            <div style={{
                flex: 1, position: 'relative', overflow: 'hidden', display: 'flex',
                flexDirection: 'column', justifyContent: 'center', padding: '60px',
                background: '#0A0A0A', color: 'white'
            }} className="auth-left-hide-mobile">
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
                    <div style={{
                        position: 'absolute', top: '-10%', left: '-10%', width: '80%', height: '80%',
                        background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)'
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '-20%', right: '-10%', width: '70%', height: '70%',
                        background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(80px)'
                    }} />
                    <div style={{
                        position: 'absolute', width: '200%', height: '200%',
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
                        backgroundSize: '40px 40px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)',
                    }} />
                </div>

                <div style={{ position: 'relative', zIndex: 1, maxWidth: '440px' }}>
                    <div style={{
                        width: '48px', height: '48px', background: 'linear-gradient(135deg, #fff 0%, #10b981 100%)',
                        borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '32px',
                        boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                    }}>
                        <span style={{ fontSize: '24px', color: '#000' }}>✨</span>
                    </div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                        style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: '24px' }}
                    >
                        Join the <br />SmartCommerce AI platform.
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        style={{ fontSize: '18px', color: '#9CA3AF', lineHeight: 1.6 }}
                    >
                        Create an account to start exploring curated catalogs, personalized recommendations, and dynamic pricing features driven by real-time intelligence.
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
                            STEP 1: REGISTRATION FORM
                            ════════════════════════════════════════════ */}
                        {step === 1 && (
                            <motion.form key="signup" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', maxHeight: '75vh', overflowY: 'auto', paddingRight: '10px' }} className="custom-scrollbar">
                                <div style={{ marginBottom: '24px' }}>
                                    <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Create Account</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px' }}>Let's get you set up so you can access your personal dashboard.</p>
                                </div>

                                <PremiumInput icon={User} name="name" type="text" placeholder="Full Name *" value={formData.name} onChange={handleChange} required />
                                <PremiumInput icon={Mail} name="email" type="email" placeholder="Email Address *" value={formData.email} onChange={handleChange} required />

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <PremiumInput
                                        icon={Lock}
                                        name="password"
                                        placeholder="Password *"
                                        value={formData.password}
                                        onChange={handleChange}
                                        isPassword
                                        show={showPassword}
                                        toggleVisibility={() => setShowPassword(prev => !prev)}
                                    />

                                    <PremiumInput
                                        icon={ShieldCheck}
                                        name="confirmPassword"
                                        placeholder="Confirm Password *"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        isPassword
                                        show={showConfirmPassword}
                                        toggleVisibility={() => setShowConfirmPassword(prev => !prev)}
                                    />
                                </div>

                                {/* Password requirements */}
                                <div style={{ background: '#F3F4F6', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#4B5563', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Security Requirements:</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#6B7280' }}>
                                        <div style={{ color: passwordRules.length ? '#0bb88a' : '#6B7280' }}>{passwordRules.length ? '✅' : '○'} Min 6 chars</div>
                                        <div style={{ color: passwordRules.uppercase ? '#0bb88a' : '#6B7280' }}>{passwordRules.uppercase ? '✅' : '○'} 1 Uppercase</div>
                                        <div style={{ color: passwordRules.lowercase ? '#0bb88a' : '#6B7280' }}>{passwordRules.lowercase ? '✅' : '○'} 1 Lowercase</div>
                                        <div style={{ color: passwordRules.number ? '#0bb88a' : '#6B7280' }}>{passwordRules.number ? '✅' : '○'} 1 Number</div>
                                        <div style={{ color: passwordRules.special ? '#0bb88a' : '#6B7280' }}>{passwordRules.special ? '✅' : '○'} 1 Special char</div>
                                        <div style={{ color: (isMatch && formData.password.length > 0) ? '#0bb88a' : '#6B7280' }}>{(isMatch && formData.password.length > 0) ? '✅' : '○'} Passwords match</div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <PremiumInput icon={Phone} name="phone" type="tel" placeholder="Phone (Optional)" value={formData.phone} onChange={handleChange} />
                                    <PremiumInput icon={MapPin} name="address" type="text" placeholder="Location (Optional)" value={formData.address} onChange={handleChange} />
                                </div>

                                <button type="submit" disabled={loading || !allRulesMet} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || !allRulesMet) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: (loading || !allRulesMet) ? 0.7 : 1,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '8px'
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Create securely'}
                                </button>

                                <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#6B7280', fontWeight: 500 }}>
                                    Already have an account? <Link to="/login" style={{ color: '#111', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link>
                                </div>
                            </motion.form>
                        )}

                        {/* ════════════════════════════════════════════
                            STEP 2: OTP VERIFICATION
                            ════════════════════════════════════════════ */}
                        {step === 2 && (
                            <motion.form key="verify-otp" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleOTPSubmit}>
                                <button type="button" onClick={() => { setStep(1); setError(''); }} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', marginBottom: '24px', padding: 0, display: 'flex' }}><ChevronLeft size={20} /></button>

                                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                                    <div style={{ width: '64px', height: '64px', background: 'var(--accent-glow)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'var(--accent-primary)' }}>
                                        <Mail size={30} />
                                    </div>
                                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '8px' }}>Verify your email</h2>
                                    <p style={{ color: '#6B7280', fontSize: '15px', lineHeight: 1.5 }}>Please enter the code we sent to<br /><strong style={{ color: '#111' }}>{formData.email}</strong></p>
                                </div>

                                <PremiumOTPInput length={6} value={otp} onChange={setOtp} />

                                <button type="submit" disabled={loading || otp.length !== 6} style={{
                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#111', color: '#fff', fontSize: '15px', fontWeight: 600,
                                    cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer', transition: 'all 0.2s'
                                }}>
                                    {loading ? <span className="btn-spinner"></span> : 'Verify Code & Login'}
                                </button>

                                <button type="button" onClick={handleResendOTP} disabled={resendLoading} style={{ width: '100%', padding: '14px', marginTop: '12px', background: 'none', border: 'none', color: '#6B7280', fontSize: '14px', fontWeight: 600, cursor: resendLoading ? 'not-allowed' : 'pointer', opacity: resendLoading ? 0.7 : 1 }}>
                                    Didn't receive it? <span style={{ color: 'var(--accent-primary)' }}>{resendLoading ? 'Sending...' : 'Resend code'}</span>
                                </button>
                            </motion.form>
                        )}


                        {/* ════════════════════════════════════════════
                            STEP 3: SUCCESS 🎉
                            ════════════════════════════════════════════ */}
                        {step === 3 && (
                            <motion.div key="success" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" style={{ textAlign: 'center', padding: '20px 0' }}>
                                <motion.div
                                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.1 }}
                                    style={{ width: '80px', height: '80px', background: '#0bb88a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white' }}
                                >
                                    <CheckCircle size={40} />
                                </motion.div>
                                <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px', marginBottom: '12px' }}>Account Verified!</h2>
                                <p style={{ color: '#6B7280', fontSize: '16px', lineHeight: 1.5, marginBottom: '32px' }}>Your account has been successfully created. You are now logged in and redirecting to the dashboard.</p>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </GlassCard>
            </div>

            {/* Inline CSS just for hiding the left side on small screens and custom scrollbar */}
            <style>{`
                @media (max-width: 900px) {
                    .auth-left-hide-mobile { display: none !important; }
                }

                form.custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                form.custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                form.custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 10px;
                }
                form.custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(0,0,0,0.2);
                }
            `}</style>
        </div>
    );
}

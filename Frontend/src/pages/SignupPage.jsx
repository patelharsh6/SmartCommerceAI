import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ShieldCheck, Mail, User, Phone, MapPin } from 'lucide-react';
import BACKEND_URL from '../config';
import './SignupPage.css';

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
    const [success, setSuccess] = useState('');  // ✅ success messages
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const navigate = useNavigate();

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

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // ✅ Safe JSON parser — fixes "Unexpected end of JSON input"
    const safeParseJSON = async (response) => {
        const text = await response.text();
        if (!text || text.trim() === '') {
            return { message: `Server error (${response.status})` };
        }
        try {
            return JSON.parse(text);
        } catch {
            return { message: `Unexpected server response: ${text.substring(0, 100)}` };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!isMatch) return setError('Passwords do not match');
        if (!Object.values(passwordRules).every(Boolean))
            return setError('Please meet all password requirements');

        setLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    phone: formData.phone,
                    address: formData.address,
                }),
            });

            const data = await safeParseJSON(response);
            if (!response.ok) throw new Error(data.message);

            setStep(2); // ✅ Move to OTP screen
        } catch (err) {
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOTPSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp }),
            });

            const data = await safeParseJSON(response);
            if (!response.ok) {
                setOtp(''); // ✅ Clear OTP input on wrong attempt
                throw new Error(data.message);
            }

            setSuccess('✅ Email verified! Redirecting to login...');
            setTimeout(() => navigate('/login'), 1500); // ✅ Go to login, not home

        } catch (err) {
            setError(err.message || 'OTP verification failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        setSuccess('');
        setResendLoading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/auth/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email }),
            });

            const data = await safeParseJSON(response);
            if (!response.ok) throw new Error(data.message);

            setOtp(''); // ✅ Clear old OTP
            setSuccess('✅ New OTP sent to your email!');
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container auth-container-wide animate-in">
                <div className="auth-header">
                    {step === 1 ? (
                        <Link to="/" className="auth-back-link">← Back to Store</Link>
                    ) : (
                        <button onClick={() => { setStep(1); setError(''); setSuccess(''); }} className="auth-back-link-btn">
                            ← Edit Information
                        </button>
                    )}
                    <div className="auth-logo">🛒</div>
                    <h1 className="auth-title">
                        {step === 1 ? 'Create Account' : 'Verify Email'}
                    </h1>
                    <p className="auth-subtitle">
                        {step === 1
                            ? 'Join SmartCommerceAI for a smarter shopping experience'
                            : `A 6-digit code was sent to ${formData.email}`}
                    </p>
                </div>

                {/* ✅ Error message */}
                {error && (
                    <div className="auth-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* ✅ Success message */}
                {success && (
                    <div className="auth-success">
                        {success}
                    </div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <div className="input-wrapper">
                                    <User size={18} className="input-icon" />
                                    <input
                                        name="name"
                                        type="text"
                                        className="form-input has-icon"
                                        placeholder="e.g. Alex Johnson"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address *</label>
                                <div className="input-wrapper">
                                    <Mail size={18} className="input-icon" />
                                    <input
                                        name="email"
                                        type="email"
                                        className="form-input has-icon"
                                        placeholder="alex@example.com"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Password *</label>
                                <div className="input-wrapper">
                                    <input
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Min. 6 characters"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button type="button" className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                <div className="password-rules">
                                    {[
                                        [passwordRules.length, 'Minimum 6 characters'],
                                        [passwordRules.uppercase, 'At least 1 uppercase letter (A-Z)'],
                                        [passwordRules.lowercase, 'At least 1 lowercase letter (a-z)'],
                                        [passwordRules.number, 'At least 1 number (0-9)'],
                                        [passwordRules.special, 'At least 1 special character (!@#$%^&*)'],
                                    ].map(([valid, label]) => (
                                        <p key={label} className={valid ? 'rule valid' : 'rule invalid'}>
                                            {valid ? '✅' : '❌'} {label}
                                        </p>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirm Password *</label>
                                <div className="input-wrapper">
                                    <input
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Repeat password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button type="button" className="toggle-password"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {formData.confirmPassword && (
                                    <p className={isMatch ? 'match valid' : 'match invalid'}>
                                        {isMatch ? '✅ Passwords match' : '❌ Passwords do not match'}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Phone Number</label>
                                <div className="input-wrapper">
                                    <Phone size={18} className="input-icon" />
                                    <input
                                        name="phone"
                                        type="tel"
                                        className="form-input has-icon"
                                        placeholder="+1 (555) 000-0000"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Delivery Address</label>
                                <div className="input-wrapper">
                                    <MapPin size={18} className="input-icon" />
                                    <input
                                        name="address"
                                        type="text"
                                        className="form-input has-icon"
                                        placeholder="Street, City, Zip Code"
                                        value={formData.address}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="auth-submit-btn"
                            disabled={loading || !Object.values(passwordRules).every(Boolean) || !isMatch}
                        >
                            {loading ? <span className="btn-spinner"></span> : 'Create Account'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleOTPSubmit} className="auth-form">
                        <div className="form-group">
                            <label className="form-label">Verification Code</label>
                            <div className="input-wrapper">
                                <ShieldCheck size={18} className="input-icon" />
                                <input
                                    type="text"
                                    className="form-input has-icon"
                                    placeholder="Enter 6-digit code"
                                    maxLength="6"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // ✅ numbers only
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button type="submit" className="auth-submit-btn" disabled={loading || otp.length !== 6}>
                            {loading ? <span className="btn-spinner"></span> : 'Verify & Continue'}
                        </button>
                        <button
                            type="button"
                            className="resend-link"
                            onClick={handleResendOTP}
                            disabled={resendLoading}
                        >
                            {resendLoading ? 'Sending...' : 'Resend OTP'}
                        </button>
                    </form>
                )}

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, User, Phone, MapPin } from 'lucide-react';
import BACKEND_URL from '../config';
import './SignupPage.css';

import InputField from '../components/InputField';
import PasswordField from '../components/PasswordField';
import OTPInput from '../components/OTPInput';

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
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');

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

    const safeParseJSON = async (response) => {
        const text = await response.text();
        if (!text || text.trim() === '') {
            return { message: `Server error (${response.status})` };
        }
        try {
            return JSON.parse(text);
        } catch {
            return { message: `Unexpected response: ${text.substring(0, 100)}` };
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
                setOtp(''); 
                throw new Error(data.message);
            }

            setSuccess('✅ Email verified! Redirecting to login...');
            setTimeout(() => navigate('/login'), 1500);

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

            setOtp(''); 
            setSuccess('✅ New OTP sent to your email!');
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <div className="auth-split-layout">
            <div className="auth-left">
                <div className="auth-left-content animate-in">
                    <div className="auth-logo-large">🛍️</div>
                    <h2 className="auth-left-title">SmartCommerceAI</h2>
                    <p className="auth-left-desc">Join to unlock intelligent product recommendations and AI-driven dynamic pricing.</p>
                </div>
                <div className="auth-left-bg-shapes">
                    <div className="shape shape-1"></div>
                    <div className="shape shape-2"></div>
                </div>
            </div>

            <div className="auth-right">
                <div className={`auth-container ${step === 1 ? 'auth-container-wide' : ''} animate-in`}>
                    <div className="auth-header">
                        {step === 1 ? (
                            <Link to="/" className="auth-back-link">← Back to Store</Link>
                        ) : (
                            <button onClick={() => { setStep(1); setError(''); setSuccess(''); }} className="auth-back-link-btn">
                                ← Edit Information
                            </button>
                        )}
                        <h1 className="auth-title">
                            {step === 1 ? 'Create Account' : 'Verify Email'}
                        </h1>
                        <p className="auth-subtitle">
                            {step === 1
                                ? 'Get started by entering your details below.'
                                : `A 6-digit secure code was sent to ${formData.email}`}
                        </p>
                    </div>

                    {error && (
                        <div className="auth-error">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    {success && (
                        <div className="auth-success">
                            {success}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleSubmit} className="auth-form">
                            <div className="form-row">
                                <InputField
                                    label="Full Name *"
                                    icon={User}
                                    name="name"
                                    type="text"
                                    placeholder="e.g. Alex Johnson"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                                <InputField
                                    label="Email Address *"
                                    icon={Mail}
                                    name="email"
                                    type="email"
                                    placeholder="alex@example.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-row">
                                <PasswordField
                                    label="Password *"
                                    name="password"
                                    placeholder="Min. 6 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />
                                <PasswordField
                                    label="Confirm Password *"
                                    name="confirmPassword"
                                    placeholder="Repeat password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="password-rules">
                                {[
                                    [passwordRules.length, 'Minimum 6 characters'],
                                    [passwordRules.uppercase, '1 uppercase letter'],
                                    [passwordRules.number, '1 number'],
                                    [passwordRules.special, '1 special character'],
                                    [isMatch, 'Passwords match']
                                ].map(([valid, label], i) => (
                                    <p key={i} className={`rule ${valid ? 'valid' : 'invalid'}`}>
                                        {valid ? '✅' : '○'} {label}
                                    </p>
                                ))}
                            </div>

                            <div className="form-row">
                                <InputField
                                    label="Phone Number"
                                    icon={Phone}
                                    name="phone"
                                    type="tel"
                                    placeholder="+1 (555) 000-0000"
                                    value={formData.phone}
                                    onChange={handleChange}
                                />
                                <InputField
                                    label="Delivery Address"
                                    icon={MapPin}
                                    name="address"
                                    type="text"
                                    placeholder="Street, City, Zip"
                                    value={formData.address}
                                    onChange={handleChange}
                                />
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
                            <div className="premium-form-group">
                                <label className="premium-form-label" style={{ textAlign: 'center' }}>Secure Verification Code</label>
                                <OTPInput length={6} value={otp} onChange={setOtp} />
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
                                {resendLoading ? 'Sending...' : 'Resend OTP Code'}
                            </button>
                        </form>
                    )}

                    <div className="auth-footer">
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">Sign in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
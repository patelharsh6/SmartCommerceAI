import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    const { signupUser } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await signupUser(
                formData.name,
                formData.email,
                formData.password,
                formData.phone,
                formData.address
            );
            navigate('/');
        } catch (err) {
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container auth-container-wide animate-in">
                <div className="auth-header">
                    <Link to="/" className="auth-back-link">← Back to Store</Link>
                    <div className="auth-logo"></div>
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join SmartCommerceAI for personalized shopping</p>
                </div>

                {error && (
                    <div className="auth-error" id="signup-error">
                        <span></span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form" id="signup-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-name">Full Name *</label>
                            <input
                                id="signup-name"
                                name="name"
                                type="text"
                                className="form-input"
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-email">Email Address *</label>
                            <input
                                id="signup-email"
                                name="email"
                                type="email"
                                className="form-input"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-password">Password *</label>
                            <input
                                id="signup-password"
                                name="password"
                                type="password"
                                className="form-input"
                                placeholder="Min. 6 characters"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-confirm-password">Confirm Password *</label>
                            <input
                                id="signup-confirm-password"
                                name="confirmPassword"
                                type="password"
                                className="form-input"
                                placeholder="Re-enter password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-phone">Phone Number</label>
                            <input
                                id="signup-phone"
                                name="phone"
                                type="tel"
                                className="form-input"
                                placeholder="+91 9876543210"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" htmlFor="signup-address">Delivery Address</label>
                            <input
                                id="signup-address"
                                name="address"
                                type="text"
                                className="form-input"
                                placeholder="123 Main St, City"
                                value={formData.address}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="auth-submit-btn"
                        disabled={loading}
                        id="signup-submit-btn"
                    >
                        {loading ? (
                            <>
                                <span className="btn-spinner"></span>
                                Creating account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link" id="go-to-login">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    );
}

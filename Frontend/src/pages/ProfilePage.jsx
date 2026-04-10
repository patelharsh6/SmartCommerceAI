import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

const AVATAR_OPTIONS = ['👤', '👨‍💼', '👩‍💻', '🧑‍🎓', '👨‍🎨', '👩‍🔬', '🧑‍💻', '👨‍🚀', '👩‍🍳', '🦸‍♂️', '🦸‍♀️', '🧙‍♂️'];

export default function ProfilePage() {
    const { user, refreshUser, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');
    const [orders, setOrders] = useState([]);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        avatar: '👤',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                phone: user.phone || '',
                address: user.address || '',
                avatar: user.avatar || '👤',
            });
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'orders') {
            loadOrders();
        }
    }, [activeTab]);

    const loadOrders = async () => {
        setLoadingOrders(true);
        try {
            const data = await api.getOrders();
            setOrders(data.orders || []);
        } catch {
            setOrders([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async () => {
        setError('');
        setMessage('');
        try {
            await api.updateProfile(formData);
            await refreshUser();
            setEditing(false);
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            setError(err.message || 'Failed to update profile');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return '#3b82f6';
            case 'shipped': return '#f59e0b';
            case 'delivered': return '#0bb88a';
            case 'cancelled': return '#e74c3c';
            default: return '#8b8da6';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'confirmed': return '✅';
            case 'shipped': return '🚚';
            case 'delivered': return '📦';
            case 'cancelled': return '❌';
            default: return '⏳';
        }
    };

    if (!user) {
        return (
            <div className="auth-page">
                <div className="auth-container animate-in" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
                    <h2 style={{ marginBottom: 12 }}>Please sign in</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                        You need to be logged in to view your profile.
                    </p>
                    <Link to="/login" className="auth-submit-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container animate-in">
                {/* Profile Header */}
                <div className="profile-header">
                    <Link to="/" className="auth-back-link">← Back to Store</Link>
                    <div className="profile-hero">
                        <div className="profile-avatar-large">{formData.avatar}</div>
                        <div className="profile-hero-info">
                            <h1 className="profile-name">{user.name}</h1>
                            <p className="profile-email">{user.email}</p>
                            <div className="profile-stats-row">
                                <div className="profile-stat">
                                    <span className="profile-stat-value">${user.total_spent?.toFixed(2) || '0.00'}</span>
                                    <span className="profile-stat-label">Total Spent</span>
                                </div>
                                <div className="profile-stat">
                                    <span className="profile-stat-value">{user.total_orders || 0}</span>
                                    <span className="profile-stat-label">Orders</span>
                                </div>
                                <div className="profile-stat">
                                    <span className="profile-stat-value">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                    <span className="profile-stat-label">Member Since</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="profile-tabs">
                    <button
                        className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                        id="tab-profile"
                    >
                        👤 Profile
                    </button>
                    <button
                        className={`profile-tab ${activeTab === 'orders' ? 'active' : ''}`}
                        onClick={() => setActiveTab('orders')}
                        id="tab-orders"
                    >
                        📦 Orders
                    </button>
                </div>

                {/* Messages */}
                {message && <div className="auth-success">{message}</div>}
                {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="profile-content animate-in">
                        <div className="profile-section">
                            <div className="profile-section-header">
                                <h3>Personal Information</h3>
                                {!editing ? (
                                    <button className="profile-edit-btn" onClick={() => setEditing(true)} id="edit-profile-btn">
                                        ✏️ Edit
                                    </button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="profile-save-btn" onClick={handleSave} id="save-profile-btn">
                                            💾 Save
                                        </button>
                                        <button className="profile-cancel-btn" onClick={() => {
                                            setEditing(false);
                                            setFormData({
                                                name: user.name || '',
                                                phone: user.phone || '',
                                                address: user.address || '',
                                                avatar: user.avatar || '👤',
                                            });
                                        }} id="cancel-edit-btn">
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            {editing && (
                                <div className="avatar-picker">
                                    <label className="form-label">Choose Avatar</label>
                                    <div className="avatar-options">
                                        {AVATAR_OPTIONS.map(av => (
                                            <button
                                                key={av}
                                                type="button"
                                                className={`avatar-option ${formData.avatar === av ? 'active' : ''}`}
                                                onClick={() => setFormData(prev => ({ ...prev, avatar: av }))}
                                            >
                                                {av}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="profile-fields">
                                <div className="profile-field">
                                    <label className="form-label">Full Name</label>
                                    {editing ? (
                                        <input
                                            name="name"
                                            className="form-input"
                                            value={formData.name}
                                            onChange={handleChange}
                                        />
                                    ) : (
                                        <div className="profile-field-value">{user.name}</div>
                                    )}
                                </div>
                                <div className="profile-field">
                                    <label className="form-label">Email</label>
                                    <div className="profile-field-value profile-field-readonly">
                                        {user.email}
                                        <span className="field-badge">Verified</span>
                                    </div>
                                </div>
                                <div className="profile-field">
                                    <label className="form-label">Phone</label>
                                    {editing ? (
                                        <input
                                            name="phone"
                                            className="form-input"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            placeholder="Enter phone number"
                                        />
                                    ) : (
                                        <div className="profile-field-value">
                                            {user.phone || <span style={{ color: 'var(--text-muted)' }}>Not provided</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="profile-field">
                                    <label className="form-label">Delivery Address</label>
                                    {editing ? (
                                        <input
                                            name="address"
                                            className="form-input"
                                            value={formData.address}
                                            onChange={handleChange}
                                            placeholder="Enter delivery address"
                                        />
                                    ) : (
                                        <div className="profile-field-value">
                                            {user.address || <span style={{ color: 'var(--text-muted)' }}>Not provided</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="profile-section">
                            <div className="profile-section-header">
                                <h3>Account Actions</h3>
                            </div>
                            <button className="profile-logout-btn" onClick={logout} id="logout-btn">
                                🚪 Sign Out
                            </button>
                        </div>
                    </div>
                )}

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className="profile-content animate-in">
                        {loadingOrders ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <div className="loading-text">Loading orders...</div>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon">🛍️</div>
                                <h3>No orders yet</h3>
                                <p>Start shopping and your orders will appear here!</p>
                                <Link to="/" className="auth-submit-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 16 }}>
                                    Browse Products
                                </Link>
                            </div>
                        ) : (
                            <div className="orders-list">
                                {orders.map(order => (
                                    <div key={order.order_id} className="order-card">
                                        <div className="order-header">
                                            <div className="order-id">
                                                <span className="order-id-label">Order</span>
                                                <span className="order-id-value">{order.order_id}</span>
                                            </div>
                                            <div className="order-status" style={{ color: getStatusColor(order.status) }}>
                                                {getStatusIcon(order.status)} {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                            </div>
                                        </div>

                                        <div className="order-items">
                                            {order.items.map((item, i) => (
                                                <div key={i} className="order-item">
                                                    <span className="order-item-image">{item.image}</span>
                                                    <div className="order-item-info">
                                                        <div className="order-item-name">{item.name}</div>
                                                        <div className="order-item-qty">Qty: {item.quantity}</div>
                                                    </div>
                                                    <div className="order-item-price">${(item.price * item.quantity).toFixed(2)}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="order-footer">
                                            <div className="order-meta">
                                                <span>💳 {order.payment_method}</span>
                                                <span>📍 {order.delivery_address}</span>
                                                <span>📅 {new Date(order.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="order-total">
                                                Total: <strong>${order.total.toFixed(2)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

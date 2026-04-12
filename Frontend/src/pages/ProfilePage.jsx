import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

/* ─── Constants ─── */
const AVATAR_OPTIONS = ['👤', '👨‍💼', '👩‍💻', '🧑‍🎓', '👨‍🎨', '👩‍🔬', '🧑‍💻', '👨‍🚀', '👩‍🍳', '🦸‍♂️', '🦸‍♀️', '🧙‍♂️'];
const USD_RATE = 0.012;

const STATUS_META = {
    confirmed:  { label: 'Confirmed',  color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  icon: '✅', step: 1 },
    processing: { label: 'Processing', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  icon: '⚙️', step: 2 },
    shipped:    { label: 'Shipped',    color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  icon: '🚚', step: 3 },
    delivered:  { label: 'Delivered',  color: '#0bb88a', bg: 'rgba(11,184,138,0.1)',  icon: '📦', step: 4 },
    cancelled:  { label: 'Cancelled',  color: '#e74c3c', bg: 'rgba(231,76,60,0.1)',   icon: '❌', step: 0 },
};

/* ─── Sub-components ─── */

function AvatarPicker({ value, onChange }) {
    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Choose Avatar
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AVATAR_OPTIONS.map(av => (
                    <button
                        key={av}
                        type="button"
                        onClick={() => onChange(av)}
                        style={{
                            width: 48, height: 48, fontSize: 24, border: '2px solid',
                            borderColor: value === av ? 'var(--accent-primary)' : 'var(--border)',
                            background: value === av ? 'var(--accent-glow)' : 'var(--bg-primary)',
                            borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                            transform: value === av ? 'scale(1.1)' : 'scale(1)',
                        }}
                    >{av}</button>
                ))}
            </div>
        </div>
    );
}

function StatCard({ icon, value, label, gradient }) {
    return (
        <div style={{
            background: gradient || 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0,
        }}>
            <div style={{ fontSize: 28 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{label}</div>
            </div>
        </div>
    );
}

function OrderTimeline({ status }) {
    const steps = [
        { key: 'confirmed', label: 'Confirmed', icon: '✅' },
        { key: 'processing', label: 'Processing', icon: '⚙️' },
        { key: 'shipped', label: 'Shipped', icon: '🚚' },
        { key: 'delivered', label: 'Delivered', icon: '📦' },
    ];
    const meta = STATUS_META[status] || STATUS_META.confirmed;
    const currentStep = meta.step;

    if (status === 'cancelled') return (
        <div style={{ padding: '10px 14px', background: STATUS_META.cancelled.bg, borderRadius: 8, fontSize: 13, color: STATUS_META.cancelled.color, fontWeight: 600 }}>
            ❌ Order Cancelled
        </div>
    );

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, margin: '12px 0' }}>
            {steps.map((step, i) => {
                const done = i + 1 <= currentStep;
                const active = i + 1 === currentStep;
                return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: done ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                            border: active ? '3px solid var(--accent-secondary)' : '2px solid var(--border)',
                            fontSize: done ? 14 : 12, flexShrink: 0, transition: 'all 0.3s',
                            boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none',
                        }}>
                            {done ? '✓' : (i + 1)}
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, margin: '0 4px',
                                background: done && i + 1 < currentStep ? 'var(--accent-primary)' : 'var(--border)',
                                transition: 'background 0.3s',
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function OrderCard({ order }) {
    const [expanded, setExpanded] = useState(false);
    const meta = STATUS_META[order.status] || STATUS_META.confirmed;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, overflow: 'hidden', marginBottom: 16,
            }}
        >
            {/* Header */}
            <div
                style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}
                onClick={() => setExpanded(!expanded)}
            >
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Order ID</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5 }}>{order.order_id}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Date</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Items</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{order.item_count} items</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Total</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>₹{order.total.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ padding: '6px 14px', borderRadius: 20, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700, border: `1px solid ${meta.color}33` }}>
                        {meta.icon} {meta.label}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</div>
                </div>
            </div>

            {/* Expanded Content */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ padding: '0 24px 24px', borderTop: '1px solid var(--border)' }}>
                            {/* Timeline */}
                            <div style={{ padding: '20px 0 12px' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Delivery Progress</div>
                                <OrderTimeline status={order.status} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                    <span>Confirmed</span><span>Processing</span><span>Shipped</span><span>Delivered</span>
                                </div>
                            </div>

                            {/* Items */}
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Items Ordered</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {order.items.map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 10 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                                {item.image || '📦'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty: {item.quantity}</div>
                                            </div>
                                            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Meta */}
                            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Payment</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{order.payment_method}</div>
                                </div>
                                <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px' }}>
                                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Est. Delivery</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{order.estimated_delivery || '3–5 business days'}</div>
                                </div>
                                <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '12px 14px', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Delivery Address</div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{order.delivery_address}</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/* ─── Profile Field Row ─── */
function Field({ label, value, name, editing, onChange, placeholder, readonly }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>{label}</label>
            {readonly ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                    <span style={{ fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>{value || <span style={{ color: 'var(--text-muted)' }}>—</span>}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 20 }}>Verified</span>
                </div>
            ) : editing ? (
                <input
                    name={name}
                    className="form-input"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    style={{ fontSize: 15 }}
                />
            ) : (
                <div style={{ fontSize: 15, fontWeight: 500, color: value ? 'var(--text-primary)' : 'var(--text-muted)', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    {value || 'Not provided'}
                </div>
            )}
        </div>
    );
}

/* ─── Main Component ─── */
export default function ProfilePage() {
    const { user, refreshUser, logout } = useAuth();
    const navigate = useNavigate();

    const [tab, setTab] = useState('profile');
    const [orders, setOrders] = useState([]);
    const [editing, setEditing] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [message, setMessage] = useState('');
    const [msgType, setMsgType] = useState('success');
    const [currency, setCurrency] = useState('INR');

    const [formData, setFormData] = useState({
        name: '', phone: '', address: '', avatar: '👤',
    });

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
        if (tab === 'orders') loadOrders();
    }, [tab]);

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

    const showMsg = (msg, type = 'success') => {
        setMessage(msg);
        setMsgType(type);
        setTimeout(() => setMessage(''), 3500);
    };

    const handleSave = async () => {
        setSavingProfile(true);
        try {
            await api.updateProfile(formData);
            await refreshUser();
            setEditing(false);
            showMsg('✅ Profile updated successfully!');
        } catch (err) {
            showMsg(err.message || 'Failed to update profile', 'error');
        } finally {
            setSavingProfile(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setFormData({ name: user.name || '', phone: user.phone || '', address: user.address || '', avatar: user.avatar || '👤' });
    };

    const totalSpent = user?.total_spent ?? 0;
    const totalOrders = user?.total_orders ?? 0;
    const totalSaved = totalOrders * 150; // Simulated savings — wire to real data

    if (!user) {
        return (
            <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', background: 'var(--bg-card)', padding: 48, borderRadius: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🔐</div>
                    <h2 style={{ marginBottom: 8 }}>Sign in to view profile</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>Access your orders, settings, and more</p>
                    <Link to="/login" className="auth-submit-btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>Sign In</Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '28px 0 64px' }}>
            <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 20px' }}>

                {/* ─── Profile Hero Card ─── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                        borderRadius: 20, padding: '32px', marginBottom: 24, position: 'relative', overflow: 'hidden',
                    }}
                >
                    {/* Decorative blob */}
                    <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -30, left: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

                    <Link to="/" style={{ display: 'inline-block', marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontWeight: 500 }}>← Back to Store</Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                        <div style={{
                            width: 88, height: 88, borderRadius: 20, background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 48, border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0,
                        }}>
                            {formData.avatar}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: -0.5, marginBottom: 4 }}>{user.name}</h1>
                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 0 }}>{user.email}</p>
                            {user.created_at && (
                                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
                                    Member since {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                </p>
                            )}
                        </div>
                        {/* Currency switch */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.15)', borderRadius: 10, overflow: 'hidden' }}>
                            <button onClick={() => setCurrency('INR')}
                                style={{ padding: '8px 16px', border: 'none', background: currency === 'INR' ? 'rgba(255,255,255,0.3)' : 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                                ₹ INR
                            </button>
                            <button onClick={() => setCurrency('USD')}
                                style={{ padding: '8px 16px', border: 'none', background: currency === 'USD' ? 'rgba(255,255,255,0.3)' : 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                                $ USD
                            </button>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28 }}>
                        {[
                            { icon: '🛒', label: 'Total Orders', value: totalOrders },
                            {
                                icon: '💰', label: 'Total Spent',
                                value: currency === 'USD' ? `$${(totalSpent * USD_RATE).toFixed(0)}` : `₹${totalSpent.toLocaleString('en-IN')}`
                            },
                            {
                                icon: '🎁', label: 'Total Saved',
                                value: currency === 'USD' ? `$${(totalSaved * USD_RATE).toFixed(0)}` : `₹${totalSaved}`
                            },
                        ].map((s, i) => (
                            <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '16px 20px', backdropFilter: 'blur(8px)' }}>
                                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{s.value}</div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ─── Status Message ─── */}
                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{
                                marginBottom: 16, padding: '14px 20px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                                background: msgType === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                border: `1px solid ${msgType === 'success' ? 'rgba(11,184,138,0.3)' : 'rgba(231,76,60,0.3)'}`,
                                color: msgType === 'success' ? 'var(--success)' : 'var(--danger)',
                            }}
                        >
                            {message}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── Tabs ─── */}
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, marginBottom: 24 }}>
                    {[
                        { key: 'profile', label: '👤 Profile' },
                        { key: 'orders', label: '📦 Orders' },
                        { key: 'settings', label: '⚙️ Settings' },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            id={`tab-${t.key}`}
                            style={{
                                flex: 1, padding: '12px 20px', border: 'none', borderRadius: 10, cursor: 'pointer',
                                fontFamily: 'inherit', fontWeight: 600, fontSize: 14, transition: 'all 0.2s',
                                background: tab === t.key ? 'var(--accent-primary)' : 'transparent',
                                color: tab === t.key ? 'white' : 'var(--text-secondary)',
                                boxShadow: tab === t.key ? 'var(--shadow-glow)' : 'none',
                            }}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ─── PROFILE TAB ─── */}
                <AnimatePresence mode="wait">
                    {tab === 'profile' && (
                        <motion.div key="profile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                {/* Personal Info Card */}
                                <div style={{ gridColumn: '1 / -1', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Personal Information</h3>
                                        {!editing ? (
                                            <button
                                                id="edit-profile-btn"
                                                onClick={() => setEditing(true)}
                                                style={{ padding: '8px 20px', border: '1px solid var(--accent-primary)', background: 'var(--accent-glow)', color: 'var(--accent-primary)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}
                                            >
                                                ✏️ Edit
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button id="save-profile-btn" onClick={handleSave} disabled={savingProfile}
                                                    style={{ padding: '8px 20px', border: 'none', background: 'var(--accent-gradient)', color: 'white', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>
                                                    {savingProfile ? '…' : '✅ Save'}
                                                </button>
                                                <button id="cancel-edit-btn" onClick={handleCancel}
                                                    style={{ padding: '8px 20px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13 }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {editing && <AvatarPicker value={formData.avatar} onChange={av => setFormData(p => ({ ...p, avatar: av }))} />}

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                        <Field label="Full Name" name="name" value={formData.name} editing={editing} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" />
                                        <Field label="Email Address" value={user.email} readonly />
                                        <Field label="Phone Number" name="phone" value={editing ? formData.phone : user.phone} editing={editing} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 00000 00000" />
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <Field label="Delivery Address" name="address" value={editing ? formData.address : user.address} editing={editing} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} placeholder="Street, City, State, PIN" />
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Quick Links</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {[
                                            { icon: '📦', label: 'My Orders', action: () => setTab('orders') },
                                            { icon: '🛒', label: 'Go to Cart', action: () => navigate('/cart') },
                                            { icon: '🏠', label: 'Browse Store', action: () => navigate('/') },
                                        ].map((item, i) => (
                                            <button key={i} onClick={item.action}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, transition: 'all 0.15s', textAlign: 'left' }}
                                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'var(--accent-glow)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
                                            >
                                                <span style={{ fontSize: 20 }}>{item.icon}</span> {item.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Danger Zone */}
                                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 16, padding: 24 }}>
                                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)', marginBottom: 8 }}>Account Actions</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Sign out from your SmartCommerceAI account</p>
                                    <button id="logout-btn" onClick={logout}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: 'var(--danger-bg)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, color: 'var(--danger)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, transition: 'all 0.15s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger)'; e.currentTarget.style.color = 'white'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                                    >
                                        🚪 Sign Out
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ─── ORDERS TAB ─── */}
                    {tab === 'orders' && (
                        <motion.div key="orders" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                            {loadingOrders ? (
                                <div className="loading-container">
                                    <div className="loading-spinner" />
                                    <div className="loading-text">Loading your orders…</div>
                                </div>
                            ) : orders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '80px 24px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                                    <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
                                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No orders yet</h3>
                                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Start shopping and your orders will appear here!</p>
                                    <Link to="/" className="auth-submit-btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>Browse Products</Link>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                                        Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
                                    </div>
                                    {orders.map(order => <OrderCard key={order.order_id} order={order} />)}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ─── SETTINGS TAB ─── */}
                    {tab === 'settings' && (
                        <motion.div key="settings" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Preferences</h3>

                                {/* Currency Preference */}
                                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 20, marginBottom: 20 }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Display Currency</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Choose how prices are displayed throughout the app</div>
                                    <div style={{ display: 'flex', gap: 10 }}>
                                        {['INR', 'USD'].map(c => (
                                            <button key={c} onClick={() => setCurrency(c)}
                                                style={{ padding: '10px 24px', border: '2px solid', borderColor: currency === c ? 'var(--accent-primary)' : 'var(--border)', borderRadius: 10, background: currency === c ? 'var(--accent-glow)' : 'none', color: currency === c ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, transition: 'all 0.15s' }}>
                                                {c === 'INR' ? '₹ Indian Rupee' : '$ US Dollar'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Notification Settings (UI-only) */}
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Notifications</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {[
                                            { label: 'Order Updates', hint: 'Get notified when your order status changes' },
                                            { label: 'Promotional Offers', hint: 'Receive vouchers and special deals' },
                                            { label: 'Price Alerts', hint: 'Know when prices drop on wishlist items' },
                                        ].map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-primary)', borderRadius: 10 }}>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.hint}</div>
                                                </div>
                                                <div style={{ width: 40, height: 22, background: i === 0 ? 'var(--accent-primary)' : 'var(--bg-elevated)', borderRadius: 11, cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                                                    <div style={{ width: 18, height: 18, background: 'white', borderRadius: '50%', margin: '2px 2px 2px', transform: i === 0 ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

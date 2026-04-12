import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../api';
import { useAuth } from '../context/AuthContext';

// ─── animation presets ───────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
const stagger  = { show: { transition: { staggerChildren: 0.07 } } };
const popIn    = { hidden: { opacity: 0, scale: 0.92 }, show: { opacity: 1, scale: 1 } };

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const fmt = (n) =>
    n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const fmtCurrencyINR = (n) =>
    n == null ? '—' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtCurrencyUSD = (n) =>
    n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (s) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }); }
    catch { return s; }
};

// ─────────────────────────────────────────────────────────────────────────────
// UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Badge = ({ label, color = 'blue' }) => {
    const map = {
        blue:   { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
        green:  { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
        amber:  { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' },
        red:    { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
        purple: { bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' },
        gray:   { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    };
    const c = map[color] || map.gray;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: '999px', 
            fontSize: '11px', fontWeight: 500, background: c.bg, color: c.text, border: `1px solid ${c.border}`,
            letterSpacing: '0.3px', whiteSpace: 'nowrap',
        }}>{label}</span>
    );
};

const statusBadge = (status) => {
    if (status === null || status === undefined) return <Badge label="unknown" color="gray" />;
    const s = String(status).toLowerCase();
    if (s === 'completed' || s === 'delivered' || s === 'verified' || s === 'true') return <Badge label={status} color="green" />;
    if (s === 'pending' || s === 'false') return <Badge label={status} color="amber" />;
    if (s === 'cancelled') return <Badge label={status} color="red" />;
    if (s === 'shipped')   return <Badge label={status} color="blue" />;
    return <Badge label={status} color="gray" />;
};

const KpiCard = ({ icon, title, value, sub, color }) => {
    const colors = {
        blue:   { bg: '#eff6ff', icon: '#2563eb', border: '#bfdbfe' },
        green:  { bg: '#f0fdf4', icon: '#16a34a', border: '#bbf7d0' },
        purple: { bg: '#faf5ff', icon: '#7c3aed', border: '#e9d5ff' },
        amber:  { bg: '#fffbeb', icon: '#d97706', border: '#fde68a' },
    };
    const c = colors[color] || colors.blue;
    return (
        <motion.div variants={popIn} whileHover={{ y: -3 }}
            style={{
                background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb',
                padding: '20px 22px', flex: '1 1 180px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{icon}</div>
            <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
                <p style={{ margin: '4px 0 2px', fontSize: '24px', fontWeight: 700, color: '#111827' }}>{value}</p>
                {sub && <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{sub}</p>}
            </div>
        </motion.div>
    );
};

const Table = ({ cols, rows, emptyMsg = 'No records found' }) => (
    <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
                <tr style={{ background: '#f9fafb' }}>
                    {cols.map(c => <th key={c.key} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{c.label}</th>)}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? <tr><td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>{emptyMsg}</td></tr> : 
                rows.map((row, i) => (
                    <motion.tr key={row._id || i} style={{ borderBottom: '1px solid #f3f4f6' }} whileHover={{ background: '#f9fafb' }}>
                        {cols.map(c => <td key={c.key} style={{ padding: '12px 16px', color: '#374151' }}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
                    </motion.tr>
                ))}
            </tbody>
        </table>
    </div>
);

const Avatar = ({ name = '', size = 32 }) => {
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return <div style={{ width: size, height: size, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4 + 'px', fontWeight: 600 }}>{initials || '?'}</div>;
};

const Section = ({ title, icon, children }) => (
    <motion.div variants={fadeUp} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{icon}</span><h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>{title}</h2>
        </div>
        <div>{children}</div>
    </motion.div>
);

const Toast = ({ msg, type, onDone }) => {
    useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, background: type === 'error' ? '#991b1b' : '#111827', color: '#fff', padding: '12px 20px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '14px' }}>
            {msg}
        </motion.div>
    );
};

const Skeleton = ({ h = 160 }) => (
    <div style={{ height: h, width: '100%', borderRadius: '14px', background: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
        <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)' }} />
    </div>
);

const SparkBar = ({ data = [] }) => {
    const max = Math.max(...data, 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '40px' }}>
            {data.map((v, i) => <div key={i} style={{ flex: 1, height: `${(v / max) * 100}%`, background: '#2563eb', borderRadius: '2px', opacity: 0.4 + (i / data.length) * 0.6 }} />)}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
    const { user } = useAuth();
    const [dashboard, setDashboard] = useState({ total_revenue: 0, total_products: 0, total_users: 0, active_carts: 0, categories: [] });
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [products, setProducts] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [toast, setToast] = useState(null);
    const [pricingLoading, setPricingLoading] = useState(false);
    const [search, setSearch] = useState('');

    const tabs = useMemo(() => [
        { id: 'overview', label: 'Overview', icon: '📊' },
        { id: 'users', label: 'Users', icon: '👥' },
        { id: 'orders', label: 'Orders', icon: '💳' },
        { id: 'products', label: 'Products', icon: '📦' },
        { id: 'trending', label: 'Trending', icon: '🔥' },
    ], []);

    const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [dash, u, o, p, t] = await Promise.all([
                api.getDashboard(), api.getAllUsers(), api.getOrders(), api.getProducts(), api.getTrending()
            ]);
            setDashboard(dash || { total_revenue: 0, total_products: 0, total_users: 0, active_carts: 0, categories: [] });
            setUsers(u?.users || []);
            setOrders(o?.orders || []);
            setProducts(p?.products || []);
            setTrending(t?.trending || []);
        } catch (err) {
            showToast('Failed to sync with database', 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { loadData(); }, [loadData]);

    const refreshPricing = async () => {
        setPricingLoading(true);
        try {
            const res = await fetch('/api/admin/refresh-pricing', { method: 'POST' });
            const data = await res.json();
            showToast(data.message || 'AI models synchronized');
            if (data.status === 'ok') loadData();
        } catch {
            showToast('Pricing engine refresh failed', 'error');
        } finally {
            setPricingLoading(false);
        }
    };

    const revenueSpark = useMemo(() => {
        const last8 = [...orders].slice(0, 8).map(o => o.total || 0).reverse();
        return last8.length > 0 ? last8 : [0, 0, 0, 0];
    }, [orders]);

    const activeTabLabel = tabs.find(t => t.id === activeTab)?.label || 'Admin';

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', color: '#1e293b' }}>
            <AnimatePresence>{toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}</AnimatePresence>

            {/* Sidebar Navigation */}
            <aside style={{ width: '240px', background: '#fff', borderRight: '1px solid #e5e7eb', padding: '24px 16px', position: 'sticky', top: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '32px', paddingLeft: '8px' }}>
                    <p style={{ fontWeight: 800, fontSize: '20px', color: '#2563eb', margin: 0, letterSpacing: '-0.02em' }}>⚡ AdminPanel</p>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 600, textTransform: 'uppercase' }}>SmartCommerce Engine</p>
                </div>
                
                <nav style={{ flex: 1 }}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                            width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? '#eff6ff' : 'transparent',
                            color: activeTab === tab.id ? '#2563eb' : '#64748b', textAlign: 'left', cursor: 'pointer', marginBottom: '4px', fontWeight: activeTab === tab.id ? 600 : 500,
                            display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                        }}>
                            <span style={{ fontSize: '18px', marginRight: '12px' }}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div style={{ marginTop: 'auto', padding: '12px', background: '#f8fafc', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Avatar name={user?.name || 'Admin'} size={32} />
                    <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'Admin'}</p>
                        <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0 }}>Root Administrator</p>
                    </div>
                </div>
            </aside>

            {/* Main Dashboard Workspace */}
            <main style={{ flex: 1, padding: '32px 40px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>{activeTabLabel}</h1>
                        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Real-time database monitoring</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} 
                                style={{ padding: '10px 16px', paddingLeft: '36px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '240px', outline: 'none', fontSize: '14px' }} />
                            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>🔍</span>
                        </div>
                        <button onClick={refreshPricing} disabled={pricingLoading} 
                            style={{ padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', opacity: pricingLoading ? 0.7 : 1 }}>
                            {pricingLoading ? 'Recalculating...' : '⚡ AI Refresh'}
                        </button>
                    </div>
                </header>

                {loading ? <Skeleton h={220} /> : (
                    <motion.div initial="hidden" animate="show" variants={stagger}>
                        {activeTab === 'overview' && (
                            <>
                                <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                                    <KpiCard icon="₹" title="Gross Revenue" value={fmtCurrencyINR(dashboard.total_revenue)} color="green" sub="Settled transactions" />
                                    <KpiCard icon="📦" title="Catalog Size" value={fmt(dashboard.total_products)} color="blue" sub={`${dashboard.categories?.length || 0} active categories`} />
                                    <KpiCard icon="👥" title="Registered Users" value={fmt(dashboard.total_users)} color="purple" sub="Across all segments" />
                                    <KpiCard icon="🛒" title="Open Carts" value={fmt(dashboard.active_carts)} color="amber" sub="Real-time session data" />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
                                    <Section title="Revenue Pulse" icon="📈">
                                        <div style={{ padding: '24px' }}>
                                            <SparkBar data={revenueSpark} />
                                            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '16px', fontWeight: 500 }}>Transaction velocity (Last 8)</p>
                                        </div>
                                    </Section>
                                    <Section title="Live Transaction Feed" icon="💳">
                                        <Table cols={[
                                            { key: 'order_id', label: 'Order ID', render: r => <code style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>#{r.order_id?.slice(-8)}</code> },
                                            { key: 'email', label: 'Customer' },
                                            { key: 'total', label: 'Amount', render: r => <strong style={{ color: '#0f172a' }}>{fmtCurrencyINR(r.total)}</strong> },
                                            { key: 'status', label: 'Status', render: r => statusBadge(r.status) }
                                        ]} rows={orders.slice(0, 5)} />
                                    </Section>
                                </div>
                            </>
                        )}

                        {activeTab === 'users' && (
                            <Section title="User Management Console" icon="👥">
                                <Table cols={[
                                    { key: 'name', label: 'Full Name', render: r => <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Avatar name={r.name} size={28} /><strong>{r.name}</strong></div> },
                                    { key: 'email', label: 'Primary Email' },
                                    { key: 'is_verified', label: 'Verified', render: r => statusBadge(r.is_verified) },
                                    { key: 'created_at', label: 'Joined', render: r => fmtDate(r.created_at) }
                                ]} rows={users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))} />
                            </Section>
                        )}

                        {activeTab === 'products' && (
                            <Section title="Global Catalog Ledger" icon="📦">
                                <Table cols={[
                                    { key: 'product_name', label: 'SKU Name', render: r => <span style={{ fontWeight: 600 }}>{r.product_name}</span> },
                                    { key: 'brand', label: 'Brand', render: r => <Badge label={r.brand} color="purple" /> },
                                    { key: 'base_price_usd', label: 'MSRP (USD)', render: r => <strong style={{ color: '#0f172a' }}>{fmtCurrencyUSD(r.base_price_usd)}</strong> },
                                    { key: 'inventory_count', label: 'Stock Level', render: r => <Badge label={`${r.inventory_count} units`} color={r.inventory_count < 10 ? 'red' : 'green'} /> },
                                    { key: 'predicted_price', label: 'AI Suggestion', render: r => r.predicted_price ? <span style={{ color: '#2563eb', fontWeight: 700 }}>${r.predicted_price}</span> : <span style={{ color: '#94a3b8' }}>Analyzing...</span> }
                                ]} rows={products.filter(p => p.product_name?.toLowerCase().includes(search.toLowerCase()))} />
                            </Section>
                        )}

                        {activeTab === 'orders' && (
                            <Section title="Transactional Audit Trail" icon="💳">
                                <Table cols={[
                                    { key: 'order_id', label: 'Order ID' },
                                    { key: 'email', label: 'Customer' },
                                    { key: 'total', label: 'Settled Amount', render: r => <strong>{fmtCurrencyINR(r.total)}</strong> },
                                    { key: 'status', label: 'Status', render: r => statusBadge(r.status) },
                                    { key: 'created_at', label: 'Timestamp', render: r => fmtDate(r.created_at) }
                                ]} rows={orders.filter(o => o.email?.toLowerCase().includes(search.toLowerCase()) || o.order_id?.includes(search))} />
                            </Section>
                        )}

                        {activeTab === 'trending' && (
                             <Section title="Market Trending Analysis" icon="🔥">
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', padding: '24px' }}>
                                    {trending.length === 0 ? <p style={{ color: '#64748b' }}>No market trends detected yet.</p> : trending.map((p, i) => (
                                        <div key={i} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', padding: '4px 8px', borderRadius: '6px', fontWeight: 800 }}>RANK #{i + 1}</span>
                                                <span style={{ fontSize: '18px' }}>🔥</span>
                                            </div>
                                            <p style={{ fontWeight: 700, margin: '0 0 8px', fontSize: '14px', lineHeight: '1.4' }}>{p.product_name || p.name}</p>
                                            <Badge label={p.category} color="blue" />
                                        </div>
                                    ))}
                                </div>
                             </Section>
                        )}
                    </motion.div>
                )}
            </main>
        </div>
    );
}
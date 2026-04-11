import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

/* ─── Currency Config ─── */
const USD_RATE = 0.012; // 1 INR = 0.012 USD (static, can wire to API)

function formatPrice(inr, currency) {
    if (currency === 'USD') return `$${(inr * USD_RATE).toFixed(2)}`;
    return `₹${inr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

/* ─── Voucher Engine (Frontend mirror of backend logic) ─── */
const VOUCHERS = [
    {
        code: 'WELCOME10',
        type: 'percentage',
        value: 10,
        minCart: 0,
        maxDiscount: 500,
        label: '10% OFF',
        description: 'Welcome offer for new customers',
        categories: null,
    },
    {
        code: 'FLAT500',
        type: 'flat',
        value: 500,
        minCart: 2000,
        maxDiscount: 500,
        label: '₹500 OFF',
        description: 'Flat ₹500 off on orders above ₹2,000',
        categories: null,
    },
    {
        code: 'ELECTRONICS15',
        type: 'category_percentage',
        value: 15,
        minCart: 5000,
        maxDiscount: 2000,
        label: '15% OFF Electronics',
        description: '15% off electronics orders above ₹5,000',
        categories: ['electronics', 'computers', 'smartphones'],
    },
    {
        code: 'SAVE20',
        type: 'percentage',
        value: 20,
        minCart: 10000,
        maxDiscount: 3000,
        label: '20% OFF',
        description: '20% off on cart value above ₹10,000',
        categories: null,
    },
];

function computeBestVoucher(items, cartTotal) {
    const hasElectronics = items.some(item => {
        const cat = (item.category || '').toLowerCase();
        return ['electronics', 'computers', 'smartphones', 'appliances'].some(e => cat.includes(e));
    });

    let best = null;
    let bestSavings = 0;

    for (const v of VOUCHERS) {
        if (cartTotal < v.minCart) continue;
        if (v.categories && !hasElectronics) continue;

        let savings = 0;
        if (v.type === 'flat') {
            savings = Math.min(v.value, v.maxDiscount);
        } else {
            savings = Math.min((cartTotal * v.value) / 100, v.maxDiscount);
        }

        if (savings > bestSavings) {
            bestSavings = savings;
            best = { ...v, savings };
        }
    }
    return best;
}

/* ─── Cart Item Card ─── */
function CartItemCard({ item, currency, onUpdateQty, onRemove, updating }) {
    const isUpdating = updating === item.product_id;
    const itemTotal = item.price * item.quantity;

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: isUpdating ? 0.6 : 1, y: 0 }}
            exit={{ opacity: 0, x: -40, height: 0 }}
            transition={{ duration: 0.25 }}
            className="cart-item-card"
        >
            {/* Product Image / Emoji */}
            <div className="cart-item-thumb">
                {item.img_url ? (
                    <img src={item.img_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
                ) : (
                    <span style={{ fontSize: 32 }}>{item.image || '📦'}</span>
                )}
            </div>

            {/* Info */}
            <div className="cart-item-body">
                <div className="cart-item-category">{item.category || 'Product'}</div>
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-unit">{formatPrice(item.price, currency)} each</div>

                {/* Qty Controls */}
                <div className="cart-item-qty-row">
                    <div className="qty-pill">
                        <button
                            className="qty-btn-circle"
                            onClick={() => onUpdateQty(item.product_id, item.quantity - 1)}
                            disabled={isUpdating}
                            aria-label="Decrease quantity"
                        >−</button>
                        <span className="qty-num">{item.quantity}</span>
                        <button
                            className="qty-btn-circle"
                            onClick={() => onUpdateQty(item.product_id, item.quantity + 1)}
                            disabled={isUpdating}
                            aria-label="Increase quantity"
                        >+</button>
                    </div>
                    <button
                        className="cart-remove-link"
                        onClick={() => onRemove(item.product_id)}
                        disabled={isUpdating}
                    >
                        {isUpdating ? '…' : 'Remove'}
                    </button>
                </div>
            </div>

            {/* Price */}
            <div className="cart-item-price-block">
                <div className="cart-item-total-price">{formatPrice(itemTotal, currency)}</div>
                {currency === 'INR' && (
                    <div className="cart-item-usd-hint">${(itemTotal * USD_RATE).toFixed(0)}</div>
                )}
            </div>
        </motion.div>
    );
}

/* ─── Voucher Banner ─── */
function VoucherBanner({ voucher, onRemove, currency }) {
    if (!voucher) return null;
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="voucher-banner"
        >
            <div className="voucher-banner-left">
                <span className="voucher-tag">🎟️ BEST OFFER APPLIED</span>
                <div className="voucher-code">{voucher.code}</div>
                <div className="voucher-desc">{voucher.description}</div>
            </div>
            <div className="voucher-banner-right">
                <div className="voucher-savings">−{formatPrice(voucher.savings, currency)}</div>
                <button className="voucher-remove-btn" onClick={onRemove}>Remove</button>
            </div>
        </motion.div>
    );
}

/* ─── Empty Cart ─── */
function EmptyCart() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="empty-cart-state"
        >
            <div className="empty-cart-icon">🛒</div>
            <h2 className="empty-cart-title">Your cart is empty</h2>
            <p className="empty-cart-subtitle">Browse our catalog and add something you love</p>
            <Link to="/" className="empty-cart-cta">
                Browse Products →
            </Link>
        </motion.div>
    );
}

/* ─── Main Component ─── */
export default function CartPage() {
    const { isAuthenticated, refreshCart } = useAuth();
    const navigate = useNavigate();

    const [cart, setCart] = useState({ items: [], total: 0, item_count: 0 });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [currency, setCurrency] = useState('INR');
    const [bestVoucher, setBestVoucher] = useState(null);
    const [voucherRemoved, setVoucherRemoved] = useState(false);
    const [voucherInput, setVoucherInput] = useState('');
    const [voucherError, setVoucherError] = useState('');
    const [toast, setToast] = useState('');

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const loadCart = useCallback(async () => {
        try {
            const data = await api.getCart();
            setCart(data);
        } catch {
            setCart({ items: [], total: 0, item_count: 0 });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated) loadCart();
        else setLoading(false);
    }, [isAuthenticated, loadCart]);

    /* Auto-apply best voucher when cart changes */
    useEffect(() => {
        if (cart.items.length > 0 && !voucherRemoved) {
            const best = computeBestVoucher(cart.items, cart.total);
            setBestVoucher(best);
        } else if (cart.items.length === 0) {
            setBestVoucher(null);
        }
    }, [cart, voucherRemoved]);

    const handleUpdateQty = async (productId, newQty) => {
        setUpdating(productId);
        try {
            let data;
            if (newQty <= 0) {
                data = await api.removeFromCart(productId);
                showToast('Item removed from cart');
            } else {
                data = await api.updateCartItem(productId, newQty);
            }
            setCart(data);
            await refreshCart();
        } catch (err) {
            console.error('Cart update failed:', err);
        } finally {
            setUpdating(null);
        }
    };

    const handleRemove = async (productId) => {
        setUpdating(productId);
        try {
            const data = await api.removeFromCart(productId);
            setCart(data);
            await refreshCart();
            showToast('Item removed');
        } catch {
        } finally {
            setUpdating(null);
        }
    };

    const handleApplyManualVoucher = () => {
        setVoucherError('');
        const code = voucherInput.trim().toUpperCase();
        const found = VOUCHERS.find(v => v.code === code);
        if (!found) {
            setVoucherError('Invalid voucher code');
            return;
        }
        if (cart.total < found.minCart) {
            setVoucherError(`Minimum cart value of ₹${found.minCart.toLocaleString()} required`);
            return;
        }
        let savings = 0;
        if (found.type === 'flat') {
            savings = Math.min(found.value, found.maxDiscount);
        } else {
            savings = Math.min((cart.total * found.value) / 100, found.maxDiscount);
        }
        setBestVoucher({ ...found, savings });
        setVoucherRemoved(false);
        setVoucherInput('');
        showToast(`Voucher ${code} applied! You save ${formatPrice(savings, currency)}`);
    };

    /* Pricing Calculations */
    const subtotal = cart.total;
    const discount = bestVoucher ? bestVoucher.savings : 0;
    const finalTotal = Math.max(0, subtotal - discount);

    if (!isAuthenticated) {
        return (
            <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', background: 'var(--bg-card)', padding: 48, borderRadius: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🔐</div>
                    <h2 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>Sign in to view cart</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Please login to manage your cart</p>
                    <Link to="/login" className="auth-submit-btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>Sign In</Link>
                </motion.div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '60vh' }}>
                <div className="loading-spinner" />
                <div className="loading-text">Loading your cart…</div>
            </div>
        );
    }

    return (
        <div className="cart-pg">
            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        className="cart-pg-toast"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        ✅ {toast}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="cart-pg-inner">
                {/* Header */}
                <div className="cart-pg-header">
                    <div>
                        <Link to="/" className="auth-back-link">← Continue Shopping</Link>
                        <h1 className="cart-pg-title">
                            Your Cart
                            {cart.item_count > 0 && (
                                <span className="cart-pg-count">{cart.item_count} item{cart.item_count !== 1 ? 's' : ''}</span>
                            )}
                        </h1>
                    </div>
                    {/* Currency Toggle */}
                    <div className="currency-toggle">
                        <button
                            className={`currency-btn ${currency === 'INR' ? 'active' : ''}`}
                            onClick={() => setCurrency('INR')}
                        >₹ INR</button>
                        <button
                            className={`currency-btn ${currency === 'USD' ? 'active' : ''}`}
                            onClick={() => setCurrency('USD')}
                        >$ USD</button>
                    </div>
                </div>

                {cart.items.length === 0 ? (
                    <EmptyCart />
                ) : (
                    <div className="cart-pg-body">
                        {/* Left: Items */}
                        <div className="cart-pg-left">
                            {/* Voucher Banner */}
                            <AnimatePresence>
                                {bestVoucher && (
                                    <VoucherBanner
                                        voucher={bestVoucher}
                                        currency={currency}
                                        onRemove={() => { setBestVoucher(null); setVoucherRemoved(true); }}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Items */}
                            <div className="cart-items-wrap">
                                <AnimatePresence>
                                    {cart.items.map(item => (
                                        <CartItemCard
                                            key={item.product_id}
                                            item={item}
                                            currency={currency}
                                            onUpdateQty={handleUpdateQty}
                                            onRemove={handleRemove}
                                            updating={updating}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>

                            {/* Manual Voucher Input */}
                            <div className="voucher-input-block">
                                <div className="voucher-input-title">🎟️ Have a voucher code?</div>
                                <div className="voucher-input-row">
                                    <input
                                        className="form-input"
                                        placeholder="Enter code e.g. SAVE20"
                                        value={voucherInput}
                                        onChange={e => { setVoucherInput(e.target.value); setVoucherError(''); }}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyManualVoucher()}
                                        style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 1 }}
                                    />
                                    <button className="voucher-apply-btn" onClick={handleApplyManualVoucher}>Apply</button>
                                </div>
                                {voucherError && (
                                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>
                                        ⚠️ {voucherError}
                                    </motion.p>
                                )}
                                {/* Available vouchers hint */}
                                <div className="voucher-hints">
                                    {VOUCHERS.map(v => (
                                        <button
                                            key={v.code}
                                            className="voucher-hint-chip"
                                            onClick={() => { setVoucherInput(v.code); setVoucherError(''); }}
                                        >
                                            {v.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right: Summary */}
                        <div className="cart-pg-right">
                            <div className="cart-summary-card-new">
                                <h3 className="cart-summary-heading">Order Summary</h3>

                                <div className="cart-summary-lines">
                                    <div className="cart-summary-line">
                                        <span>Subtotal ({cart.item_count} items)</span>
                                        <span>{formatPrice(subtotal, currency)}</span>
                                    </div>
                                    <div className="cart-summary-line">
                                        <span>Shipping</span>
                                        <span className="cart-free-tag">FREE</span>
                                    </div>
                                    {discount > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="cart-summary-line cart-summary-discount"
                                        >
                                            <span>🎟️ {bestVoucher?.code}</span>
                                            <span>−{formatPrice(discount, currency)}</span>
                                        </motion.div>
                                    )}
                                </div>

                                <div className="cart-summary-divider-new" />

                                <div className="cart-summary-total-row">
                                    <span>Total</span>
                                    <div>
                                        <div className="cart-summary-total-price">{formatPrice(finalTotal, currency)}</div>
                                        {currency === 'INR' && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                                                ≈ ${(finalTotal * USD_RATE).toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {discount > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="cart-savings-badge"
                                    >
                                        🎉 You're saving {formatPrice(discount, currency)} on this order!
                                    </motion.div>
                                )}

                                {/* Voucher explainability */}
                                {bestVoucher && (
                                    <div className="cart-voucher-explain">
                                        💡 {bestVoucher.description}
                                    </div>
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="cart-checkout-btn"
                                    onClick={() => navigate('/checkout')}
                                    id="proceed-to-checkout"
                                >
                                    Proceed to Checkout →
                                </motion.button>

                                <div className="cart-cod-note">
                                    🔒 Secure checkout · Cash on Delivery
                                </div>

                                {/* Trust badges */}
                                <div className="cart-trust-row">
                                    <div className="cart-trust-item">📦 Free Returns</div>
                                    <div className="cart-trust-item">⚡ Fast Delivery</div>
                                    <div className="cart-trust-item">🛡️ Buyer Protected</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .cart-pg {
                    min-height: 100vh;
                    background: var(--bg-primary);
                    padding: 24px 0 64px;
                }
                .cart-pg-inner {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 20px;
                }
                .cart-pg-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    margin-bottom: 28px;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .cart-pg-title {
                    font-size: 28px;
                    font-weight: 800;
                    color: var(--text-primary);
                    letter-spacing: -0.5px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 8px;
                }
                .cart-pg-count {
                    font-size: 14px;
                    font-weight: 600;
                    padding: 4px 12px;
                    background: var(--accent-glow);
                    color: var(--accent-primary);
                    border-radius: 20px;
                    border: 1px solid var(--accent-primary);
                }
                .currency-toggle {
                    display: flex;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    overflow: hidden;
                    background: var(--bg-card);
                }
                .currency-btn {
                    padding: 8px 18px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-muted);
                    font-family: inherit;
                    transition: all 0.2s;
                }
                .currency-btn.active {
                    background: var(--accent-primary);
                    color: white;
                }
                .cart-pg-body {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 28px;
                    align-items: start;
                }
                @media (max-width: 900px) {
                    .cart-pg-body { grid-template-columns: 1fr; }
                    .cart-pg-right { position: static; }
                }
                .cart-pg-left { display: flex; flex-direction: column; gap: 16px; }
                .cart-pg-right { position: sticky; top: 90px; }

                /* ─── Item Card ─── */
                .cart-item-card {
                    display: flex;
                    gap: 16px;
                    padding: 20px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    transition: box-shadow 0.2s;
                    align-items: flex-start;
                }
                .cart-item-card:hover { box-shadow: var(--shadow-md); }
                .cart-item-thumb {
                    width: 80px;
                    height: 80px;
                    border-radius: 10px;
                    background: var(--bg-elevated);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    overflow: hidden;
                }
                .cart-item-body { flex: 1; }
                .cart-item-category {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: var(--accent-secondary);
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                .cart-item-name {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                    line-height: 1.3;
                }
                .cart-item-unit { font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
                .cart-item-qty-row { display: flex; align-items: center; gap: 16px; }
                .qty-pill {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    border: 1px solid var(--border);
                    border-radius: 10px;
                    overflow: hidden;
                    background: var(--bg-primary);
                }
                .qty-btn-circle {
                    width: 36px;
                    height: 36px;
                    border: none;
                    background: none;
                    cursor: pointer;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                    transition: background 0.15s;
                    font-family: inherit;
                }
                .qty-btn-circle:hover:not(:disabled) { background: var(--accent-glow); color: var(--accent-primary); }
                .qty-btn-circle:disabled { opacity: 0.4; cursor: not-allowed; }
                .qty-num {
                    min-width: 32px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 14px;
                    border-left: 1px solid var(--border);
                    border-right: 1px solid var(--border);
                    padding: 0 8px;
                    line-height: 36px;
                }
                .cart-remove-link {
                    background: none;
                    border: none;
                    color: var(--danger);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: inherit;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                    padding: 4px 0;
                }
                .cart-remove-link:hover { opacity: 1; text-decoration: underline; }
                .cart-item-price-block { text-align: right; flex-shrink: 0; }
                .cart-item-total-price {
                    font-size: 17px;
                    font-weight: 800;
                    color: var(--text-primary);
                }
                .cart-item-usd-hint { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

                /* ─── Voucher Banner ─── */
                .voucher-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    background: linear-gradient(135deg, rgba(91,76,219,0.08) 0%, rgba(124,111,240,0.06) 100%);
                    border: 1.5px dashed var(--accent-primary);
                    border-radius: 14px;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .voucher-tag {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: var(--accent-primary);
                    margin-bottom: 4px;
                    display: block;
                }
                .voucher-code {
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--text-primary);
                    letter-spacing: 2px;
                    margin-bottom: 2px;
                }
                .voucher-desc { font-size: 12px; color: var(--text-muted); }
                .voucher-banner-right { text-align: right; }
                .voucher-savings {
                    font-size: 22px;
                    font-weight: 800;
                    color: var(--success);
                    margin-bottom: 4px;
                }
                .voucher-remove-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    font-size: 11px;
                    cursor: pointer;
                    font-family: inherit;
                    text-decoration: underline;
                }

                /* ─── Voucher Input ─── */
                .voucher-input-block {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 14px;
                    padding: 20px;
                }
                .voucher-input-title {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 12px;
                }
                .voucher-input-row { display: flex; gap: 10px; }
                .voucher-apply-btn {
                    padding: 12px 20px;
                    border: none;
                    background: var(--accent-gradient);
                    color: white;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 14px;
                    cursor: pointer;
                    font-family: inherit;
                    white-space: nowrap;
                    transition: transform 0.15s;
                }
                .voucher-apply-btn:hover { transform: translateY(-1px); }
                .voucher-hints { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
                .voucher-hint-chip {
                    padding: 4px 12px;
                    background: var(--accent-glow);
                    color: var(--accent-primary);
                    border: 1px solid var(--accent-primary);
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    font-family: inherit;
                    letter-spacing: 0.5px;
                    transition: all 0.15s;
                }
                .voucher-hint-chip:hover { background: var(--accent-primary); color: white; }

                /* ─── Summary Card ─── */
                .cart-summary-card-new {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 20px;
                    padding: 28px;
                    box-shadow: var(--shadow-md);
                }
                .cart-summary-heading {
                    font-size: 18px;
                    font-weight: 800;
                    color: var(--text-primary);
                    margin-bottom: 20px;
                }
                .cart-summary-lines { display: flex; flex-direction: column; gap: 12px; }
                .cart-summary-line {
                    display: flex;
                    justify-content: space-between;
                    font-size: 14px;
                    color: var(--text-secondary);
                }
                .cart-free-tag { color: var(--success); font-weight: 700; }
                .cart-summary-discount { color: var(--success); font-weight: 600; }
                .cart-summary-divider-new { height: 1px; background: var(--border); margin: 16px 0; }
                .cart-summary-total-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--text-primary);
                }
                .cart-summary-total-price { font-size: 24px; font-weight: 800; color: var(--text-primary); }
                .cart-savings-badge {
                    background: var(--success-bg);
                    border: 1px solid rgba(11,184,138,0.25);
                    border-radius: 10px;
                    padding: 10px 14px;
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--success);
                    margin-bottom: 12px;
                    text-align: center;
                }
                .cart-voucher-explain {
                    font-size: 12px;
                    color: var(--text-muted);
                    background: var(--bg-elevated);
                    padding: 10px 14px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                    line-height: 1.5;
                }
                .cart-checkout-btn {
                    width: 100%;
                    padding: 16px;
                    background: var(--accent-gradient);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    font-family: inherit;
                    box-shadow: var(--shadow-glow);
                    margin-bottom: 12px;
                    transition: box-shadow 0.2s;
                }
                .cart-checkout-btn:hover { box-shadow: 0 8px 32px rgba(91,76,219,0.3); }
                .cart-cod-note {
                    text-align: center;
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-bottom: 16px;
                }
                .cart-trust-row {
                    display: flex;
                    justify-content: space-between;
                    padding-top: 16px;
                    border-top: 1px solid var(--border);
                }
                .cart-trust-item { font-size: 11px; color: var(--text-muted); font-weight: 500; }

                /* ─── Empty State ─── */
                .empty-cart-state {
                    text-align: center;
                    padding: 80px 24px;
                }
                .empty-cart-icon { font-size: 72px; margin-bottom: 20px; }
                .empty-cart-title { font-size: 24px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px; }
                .empty-cart-subtitle { font-size: 15px; color: var(--text-muted); margin-bottom: 28px; }
                .empty-cart-cta {
                    display: inline-flex;
                    padding: 14px 32px;
                    background: var(--accent-gradient);
                    color: white;
                    border-radius: 14px;
                    text-decoration: none;
                    font-weight: 700;
                    font-size: 15px;
                    box-shadow: var(--shadow-glow);
                    transition: transform 0.2s;
                }
                .empty-cart-cta:hover { transform: translateY(-2px); }

                /* ─── Cart Items Wrap ─── */
                .cart-items-wrap { display: flex; flex-direction: column; gap: 12px; }

                /* ─── Toast ─── */
                .cart-pg-toast {
                    position: fixed;
                    top: 80px;
                    right: 24px;
                    z-index: 999;
                    padding: 14px 24px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--success);
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(11,184,138,0.15);
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--success);
                }
            `}</style>
        </div>
    );
}

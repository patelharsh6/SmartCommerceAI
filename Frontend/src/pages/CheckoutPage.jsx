import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

export default function CheckoutPage() {
    const { user, isAuthenticated, refreshCart, refreshUser } = useAuth();
    const [cart, setCart] = useState({ items: [], total: 0, item_count: 0 });
    const [loading, setLoading] = useState(true);
    const [placing, setPlacing] = useState(false);
    const [orderPlaced, setOrderPlaced] = useState(null);
    const [error, setError] = useState('');
    const [deliveryInfo, setDeliveryInfo] = useState({
        fullName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
        phone: '',
    });
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            loadCart();
            if (user) {
                setDeliveryInfo({
                    fullName: user.name || '',
                    addressLine1: user.address || '',
                    addressLine2: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    phone: user.phone || '',
                });
            }
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, user]);

    const loadCart = async () => {
        try {
            const data = await api.getCart();
            setCart(data);
            if (data.items.length === 0 && !orderPlaced) {
                navigate('/cart');
            }
        } catch {
            navigate('/cart');
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceOrder = async () => {
        setError('');

        const fullAddress = `${deliveryInfo.fullName}, ${deliveryInfo.addressLine1} ${deliveryInfo.addressLine2}, ${deliveryInfo.city}, ${deliveryInfo.state} ${deliveryInfo.zipCode}`.trim();
        if (!deliveryInfo.addressLine1.trim() || !deliveryInfo.city.trim() || !deliveryInfo.zipCode.trim() || !deliveryInfo.fullName.trim()) {
            setError('Please provide full name, address line 1, city, and zip code');
            return;
        }
        if (!deliveryInfo.phone.trim()) {
            setError('Please provide a phone number');
            return;
        }

        setPlacing(true);
        try {
            const data = await api.placeOrder(fullAddress, deliveryInfo.phone);
            setOrderPlaced(data.order);
            await refreshCart();
            await refreshUser();
        } catch (err) {
            setError(err.message || 'Failed to place order. Please try again.');
        } finally {
            setPlacing(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="auth-page">
                <div className="auth-container animate-in" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}></div>
                    <h2 style={{ marginBottom: 12 }}>Please sign in</h2>
                    <Link to="/login" className="auth-submit-btn" style={{ display: 'inline-block', textDecoration: 'none' }}>
                        Sign In
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="loading-container" style={{ minHeight: '60vh' }}>
                <div className="loading-spinner"></div>
                <div className="loading-text">Loading checkout...</div>
            </div>
        );
    }

    // Order confirmed state
    if (orderPlaced) {
        return (
            <div className="checkout-page">
                <div className="checkout-container animate-in">
                    <div className="order-success">
                        <div className="success-animation">
                            <div className="success-checkmark"></div>
                        </div>
                        <h1 className="success-title">Order Placed Successfully!</h1>
                        <p className="success-subtitle">Thank you for shopping with SmartCommerceAI</p>

                        <div className="success-order-card">
                            <div className="success-order-header">
                                <div>
                                    <div className="success-order-label">Order ID</div>
                                    <div className="success-order-id">{orderPlaced.order_id}</div>
                                </div>
                                <div className="success-order-total">${orderPlaced.total.toFixed(2)}</div>
                            </div>

                            <div className="success-details">
                                <div className="success-detail-row">
                                    <span></span>
                                    <span>Payment: <strong>{orderPlaced.payment_method}</strong></span>
                                </div>
                                <div className="success-detail-row">
                                    <span></span>
                                    <span>Delivery: <strong>{orderPlaced.delivery_address}</strong></span>
                                </div>
                                <div className="success-detail-row">
                                    <span></span>
                                    <span>Estimated: <strong>{orderPlaced.estimated_delivery}</strong></span>
                                </div>
                                <div className="success-detail-row">
                                    <span></span>
                                    <span>Phone: <strong>{orderPlaced.delivery_phone}</strong></span>
                                </div>
                            </div>

                            <div className="success-items">
                                {orderPlaced.items.map((item, i) => (
                                    <div key={i} className="success-item">
                                        <span>{item.image}</span>
                                        <span>{item.name} × {item.quantity}</span>
                                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="success-actions">
                            <Link to="/" className="auth-submit-btn" style={{ textDecoration: 'none' }}>
                                Continue Shopping
                            </Link>
                            <Link to="/profile" className="profile-edit-btn" style={{ textDecoration: 'none', textAlign: 'center' }}>
                                View All Orders
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-page">
            <div className="checkout-container animate-in">
                <div className="cart-header">
                    <Link to="/cart" className="auth-back-link">← Back to Cart</Link>
                    <h1 className="cart-title">
                        Checkout
                    </h1>
                </div>

                {error && (
                    <div className="auth-error">
                        <span></span> {error}
                    </div>
                )}

                <div className="checkout-layout">
                    <div className="checkout-form-section">
                        {/* Delivery Information */}
                        <div className="checkout-section-card">
                            <h3 className="checkout-section-title">Delivery Information</h3>
                            <div className="form-group">
                                <label className="form-label" htmlFor="checkout-fullname">Full Name *</label>
                                <input
                                    id="checkout-fullname"
                                    className="form-input"
                                    placeholder="Enter your full name"
                                    value={deliveryInfo.fullName}
                                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, fullName: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="checkout-address1">Address Line 1 *</label>
                                <input
                                    id="checkout-address1"
                                    className="form-input"
                                    placeholder="House number, street name"
                                    value={deliveryInfo.addressLine1}
                                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, addressLine1: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="checkout-address2">Address Line 2 (Optional)</label>
                                <input
                                    id="checkout-address2"
                                    className="form-input"
                                    placeholder="Apartment, suite, etc."
                                    value={deliveryInfo.addressLine2}
                                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, addressLine2: e.target.value }))}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="checkout-city">City *</label>
                                    <input
                                        id="checkout-city"
                                        className="form-input"
                                        placeholder="City"
                                        value={deliveryInfo.city}
                                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, city: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="checkout-state">State *</label>
                                    <input
                                        id="checkout-state"
                                        className="form-input"
                                        placeholder="State"
                                        value={deliveryInfo.state}
                                        onChange={(e) => setDeliveryInfo(prev => ({ ...prev, state: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="checkout-zip">PIN / ZIP Code *</label>
                                <input
                                    id="checkout-zip"
                                    className="form-input"
                                    placeholder="PIN Code"
                                    value={deliveryInfo.zipCode}
                                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, zipCode: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="checkout-phone">Phone Number *</label>
                                <input
                                    id="checkout-phone"
                                    className="form-input"
                                    placeholder="Enter your phone number"
                                    value={deliveryInfo.phone}
                                    onChange={(e) => setDeliveryInfo(prev => ({ ...prev, phone: e.target.value }))}
                                    required
                                />
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="checkout-section-card">
                            <h3 className="checkout-section-title">Payment Method</h3>
                            <div className="payment-method-card active">
                                <div className="payment-method-radio">
                                    <div className="radio-dot"></div>
                                </div>
                                <div className="payment-method-info">
                                    <div className="payment-method-name">Cash on Delivery</div>
                                    <div className="payment-method-desc">Pay with cash when your order is delivered to your doorstep</div>
                                </div>
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="checkout-section-card">
                            <h3 className="checkout-section-title">Items ({cart.item_count})</h3>
                            <div className="checkout-items">
                                {cart.items.map((item, i) => (
                                    <div key={i} className="checkout-item">
                                        <div className="checkout-item-info">
                                            <div className="checkout-item-name">{item.name}</div>
                                            <div className="checkout-item-qty">Qty: {item.quantity}</div>
                                        </div>
                                        <div className="checkout-item-price">${(item.price * item.quantity).toFixed(2)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="checkout-summary-section">
                        <div className="cart-summary-card">
                            <h3 className="cart-summary-title">Order Total</h3>
                            <div className="cart-summary-row">
                                <span>Subtotal</span>
                                <span>${cart.total.toFixed(2)}</span>
                            </div>
                            <div className="cart-summary-row">
                                <span>Shipping</span>
                                <span className="free-shipping">FREE</span>
                            </div>
                            <div className="cart-summary-row">
                                <span>Payment</span>
                                <span>COD</span>
                            </div>
                            <div className="cart-summary-divider"></div>
                            <div className="cart-summary-row cart-summary-total">
                                <span>Total</span>
                                <span>${cart.total.toFixed(2)}</span>
                            </div>
                            <button
                                className="checkout-btn place-order-btn"
                                onClick={handlePlaceOrder}
                                disabled={placing}
                                id="place-order-btn"
                            >
                                {placing ? (
                                    <>
                                        <span className="btn-spinner"></span>
                                        Placing Order...
                                    </>
                                ) : (
                                    <>Place Order — ${cart.total.toFixed(2)}</>
                                )}
                            </button>
                            <div className="cod-notice">
                                <span></span> Your order is secure. Pay only on delivery.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

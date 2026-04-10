import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

export default function CartPage() {
    const { isAuthenticated, refreshCart } = useAuth();
    const [cart, setCart] = useState({ items: [], total: 0, item_count: 0 });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            loadCart();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated]);

    const loadCart = async () => {
        try {
            const data = await api.getCart();
            setCart(data);
        } catch {
            setCart({ items: [], total: 0, item_count: 0 });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQuantity = async (productId, newQty) => {
        setUpdating(productId);
        try {
            if (newQty <= 0) {
                const data = await api.removeFromCart(productId);
                setCart(data);
            } else {
                const data = await api.updateCartItem(productId, newQty);
                setCart(data);
            }
            await refreshCart();
        } catch (err) {
            console.error('Failed to update cart:', err);
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
        } catch (err) {
            console.error('Failed to remove item:', err);
        } finally {
            setUpdating(null);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="auth-page">
                <div className="auth-container animate-in" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}></div>
                    <h2 style={{ marginBottom: 12 }}>Sign in to view cart</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
                        Please login to add items to your cart and place orders.
                    </p>
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
                <div className="loading-text">Loading your cart...</div>
            </div>
        );
    }

    return (
        <div className="cart-page">
            <div className="cart-container animate-in">
                <div className="cart-header">
                    <Link to="/" className="auth-back-link">← Continue Shopping</Link>
                    <h1 className="cart-title">
                        Your Cart
                        <span className="cart-count-badge">{cart.item_count} item{cart.item_count !== 1 ? 's' : ''}</span>
                    </h1>
                </div>

                {cart.items.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"></div>
                        <h3>Your cart is empty</h3>
                        <p>Browse our products and add some items!</p>
                        <Link to="/" className="auth-submit-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 16 }}>
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="cart-layout">
                        <div className="cart-items-list">
                            {cart.items.map(item => (
                                <div key={item.product_id} className={`cart-item ${updating === item.product_id ? 'cart-item-updating' : ''}`}>
                                    <div className="cart-item-image">{item.image}</div>
                                    <div className="cart-item-details">
                                        <div className="cart-item-name">{item.name}</div>
                                        <div className="cart-item-category">{item.category}</div>
                                        <div className="cart-item-unit-price">₹{item.price.toFixed(2)} each</div>
                                    </div>
                                    <div className="cart-item-controls">
                                        <div className="quantity-control">
                                            <button
                                                className="qty-btn"
                                                onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                                                disabled={updating === item.product_id}
                                            >
                                                −
                                            </button>
                                            <span className="qty-value">{item.quantity}</span>
                                            <button
                                                className="qty-btn"
                                                onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                                                disabled={updating === item.product_id}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="cart-item-total">₹{(item.price * item.quantity).toFixed(2)}</div>
                                        <button
                                            className="cart-remove-btn"
                                            onClick={() => handleRemove(item.product_id)}
                                            disabled={updating === item.product_id}
                                            title="Remove item"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="cart-summary">
                            <div className="cart-summary-card">
                                <h3 className="cart-summary-title">Order Summary</h3>
                                <div className="cart-summary-row">
                                    <span>Subtotal ({cart.item_count} items)</span>
                                    <span>₹{cart.total.toFixed(2)}</span>
                                </div>
                                <div className="cart-summary-row">
                                    <span>Shipping</span>
                                    <span className="free-shipping">FREE</span>
                                </div>
                                <div className="cart-summary-row">
                                    <span>Payment</span>
                                    <span>Cash on Delivery</span>
                                </div>
                                <div className="cart-summary-divider"></div>
                                <div className="cart-summary-row cart-summary-total">
                                    <span>Total</span>
                                    <span>₹{cart.total.toFixed(2)}</span>
                                </div>
                                <button
                                    className="checkout-btn"
                                    onClick={() => navigate('/checkout')}
                                    id="proceed-to-checkout"
                                >
                                    Proceed to Checkout →
                                </button>
                                <div className="cod-notice">
                                    <span></span> Pay with cash when your order is delivered
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

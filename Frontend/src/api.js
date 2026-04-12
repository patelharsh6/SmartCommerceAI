3/**
 * API Service Layer
 * Handles all communication between Frontend and Backend
 */

import BACKEND_URL from './config';  // ← ADD THIS

const API_BASE = `${BACKEND_URL}/api`;   // http://localhost:8000/api
const AUTH_BASE = `${BACKEND_URL}/auth`; // http://localhost:8000/auth

// ─── Core Fetch Helper ───
async function fetchJSON(url, options = {}) {
    const token = localStorage.getItem('smartcommerce_token');
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            ...options,
        });
        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.message || `API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
    return await response.json()
  }

// ─── Auth ───
export const login = async (email, password) => {
    const data = await fetchJSON(`${AUTH_BASE}/login`, {  // ← /auth/login
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (!data.token) {
        data.token = 'smartcommerce-jwt-token';
    }
    return data;
};

export const signup = async (name, email, password, phone, address) => {
    return fetchJSON(`${AUTH_BASE}/register`, {  // ← /auth/register
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone, address }),
    });
};

export const verifyOTP = async (email, otp) => {
    return fetchJSON(`${AUTH_BASE}/verify-otp`, {  // ← /auth/verify-otp
        method: 'POST',
        body: JSON.stringify({ email, otp }),
    });
};

export const resendOTP = async (email) => {
    return fetchJSON(`${AUTH_BASE}/resend-otp`, {  // ← /auth/resend-otp
        method: 'POST',
        body: JSON.stringify({ email }),
    });
};

export const resetPassword = async (email, otp, newPassword) => {
    return fetchJSON(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ email, otp, new_password: newPassword }),
    });
};

// ─── Profile ───
export const getProfile = async () => {
  try {
    const userStr = localStorage.getItem('smartcommerce_user')
    if (userStr) return { user: JSON.parse(userStr) }
    return { user: null }
  } catch {
    return { user: null }
  }
}

export const updateProfile = async (data) => {
    try {
        const res = await fetchJSON(`${AUTH_BASE}/update-profile`, {  // ← /auth/update-profile
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const stored = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
        localStorage.setItem('smartcommerce_user', JSON.stringify({ ...stored, ...data }));
        return res;
    } catch {
        const stored = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
        const updated = { ...stored, ...data };
        localStorage.setItem('smartcommerce_user', JSON.stringify(updated));
        return { message: 'Profile updated locally' };
    }
};

// ─── Cart (localStorage-backed) ───
const CART_KEY = 'smartcommerce_cart';

const _readCart = () => {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '{"items":[],"total":0,"item_count":0}')
  } catch {
    return { items: [], total: 0, item_count: 0 }
  }
}

const _saveCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  return cart
}

const _recalc = (items) => ({
    items,
    total: items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 1), 0),
    item_count: items.reduce((s, i) => s + (i.quantity || 1), 0),
});

export const getCart = async () => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    console.log('[getCart] email:', email);
    if (!email) {
        return { items: [], total: 0, item_count: 0 };
    }

    try {
        const data = await fetchJSON(`${BACKEND_URL}/cart/${encodeURIComponent(email)}`);
        console.log('[getCart] raw response:', data);
        const rawItems = data.cart_items || [];
        // Normalize: ensure each item has a flat `price` for CartItemCard
        const items = rawItems.map(item => ({
            ...item,
            price: item.price || item.pricing?.best_price || item.pricing?.predicted_price || item.pricing?.base_price || 0,
            img_url: item.img_url || item.image_url || item.image || null,
        }));
        const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
        const item_count = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        console.log('[getCart] normalized items:', items.length, 'total:', total);
        return { items, total, item_count };
    } catch (err) {
        console.error('[getCart] Failed to load cart from backend:', err);
        return { items: [], total: 0, item_count: 0 };
    }
};

export const addToCart = async (product) => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    console.log('[addToCart] email:', email, 'product:', product);
    if (!email) {
        throw new Error('User email required to save cart to backend');
    }

    const payload = {
        email,
        product_id: product.product_id,
        name: product.name,
        category: product.category || product.cat || null,
        sub_category: product.sub_category || product.subcategory || null,
        brand: product.brand || null,
        pricing: {
            base_price: Number(product.price ?? product.base_price ?? 0),
            predicted_price: Number(product.price ?? product.predicted_price ?? product.base_price ?? 0),
            best_price: Number(product.price ?? product.best_price ?? product.base_price ?? 0),
        },
        quantity: product.quantity || 1,
    };

    console.log('[addToCart] Sending payload:', JSON.stringify(payload));

    const result = await fetchJSON(`${BACKEND_URL}/add-to-cart`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    console.log('[addToCart] Backend response:', result);

    // Re-fetch the full cart from backend so UI stays in sync
    return await getCart();
};

export const updateCartItem = async (productId, qty) => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    if (!email) {
        throw new Error('User email required');
    }

    console.log(`[updateCartItem] email=${email}, productId=${productId}, qty=${qty}`);

    await fetchJSON(`${BACKEND_URL}/cart/${encodeURIComponent(email)}/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity: qty }),
    });

    // Re-fetch normalized cart
    return await getCart();
};

export const removeFromCart = async (productId) => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    if (!email) {
        throw new Error('User email required');
    }

    console.log(`[removeFromCart] email=${email}, productId=${productId}`);

    await fetchJSON(`${BACKEND_URL}/cart/${encodeURIComponent(email)}/${productId}`, {
        method: 'DELETE',
    });

    // Re-fetch normalized cart
    return await getCart();
};

export const clearCart = async () => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    if (email) {
        try {
            await fetchJSON(`${BACKEND_URL}/cart/${encodeURIComponent(email)}`, {
                method: 'DELETE',
            });
        } catch (err) {
            console.error('[clearCart] Failed to clear cart on backend:', err);
        }
    }
    return { items: [], total: 0, item_count: 0 };
};

// ─── Orders ───

export const getOrders = async () => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    console.log('[getOrders] email:', email);
    if (!email) {
        return { orders: [] };
    }

    try {
        const data = await fetchJSON(`${BACKEND_URL}/orders/${encodeURIComponent(email)}`);
        console.log('[getOrders] response:', data);
        return { orders: data.orders || [] };
    } catch (err) {
        console.error('[getOrders] Failed to load orders:', err);
        return { orders: [] };
    }
};

export const placeOrder = async (deliveryAddress, deliveryPhone) => {
    const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}');
    const email = user?.email;
    console.log('[placeOrder] email:', email);

    if (!email) {
        throw new Error('User email required to place order');
    }

    // Call backend to place order (backend fetches cart, creates order, clears cart)
    const result = await fetchJSON(`${BACKEND_URL}/orders`, {
        method: 'POST',
        body: JSON.stringify({
            email,
            delivery_address: deliveryAddress,
            delivery_phone: deliveryPhone,
        }),
    });

    console.log('[placeOrder] Backend response:', result);

    if (result.error) {
        throw new Error(result.error);
    }

    // Update local user stats
    if (user && result.order) {
        user.total_orders = (user.total_orders || 0) + 1;
        user.total_spent = (user.total_spent || 0) + (result.order.total || 0);
        localStorage.setItem('smartcommerce_user', JSON.stringify(user));
    }

    return { order: result.order };
};

// ─── Currency ───
export const getExchangeRate = async () => {
    return { INR_TO_USD: 0.012 };
};

// ─── Products ───
export const getProducts = (category = null) => {
  const params = category ? `?category=${encodeURIComponent(category)}` : ''
  return fetchJSON(`${API_BASE}/products${params}`)
}

export const getProduct = (productId) => {
  return fetchJSON(`${API_BASE}/products/${productId}`)
}

// ─── Events ───
export const recordEvent = (userId, productId, eventType = 'view') => {
  return fetchJSON(`${API_BASE}/events`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, product_id: productId, event_type: eventType }),
  })
}

// ─── Recommendations ───
export const getRecommendations = async (productId, userId = null) => {
    try {
        const encodedProductId = encodeURIComponent(productId);
        const params = userId ? `?user_id=${encodeURIComponent(userId)}` : '';

        return await fetchJSON(`${API_BASE}/recommendations/${encodedProductId}${params}`);
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        return null;
    }
};

export const getTrending = (limit = 5) => {
  return fetchJSON(`${API_BASE}/trending?limit=${limit}`)
}

export const getBrandRecommendations = (query, limit = 10) => {
  return fetchJSON(`${API_BASE}/brand-recommend/${encodeURIComponent(query)}?limit=${limit}`)
}

// ─── Dynamic Pricing ───
export const getPrice = (productId, userId = null) => {
    if (userId) return fetchJSON(`${API_BASE}/price/${productId}/${userId}`);
    return fetchJSON(`${API_BASE}/price/${productId}`);
};

// ─── Users & Sessions ───
export const getUsers = () => fetchJSON(`${API_BASE}/users`);
export const getSession = (userId) => fetchJSON(`${API_BASE}/session/${userId}`);

// ─── Dashboard ───
export const getDashboard = () => fetchJSON(`${API_BASE}/dashboard`);

// ─── Catalog ───
export const getCatalog = (page = 1, limit = 20, category = null, subcategory = null, search = null) => {
    const params = new URLSearchParams({ page, limit });
    if (category) params.append('category', category);
    if (subcategory) params.append('subcategory', subcategory);
    if (search) params.append('search', search);
    return fetchJSON(`${API_BASE}/catalog?${params.toString()}`);
};

<<<<<<< HEAD
/**
 * API Service Layer
 * Handles all communication between Frontend and Backend
 */

const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
}

// ─── Product APIs ───
export const getProducts = (category = null) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetchJSON(`${API_BASE}/products${params}`);
};

export const getProduct = (productId) => {
    return fetchJSON(`${API_BASE}/products/${productId}`);
};

// ─── Event Tracking ───
export const recordEvent = (userId, productId, eventType = 'view') => {
    return fetchJSON(`${API_BASE}/events`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, product_id: productId, event_type: eventType }),
    });
};

// ─── Recommendations ───
export const getRecommendations = (productId, userId = null) => {
    const params = userId ? `?user_id=${userId}` : '';
    return fetchJSON(`${API_BASE}/recommendations/${productId}${params}`);
};

export const getTrending = (limit = 5) => {
    return fetchJSON(`${API_BASE}/trending?limit=${limit}`);
};

export const getBrandRecommendations = (query, limit = 10) => {
    return fetchJSON(`${API_BASE}/brand-recommend/${encodeURIComponent(query)}?limit=${limit}`);
};

// ─── Dynamic Pricing ───
export const getPrice = (productId, userId = null) => {
    if (userId) {
        return fetchJSON(`${API_BASE}/price/${productId}/${userId}`);
    }
    return fetchJSON(`${API_BASE}/price/${productId}`);
};

// ─── Users & Sessions ───
export const getUsers = () => {
    return fetchJSON(`${API_BASE}/users`);
};

export const getSession = (userId) => {
    return fetchJSON(`${API_BASE}/session/${userId}`);
};

// ─── Dashboard ───
export const getDashboard = () => {
    return fetchJSON(`${API_BASE}/dashboard`);
};
=======
/**
 * API Service Layer
 * Handles all communication between Frontend and Backend
 */

import BACKEND_URL from './config';

if (!BACKEND_URL) {
    console.warn('VITE_BACKEND_URL is not set. Backend API calls may fail.');
}

const API_BASE = `${BACKEND_URL}/api`;

function getAuthHeaders() {
    const token = localStorage.getItem('smartcommerce_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

async function fetchJSON(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            ...options,
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const error = new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
}

// ─── Auth APIs ───
export const signup = (name, email, password, phone = '', address = '') => {
    return fetchJSON(`${API_BASE}/auth/signup`, {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone, address }),
    });
};

export const login = (email, password) => {
    return fetchJSON(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
};

export const getProfile = () => {
    return fetchJSON(`${API_BASE}/auth/profile`);
};

export const updateProfile = (data) => {
    return fetchJSON(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
};

// ─── Cart APIs ───
export const getCart = () => {
    return fetchJSON(`${API_BASE}/auth/cart`);
};

export const addToCart = (product) => {
    return fetchJSON(`${API_BASE}/auth/cart`, {
        method: 'POST',
        body: JSON.stringify(product),
    });
};

export const updateCartItem = (productId, quantity) => {
    return fetchJSON(`${API_BASE}/auth/cart/${productId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
    });
};

export const removeFromCart = (productId) => {
    return fetchJSON(`${API_BASE}/auth/cart/${productId}`, {
        method: 'DELETE',
    });
};

// ─── Order APIs ───
export const getOrders = () => {
    return fetchJSON(`${API_BASE}/auth/orders`);
};

export const placeOrder = (address = '', phone = '') => {
    return fetchJSON(`${API_BASE}/auth/orders`, {
        method: 'POST',
        body: JSON.stringify({ address, phone }),
    });
};

// ─── Product APIs ───
export const getProducts = (category = null) => {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetchJSON(`${API_BASE}/products${params}`);
};

export const getProduct = (productId) => {
    return fetchJSON(`${API_BASE}/products/${productId}`);
};

// ─── Event Tracking ───
export const recordEvent = (userId, productId, eventType = 'view') => {
    return fetchJSON(`${API_BASE}/events`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, product_id: productId, event_type: eventType }),
    });
};

// ─── Recommendations ───
export const getRecommendations = (productId, userId = null) => {
    const params = userId ? `?user_id=${userId}` : '';
    return fetchJSON(`${API_BASE}/recommendations/${productId}${params}`);
};

export const getTrending = (limit = 5) => {
    return fetchJSON(`${API_BASE}/trending?limit=${limit}`);
};

// ─── Dynamic Pricing ───
export const getPrice = (productId, userId = null) => {
    if (userId) {
        return fetchJSON(`${API_BASE}/price/${productId}/${userId}`);
    }
    return fetchJSON(`${API_BASE}/price/${productId}`);
};

// ─── Users & Sessions ───
export const getUsers = () => {
    return fetchJSON(`${API_BASE}/users`);
};

export const getSession = (userId) => {
    return fetchJSON(`${API_BASE}/session/${userId}`);
};

// ─── Dashboard ───
export const getDashboard = () => {
    return fetchJSON(`${API_BASE}/dashboard`);
};
>>>>>>> 5bdcf156df9f45a3889d4587eca3e99a6246fc64

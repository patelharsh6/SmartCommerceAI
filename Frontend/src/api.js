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

export const getCatalog = async (page = 1, limit = 20, category = '', subcategory = '', search = '') => {
  const params = new URLSearchParams({ page, limit });
  if (category) params.append('category', category);
  if (subcategory) params.append('subcategory', subcategory);
  if (search) params.append('search', search);

  return fetchJSON(`${API_BASE}/catalog?${params.toString()}`);
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

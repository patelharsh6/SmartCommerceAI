/**
 * API Service Layer
 * Handles all communication between Frontend and Backend
 */

import BACKEND_URL from './config'
const API_BASE = BACKEND_URL  // e.g. http://localhost:8000

// ─── Core Fetch Helper ───
async function fetchJSON(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(errData?.message || `API Error: ${response.status} ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error)
    throw error
  }
}

// ─── Auth ───
export const login = async (email, password) => {
  const data = await fetchJSON(`${API_BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!data.token) {
    data.token = 'smartcommerce-jwt-token'
  }
  return data
}

export const signup = async (name, email, password, phone, address) => {
  return fetchJSON(`${API_BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ name, email, password, phone, address }),
  })
}

export const verifyOTP = async (email, otp) => {
  return fetchJSON(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  })
}

export const resendOTP = async (email) => {
  return fetchJSON(`${API_BASE}/auth/resend-otp`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

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
    const res = await fetchJSON(`${API_BASE}/auth/update-profile`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    const stored = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}')
    localStorage.setItem('smartcommerce_user', JSON.stringify({ ...stored, ...data }))
    return res
  } catch {
    const stored = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}')
    localStorage.setItem('smartcommerce_user', JSON.stringify({ ...stored, ...data }))
    return { message: 'Profile updated locally' }
  }
}

// ─── Cart (localStorage) ───
const CART_KEY = 'smartcommerce_cart'

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
  total: items.reduce((s, i) => s + i.price * i.quantity, 0),
  item_count: items.reduce((s, i) => s + i.quantity, 0),
})

export const getCart = async () => _readCart()

export const addToCart = async (product) => {
  const cart = _readCart()
  const existing = cart.items.find(i => i.product_id === product.product_id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.items.push({ ...product, quantity: 1 })
  }
  return _saveCart(_recalc(cart.items))
}

export const updateCartItem = async (productId, qty) => {
  const cart = _readCart()
  const item = cart.items.find(i => i.product_id === productId)
  if (item) item.quantity = qty
  return _saveCart(_recalc(cart.items))
}

export const removeFromCart = async (productId) => {
  const cart = _readCart()
  const items = cart.items.filter(i => i.product_id !== productId)
  return _saveCart(_recalc(items))
}

export const clearCart = () => {
  return _saveCart({ items: [], total: 0, item_count: 0 })
}

// ─── Orders ───
const ORDERS_KEY = 'smartcommerce_orders'

export const getOrders = async () => {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    return { orders: stored }
  } catch {
    return { orders: [] }
  }
}

export const placeOrder = async (deliveryAddress, deliveryPhone) => {
  const cart = _readCart()
  if (cart.items.length === 0) throw new Error('Cart is empty')

  const user = JSON.parse(localStorage.getItem('smartcommerce_user') || '{}')
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`
  const d = new Date()
  d.setDate(d.getDate() + 5)

  const order = {
    order_id: orderId,
    items: cart.items,
    total: cart.total,
    item_count: cart.item_count,
    status: 'confirmed',
    payment_method: 'Cash on Delivery',
    delivery_address: deliveryAddress,
    delivery_phone: deliveryPhone,
    estimated_delivery: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    created_at: new Date().toISOString(),
  }

  const orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
  orders.unshift(order)
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))

  if (user) {
    user.total_orders = (user.total_orders || 0) + 1
    user.total_spent = (user.total_spent || 0) + cart.total
    localStorage.setItem('smartcommerce_user', JSON.stringify(user))
  }

  clearCart()
  return { order }
}

// ─── Currency ───
export const getExchangeRate = async () => ({ INR_TO_USD: 0.012 })

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
export const getRecommendations = (productId, userId = null) => {
  const params = userId ? `?user_id=${userId}` : ''
  return fetchJSON(`${API_BASE}/recommendations/${productId}${params}`)
}

export const getTrending = (limit = 5) => {
  return fetchJSON(`${API_BASE}/trending?limit=${limit}`)
}

export const getBrandRecommendations = (query, limit = 10) => {
  return fetchJSON(`${API_BASE}/brand-recommend/${encodeURIComponent(query)}?limit=${limit}`)
}

// ─── Dynamic Pricing ───
export const getPrice = (productId, userId = null) => {
  if (userId) return fetchJSON(`${API_BASE}/price/${productId}/${userId}`)
  return fetchJSON(`${API_BASE}/price/${productId}`)
}

// ─── Users & Sessions ───
export const getUsers = () => fetchJSON(`${API_BASE}/users`)
export const getSession = (userId) => fetchJSON(`${API_BASE}/session/${userId}`)

// ─── Dashboard ───
export const getDashboard = () => fetchJSON(`${API_BASE}/dashboard`)

// ─── Catalog (paginated — calls /catalog endpoint on port 8000) ───
export const getCatalog = async (page = 1, limit = 20, category = null, subcategory = null, search = null) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (category)   params.append('category', category)
  if (subcategory) params.append('subcategory', subcategory)
  if (search)     params.append('search', search)

  try {
    // ✅ Calls dedicated /catalog endpoint
    const data = await fetchJSON(`${API_BASE}/catalog?${params.toString()}`)
    return {
      products:   data.products   || [],
      categories: data.categories || [],
      page:       data.page       || page,
      has_more:   data.has_more   ?? ((data.products || []).length === limit),
      total:      data.total      || (data.products || []).length,
    }
  } catch (err) {
    // ✅ Graceful fallback to /products if /catalog doesn't exist yet
    console.warn('/catalog endpoint not found, falling back to /products:', err.message)
    const data = await fetchJSON(`${API_BASE}/products?${params.toString()}`)
    return {
      products:   data.products   || [],
      categories: data.categories || [],
      page,
      has_more:   (data.products || []).length === limit,
      total:      data.total      || (data.products || []).length,
    }
  }
}
<<<<<<< HEAD
import { useState, useEffect, useCallback } from 'react'
import './App.css'
import * as api from './api'

/* ═══════════════════════════════════════════════════════════════
   SmartCommerceAI — Main Application
   E-Commerce Dynamic Pricing & Recommendation System
   ═══════════════════════════════════════════════════════════════ */

function App() {
  // ─── State ───
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [trending, setTrending] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [session, setSession] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productPricing, setProductPricing] = useState(null)
  const [productRecs, setProductRecs] = useState(null)
  const [productPrices, setProductPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ─── Brand Search State ───
  const [searchQuery, setSearchQuery] = useState('')
  const [brandRecsData, setBrandRecsData] = useState(null)
  const [isSearching, setIsSearching] = useState(false)

  // ─── Search Handler ───
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setBrandRecsData(null)
      return
    }
    setIsSearching(true)
    try {
      const results = await api.getBrandRecommendations(searchQuery)
      setBrandRecsData(results)
    } catch (err) {
      console.error(err)
    } finally {
      setIsSearching(false)
    }
  }

  // ─── Initial Data Load ───
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true)
        const [productsData, usersData, trendingData, dashboardData] = await Promise.all([
          api.getProducts(),
          api.getUsers(),
          api.getTrending(5),
          api.getDashboard()
        ])
        setProducts(productsData.products)
        setCategories(productsData.categories)
        setUsers(usersData.users)
        setTrending(trendingData.trending)
        setDashboard(dashboardData)
        // Default to first user
        if (usersData.users.length > 0) {
          setSelectedUser(usersData.users[0])
        }
        setError(null)
      } catch (err) {
        setError('Failed to connect to backend. Make sure the API server is running on port 8000.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // ─── Load prices for all products when user changes ───
  useEffect(() => {
    if (!selectedUser || products.length === 0) return
    async function loadPrices() {
      const prices = {}
      await Promise.all(
        products.map(async (p) => {
          try {
            const priceData = await api.getPrice(p.product_id, selectedUser.user_id)
            prices[p.product_id] = priceData
          } catch { /* ignore individual failures */ }
        })
      )
      setProductPrices(prices)
    }
    loadPrices()
  }, [selectedUser, products])

  // ─── Load session when user changes ───
  useEffect(() => {
    if (!selectedUser) return
    api.getSession(selectedUser.user_id)
      .then(setSession)
      .catch(() => setSession(null))
  }, [selectedUser])

  // ─── Filter products by category ───
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products

  // ─── Handle product click ───
  const handleProductClick = useCallback(async (product) => {
    setSelectedProduct(product)
    setProductPricing(null)
    setProductRecs(null)

    try {
      // Record event
      if (selectedUser) {
        await api.recordEvent(selectedUser.user_id, product.product_id, 'click')
        // Refresh session
        const sess = await api.getSession(selectedUser.user_id)
        setSession(sess)
      }

      // Load pricing + recommendations in parallel
      const [pricing, recs] = await Promise.all([
        api.getPrice(product.product_id, selectedUser?.user_id),
        api.getRecommendations(product.product_id, selectedUser?.user_id)
      ])
      setProductPricing(pricing)
      setProductRecs(recs)
    } catch (err) {
      console.error('Error loading product details:', err)
    }
  }, [selectedUser])

  // ─── Handle recommendation click ───
  const handleRecClick = useCallback((product) => {
    handleProductClick(product)
  }, [handleProductClick])

  // ─── Close modal ───
  const closeModal = () => {
    setSelectedProduct(null)
    setProductPricing(null)
    setProductRecs(null)
  }

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner"></div>
        <div className="loading-text">Connecting to SmartCommerceAI Engine...</div>
      </div>
    )
  }

  // ─── Error State ───
  if (error) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <div style={{ color: 'var(--danger)', fontSize: '18px', fontWeight: 600 }}>Connection Error</div>
        <div className="loading-text" style={{ maxWidth: 500, textAlign: 'center' }}>{error}</div>
        <button
          className="category-btn active"
          onClick={() => window.location.reload()}
          style={{ marginTop: 16 }}
        >
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ─── NAVBAR ─── */}
      <nav className="navbar" id="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span className="navbar-logo">🛒</span>
            <div>
              <div className="navbar-title">SmartCommerceAI</div>
            </div>
          </div>


          <div className="navbar-status">
            <span className="status-dot"></span>
            System Active
          </div>
        </div>
      </nav>

      <div className="app-container">
        {/* ─── HERO ─── */}
        <section className="hero animate-in" id="hero-section">
          <h1>Smart Pricing, <span>Smarter Shopping</span></h1>
          <p className="hero-desc">
            Real-time dynamic pricing powered by demand analysis, competitor tracking,
            and personalized user segments — all working together seamlessly.
          </p>
        </section>

        {/* ─── STATS BAR ─── */}
        {dashboard && (
          <div className="stats-bar" id="stats-bar">
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_products}</div>
              <div className="stat-label">Products</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_events}</div>
              <div className="stat-label">Events Tracked</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_users}</div>
              <div className="stat-label">User Segments</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.active_sessions}</div>
              <div className="stat-label">Active Sessions</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.categories?.length || 0}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        )}

        {/* ─── SESSION PANEL ─── */}
        {session && session.total_views > 0 && (
          <div className="session-panel animate-in" id="session-panel">
            <div className="session-header">
              <div className="session-title">
                <span>🧭</span> Your Journey — {selectedUser?.name}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {session.total_views} products viewed
              </span>
            </div>
            <div className="session-journey">{session.journey_explanation}</div>
            <div className="session-products">
              {session.products_viewed.map((pv, i) => (
                <span key={i} className="session-product-tag">
                  <span>{pv.image}</span> {pv.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── TRENDING SECTION ─── */}
        <section className="trending-section animate-in animate-in-delay-1" id="trending-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon">🔥</span> Trending Now
            </div>
            <span className="section-badge">Live Data</span>
          </div>
          <div className="trending-grid">
            {trending.map((item, i) => (
              <div
                key={item.product_id}
                className="trending-card"
                onClick={() => handleProductClick(item)}
                id={`trending-${item.product_id}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="trending-rank">{item.trending_rank}</span>
                <div className="trending-emoji">{item.image}</div>
                <div className="trending-name">{item.name}</div>
                <div className="trending-views">{item.view_count} interactions</div>
                <div className="trending-price">${item.base_price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── BRAND RECOMMENDATION SECTION ─── */}
        <section className="search-section animate-in" id="search-section" style={{ background: '#fff', padding: '30px', margin: '30px 0', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
          <div className="section-header" style={{ justifyContent: 'center', marginBottom: '25px' }}>
            <div className="section-title">
              <span className="section-icon">🔍</span> Brand Explorer
            </div>
          </div>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search products (e.g., iPhone 13, Xiaomi Phone)..."
              style={{ padding: '14px 20px', width: '100%', maxWidth: '400px', borderRadius: '12px', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '16px', outline: 'none' }}
            />
            <button type="submit" className="category-btn active" style={{ padding: '14px 28px', fontSize: '16px', margin: 0, borderRadius: '12px' }}>
              {isSearching ? 'Searching...' : 'Find Brands'}
            </button>
          </form>

          {brandRecsData && (
            <div style={{ marginTop: '40px', animation: 'fade-in 0.3s ease-out' }}>
              <div className="section-header">
                <div className="section-title">
                  <span className="section-icon">🏷️</span> Match: {brandRecsData.brand || 'Try again'}
                </div>
                <span className="section-badge">{brandRecsData.explanation}</span>
              </div>

              {brandRecsData.recommendations?.length > 0 ? (
                <div className="product-grid" style={{ marginTop: 20 }}>
                  {brandRecsData.recommendations.map((product, i) => (
                    <div
                      key={`brand-${product.product_id}`}
                      className="product-card animate-in"
                      style={{ animationDelay: `${i * 0.05}s` }}
                      onClick={() => handleProductClick(product)}
                    >
                      <span className="product-card-emoji">{product.image}</span>
                      <div className="product-card-category">{product.category}</div>
                      <div className="product-card-name">{product.name}</div>
                      <div className="product-card-desc" style={{ color: 'var(--primary)' }}>{product.brand}</div>
                      <div className="product-card-price">
                        <span className="price-current">${product.base_price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No related products found. Please try another query!
                </div>
              )}
            </div>
          )}
        </section>

        {/* ─── PRODUCT CATALOG ─── */}
        <section className="animate-in animate-in-delay-2" id="products-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon">📦</span> Product Catalog
            </div>
            <span className="section-badge">{filteredProducts.length} items</span>
          </div>

          {/* Category Filters */}
          <div className="category-filters" id="category-filters">
            <button
              className={`category-btn ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            {categories.map(cat => (
              <button
<<<<<<< Updated upstream
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
=======
                key={cat.code}
                className={`category-btn ${selectedCategory === cat.code ||
                    (cat.subcategories && cat.subcategories.some(s => s.code === selectedCategory))
                    ? 'active' : ''
                  }`}
                onClick={() => handleCategoryClick(cat.code, true)}
>>>>>>> Stashed changes
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="product-grid" id="product-grid">
            {filteredProducts.map((product, i) => {
              const priceData = productPrices[product.product_id]
              const isTrending = trending.some(t => t.product_id === product.product_id)
              return (
                <div
                  key={product.product_id}
                  className="product-card animate-in"
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => handleProductClick(product)}
                  id={`product-${product.product_id}`}
                >
                  {isTrending && (
                    <span className="trending-badge">🔥 Trending</span>
                  )}
                  <span className="product-card-emoji">{product.image}</span>
                  <div className="product-card-category">{product.category}</div>
                  <div className="product-card-name">{product.name}</div>
                  <div className="product-card-desc">{product.description}</div>
                  <div className="product-card-price">
                    <span className="price-current">
                      ${priceData ? priceData.final_price : product.base_price}
                    </span>
                    {priceData && priceData.final_price !== priceData.base_price && (
                      <>
                        <span className="price-base">${priceData.base_price}</span>
                        <span className={`price-badge ${priceData.savings_percent > 0 ? 'savings' : 'increase'}`}>
                          {priceData.savings_percent > 0 ? `Save ${priceData.savings_percent}%` : `+${Math.abs(priceData.savings_percent)}%`}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="footer" id="footer">
          <div className="footer-text">
            SmartCommerceAI — E-Commerce Dynamic Pricing & Recommendation System v1.0
          </div>
          <div className="footer-team">
            <span className="footer-member">🔴 Harsh — Backend + Integration</span>
            <span className="footer-member">🟢 Het — Recommendation Engine</span>
            <span className="footer-member">🔵 Anuj — Dynamic Pricing</span>
            <span className="footer-member">🟡 Ansh — Session + UI</span>
          </div>
        </footer>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PRODUCT DETAIL MODAL
          ═══════════════════════════════════════════════════════════════ */}
      {selectedProduct && (
        <div className="modal-overlay" id="product-modal" onClick={(e) => {
          if (e.target === e.currentTarget) closeModal()
        }}>
          <div className="modal-content">
            <button className="modal-close" onClick={closeModal} id="modal-close-btn">✕</button>

            {/* Header */}
            <div className="detail-header">
              <div className="detail-emoji">{selectedProduct.image}</div>
              <div className="detail-info">
                <div className="detail-category">{selectedProduct.category}</div>
                <h2 className="detail-name">{selectedProduct.name}</h2>
                <p className="detail-desc">{selectedProduct.description}</p>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Stock: {selectedProduct.stock} units • ID: {selectedProduct.product_id}
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="pricing-section" id="pricing-section">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <span className="section-icon">💰</span> Dynamic Price Breakdown
              </div>

              {productPricing ? (
                <>
                  <div className="pricing-header">
                    <div className="pricing-main">
                      <span className="pricing-final">${productPricing.final_price}</span>
                      {productPricing.final_price !== productPricing.base_price && (
                        <span className="pricing-original">${productPricing.base_price}</span>
                      )}
                    </div>
                    {productPricing.savings_percent !== 0 && (
                      <span className={`pricing-savings-badge ${productPricing.savings_percent > 0 ? 'saving' : 'increase'}`}>
                        {productPricing.savings_percent > 0
                          ? `You save $${productPricing.total_savings} (${productPricing.savings_percent}%)`
                          : `+$${Math.abs(productPricing.total_savings)} (${Math.abs(productPricing.savings_percent)}%)`
                        }
                      </span>
                    )}
                  </div>

                  <div className="pricing-explanation">
                    <span className="pricing-explanation-icon">🧠</span>
                    {productPricing.explanation}
                  </div>

                  <div className="adjustments-list" id="adjustments-list">
                    {productPricing.adjustments.map((adj, i) => (
                      <div key={i} className="adjustment-item" style={{ animation: `slide-in-right 0.3s ease-out ${i * 0.1}s both` }}>
                        <span className="adjustment-icon">{adj.icon}</span>
                        <div className="adjustment-content">
                          <div className="adjustment-factor">{adj.factor}</div>
                          <div className="adjustment-desc">{adj.description}</div>
                        </div>
                        <span className={`adjustment-impact ${adj.impact.startsWith('+') ? 'positive' :
                          adj.impact.startsWith('-') ? 'negative' : 'neutral'
                          }`}>
                          {adj.impact}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Demand Stats from ML Model */}
                  {productPricing.demand_stats && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                      marginTop: 16, padding: 14, borderRadius: 12,
                      background: 'var(--bg-secondary, #f8f9fc)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                          {productPricing.demand_stats.views}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Views</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success, #22c55e)' }}>
                          {productPricing.demand_stats.purchases}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchases</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning, #f59e0b)' }}>
                          {productPricing.demand_stats.cart_adds}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cart Adds</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger, #ef4444)' }}>
                          {(productPricing.demand_stats.conversion_rate * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Conversion</div>
                      </div>
                    </div>
                  )}

                  {/* Cache Date Indicator */}
                  {productPricing.cache_date && (
                    <div style={{
                      marginTop: 12, fontSize: 11, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      <span>🔄</span> Price calculated for {productPricing.cache_date} • Refreshes daily
                      {productPricing.ml_factor && (
                        <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>
                          ML Factor: {productPricing.ml_factor}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Calculating dynamic price...</div>
                </div>
              )}
            </div>

            {/* Recommendations Section */}
            <div className="recommendations-section" id="recommendations-section">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <span className="section-icon">🎯</span> Personalized Recommendations
              </div>

              {productRecs ? (
                <>
                  {/* Category-based */}
                  {productRecs.category_based?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">📂 Similar Products</span>
                        <span className="rec-group-explanation">{productRecs.category_based.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.category_based.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frequently Bought Together (Apriori Model) */}
                  {productRecs.frequently_bought?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🔗 Frequently Bought Together</span>
                        <span className="rec-group-explanation">{productRecs.frequently_bought.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.frequently_bought.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session-based */}
                  {productRecs.session_based?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🧭 Based on Your Journey</span>
                        <span className="rec-group-explanation">{productRecs.session_based.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.session_based.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending */}
                  {productRecs.trending?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🔥 Trending Right Now</span>
                        <span className="rec-group-explanation">{productRecs.trending.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.trending.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Finding recommendations...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
=======
import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import './App.css'
import * as api from './api'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'

/* ═══════════════════════════════════════════════════════════════
   SmartCommerceAI — Main Application
   E-Commerce Dynamic Pricing & Recommendation System
   ═══════════════════════════════════════════════════════════════ */

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
    </Routes>
  )
}

function HomePage() {
  const { user, isAuthenticated, logout, cartCount, refreshCart } = useAuth()
  const navigate = useNavigate()

  // ─── State ───
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [expandedParent, setExpandedParent] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [trending, setTrending] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [session, setSession] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productPricing, setProductPricing] = useState(null)
  const [productRecs, setProductRecs] = useState(null)
  const [productPrices, setProductPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [addingToCart, setAddingToCart] = useState(null)
  const [cartMessage, setCartMessage] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // ─── Initial Data Load ───
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true)
        const [productsData, usersData, trendingData, dashboardData] = await Promise.all([
          api.getProducts(),
          api.getUsers(),
          api.getTrending(5),
          api.getDashboard()
        ])
        setProducts(productsData.products)
        setCategories(productsData.categories || [])
        setUsers(usersData.users)
        setTrending(trendingData.trending)
        setDashboard(dashboardData)
        // Default to first user
        if (usersData.users.length > 0) {
          setSelectedUser(usersData.users[0])
        }
        setError(null)
      } catch (err) {
        setError('Failed to connect to backend. Make sure the API server is running on port 8000.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadInitialData()
  }, [])

  // ─── Load prices for all products when user changes ───
  useEffect(() => {
    if (!selectedUser || products.length === 0) return
    async function loadPrices() {
      const prices = {}
      await Promise.all(
        products.map(async (p) => {
          try {
            const priceData = await api.getPrice(p.product_id, selectedUser.user_id)
            prices[p.product_id] = priceData
          } catch { /* ignore individual failures */ }
        })
      )
      setProductPrices(prices)
    }
    loadPrices()
  }, [selectedUser, products])

  // ─── Load session when user changes ───
  useEffect(() => {
    if (!selectedUser) return
    api.getSession(selectedUser.user_id)
      .then(setSession)
      .catch(() => setSession(null))
  }, [selectedUser])

  // ─── Load products when category changes ───
  useEffect(() => {
    async function loadCategoryProducts() {
      try {
        const data = selectedCategory
          ? await api.getProducts(selectedCategory)
          : await api.getProducts()
        setProducts(data.products)
      } catch (err) {
        console.error('Error loading category products:', err)
      }
    }
    loadCategoryProducts()
  }, [selectedCategory])

  // ─── Handle category click ───
  const handleCategoryClick = useCallback((code, isParent = false) => {
    if (isParent) {
      if (expandedParent === code) {
        setExpandedParent(null)
        setSelectedCategory(null)
      } else {
        setExpandedParent(code)
        setSelectedCategory(code)
      }
    } else {
      setSelectedCategory(code)
    }
  }, [expandedParent])

  const filteredProducts = products

  // ─── Handle product click ───
  const handleProductClick = useCallback(async (product) => {
    setSelectedProduct(product)
    setProductPricing(null)
    setProductRecs(null)

    try {
      if (selectedUser) {
        await api.recordEvent(selectedUser.user_id, product.product_id, 'click')
        const sess = await api.getSession(selectedUser.user_id)
        setSession(sess)
      }

      const [pricing, recs] = await Promise.all([
        api.getPrice(product.product_id, selectedUser?.user_id),
        api.getRecommendations(product.product_id, selectedUser?.user_id)
      ])
      setProductPricing(pricing)
      setProductRecs(recs)
    } catch (err) {
      console.error('Error loading product details:', err)
    }
  }, [selectedUser])

  // ─── Handle recommendation click ───
  const handleRecClick = useCallback((product) => {
    handleProductClick(product)
  }, [handleProductClick])

  // ─── Close modal ───
  const closeModal = () => {
    setSelectedProduct(null)
    setProductPricing(null)
    setProductRecs(null)
  }

  // ─── Add to cart ───
  const handleAddToCart = useCallback(async (product, price, e) => {
    if (e) e.stopPropagation()

    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    setAddingToCart(product.product_id)
    try {
      await api.addToCart({
        product_id: String(product.product_id),
        name: product.name,
        image: product.image,
        price: price || product.base_price,
        quantity: 1,
        category: product.category,
      })
      await refreshCart()
      setCartMessage(`${product.name} added to cart!`)
      setTimeout(() => setCartMessage(''), 2500)
    } catch (err) {
      console.error('Add to cart failed:', err)
    } finally {
      setAddingToCart(null)
    }
  }, [isAuthenticated, navigate, refreshCart])

  // ─── Close user menu on click outside ───
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false)
    if (userMenuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [userMenuOpen])

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner"></div>
        <div className="loading-text">Connecting to SmartCommerceAI Engine...</div>
      </div>
    )
  }

  // ─── Error State ───
  if (error) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <div style={{ color: 'var(--danger)', fontSize: '18px', fontWeight: 600 }}>Connection Error</div>
        <div className="loading-text" style={{ maxWidth: 500, textAlign: 'center' }}>{error}</div>
        <button
          className="category-btn active"
          onClick={() => window.location.reload()}
          style={{ marginTop: 16 }}
        >
          Retry Connection
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ─── CART MESSAGE TOAST ─── */}
      {cartMessage && (
        <div className="cart-toast animate-in" id="cart-toast">
          <span>✅</span> {cartMessage}
        </div>
      )}

      {/* ─── NAVBAR ─── */}
      <nav className="navbar" id="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
            <span className="navbar-logo">🛒</span>
            <div>
              <div className="navbar-title">SmartCommerceAI</div>
            </div>
          </Link>

          <div className="navbar-actions">
            <div className="navbar-status">
              <span className="status-dot"></span>
              System Active
            </div>

            {/* Cart Button */}
            <Link to="/cart" className="navbar-cart-btn" id="navbar-cart-btn">
              <span className="cart-icon">🛒</span>
              {cartCount > 0 && (
                <span className="cart-badge">{cartCount}</span>
              )}
            </Link>

            {/* Auth Section */}
            {isAuthenticated ? (
              <div className="navbar-user-menu" onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}>
                <button className="navbar-user-btn" id="navbar-user-btn">
                  <span className="navbar-user-avatar">{user?.avatar || '👤'}</span>
                  <span className="navbar-user-name">{user?.name?.split(' ')[0]}</span>
                  <span className="navbar-chevron">{userMenuOpen ? '▲' : '▼'}</span>
                </button>
                {userMenuOpen && (
                  <div className="user-dropdown animate-in" id="user-dropdown">
                    <div className="dropdown-header">
                      <span className="dropdown-avatar">{user?.avatar || '👤'}</span>
                      <div>
                        <div className="dropdown-name">{user?.name}</div>
                        <div className="dropdown-email">{user?.email}</div>
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    <Link to="/profile" className="dropdown-item" id="dropdown-profile">
                      <span>👤</span> My Profile
                    </Link>
                    <Link to="/cart" className="dropdown-item" id="dropdown-cart">
                      <span>🛒</span> My Cart {cartCount > 0 && `(${cartCount})`}
                    </Link>
                    <Link to="/profile" className="dropdown-item" id="dropdown-orders" onClick={() => {}}>
                      <span>📦</span> My Orders
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button className="dropdown-item dropdown-logout" onClick={logout} id="dropdown-logout">
                      <span>🚪</span> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="navbar-auth-btns">
                <Link to="/login" className="navbar-login-btn" id="navbar-login-btn">Sign In</Link>
                <Link to="/signup" className="navbar-signup-btn" id="navbar-signup-btn">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="app-container">
        {/* ─── HERO ─── */}
        <section className="hero animate-in" id="hero-section">
          <h1>Smart Pricing, <span>Smarter Shopping</span></h1>
          <p className="hero-desc">
            Real-time dynamic pricing powered by demand analysis, competitor tracking,
            and personalized user segments — all working together seamlessly.
          </p>
          {!isAuthenticated && (
            <div className="hero-cta">
              <Link to="/signup" className="hero-cta-btn" id="hero-signup-btn">
                🚀 Get Started — It's Free
              </Link>
            </div>
          )}
        </section>

        {/* ─── STATS BAR ─── */}
        {dashboard && (
          <div className="stats-bar" id="stats-bar">
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_products}</div>
              <div className="stat-label">Products</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_events}</div>
              <div className="stat-label">Events Tracked</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.total_users}</div>
              <div className="stat-label">User Segments</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.active_sessions}</div>
              <div className="stat-label">Active Sessions</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{dashboard.categories?.length || 0}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        )}

        {/* ─── SESSION PANEL ─── */}
        {session && session.total_views > 0 && (
          <div className="session-panel animate-in" id="session-panel">
            <div className="session-header">
              <div className="session-title">
                <span>🧭</span> Your Journey — {selectedUser?.name}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {session.total_views} products viewed
              </span>
            </div>
            <div className="session-journey">{session.journey_explanation}</div>
            <div className="session-products">
              {session.products_viewed.map((pv, i) => (
                <span key={i} className="session-product-tag">
                  <span>{pv.image}</span> {pv.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── TRENDING SECTION ─── */}
        <section className="trending-section animate-in animate-in-delay-1" id="trending-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon">🔥</span> Trending Now
            </div>
            <span className="section-badge">Live Data</span>
          </div>
          <div className="trending-grid">
            {trending.map((item, i) => (
              <div
                key={item.product_id}
                className="trending-card"
                onClick={() => handleProductClick(item)}
                id={`trending-${item.product_id}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="trending-rank">{item.trending_rank}</span>
                <div className="trending-emoji">{item.image}</div>
                <div className="trending-name">{item.name}</div>
                <div className="trending-views">{item.view_count} interactions</div>
                <div className="trending-price">${item.base_price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PRODUCT CATALOG ─── */}
        <section className="animate-in animate-in-delay-2" id="products-section">
          <div className="section-header">
            <div className="section-title">
              <span className="section-icon">📦</span> Product Catalog
            </div>
            <span className="section-badge">{filteredProducts.length} items</span>
          </div>

          {/* Category Filters — Parent Level */}
          <div className="category-filters" id="category-filters">
            <button
              className={`category-btn ${!selectedCategory ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(null)
                setExpandedParent(null)
              }}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.code}
                className={`category-btn ${
                  selectedCategory === cat.code || 
                  (cat.subcategories && cat.subcategories.some(s => s.code === selectedCategory))
                    ? 'active' : ''
                }`}
                onClick={() => handleCategoryClick(cat.code, true)}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>

          {/* Subcategory Filters */}
          {expandedParent && (() => {
            const parent = categories.find(c => c.code === expandedParent)
            if (!parent || !parent.subcategories || parent.subcategories.length === 0) return null
            return (
              <div className="category-filters subcategory-filters" style={{ paddingTop: 0 }}>
                <button
                  className={`category-btn sub-btn ${selectedCategory === expandedParent ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(expandedParent)}
                  style={{ fontSize: 12 }}
                >
                  All {parent.name}
                </button>
                {parent.subcategories.map(sub => (
                  <button
                    key={sub.code}
                    className={`category-btn sub-btn ${selectedCategory === sub.code ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(sub.code, false)}
                    style={{ fontSize: 12 }}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Product Grid */}
          <div className="product-grid" id="product-grid">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product, i) => {
                const priceData = productPrices[product.product_id]
                const isTrending = trending.some(t => t.product_id === product.product_id)
                const finalPrice = priceData ? priceData.final_price : product.base_price
                return (
                  <div
                    key={product.product_id}
                    className="product-card animate-in"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => handleProductClick(product)}
                    id={`product-${product.product_id}`}
                  >
                    {isTrending && (
                      <span className="trending-badge">🔥 Trending</span>
                    )}
                    <span className="product-card-emoji">{product.image}</span>
                    <div className="product-card-category">{product.category}</div>
                    <div className="product-card-name">{product.name}</div>
                    <div className="product-card-desc">{product.description}</div>
                    <div className="product-card-price">
                      <span className="price-current">
                        ${priceData ? priceData.final_price : product.base_price}
                      </span>
                      {priceData && priceData.final_price !== priceData.base_price && (
                        <>
                          <span className="price-base">${priceData.base_price}</span>
                          <span className={`price-badge ${priceData.savings_percent > 0 ? 'savings' : 'increase'}`}>
                            {priceData.savings_percent > 0 ? `Save ${priceData.savings_percent}%` : `+${Math.abs(priceData.savings_percent)}%`}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      className={`add-to-cart-btn ${addingToCart === product.product_id ? 'adding' : ''}`}
                      onClick={(e) => handleAddToCart(product, finalPrice, e)}
                      disabled={addingToCart === product.product_id}
                      id={`add-cart-${product.product_id}`}
                    >
                      {addingToCart === product.product_id ? (
                        <><span className="btn-spinner-sm"></span> Adding...</>
                      ) : (
                        <>🛒 Add to Cart</>
                      )}
                    </button>
                  </div>
                )
              })
            ) : (
              <div style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-muted)'
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No products found</div>
                <div style={{ fontSize: 14, marginBottom: 20 }}>
                  Try selecting a different category or browse all products
                </div>
                <button
                  className="category-btn active"
                  onClick={() => {
                    setSelectedCategory(null)
                    setExpandedParent(null)
                  }}
                >
                  Show All Products
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="footer" id="footer">
          <div className="footer-text">
            SmartCommerceAI — E-Commerce Dynamic Pricing & Recommendation System v1.0
          </div>
          <div className="footer-team">
            <span className="footer-member">🔴 Harsh — Backend + Integration</span>
            <span className="footer-member">🟢 Het — Recommendation Engine</span>
            <span className="footer-member">🔵 Anuj — Dynamic Pricing</span>
            <span className="footer-member">🟡 Ansh — Session + UI</span>
          </div>
        </footer>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PRODUCT DETAIL MODAL
          ═══════════════════════════════════════════════════════════════ */}
      {selectedProduct && (
        <div className="modal-overlay" id="product-modal" onClick={(e) => {
          if (e.target === e.currentTarget) closeModal()
        }}>
          <div className="modal-content">
            <button className="modal-close" onClick={closeModal} id="modal-close-btn">✕</button>

            {/* Header */}
            <div className="detail-header">
              <div className="detail-emoji">{selectedProduct.image}</div>
              <div className="detail-info">
                <div className="detail-category">{selectedProduct.category}</div>
                <h2 className="detail-name">{selectedProduct.name}</h2>
                <p className="detail-desc">{selectedProduct.description}</p>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Stock: {selectedProduct.stock} units • ID: {selectedProduct.product_id}
                </div>
                {/* Add to Cart in modal */}
                <button
                  className={`modal-add-to-cart-btn ${addingToCart === selectedProduct.product_id ? 'adding' : ''}`}
                  onClick={(e) => handleAddToCart(
                    selectedProduct,
                    productPricing ? productPricing.final_price : selectedProduct.base_price,
                    e
                  )}
                  disabled={addingToCart === selectedProduct.product_id}
                  id="modal-add-cart-btn"
                  style={{ marginTop: 16 }}
                >
                  {addingToCart === selectedProduct.product_id ? (
                    <><span className="btn-spinner-sm"></span> Adding...</>
                  ) : (
                    <>🛒 Add to Cart — ${productPricing ? productPricing.final_price : selectedProduct.base_price}</>
                  )}
                </button>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="pricing-section" id="pricing-section">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <span className="section-icon">💰</span> Dynamic Price Breakdown
              </div>

              {productPricing ? (
                <>
                  <div className="pricing-header">
                    <div className="pricing-main">
                      <span className="pricing-final">${productPricing.final_price}</span>
                      {productPricing.final_price !== productPricing.base_price && (
                        <span className="pricing-original">${productPricing.base_price}</span>
                      )}
                    </div>
                    {productPricing.savings_percent !== 0 && (
                      <span className={`pricing-savings-badge ${productPricing.savings_percent > 0 ? 'saving' : 'increase'}`}>
                        {productPricing.savings_percent > 0
                          ? `You save $${productPricing.total_savings} (${productPricing.savings_percent}%)`
                          : `+$${Math.abs(productPricing.total_savings)} (${Math.abs(productPricing.savings_percent)}%)`
                        }
                      </span>
                    )}
                  </div>

                  <div className="pricing-explanation">
                    <span className="pricing-explanation-icon">🧠</span>
                    {productPricing.explanation}
                  </div>

                  <div className="adjustments-list" id="adjustments-list">
                    {productPricing.adjustments.map((adj, i) => (
                      <div key={i} className="adjustment-item" style={{ animation: `slide-in-right 0.3s ease-out ${i * 0.1}s both` }}>
                        <span className="adjustment-icon">{adj.icon}</span>
                        <div className="adjustment-content">
                          <div className="adjustment-factor">{adj.factor}</div>
                          <div className="adjustment-desc">{adj.description}</div>
                        </div>
                        <span className={`adjustment-impact ${adj.impact.startsWith('+') ? 'positive' :
                            adj.impact.startsWith('-') ? 'negative' : 'neutral'
                          }`}>
                          {adj.impact}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Demand Stats from ML Model */}
                  {productPricing.demand_stats && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
                      marginTop: 16, padding: 14, borderRadius: 12,
                      background: 'var(--bg-secondary, #f8f9fc)'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>
                          {productPricing.demand_stats.views}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Views</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success, #22c55e)' }}>
                          {productPricing.demand_stats.purchases}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Purchases</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning, #f59e0b)' }}>
                          {productPricing.demand_stats.cart_adds}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cart Adds</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger, #ef4444)' }}>
                          {(productPricing.demand_stats.conversion_rate * 100).toFixed(1)}%
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Conversion</div>
                      </div>
                    </div>
                  )}

                  {/* Cache Date Indicator */}
                  {productPricing.cache_date && (
                    <div style={{
                      marginTop: 12, fontSize: 11, color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      <span>🔄</span> Price calculated for {productPricing.cache_date} • Refreshes daily
                      {productPricing.ml_factor && (
                        <span style={{ marginLeft: 'auto', fontFamily: 'monospace' }}>
                          ML Factor: {productPricing.ml_factor}
                        </span>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Calculating dynamic price...</div>
                </div>
              )}
            </div>

            {/* Recommendations Section */}
            <div className="recommendations-section" id="recommendations-section">
              <div className="section-title" style={{ marginBottom: 20 }}>
                <span className="section-icon">🎯</span> Personalized Recommendations
              </div>

              {productRecs ? (
                <>
                  {/* Category-based */}
                  {productRecs.category_based?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">📂 Similar Products</span>
                        <span className="rec-group-explanation">{productRecs.category_based.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.category_based.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frequently Bought Together (Apriori Model) */}
                  {productRecs.frequently_bought?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🔗 Frequently Bought Together</span>
                        <span className="rec-group-explanation">{productRecs.frequently_bought.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.frequently_bought.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Session-based */}
                  {productRecs.session_based?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🧭 Based on Your Journey</span>
                        <span className="rec-group-explanation">{productRecs.session_based.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.session_based.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending */}
                  {productRecs.trending?.products?.length > 0 && (
                    <div className="rec-group">
                      <div className="rec-group-header">
                        <span className="rec-group-title">🔥 Trending Right Now</span>
                        <span className="rec-group-explanation">{productRecs.trending.explanation}</span>
                      </div>
                      <div className="rec-scroll">
                        {productRecs.trending.products.map(rec => (
                          <div key={rec.product_id} className="rec-card" onClick={() => handleRecClick(rec)}>
                            <div className="rec-card-emoji">{rec.image}</div>
                            <div className="rec-card-name">{rec.name}</div>
                            <div className="rec-card-price">${rec.base_price}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">Finding recommendations...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
>>>>>>> 5bdcf156df9f45a3889d4587eca3e99a6246fc64

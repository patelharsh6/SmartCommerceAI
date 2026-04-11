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

import { Navigate } from 'react-router-dom';
import { getImageForProduct } from './utils';
import SearchBar from './components/SearchBar';
import Sidebar from './components/Sidebar';
import ProductCard from './components/ProductCard';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="loading-spinner"></div></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><CartPage /></ProtectedRoute>} />
      <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
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
  const [searchQuery, setSearchQuery] = useState('')

  // ─── Catalog State (product_catalog.csv) ───
  const [catalogProducts, setCatalogProducts] = useState([])
  const [catalogPage, setCatalogPage] = useState(1)
  const [catalogHasMore, setCatalogHasMore] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogTotal, setCatalogTotal] = useState(0)
  const [catalogCategories, setCatalogCategories] = useState([])
  const [selectedCatFilter, setSelectedCatFilter] = useState('')
  const [selectedSubcatFilter, setSelectedSubcatFilter] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const CATALOG_PAGE_SIZE = 20

  // ─── Load catalog products (paginated from product_catalog.csv) ───
  const loadCatalog = useCallback(async (page = 1, append = false) => {
    setCatalogLoading(true)
    try {
      const data = await api.getCatalog(
        page,
        CATALOG_PAGE_SIZE,
        selectedCatFilter || null,
        selectedSubcatFilter || null,
        catalogSearch || null
      )
      if (append) {
        setCatalogProducts(prev => [...prev, ...data.products])
      } else {
        setCatalogProducts(data.products)
      }
      setCatalogPage(data.page)
      setCatalogHasMore(data.has_more)
      setCatalogTotal(data.total)
      if (data.categories) setCatalogCategories(data.categories)
    } catch (err) {
      console.error('Error loading catalog:', err)
    } finally {
      setCatalogLoading(false)
    }
  }, [selectedCatFilter, selectedSubcatFilter, catalogSearch])

  const loadMoreCatalog = useCallback(() => {
    if (catalogHasMore && !catalogLoading) {
      loadCatalog(catalogPage + 1, true)
    }
  }, [catalogHasMore, catalogLoading, catalogPage, loadCatalog])

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

  // ─── Load catalog on mount and when filters change ───
  useEffect(() => {
    loadCatalog(1, false)
  }, [loadCatalog])

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

  // ─── Load products when sidebar category changes ───
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

  // ─── Handle catalog category filter change ───
  const handleCatFilterChange = useCallback((cat) => {
    setSelectedCatFilter(cat)
    setSelectedSubcatFilter('')
    setCatalogPage(1)
  }, [])

  const handleSubcatFilterChange = useCallback((sub) => {
    setSelectedSubcatFilter(sub)
    setCatalogPage(1)
  }, [])

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

  const filteredProducts = products.filter(p => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q))
  })

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
          {cartMessage}
        </div>
      )}

      {/* ─── NAVBAR ─── */}
      <nav className="navbar" id="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand" style={{ textDecoration: 'none' }}>
            <div>
              <div className="navbar-title" style={{ fontSize: '24px' }}>SmartCommerceAI</div>
            </div>
          </Link>



          <div className="navbar-actions">
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
        <div className="dashboard-layout">
          {/* ─── SIDEBAR ─── */}
          <Sidebar
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategoryClick}
          />

          {/* ─── MAIN CONTENT ─── */}
          <main className="dashboard-main">
            {/* ─── HERO ─── */}
            <section className="hero animate-in" id="hero-section" style={{ borderRadius: '12px', padding: '40px', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '40px' }}>Smart Pricing, <span>Smarter Shopping</span></h1>
              <p className="hero-desc" style={{ fontSize: '16px' }}>
                Real-time dynamic pricing powered by demand analysis, competitor tracking,
                and personalized user segments — all working together seamlessly.
              </p>
              {!isAuthenticated && (
                <div className="hero-cta">
                  <Link to="/signup" className="hero-cta-btn" id="hero-signup-btn">
                    Get Started — It's Free
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
              Trending Now
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
                <div className="trending-image" style={{height: '120px', marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-secondary)'}}>
                  <img
                    src={item.image_url || item.img_url || getImageForProduct(item)}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.onerror = null; const s = parseInt(String(item.product_id).replace(/\D/g,'') || '1') % 10000; e.target.src = `https://picsum.photos/seed/${s}/400/400`; }}
                  />
                </div>
                <div className="trending-name">{item.name}</div>
                <div className="trending-views">{item.view_count} interactions</div>
                <div className="trending-price">${item.base_price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── PRODUCT CATALOG (from product_catalog.csv) ─── */}
        <section className="animate-in animate-in-delay-2" id="products-section">
          <div className="section-header" style={{ flexWrap: 'wrap', gap: '20px' }}>
            <div className="section-title">
              Product Catalog
              <span className="section-badge">{catalogTotal.toLocaleString()} items</span>
            </div>
            
            <div className="catalog-search-wrapper">
              <span className="catalog-search-icon">🔍</span>
              <input 
                type="text" 
                className="catalog-search-input" 
                placeholder="Search catalog... (e.g., Apple, Shoes)"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              {catalogSearch && (
                <button className="catalog-search-clear" onClick={() => setCatalogSearch('')}>✕</button>
              )}
            </div>
          </div>

          {/* Category Filter Bar */}
          <div className="catalog-filter-bar" id="catalog-filter-bar">
            <select
              className="catalog-filter-select"
              value={selectedCatFilter}
              onChange={(e) => {
                setSelectedCatFilter(e.target.value);
                setSelectedSubcatFilter('');
                setCatalogPage(1);
              }}
            >
              <option value="">All Categories</option>
              {catalogCategories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            {selectedCatFilter && (
              <select
                className="catalog-filter-select"
                value={selectedSubcatFilter}
                onChange={(e) => {
                  setSelectedSubcatFilter(e.target.value);
                  setCatalogPage(1);
                }}
              >
                <option value="">All Subcategories</option>
                {catalogCategories.find(c => c.name === selectedCatFilter)?.subcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            )}
          </div>

          {/* Product Grid */}
          <div className="product-grid catalog-grid" id="catalog-grid">
            {catalogProducts.length > 0 ? (
              catalogProducts.map((product, i) => (
                <div
                  key={`${product.product_id}-${i}`}
                  className="product-card animate-in premium-card"
                  style={{ animationDelay: `${Math.min(i, 19) * 0.04}s` }}
                  onClick={() => handleProductClick(product)}
                  id={`product-${product.product_id}`}
                >
                  {/* Product Image from image_url */}
                  <div className="product-card-image-wrapper">
                    <img
                      src={product.image_url || product.img_url || product.image}
                      alt={product.name}
                      className="product-card-image loaded"
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null
                        const seed = parseInt(product.product_id.replace(/\D/g, '') || '1') % 10000;
                        e.target.src = `https://picsum.photos/seed/${seed}/400/400`
                      }}
                    />
                  </div>

                  <div className="product-card-content">
                    <div className="product-card-category">{product.subcategory || product.category}</div>
                    <div className="product-card-name">{product.name}</div>

                    {/* Rating */}
                    {product.avg_rating && (
                      <div className="product-card-rating">
                        <span className="rating-stars">
                          {'★'.repeat(Math.round(product.avg_rating))}
                          {'☆'.repeat(5 - Math.round(product.avg_rating))}
                        </span>
                        <span className="rating-value">{product.avg_rating}</span>
                        <span className="rating-count">({product.review_count?.toLocaleString()})</span>
                      </div>
                    )}

                    <div className="product-card-footer">
                      <div className="product-card-price">
                        <span className="price-current">${product.base_price}</span>
                        {product.original_price && product.original_price > product.base_price && (
                          <div className="price-savings-row">
                            <span className="price-base">${product.original_price}</span>
                            <span className="price-badge savings">
                              Save {Math.round(((product.original_price - product.base_price) / product.original_price) * 100)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      className={`premium-cart-btn ${addingToCart === product.product_id ? 'adding' : ''}`}
                      onClick={(e) => handleAddToCart(product, product.base_price, e)}
                      disabled={addingToCart === product.product_id}
                    >
                      {addingToCart === product.product_id ? (
                        <><span className="btn-spinner-sm"></span> Adding...</>
                      ) : (
                        <>Add to Cart</>
                      )}
                    </button>
                  </div>
                </div>
              ))
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
                    setSelectedCatFilter('')
                    setSelectedSubcatFilter('')
                    setSearchQuery('')
                  }}
                >
                  Show All Products
                </button>
              </div>
            )}
          </div>

          {/* Load More Button */}
          {catalogHasMore && catalogProducts.length > 0 && (
            <div className="load-more-container" id="load-more-container">
              <button
                className="load-more-btn"
                onClick={loadMoreCatalog}
                disabled={catalogLoading}
                id="load-more-btn"
              >
                {catalogLoading ? (
                  <><span className="btn-spinner-sm"></span> Loading more products...</>
                ) : (
                  <>Load More Products <span className="load-more-count">({catalogProducts.length} of {catalogTotal.toLocaleString()})</span></>
                )}
              </button>
            </div>
          )}

          {/* All loaded indicator */}
          {!catalogHasMore && catalogProducts.length > 0 && (
            <div className="all-loaded-indicator">
              ✅ All {catalogTotal.toLocaleString()} products loaded
            </div>
          )}
        </section>
      </main>
      </div>

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
              <div className="detail-image" style={{ width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0 }}><img src={selectedProduct.img_url || getImageForProduct(selectedProduct)} alt={selectedProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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
                    <>Add to Cart — ${productPricing ? productPricing.final_price : selectedProduct.base_price}</>
                  )}
                </button>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="pricing-section" id="pricing-section">
              <div className="section-title" style={{ marginBottom: 20 }}>
                Dynamic Price Breakdown
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
                Personalized Recommendations
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
                            <div className="rec-card-image" style={{ height: '100px', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden' }}><img src={getImageForProduct(rec)} alt={rec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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
                            <div className="rec-card-image" style={{ height: '100px', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden' }}><img src={getImageForProduct(rec)} alt={rec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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
                            <div className="rec-card-image" style={{ height: '100px', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden' }}><img src={getImageForProduct(rec)} alt={rec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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
                            <div className="rec-card-image" style={{ height: '100px', marginBottom: '12px', borderRadius: '8px', overflow: 'hidden' }}><img src={getImageForProduct(rec)} alt={rec.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
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

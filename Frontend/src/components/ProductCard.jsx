import { useState } from 'react';
import { getImageForProduct } from '../utils';

export default function ProductCard({ product, priceData, isTrending, onClick, onAddToCart, addingToCart, animationDelay }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const finalPrice = priceData ? priceData.final_price : product.base_price;

    return (
        <div
            className="product-card animate-in premium-card"
            style={{ animationDelay: `${animationDelay || 0}s` }}
            onClick={() => onClick(product)}
            id={`product-${product.product_id}`}
        >
            {isTrending && (
                <span className="trending-badge premium-badge">🔥 Trending</span>
            )}

            <div className="product-card-image-wrapper">
                {!imageLoaded && (
                    <div className="image-skeleton animate-pulse"></div>
                )}
                <img
                    src={product.img_url || getImageForProduct(product)}
                    alt={product.name}
                    className={`product-card-image ${imageLoaded ? 'loaded' : ''}`}
                    onLoad={() => setImageLoaded(true)}
                    onError={(e) => {
                        e.target.onerror = null
                        e.target.src = `https://source.unsplash.com/400x400/?${encodeURIComponent(product.subcategory || product.category)},product`
                        setImageLoaded(true)
                    }}
                    loading="lazy"
                />
            </div>

            <div className="product-card-content">
                <div className="product-card-category">{product.subcategory || product.category}</div>
                <div className="product-card-name">{product.name}</div>

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
<<<<<<< HEAD
                        <span className="price-current">₹{finalPrice}</span>
=======
                        <span className="price-current">
                            ${finalPrice}
                        </span>
>>>>>>> 94ba4386ebddc26dfc01dc51921f6a7408db2278
                        {priceData && priceData.final_price !== priceData.base_price && (
                            <div className="price-savings-row">
                                <span className="price-base">${priceData.base_price}</span>
                                <span className={`price-badge ${priceData.savings_percent > 0 ? 'savings' : 'increase'}`}>
                                    {priceData.savings_percent > 0
                                        ? `Save ${priceData.savings_percent}%`
                                        : `+${Math.abs(priceData.savings_percent)}%`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    className={`premium-cart-btn ${addingToCart === product.product_id ? 'adding' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onAddToCart(product, finalPrice, e); }}
                    disabled={addingToCart === product.product_id}
                >
                    {addingToCart === product.product_id
                        ? <><span className="btn-spinner-sm"></span> Adding...</>
                        : <>Add to Cart</>}
                </button>
            </div>
        </div>
    );
}
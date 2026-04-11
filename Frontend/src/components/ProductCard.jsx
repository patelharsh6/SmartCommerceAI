import { useState, useEffect } from 'react';
import { getImageForProduct } from '../utils';

export default function ProductCard({ product, priceData, isTrending, onClick, onAddToCart, addingToCart, animationDelay }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const finalPrice = priceData ? priceData.final_price : product.base_price;

    return (
        <div
            className="product-card animate-in premium-card"
            style={{ animationDelay: `${animationDelay}s` }}
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
                    src={getImageForProduct(product)} 
                    alt={product.name} 
                    className={`product-card-image ${imageLoaded ? 'loaded' : ''}`}
                    onLoad={() => setImageLoaded(true)}
                    loading="lazy"
                />
            </div>
            
            <div className="product-card-content">
                <div className="product-card-category">{product.category}</div>
                <div className="product-card-name">{product.name}</div>
                
                <div className="product-card-footer">
                    <div className="product-card-price">
                        <span className="price-current">
                            ₹{finalPrice}
                        </span>
                        {priceData && priceData.final_price !== priceData.base_price && (
                            <div className="price-savings-row">
                                <span className="price-base">₹{priceData.base_price}</span>
                                <span className={`price-badge ${priceData.savings_percent > 0 ? 'savings' : 'increase'}`}>
                                    {priceData.savings_percent > 0 ? `Save ${priceData.savings_percent}%` : `+${Math.abs(priceData.savings_percent)}%`}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    className={`premium-cart-btn ${addingToCart === product.product_id ? 'adding' : ''}`}
                    onClick={(e) => onAddToCart(product, finalPrice, e)}
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
    );
}

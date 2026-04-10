import { useState, useEffect, useRef } from 'react';
import { getImageForProduct } from '../utils';

export default function SearchBar({ products, onSelectProduct, searchQuery, setSearchQuery }) {
    const [localQuery, setLocalQuery] = useState(searchQuery || '');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const wrapperRef = useRef(null);

    // Debounce the search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localQuery);
            if (localQuery.trim().length > 0) {
                const q = localQuery.toLowerCase();
                const filtered = products.filter(p => 
                    p.name.toLowerCase().includes(q) || 
                    (p.category && p.category.toLowerCase().includes(q))
                ).slice(0, 5); // Max 5 suggestions
                setSuggestions(filtered);
                setIsOpen(true);
            } else {
                setSuggestions([]);
                setIsOpen(false);
            }
            setFocusedIndex(-1);
        }, 300);

        return () => clearTimeout(timer);
    }, [localQuery, products, setSearchQuery]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
                handleSelect(suggestions[focusedIndex]);
            } else {
                setIsOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSelect = (product) => {
        onSelectProduct(product);
        setIsOpen(false);
        setLocalQuery('');
        setSearchQuery('');
    };

    const highlightText = (text, highlight) => {
        if (!highlight.trim()) return text;
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) => 
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <b key={i} style={{ color: 'var(--accent-primary)' }}>{part}</b>
                    ) : (
                        part
                    )
                )}
            </span>
        );
    };

    return (
        <div ref={wrapperRef} className="searchbar-wrapper" style={{ position: 'relative', flexGrow: 1, margin: '0 40px', maxWidth: '600px' }}>
            <div className="searchbar-input-container" style={{ position: 'relative' }}>
                <span className="searchbar-icon" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    🔍
                </span>
                <input
                    type="search"
                    placeholder="Search premium products..."
                    value={localQuery}
                    onChange={(e) => setLocalQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (localQuery.trim().length > 0) setIsOpen(true);
                    }}
                    style={{
                        width: '100%',
                        padding: '12px 20px 12px 48px',
                        borderRadius: '24px',
                        border: '1px solid var(--border)',
                        background: 'rgba(255, 255, 255, 0.4)',
                        backdropFilter: 'blur(10px)',
                        outline: 'none',
                        fontSize: '15px',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s ease'
                    }}
                />
            </div>

            {isOpen && localQuery.trim().length > 0 && (
                <div className="search-dropdown animate-in" style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-primary)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-xl)',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    zIndex: 1000
                }}>
                    {suggestions.length > 0 ? (
                        <div className="search-suggestions">
                            {suggestions.map((product, index) => (
                                <div
                                    key={product.product_id}
                                    className={`search-item ${index === focusedIndex ? 'focused' : ''}`}
                                    onClick={() => handleSelect(product)}
                                    // Make sure mouse enter updates the active hovered index
                                    onMouseEnter={() => setFocusedIndex(index)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px 16px',
                                        gap: '12px',
                                        cursor: 'pointer',
                                        background: index === focusedIndex ? 'var(--bg-secondary)' : 'transparent',
                                        borderBottom: index !== suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                                    }}
                                >
                                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-secondary)' }}>
                                        <img src={getImageForProduct(product)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {highlightText(product.name, localQuery)}
                                        </span>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {product.category}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                        ₹{product.base_price}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
                            No results found for "{localQuery}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

import { useState } from 'react';

const CATEGORY_ICONS = {
    'electronics': '💻',
    'fashion': '👕',
    'home': '🏠',
    'books': '📚',
    'sports': '⚽',
    'default': '🏷️'
};

export default function Sidebar({ categories, selectedCategory, onSelectCategory }) {
    const [expandedParents, setExpandedParents] = useState({});

    const toggleParent = (code) => {
        setExpandedParents(prev => ({
            ...prev,
            [code]: !prev[code]
        }));
    };

    const getIcon = (code) => {
        const key = Object.keys(CATEGORY_ICONS).find(k => code.toLowerCase().includes(k));
        return CATEGORY_ICONS[key] || CATEGORY_ICONS.default;
    };

    return (
        <aside className="dashboard-sidebar">
            <h3 style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                margin: '0 0 16px 16px',
                letterSpacing: '1.2px',
                fontWeight: 700
            }}>
                Departments
            </h3>
            
            <div className="sidebar-filters">
                <button
                    className={`sidebar-cat-btn ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => {
                        onSelectCategory(null, true);
                        setExpandedParents({});
                    }}
                >
                    <span className="sidebar-icon">🌐</span>
                    All Departments
                </button>

                {categories.map(cat => {
                    const isParentExpanded = expandedParents[cat.code];
                    const isParentSelected = selectedCategory === cat.code;
                    const hasSubcategories = cat.subcategories && cat.subcategories.length > 0;
                    const isActive = isParentSelected || (hasSubcategories && cat.subcategories.some(s => s.code === selectedCategory));

                    return (
                        <div key={cat.code} className="sidebar-cat-group">
                            <button
                                className={`sidebar-cat-btn ${isActive ? 'active' : ''}`}
                                onClick={() => {
                                    onSelectCategory(cat.code, true);
                                    if (hasSubcategories) {
                                        toggleParent(cat.code);
                                    }
                                }}
                            >
                                <span className="sidebar-icon">{getIcon(cat.code)}</span>
                                <span style={{ flexGrow: 1 }}>{cat.name}</span>
                                {hasSubcategories && (
                                    <span className={`sidebar-chevron ${isParentExpanded ? 'expanded' : ''}`}>
                                        ▼
                                    </span>
                                )}
                            </button>

                            {hasSubcategories && isParentExpanded && (
                                <div className="sidebar-subcategories animate-in-fast">
                                    <button
                                        className={`sidebar-sub-btn ${isParentSelected ? 'active' : ''}`}
                                        onClick={() => onSelectCategory(cat.code, false)}
                                    >
                                        All {cat.name}
                                    </button>
                                    {cat.subcategories.map(sub => (
                                        <button
                                            key={sub.code}
                                            className={`sidebar-sub-btn ${selectedCategory === sub.code ? 'active' : ''}`}
                                            onClick={() => onSelectCategory(sub.code, false)}
                                        >
                                            {sub.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}

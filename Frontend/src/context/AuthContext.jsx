import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cartCount, setCartCount] = useState(0);

    const getStoredCartCount = () => {
        try {
            const cart = JSON.parse(localStorage.getItem('smartcommerce_cart') || '{"items":[],"total":0,"item_count":0}');
            if (typeof cart.item_count === 'number') {
                return cart.item_count;
            }
            if (Array.isArray(cart.items)) {
                return cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            }
            return 0;
        } catch {
            return 0;
        }
    };

    // Restore session on mount
    useEffect(() => {
        const token = localStorage.getItem('smartcommerce_token');
        const savedUser = localStorage.getItem('smartcommerce_user');
        if (token && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
                // Refresh profile from server
                api.getProfile()
                    .then(data => {
                        setUser(data.user);
                        localStorage.setItem('smartcommerce_user', JSON.stringify(data.user));
                    })
                    .catch(() => {
                        // Token expired or invalid
                        logout();
                    });
                // Fetch real cart count from backend
                api.getCart()
                    .then(cartData => setCartCount(cartData.item_count || 0))
                    .catch(() => setCartCount(0));
            } catch {
                logout();
            }
        }
        setLoading(false);
    }, []);

    const loginUser = useCallback(async (email, password) => {
        const data = await api.login(email, password);
        localStorage.setItem('smartcommerce_token', data.token);
        localStorage.setItem('smartcommerce_user', JSON.stringify(data.user));
        setUser(data.user);
        // Fetch real cart count from backend
        try {
            const cartData = await api.getCart();
            setCartCount(cartData.item_count || 0);
        } catch {
            setCartCount(0);
        }
        return data;
    }, []);

    const signupUser = useCallback(async (name, email, password, phone, address) => {
        const data = await api.signup(name, email, password, phone, address);
        localStorage.setItem('smartcommerce_token', data.token);
        localStorage.setItem('smartcommerce_user', JSON.stringify(data.user));
        setUser(data.user);
        setCartCount(0);
        return data;
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('smartcommerce_token');
        localStorage.removeItem('smartcommerce_user');
        setUser(null);
        setCartCount(0);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const data = await api.getProfile();
            setUser(data.user);
            localStorage.setItem('smartcommerce_user', JSON.stringify(data.user));
        } catch {
            // ignore
        }
    }, []);

    // Cart not yet implemented on backend — placeholder for future use
    const refreshCart = useCallback(async () => {
        try {
            const cartData = await api.getCart();
            setCartCount(cartData.item_count || 0);
        } catch (err) {
            console.error('Failed to refresh cart count:', err);
            setCartCount(0);
        }
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            cartCount,
            loginUser,
            signupUser,
            logout,
            refreshUser,
            refreshCart,
            isAuthenticated: !!user,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
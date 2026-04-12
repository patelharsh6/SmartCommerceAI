import React from "react";
import { useNavigate } from "react-router-dom";

const AdminDashboard = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.clear();
        navigate("/");
    };

    return (
        <div className="app-container">
            <div className="navbar">
                <div className="navbar-inner">
                    <h2>Admin Dashboard</h2>
                    <button onClick={handleLogout} className="navbar-login-btn">
                        Logout
                    </button>
                </div>
            </div>

            <div className="dashboard-layout">
                
                {/* Sidebar */}
                <div className="dashboard-sidebar">
                    <div className="sidebar-filters">
                        <button className="category-btn active">Overview</button>
                        <button className="category-btn">Users</button>
                        <button className="category-btn">Products</button>
                        <button className="category-btn">Orders</button>
                    </div>
                </div>

                {/* Main */}
                <div className="dashboard-main">
                    <div className="section-header">
                        <h2 className="section-title">📊 Admin Panel</h2>
                    </div>

                    <div className="stats-bar">
                        <div className="stat-item">
                            <div className="stat-value">120</div>
                            <div className="stat-label">Users</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">45</div>
                            <div className="stat-label">Orders</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">₹50K</div>
                            <div className="stat-label">Revenue</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
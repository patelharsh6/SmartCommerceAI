import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function PasswordField({ label = "Password", ...props }) {
    const [show, setShow] = useState(false);
    return (
        <div className="premium-form-group">
            {label && <label className="premium-form-label">{label}</label>}
            <div className="premium-input-wrapper">
                <Lock size={18} className="premium-input-icon" />
                <input
                    type={show ? 'text' : 'password'}
                    className="premium-form-input has-icon"
                    {...props}
                />
                <button
                    type="button"
                    className="premium-toggle-password"
                    onClick={() => setShow(!show)}
                    tabIndex="-1"
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
}

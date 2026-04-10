import React from 'react';

export default function InputField({ label, icon: Icon, wrapperClass = "", ...props }) {
    return (
        <div className={`premium-form-group ${wrapperClass}`}>
            {label && <label className="premium-form-label">{label}</label>}
            <div className="premium-input-wrapper">
                {Icon && <Icon size={18} className="premium-input-icon" />}
                <input className={`premium-form-input ${Icon ? 'has-icon' : ''}`} {...props} />
            </div>
        </div>
    );
}

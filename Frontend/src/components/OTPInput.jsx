import React, { useRef } from 'react';

export default function OTPInput({ length = 6, value, onChange }) {
    const inputs = useRef([]);

    const handleChange = (e, index) => {
        const val = e.target.value.replace(/\D/g, ''); 
        if (!val) return;
        
        let newOtp = value.split('');
        if (newOtp.length < length) {
            newOtp = Array.from({ length }, (_, i) => newOtp[i] || '');
        }
        newOtp[index] = val.slice(-1);
        const newValue = newOtp.join('');
        onChange(newValue.slice(0, length));
        
        // Auto focus next
        if (index < length - 1) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            let newOtp = value.split('');
            if (newOtp.length < length) {
                newOtp = Array.from({ length }, (_, i) => newOtp[i] || '');
            }
            newOtp[index] = '';
            onChange(newOtp.join(''));
            
            // Focus previous
            if (index > 0) {
                inputs.current[index - 1].focus();
            }
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        if (pasted) {
            onChange(pasted);
            inputs.current[Math.min(pasted.length, length - 1)].focus();
        }
    };

    return (
        <div className="premium-otp-container" style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '24px 0' }}>
            {Array.from({ length }).map((_, idx) => (
                <input
                    key={idx}
                    ref={el => inputs.current[idx] = el}
                    className="premium-otp-input"
                    type="password"
                    maxLength={1}
                    value={value[idx] || ''}
                    onChange={(e) => handleChange(e, idx)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    onPaste={handlePaste}
                />
            ))}
        </div>
    );
}

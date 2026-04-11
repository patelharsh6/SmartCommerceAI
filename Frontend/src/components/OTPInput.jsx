import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function OTPInput({ length = 6, value, onChange, isError }) {
    const inputs = useRef([]);
    const [visibleDigits, setVisibleDigits] = useState({});

    const revealThenHide = (indices) => {
        const show = {};
        indices.forEach(i => { show[i] = true });
        setVisibleDigits(show);
        setTimeout(() => setVisibleDigits({}), 1500);
    };

    const handleChange = (e, index) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (!val) return;

        let newOtp = Array.from({ length }, (_, i) => value[i] || '');
        newOtp[index] = val.slice(-1);
        onChange(newOtp.join('').slice(0, length));

        revealThenHide([index]);

        if (index < length - 1) {
            inputs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            let newOtp = Array.from({ length }, (_, i) => value[i] || '');
            newOtp[index] = '';
            onChange(newOtp.join(''));
            if (index > 0) inputs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, length);
        if (!pasted) return;
        onChange(pasted)
        revealThenHide([...Array(pasted.length).keys()]);
        inputs.current[Math.min(pasted.length, length - 1)]?.focus();
    };

    return (
        <motion.div
            className="premium-otp-container"
            style={{ display: 'flex', gap: '12px', justifyContent: 'center', margin: '24px 0' }}
            animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
        >
            {Array.from({ length }).map((_, idx) => {
                const isMasked = !visibleDigits[idx] && value[idx];
                const displayValue = isMasked ? '•' : (value[idx] || '');

                return (
                    <motion.input
                        key={idx}
                        ref={el => inputs.current[idx] = el}
                        className={`premium-otp-input ${isError ? 'error-border' : ''}`}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={displayValue}
                        onChange={(e) => handleChange(e, idx)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        onPaste={handlePaste}
                        whileFocus={{
                            scale: 1.05,
                            borderColor: "var(--accent-primary)",
                            boxShadow: "0 0 0 4px var(--accent-glow)"
                        }}
                    />
                );
            })}
        </motion.div>
    );
}
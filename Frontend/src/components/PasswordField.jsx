import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PasswordField({ label = "Password", wrapperClass = "", value, ...props }) {
    const [show, setShow] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value && value.toString().length > 0;
    const isActive = isFocused || hasValue;

    return (
        <div className={`premium-form-group ${wrapperClass}`}>
            <motion.div
                className="premium-input-wrapper floating-style"
                animate={isFocused
                    ? { boxShadow: "0 0 0 4px var(--accent-glow)", borderColor: "var(--accent-primary)" }
                    : { boxShadow: "none" }
                }
            >
                <motion.div
                    className="premium-input-icon"
                    animate={{ color: isFocused ? "var(--accent-primary)" : "var(--text-muted)" }}
                >
                    <Lock size={18} />
                </motion.div>

                <motion.label
                    className="premium-floating-label"
                    initial={{ top: '50%', y: '-50%', fontSize: '14px' }}
                    animate={{
                        top: isActive ? '8px' : '50%',
                        y: isActive ? '0%' : '-50%',
                        fontSize: isActive ? '11px' : '14px',
                        color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                        fontWeight: isActive ? 600 : 400
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    style={{ left: '42px' }}
                >
                    {label}
                </motion.label>

                <input
                    type={show ? 'text' : 'password'}
                    className="premium-form-input floating-input has-icon"
                    value={value}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />

                <motion.button
                    type="button"
                    className="premium-toggle-password"
                    onClick={() => setShow(!show)}
                    tabIndex="-1"
                    whileTap={{ scale: 0.9 }}
                >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </motion.button>
            </motion.div>
        </div>
    );
}
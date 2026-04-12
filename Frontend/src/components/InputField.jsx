<<<<<<< HEAD
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function InputField({ label, icon: Icon, wrapperClass = "", value, ...props }) {
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
                {Icon && (
                    <motion.div
                        className="premium-input-icon"
                        animate={{ color: isFocused ? "var(--accent-primary)" : "var(--text-muted)" }}
                    >
                        <Icon size={18} />
                    </motion.div>
                )}

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
                    style={{ left: Icon ? '42px' : '16px' }}
                >
                    {label}
                </motion.label>

                <input
                    className={`premium-form-input floating-input ${Icon ? 'has-icon' : ''}`}
                    value={value}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props}
                />
            </motion.div>
        </div>
    );
}
=======
import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function InputField({ label, icon: Icon, wrapperClass = "", value, ...props }) {
    const [isFocused, setIsFocused] = useState(false);
    const hasValue = value && value.toString().length > 0;
    const isActive = isFocused || hasValue;

    return (
        <div className={`premium-form-group ${wrapperClass}`}>
            <motion.div 
                className="premium-input-wrapper floating-style"
                animate={isFocused ? { boxShadow: "0 0 0 4px var(--accent-glow)", borderColor: "var(--accent-primary)" } : {}}
            >
                {Icon && (
                    <motion.div 
                        className="premium-input-icon"
                        animate={{ color: isFocused ? "var(--accent-primary)" : "var(--text-muted)" }}
                    >
                        <Icon size={18} />
                    </motion.div>
                )}
                
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
                    style={{ left: Icon ? '42px' : '16px' }}
                >
                    {label}
                </motion.label>
                
                <input 
                    className={`premium-form-input floating-input ${Icon ? 'has-icon' : ''}`} 
                    value={value}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...props} 
                />
            </motion.div>
        </div>
    );
}
>>>>>>> c4ac3b45a720008ab48088b49b48f2cc161ba1d6

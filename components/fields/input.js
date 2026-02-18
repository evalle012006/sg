import { useEffect, useState, useRef, useCallback } from "react";
import { validateEmail, validatePhoneNumber } from "../../utilities/common";

const InputField = (props) => {
    const {
        label,
        value: propsValue,
        defaultValue,
        onChange,
        onBlur,
        className,
        type = "text",
        id,
        name,
        required = false,
        error: propsError,
        autoComplete = "on",
        placeholder,
        size = "medium",
        width,
        builderMode = false,
        question,
        builder = false,
        validateOnMount = true,
        forceShowErrors = false,
        // NEW: Callback to notify parent when autofill is detected
        onAutofillDetected = null,
        // NEW: External dirty state (from parent/Redux)
        externalDirty = null,
        ...otherProps
    } = props;

    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [value, setValue] = useState(propsValue || defaultValue || "");
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isAutofilled, setIsAutofilled] = useState(false);
    const inputRef = useRef(null);
    const lastProcessedAutofillRef = useRef(null);
    const autofillCheckIntervalRef = useRef(null);

    // Use external dirty state if provided, otherwise use local
    const effectiveDirty = externalDirty !== null ? externalDirty : dirty;

    // Determine actual field type based on props
    const getFieldType = () => {
        if (type === "phone-number") return "tel";
        if (type === "string" || type === "text") return "text";
        if (type === "integer") return "number";
        return type;
    };

    // Enhanced validation logic with user-friendly messages
    const validateInput = useCallback((inputValue, shouldSetDirty = false) => {
        if (propsError) {
            setError(true);
            setErrorMessage(propsError);
            if (shouldSetDirty) setDirty(true);
            return;
        }
        
        // Required field validation
        if (required && (!inputValue || inputValue.trim() === '')) {
            setError(true);
            const fieldName = label || (type === 'email' ? 'Email' : type === 'phone-number' ? 'Phone number' : 'This field');
            setErrorMessage(`${fieldName} is required`);
            if (shouldSetDirty) setDirty(true);
            return;
        }

        // Type-specific validation for non-empty values
        if (inputValue && inputValue.trim()) {
            if (type === "email" && !validateEmail(inputValue)) {
                setError(true);
                if (inputValue.indexOf('@') === -1) {
                    setErrorMessage('Email must contain an @ symbol');
                } else if (inputValue.indexOf('.') === -1) {
                    setErrorMessage('Email must contain a domain (e.g., .com)');
                } else if (inputValue.split('@').length > 2) {
                    setErrorMessage('Email can only contain one @ symbol');
                } else {
                    setErrorMessage('Please enter a valid email address (e.g., name@example.com)');
                }
                if (shouldSetDirty) setDirty(true);
                return;
            }
            
            if (type === "phone-number" && !validatePhoneNumber(inputValue)) {
                setError(true);
                const digitCount = inputValue.replace(/\D/g, '').length;
                if (digitCount < 10) {
                    setErrorMessage('Phone number must be at least 10 digits');
                } else {
                    setErrorMessage('Please enter a valid phone number (e.g., (555) 123-4567)');
                }
                if (shouldSetDirty) setDirty(true);
                return;
            }
            
            if (type === "number" && isNaN(Number(inputValue))) {
                setError(true);
                setErrorMessage('Please enter numbers only');
                if (shouldSetDirty) setDirty(true);
                return;
            }
        }
        
        setError(false);
        setErrorMessage('');
        setIsValid(inputValue && inputValue.trim() !== '');
        if (shouldSetDirty) setDirty(true);
    }, [propsError, required, label, type]);

    // Process autofill value and notify parent
    const processAutofillValue = useCallback((newValue, source = 'unknown') => {
        if (!newValue || newValue === value) return;
        if (lastProcessedAutofillRef.current === newValue) return;
        
        lastProcessedAutofillRef.current = newValue;
        
        console.log(`🔄 InputField autofill [${source}]:`, {
            field: name || id || label,
            value: newValue.substring(0, 20) + (newValue.length > 20 ? '...' : ''),
            type
        });
        
        setValue(newValue);
        setDirty(true);
        setIsAutofilled(true);
        validateInput(newValue, true);
        
        // Notify parent
        if (onChange) {
            if (type === 'phone-number') {
                let errorMsg = null;
                if (required && newValue && !validatePhoneNumber(newValue)) {
                    const digitCount = newValue.replace(/\D/g, '').length;
                    errorMsg = digitCount < 10 
                        ? 'Phone number must be at least 10 digits'
                        : 'Please enter a valid phone number';
                }
                onChange(newValue, errorMsg);
            } else if (type === 'email') {
                let errorMsg = null;
                if (required && newValue && !validateEmail(newValue)) {
                    errorMsg = 'Please enter a valid email address';
                }
                onChange(newValue, errorMsg);
            } else {
                onChange(newValue);
            }
        }
        
        // Call autofill callback if provided
        if (onAutofillDetected) {
            onAutofillDetected(name || id, newValue, { type, source });
        }
    }, [value, name, id, label, type, onChange, onAutofillDetected, required, validateInput]);

    // ENHANCED: Comprehensive autofill detection
    useEffect(() => {
        if (!inputRef.current) return;
        const input = inputRef.current;
        
        // METHOD 1: Check for :-webkit-autofill pseudo-class
        const checkAutofillPseudoClass = () => {
            try {
                const isAutofillActive = input.matches(':-webkit-autofill');
                if (isAutofillActive && input.value && input.value !== value) {
                    processAutofillValue(input.value, 'pseudo-class');
                }
            } catch (e) {
                // Pseudo-class not supported
            }
        };
        
        // METHOD 2: Background color detection (Chrome shows yellow bg for autofill)
        const checkBackgroundColor = () => {
            const computedStyle = window.getComputedStyle(input);
            const bgColor = computedStyle.backgroundColor;
            // Chrome autofill typically uses rgb(232, 240, 254) or similar
            if (bgColor && (
                bgColor.includes('232, 240, 254') || // Chrome
                bgColor.includes('250, 255, 189') || // Some browsers use yellow
                bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'rgb(255, 255, 255)' && bgColor !== 'transparent'
            )) {
                if (input.value && input.value !== value) {
                    processAutofillValue(input.value, 'bg-color');
                }
            }
        };
        
        // METHOD 3: Direct value check
        const checkValue = () => {
            if (input.value && input.value !== value && !dirty) {
                processAutofillValue(input.value, 'value-check');
            }
        };
        
        // METHOD 4: Animation event handler
        const handleAnimationStart = (e) => {
            if (e.animationName === 'onAutoFillStart' || e.animationName === 'autofill') {
                setTimeout(() => {
                    if (input.value && input.value !== value) {
                        processAutofillValue(input.value, 'animation');
                    }
                }, 10);
            }
        };
        
        // METHOD 5: Input event without inputType (indicates programmatic change)
        const handleInput = (e) => {
            if (!e.inputType && input.value && input.value !== value) {
                processAutofillValue(input.value, 'input-no-type');
            }
        };
        
        // METHOD 6: Focus event (Edge shows autofill on focus)
        const handleFocus = () => {
            setTimeout(() => {
                if (input.value && input.value !== value && !dirty) {
                    processAutofillValue(input.value, 'focus');
                }
            }, 50);
        };
        
        // METHOD 7: Change event without user interaction
        const handleChange = (e) => {
            if (!input.dataset.userTyping && input.value && input.value !== value) {
                processAutofillValue(input.value, 'change');
            }
        };
        
        // Track user typing to differentiate from autofill
        const handleKeydown = () => {
            input.dataset.userTyping = 'true';
            setTimeout(() => {
                delete input.dataset.userTyping;
            }, 100);
        };
        
        // Attach listeners
        input.addEventListener('animationstart', handleAnimationStart);
        input.addEventListener('input', handleInput);
        input.addEventListener('focus', handleFocus);
        input.addEventListener('change', handleChange);
        input.addEventListener('keydown', handleKeydown);
        
        // Run immediate checks
        checkValue();
        checkAutofillPseudoClass();
        checkBackgroundColor();
        
        // Schedule delayed checks for different browser timing
        const timeouts = [
            setTimeout(checkValue, 100),
            setTimeout(checkValue, 300),
            setTimeout(checkValue, 500),
            setTimeout(checkValue, 1000),
            setTimeout(checkValue, 2000), // Edge needs longer
            setTimeout(checkAutofillPseudoClass, 200),
            setTimeout(checkAutofillPseudoClass, 1000),
            setTimeout(checkBackgroundColor, 300),
            setTimeout(checkBackgroundColor, 1000),
        ];
        
        // Periodic check for Edge (which may autofill later)
        autofillCheckIntervalRef.current = setInterval(() => {
            checkValue();
            checkAutofillPseudoClass();
        }, 2000);
        
        // Stop periodic checks after 10 seconds
        setTimeout(() => {
            if (autofillCheckIntervalRef.current) {
                clearInterval(autofillCheckIntervalRef.current);
            }
        }, 10000);
        
        return () => {
            input.removeEventListener('animationstart', handleAnimationStart);
            input.removeEventListener('input', handleInput);
            input.removeEventListener('focus', handleFocus);
            input.removeEventListener('change', handleChange);
            input.removeEventListener('keydown', handleKeydown);
            timeouts.forEach(t => clearTimeout(t));
            if (autofillCheckIntervalRef.current) {
                clearInterval(autofillCheckIntervalRef.current);
            }
        };
    }, [processAutofillValue, value, dirty]);

    // Initial setup effect
    useEffect(() => {
        const initialValue = propsValue || defaultValue || "";
        
        if (initialValue && validateOnMount) {
            setValue(initialValue);
            setDirty(true);
            validateInput(initialValue);
        } else if (initialValue) {
            setValue(initialValue);
            validateInput(initialValue);
        }
        
        setIsInitialized(true);
    }, []);

    // Handle builder mode initialization
    useEffect(() => {
        if ((builderMode || builder) && question?.question) {
            const questionValue = question.question || "";
            setValue(questionValue);
            if (validateOnMount && questionValue) {
                setDirty(true);
                validateInput(questionValue);
            }
        }
    }, [builderMode, builder, question, validateOnMount, validateInput]);

    // Sync with external value changes
    useEffect(() => {
        if (isInitialized && propsValue !== undefined && propsValue !== value) {
            setValue(propsValue);
            if (propsValue && validateOnMount) {
                setDirty(true);
            }
            validateInput(propsValue, propsValue && validateOnMount);
        }
    }, [propsValue, isInitialized, value, validateOnMount, validateInput]);

    // Validation effect
    useEffect(() => {
        if (isInitialized) {
            validateInput(value);
        }
    }, [propsError, required, type, isInitialized, validateInput, value]);

    // Sync external dirty state
    useEffect(() => {
        if (externalDirty !== null && externalDirty !== dirty) {
            setDirty(externalDirty);
        }
    }, [externalDirty, dirty]);

    // Add CSS for autofill detection
    useEffect(() => {
        if (document.getElementById('autofill-detection-styles')) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'autofill-detection-styles';
        styleEl.textContent = `
            @keyframes onAutoFillStart {
                from { opacity: 1; }
                to { opacity: 1; }
            }
            
            @keyframes onAutoFillCancel {
                from { opacity: 1; }
                to { opacity: 1; }
            }
            
            input:-webkit-autofill {
                animation-name: onAutoFillStart !important;
                animation-duration: 0.001s !important;
            }
            
            input:not(:-webkit-autofill) {
                animation-name: onAutoFillCancel !important;
            }
        `;
        document.head.appendChild(styleEl);
        
        return () => {
            // Don't remove - other inputs may need it
        };
    }, []);

    const handleOnBlur = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        setIsFocused(false);
        validateInput(val, true);
        
        if (onBlur) {
            if (type === 'phone-number') {
                let errorMsg = null;
                if (required && val && !validatePhoneNumber(val)) {
                    const digitCount = val.replace(/\D/g, '').length;
                    errorMsg = digitCount < 10 
                        ? 'Phone number must be at least 10 digits'
                        : 'Please enter a valid phone number (e.g., (555) 123-4567)';
                }
                onBlur(val, errorMsg);
            } else if (type === 'email') {
                let errorMsg = null;
                if (required && val && !validateEmail(val)) {
                    errorMsg = 'Please enter a valid email address';
                }
                onBlur(val, errorMsg);
            } else {
                onBlur(val);
            }
        }
        
        if (onChange) {
            if (type === 'phone-number') {
                let errorMsg = null;
                if (required && val && !validatePhoneNumber(val)) {
                    const digitCount = val.replace(/\D/g, '').length;
                    errorMsg = digitCount < 10 
                        ? 'Phone number must be at least 10 digits'
                        : 'Please enter a valid phone number';
                }
                onChange(val, errorMsg);
            } else if (type === 'email') {
                let errorMsg = null;
                if (required && val && !validateEmail(val)) {
                    errorMsg = 'Please enter a valid email address';
                }
                onChange(val, errorMsg);
            } else {
                onChange(val);
            }
        }
    };

    const handleOnFocus = () => {
        setIsFocused(true);
        
        // Check for autofill on focus (Edge behavior)
        setTimeout(() => {
            if (inputRef.current && inputRef.current.value && inputRef.current.value !== value && !dirty) {
                processAutofillValue(inputRef.current.value, 'focus-delayed');
            }
        }, 50);
    };

    const handleOnChange = (e) => {
        const val = e.target.value;
        
        // Mark as user typing
        if (inputRef.current) {
            inputRef.current.dataset.userTyping = 'true';
            setTimeout(() => {
                if (inputRef.current) {
                    delete inputRef.current.dataset.userTyping;
                }
            }, 100);
        }
        
        // ✅ Update internal state immediately (shows validation in real-time)
        setValue(val);
        setDirty(true);
        setIsAutofilled(false);
        validateInput(val, true); // ✅ Validates and shows red/green borders
        
        // ✅ DO NOT call onChange during typing - prevents parent re-render and focus loss
        // Parent will be notified onBlur instead for all field types
    };

    const shouldShowError = propsError || (error && (effectiveDirty || forceShowErrors));
    const shouldShowValid = !shouldShowError && isValid && (effectiveDirty || forceShowErrors);

    const getBorderClasses = () => {
        if (shouldShowError) {
            return 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200';
        }
        if (shouldShowValid) {
            return 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-200';
        }
        if (isFocused) {
            return 'border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
        }
        return 'border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200';
    };

    const getBackgroundClasses = () => {
        if (shouldShowError) {
            return 'bg-red-50 focus:bg-white';
        }
        if (shouldShowValid) {
            return 'bg-green-50 focus:bg-white';
        }
        if (isAutofilled) {
            return 'bg-blue-50 focus:bg-white'; // Indicate autofilled state
        }
        return 'bg-white';
    };

    const StatusIcon = () => {
        if (shouldShowError) {
            return (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        if (shouldShowValid) {
            return (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        return null;
    };

    const getSizeClasses = () => {
        switch (size) {
            case "small":
                return "px-3 py-1.5 text-sm h-8";
            case "large":
                return "px-4 py-3 text-lg h-12";
            case "medium":
            default:
                return "px-3.5 py-2.5 text-base h-12";
        }
    };

    const containerStyle = {
        width: width || "100%"
    };

    // Builder mode rendering
    if (builderMode || builder) {
        return (
            <div className="w-full">
                <div className="relative">
                    <input
                        ref={inputRef}
                        autoComplete={autoComplete}
                        name={name || label}
                        id={id || name || label}
                        value={value}
                        placeholder={placeholder || `Enter ${type === 'phone-number' ? 'phone number' : type}...`}
                        type={getFieldType()}
                        className={`
                            block w-full font-normal text-gray-700 bg-clip-padding 
                            border border-solid rounded-lg shadow-sm transition-all ease-in-out duration-200
                            focus:text-gray-700 focus:outline-none 
                            disabled:opacity-80 px-3 py-2 text-base pr-10
                            ${getBorderClasses()} ${getBackgroundClasses()}
                            ${className || ''}
                        `}
                        onBlur={handleOnBlur}
                        onFocus={handleOnFocus}
                        onChange={handleOnChange}
                        {...otherProps}
                    />
                    <StatusIcon />
                </div>
                {shouldShowError && (
                    <div className="mt-1 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
                    </div>
                )}
            </div>
        );
    }

    // Standard form rendering
    return (
        <div className="flex mb-2" style={containerStyle}>
            <div className="mb-3 w-full">
                {label && (
                    <label 
                        htmlFor={id || name || label} 
                        className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}
                    >
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    <input
                        ref={inputRef}
                        autoComplete={autoComplete}
                        name={name || label}
                        id={id || name || label}
                        value={value}
                        required={required}
                        placeholder={placeholder}
                        type={getFieldType()}
                        data-autofilled={isAutofilled ? 'true' : 'false'}
                        className={`
                            block w-full font-normal text-gray-700 bg-clip-padding 
                            border border-solid rounded-lg shadow-sm transition-all ease-in-out duration-200
                            focus:text-gray-700 focus:outline-none 
                            disabled:opacity-80 pr-10
                            ${getSizeClasses()} 
                            ${getBorderClasses()} ${getBackgroundClasses()}
                            ${className || ''}
                        `}
                        onBlur={handleOnBlur}
                        onFocus={handleOnFocus}
                        onChange={handleOnChange}
                        {...otherProps}
                    />
                    <StatusIcon />
                </div>
                
                {shouldShowError && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InputField;
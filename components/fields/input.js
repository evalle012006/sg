import { useEffect, useState, useRef } from "react";
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
        question, // For builder mode
        builder = false, // Legacy prop for builder mode
        validateOnMount = true, // New prop to control initial validation
        ...otherProps
    } = props;

    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [value, setValue] = useState(propsValue || defaultValue || "");
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const inputRef = useRef(null);

    // Determine actual field type based on props
    const getFieldType = () => {
        if (type === "phone-number") return "tel";
        if (type === "string" || type === "text") return "text";
        if (type === "integer") return "number";
        return type;
    };

    // Enhanced validation logic with user-friendly messages
    const validateInput = (inputValue, shouldSetDirty = false) => {
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
        // Set valid state for non-empty, non-required fields or valid required fields
        setIsValid(inputValue && inputValue.trim() !== '');
        if (shouldSetDirty) setDirty(true);
    };

    // Initial setup effect - handles pre-populated data validation
    useEffect(() => {
        const initialValue = propsValue || defaultValue || "";
        
        if (initialValue && validateOnMount) {
            setValue(initialValue);
            setDirty(true); // Mark as dirty to show validation feedback
            validateInput(initialValue);
        } else if (initialValue) {
            setValue(initialValue);
            validateInput(initialValue);
        }
        
        setIsInitialized(true);
    }, []); // Only run on mount

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
    }, [builderMode, builder, question]);

    // Sync with external value changes (after initial mount)
    useEffect(() => {
        if (isInitialized && propsValue !== undefined && propsValue !== value) {
            setValue(propsValue);
            if (propsValue && validateOnMount) {
                setDirty(true);
            }
            validateInput(propsValue, propsValue && validateOnMount);
        }
    }, [propsValue, isInitialized]);

    // Validation effect - runs when dependencies change
    useEffect(() => {
        if (isInitialized) {
            validateInput(value);
        }
    }, [propsError, required, type, isInitialized]);

    // Autofill detection
    useEffect(() => {
        if (!inputRef.current) return;

        // Function to process autofilled value
        const processAutofillValue = (newValue) => {
            if (newValue !== value) {
                setValue(newValue);
                setDirty(true);
                onChange && onChange(newValue);
                validateInput(newValue, true);
            }
        };

        // Method 1: CSS background-image detection (Chrome/Safari)
        const detectAutofill = () => {
            if (
                inputRef.current && 
                window.getComputedStyle(inputRef.current, null).getPropertyValue('background-image') !== 'none' &&
                inputRef.current.value !== value
            ) {
                processAutofillValue(inputRef.current.value);
            }
        };

        // Method 2: Input event listener (Edge compatibility)
        const handleInput = (e) => {
            processAutofillValue(e.target.value);
        };

        // Method 3: Focus event listener (catches when user clicks autofilled field in Edge)
        const handleFocus = (e) => {
            // Small delay to ensure autofill has completed
            setTimeout(() => {
                if (e.target.value && e.target.value !== value) {
                    processAutofillValue(e.target.value);
                }
            }, 50);
        };

        // Method 4: Change event listener (backup detection)
        const handleChange = (e) => {
            processAutofillValue(e.target.value);
        };

        // Run initial detection
        detectAutofill();
        
        // Run detection with delays for slower autofill
        const timeout1 = setTimeout(detectAutofill, 100);
        const timeout2 = setTimeout(detectAutofill, 500);
        const timeout3 = setTimeout(detectAutofill, 1500); // Extra delay for Edge
        
        // Add event listeners
        const inputElement = inputRef.current;
        inputElement.addEventListener('input', handleInput);
        inputElement.addEventListener('focus', handleFocus);
        inputElement.addEventListener('change', handleChange);
        inputElement.classList.add('autofill-monitor');
        
        // Cleanup
        return () => {
            clearTimeout(timeout1);
            clearTimeout(timeout2);
            clearTimeout(timeout3);
            if (inputElement) {
                inputElement.removeEventListener('input', handleInput);
                inputElement.removeEventListener('focus', handleFocus);
                inputElement.removeEventListener('change', handleChange);
            }
        };
    }, [onChange, value]);

    const handleOnAnimationStart = (e) => {
        if (e.animationName === 'onAutoFillStart') {
            const newValue = inputRef.current.value;
            if (newValue !== value) {
                setValue(newValue);
                setDirty(true);
                onChange && onChange(newValue);
                validateInput(newValue, true);
            }
        }
    };
    
    // Add CSS for autofill detection
    useEffect(() => {
        // Check if style already exists to avoid duplicates
        if (document.getElementById('autofill-detection-styles')) return;
        
        const styleEl = document.createElement('style');
        styleEl.id = 'autofill-detection-styles';
        styleEl.textContent = `
            @keyframes onAutoFillStart {
                from {/**/}
                to {/**/}
            }
            
            @keyframes onAutoFillCancel {
                from {/**/}
                to {/**/}
            }
            
            input:-webkit-autofill {
                animation-name: onAutoFillStart;
                transition: background-color 50000s ease-in-out 0s;
            }
            
            input:not(:-webkit-autofill) {
                animation-name: onAutoFillCancel;
            }
        `;
        document.head.appendChild(styleEl);
        
        return () => {
            const existingStyle = document.getElementById('autofill-detection-styles');
            if (existingStyle) {
                document.head.removeChild(existingStyle);
            }
        };
    }, []);

    useEffect(() => {
        // Update internal value when external value prop changes
        if (props.value !== undefined && props.value !== value) {
            setValue(props.value);
        }
    }, [props.value]);

    // MODIFIED: handleOnBlur - only change for phone-number
    const handleOnBlur = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        setIsFocused(false);
        validateInput(val, true);
        
        // PHONE-NUMBER SPECIFIC: Pass error to parent using imported validation
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
            } else {
                onBlur(val);
            }
        }
    };

    const handleOnFocus = (e) => {
        setIsFocused(true);
    };

    // MODIFIED: handleOnChange - only change for phone-number
    const handleOnChange = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        validateInput(val, true);
        
        // PHONE-NUMBER SPECIFIC: Pass error to parent using imported validation
        if (onChange) {
            if (type === 'phone-number') {
                let errorMsg = null;
                if (required && val && !validatePhoneNumber(val)) {
                    const digitCount = val.replace(/\D/g, '').length;
                    errorMsg = digitCount < 10 
                        ? 'Phone number must be at least 10 digits'
                        : 'Please enter a valid phone number (e.g., (555) 123-4567)';
                }
                onChange(val, errorMsg);
            } else {
                onChange(val);
            }
        }
    };

    const shouldShowError = propsError || (error && dirty);
    const shouldShowValid = !shouldShowError && isValid && dirty;

    // Get border and focus colors based on state
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

    // Get background color based on state
    const getBackgroundClasses = () => {
        if (shouldShowError) {
            return 'bg-red-50 focus:bg-white';
        }
        if (shouldShowValid) {
            return 'bg-green-50 focus:bg-white';
        }
        return 'bg-white';
    };

    // Status icon component
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

    // Size classes
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

    // Container width style
    const containerStyle = {
        width: width || "100%"
    };

    // Builder mode rendering - simplified for template builder
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
                        onAnimationStart={handleOnAnimationStart}
                        onInput={(e) => handleOnChange(e)}
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
                        onAnimationStart={handleOnAnimationStart}
                        onInput={(e) => handleOnChange(e)}
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
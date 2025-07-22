import { useEffect, useState, useRef } from "react";

const TextField = (props) => {
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
        ...otherProps
    } = props;

    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [value, setValue] = useState(propsValue || defaultValue || "");
    const inputRef = useRef(null);

    // Validation functions
    const validateEmail = (val) => {
        const validEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        return val.match(validEmail);
    };

    const validatePhoneNumber = (val) => {
        const validPhoneNumber = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/;
        return val.match(validPhoneNumber);
    };

    // Autofill detection
    useEffect(() => {
        const detectAutofill = () => {
            if (
                inputRef.current && 
                window.getComputedStyle(inputRef.current, null).getPropertyValue('background-image') !== 'none' &&
                inputRef.current.value !== value
            ) {
                const newValue = inputRef.current.value;
                setValue(newValue);
                setDirty(true);
                onChange && onChange(newValue);
                validateInput(newValue);
            }
        };
        
        detectAutofill();
        const timeout = setTimeout(detectAutofill, 100);
        
        if (inputRef.current) {
            inputRef.current.classList.add('autofill-monitor');
        }
        
        return () => clearTimeout(timeout);
    }, [onChange, value]);
    
    const handleOnAnimationStart = (e) => {
        if (e.animationName === 'onAutoFillStart') {
            const newValue = inputRef.current.value;
            setValue(newValue);
            setDirty(true);
            onChange && onChange(newValue);
            validateInput(newValue);
        }
    };
    
    // Add CSS for autofill detection
    useEffect(() => {
        // Add a style element to detect autofill
        const styleEl = document.createElement('style');
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
            document.head.removeChild(styleEl);
        };
    }, []);

    // Sync with external value
    useEffect(() => {
        if (propsValue !== undefined && propsValue !== value) {
            setValue(propsValue);
            validateInput(propsValue);
        }
    }, [propsValue]);
    
    // Sync with defaultValue on mount
    useEffect(() => {
        if (defaultValue && !propsValue) {
            setValue(defaultValue);
            validateInput(defaultValue);
        }
    }, []);

    // Validation logic
    const validateInput = (inputValue) => {
        if (propsError) {
            setError(true);
            setErrorMessage(propsError);
            return;
        }
        
        if (required && !inputValue) {
            setError(true);
            setErrorMessage('This field is required');
            return;
        }

        if (inputValue) {
            if (type === "email" && !validateEmail(inputValue)) {
                setError(true);
                setErrorMessage('Please enter a valid email address');
                return;
            }
            
            if (type === "phone" && !validatePhoneNumber(inputValue)) {
                setError(true);
                setErrorMessage('Please enter a valid phone number');
                return;
            }
            
            if (type === "number" && isNaN(Number(inputValue))) {
                setError(true);
                setErrorMessage('Please enter a valid number');
                return;
            }
        }
        
        setError(false);
        setErrorMessage('');
    };

    useEffect(() => {
        validateInput(value);
    }, [propsError, required, type, value]);

    const handleOnBlur = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        validateInput(val);
        onBlur && onBlur(val);
    };

    const handleOnChange = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        validateInput(val);
        onChange && onChange(val);
    };

    const shouldShowError = propsError || (error && dirty);

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

    return (
        <div className="flex mb-2" style={containerStyle}>
            <div className="mb-3 w-full">
                {label && (
                    <label 
                        htmlFor={id || name || label} 
                        className="font-semibold form-label inline-block mb-1.5 text-slate-700"
                    >
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <input
                    ref={inputRef}
                    autoComplete={autoComplete}
                    name={name || label}
                    id={id || name || label}
                    value={value}
                    required={required}
                    placeholder={placeholder}
                    type={type === "phone" ? "tel" : type}
                    className={`
                        block w-full font-normal text-gray-700 bg-white bg-clip-padding 
                        border border-solid rounded-lg shadow-sm transition ease-in-out 
                        focus:text-gray-700 focus:bg-white focus:outline-none 
                        disabled:opacity-80 
                        ${getSizeClasses()} 
                        ${className || ''} 
                        ${(shouldShowError && !className) 
                            ? 'border-red-400 focus:border-red-500' 
                            : !className 
                                ? 'border-gray-300 focus:border-slate-400' 
                                : ''
                        }
                    `}
                    onBlur={handleOnBlur}
                    onChange={handleOnChange}
                    onAnimationStart={handleOnAnimationStart}
                    onInput={(e) => handleOnChange(e)}
                    {...otherProps}
                />
                
                {shouldShowError && (
                    <p className="mt-1.5 text-red-500 text-xs">{errorMessage}</p>
                )}
            </div>
        </div>
    );
};

export default TextField;
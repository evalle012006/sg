import { useEffect, useState, useRef } from "react";

const TimeField = (props) => {
    const {
        label,
        value: propsValue,
        defaultValue,
        onChange,
        onBlur,
        className,
        id,
        name,
        required = false,
        error: propsError,
        placeholder,
        size = "medium",
        width,
        builderMode = false,
        question, // For builder mode
        builder = false, // Legacy prop for builder mode
        validateOnMount = true, // New prop to control initial validation
        invalidTimeErrorMsg = "Please enter a valid time",
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

    // Time validation function
    const validateTime = (val) => {
        if (!val) return true; // Empty is valid unless required
        
        // Check if it's a valid time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(val);
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
            const fieldName = label || 'Time';
            setErrorMessage(`${fieldName} is required`);
            if (shouldSetDirty) setDirty(true);
            return;
        }

        // Time-specific validation for non-empty values
        if (inputValue && inputValue.trim()) {
            if (!validateTime(inputValue)) {
                setError(true);
                setErrorMessage(invalidTimeErrorMsg);
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
    }, [propsError, required, isInitialized]);

    const handleOnBlur = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        setIsFocused(false);
        validateInput(val, true);
        onBlur && onBlur(val);
    };

    const handleOnFocus = (e) => {
        setIsFocused(true);
    };

    const handleOnChange = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        validateInput(val, true);
        onChange && onChange(val);
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
        width: width || "10.5rem"
    };

    // Builder mode rendering - simplified for template builder
    if (builderMode || builder) {
        return (
            <div className="w-full">
                <div className="relative">
                    <input
                        ref={inputRef}
                        name={name || label}
                        id={id || name || label}
                        value={value}
                        placeholder={placeholder}
                        type="time"
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
                        name={name || label}
                        id={id || name || label}
                        value={value}
                        required={required}
                        placeholder={placeholder}
                        type="time"
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

export default TimeField;
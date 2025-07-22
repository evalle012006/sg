import { useEffect, useState } from "react";
import { validateEmail } from "../../utilities/common";

const EmailField = (props) => {
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState(props.error || '');
    const [value, setValue] = useState(props.value || props.defaultValue || '');

    const validateAndSetError = (val) => {
        if (!val && props.required) {
            setError(true);
            setErrorMsg('Email is required.');
            return false;
        } else if (val && !validateEmail(val)) {
            setError(true);
            setErrorMsg('Please input a valid email address.');
            return false;
        } else {
            setError(false);
            setErrorMsg('');
            return true;
        }
    }

    const handleOnBlur = (e) => {
        const val = e.target.value ? e.target.value : '';
        setValue(val);
        setDirty(true);
        const isValid = validateAndSetError(val);
        
        // Determine error message to pass to parent
        let errorMessage = null;
        if (!val && props.required) {
            errorMessage = 'Email is required.';
        } else if (val && !validateEmail(val)) {
            errorMessage = 'Please input a valid email address.';
        }
        
        // FIXED: Always call onBlur with value and error (similar to phone/date fields)
        if (props.onBlur) {
            props.onBlur(val, errorMessage);
        }
        
        return isValid;
    }

    const handleOnChange = (e) => {
        const val = e.target.value ? e.target.value : '';
        setValue(val);
        
        // Only validate on change if already dirty
        let isValid = true;
        if (dirty) {
            isValid = validateAndSetError(val);
        }
        
        // Determine error message to pass to parent
        let errorMessage = null;
        if (dirty) {
            if (!val && props.required) {
                errorMessage = 'Email is required.';
            } else if (val && !validateEmail(val)) {
                errorMessage = 'Please input a valid email address.';
            }
        }
        
        // FIXED: Always call onChange with value and error (similar to phone/date fields)
        if (props.onChange) {
            props.onChange(val, errorMessage);
        }
    }

    // Handle external value/defaultValue changes
    useEffect(() => {
        if (props.value !== undefined) {
            setValue(props.value);
            if (dirty) {
                validateAndSetError(props.value);
            }
        } else if (props.defaultValue !== undefined && !value) {
            setValue(props.defaultValue);
        }
    }, [props.value, props.defaultValue]);

    // Handle external error prop changes
    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMsg(props.error);
        } else if (!props.error && error && dirty) {
            // If external error is cleared, re-validate current value
            validateAndSetError(value);
        }
    }, [props.error]);
    
    // Force validation on form submit attempts
    useEffect(() => {
        const handleFormSubmit = () => {
            if (props.required && !dirty) {
                setDirty(true);
                validateAndSetError(value);
            }
        };
        
        // This tracks when a form attempts submission
        const formElements = document.querySelectorAll('form');
        formElements.forEach(form => {
            form.addEventListener('submit', handleFormSubmit);
        });
        
        // Auto-validate required fields when the component mounts
        if (props.required && props.value && !dirty) {
            setDirty(true);
            validateAndSetError(props.value);
        }
        
        return () => {
            formElements.forEach(form => {
                form.removeEventListener('submit', handleFormSubmit);
            });
        };
    }, [props.required, dirty, value]);

    // Use external error if provided, otherwise use internal error state
    const displayError = props.error || (dirty && error);
    const displayErrorMsg = props.error || errorMsg;

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3 max-w-96 w-full">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <input
                    {...props}
                    type="email"
                    name={props.label}
                    value={value}
                    className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${displayError ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-slate-400'}`}
                    onBlur={handleOnBlur}
                    onChange={handleOnChange} />
                {displayError && <p className="mt-1.5 text-red-500 text-xs">{displayErrorMsg}</p>}
            </div>
        </div>
    );
};

export default EmailField;
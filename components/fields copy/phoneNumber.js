import { useEffect, useState } from "react";

const PhoneNumberField = (props) => {
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState(props.error);
    const [value, setValue] = useState(props.value || props.defaultValue || '');

    const validatePhoneNumber = (val) => {
        const validPhoneNumber = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/;
        return val.match(validPhoneNumber);
    }

    const handleBlur = (e) => {
        const targetValue = e.target.value;
        setValue(targetValue);
        setDirty(true);
        
        // Pass both value and error state to parent
        if (props?.onBlur) {
            // Determine if there's an error
            let hasError = false;
            let errorMessage = null;
            
            if (!targetValue && props.required) {
                hasError = true;
                errorMessage = 'This is a required field.';
            } else if (targetValue && !validatePhoneNumber(targetValue)) {
                hasError = true;
                errorMessage = 'Please input a valid phone number. (e.g. (123)-456-7890, 123-456-7890, or 123456-7890)';
            }
            
            // Call onBlur with value and error (similar to how date fields work)
            props.onBlur(targetValue, errorMessage);
        }
    }

    const handleChange = (e) => {
        const targetValue = e.target.value;
        setValue(targetValue);
        setDirty(true);
        
        // Pass both value and error state to parent
        if (props?.onChange) {
            // Determine if there's an error
            let hasError = false;
            let errorMessage = null;
            
            if (!targetValue && props.required) {
                hasError = true;
                errorMessage = 'This is a required field.';
            } else if (targetValue && !validatePhoneNumber(targetValue)) {
                hasError = true;
                errorMessage = 'Please input a valid phone number. (e.g. (123)-456-7890, 123-456-7890, or 123456-7890)';
            }
            
            // Call onChange with value and error
            props.onChange(targetValue, errorMessage);
        }
    }

    useEffect(() => {
        if (props.value !== undefined) {
            setValue(props.value);
            setDirty(true);
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
            if (!value && props.required) {
                setError(true);
                setErrorMsg('This is a required field.');
            } else if (value) {
                if (validatePhoneNumber(value)) {
                    setError(false);
                    setErrorMsg('');
                } else {
                    setError(true);
                    setErrorMsg('Please input a valid phone number. (e.g. (123)-456-7890, 123-456-7890, or 123456-7890)');
                }
            } else {
                setError(false);
                setErrorMsg('');
            }
        }
    }, [props.error, value, props.required, dirty]);

    // Internal validation when value changes (only if no external error)
    useEffect(() => {
        if (!props.error && dirty) {
            if (!value && props.required) {
                setError(true);
                setErrorMsg('This is a required field.');
            } else if (value) {
                if (validatePhoneNumber(value)) {
                    setError(false);
                    setErrorMsg('');
                } else {
                    setError(true);
                    setErrorMsg('Please input a valid phone number. (e.g. (123)-456-7890, 123-456-7890, or 123456-7890)');
                }
            } else {
                setError(false);
                setErrorMsg('');
            }
        }
    }, [value, props.required, dirty, props.error]);

    // Use external error if provided (from parent validation)
    const displayError = props.error || (dirty && error);
    const displayErrorMsg = props.error || errorMsg;

    return (
        <div className="flex w-full mb-2" style={{ width: props.width }}>
            <div className="mb-2" style={{ width: props.width }}>
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <input
                    name={props.label}
                    type="text"
                    value={value}
                    placeholder={props.placeholder}
                    required={props.required}
                    className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${props.className || ''} 
                                ${(displayError && !props.className) ? 'border-red-400 focus:border-red-500' : !props.className ? 'border-gray-300 focus:border-slate-400' : ''}`}
                    onBlur={handleBlur}
                    onChange={handleChange} 
                />
                {displayError && <p className="mt-1.5 text-red-500 text-xs">{displayErrorMsg}</p>}
            </div>
        </div>
    );
};

export default PhoneNumberField;
import { useEffect, useState, useRef } from "react";

const TextField = (props) => {
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [value, setValue] = useState(props.value || props.defaultValue || "");
    const inputRef = useRef(null);

    useEffect(() => {
        const detectAutofill = () => {
        if (inputRef.current && 
            window.getComputedStyle(inputRef.current, null).getPropertyValue('background-image') !== 'none' &&
            inputRef.current.value !== value) {
            const newValue = inputRef.current.value;
            setValue(newValue);
            setDirty(true);
            props.onChange && props.onChange(newValue);
        }
        };
        
        detectAutofill();
        const timeout = setTimeout(detectAutofill, 100);
        
        if (inputRef.current) {
            inputRef.current.classList.add('autofill-monitor');
        }
        
        return () => clearTimeout(timeout);
    }, [props.onChange, value]);
    
    const handleOnAnimationStart = (e) => {
        if (e.animationName === 'onAutoFillStart') {
            const newValue = inputRef.current.value;
            setValue(newValue);
            setDirty(true);
            props.onChange && props.onChange(newValue);
        }
    };

    useEffect(() => {
        if (props.value !== undefined && props.value !== value) {
            setValue(props.value);
        }
    }, [props.value]);

    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMessage(props.error);
            return;
        }
        
        if (props.required && !value) {
            setError(true);
            setErrorMessage('This field is required');
        } else {
            setError(false);
            setErrorMessage('');
        }
    }, [props.error, props.required, value]);

    const handleOnBlur = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        props.onBlur && props.onBlur(val);
    };

    const handleOnChange = (e) => {
        const val = e.target.value;
        setValue(val);
        setDirty(true);
        props.onChange && props.onChange(val);
    };

    const shouldShowError = props.error || (error && dirty);

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3 max-w-96 w-full">
                {props.label && (
                    <label 
                        htmlFor={props.name || props.label} 
                        className="font-semibold form-label inline-block mb-1.5 text-slate-700"
                    >
                        {props.label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <input
                    ref={inputRef}
                    autoComplete={props.autoComplete || "on"}
                    name={props.name || props.label}
                    id={props.id || props.name || props.label}
                    value={value}
                    required={props.required}
                    {...props}
                    type={props.type || "text"}
                    className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none disabled:opacity-80 
                                ${props.className || ''} 
                                ${(shouldShowError && !props.className) ? 'border-red-400 focus:border-red-500' : !props.className ? 'border-gray-300 focus:border-slate-400' : ''}`}
                    onBlur={handleOnBlur}
                    onChange={handleOnChange}
                    onAnimationStart={handleOnAnimationStart}
                    onInput={(e) => handleOnChange(e)}
                />
                
                {(props.error || (error && dirty)) && (
                    <p className="mt-1.5 text-red-500 text-xs">{errorMessage}</p>
                )}
            </div>
        </div>
    );
};

export default TextField;
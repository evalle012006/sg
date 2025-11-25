import Radio from "./radioButton";
import { useEffect, useState } from "react";

export default function RadioField(props) {
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [dirty, setDirty] = useState(false);
    const [isValid, setIsValid] = useState(false);

    const handleChange = (selectedValue) => {
        setDirty(true);
        const newOptions = props.options.map((option) => {
            if (option.label === selectedValue) {
                return { ...option, value: true };
            } else {
                return { ...option, value: false };
            }
        });

        // Validate after selection
        validateSelection(selectedValue);

        if (props.hasOwnProperty('onChange')) {
            props.onChange(props.label, newOptions);
        }
    };

    const validateSelection = (selectedValue) => {
        // Check for external error first
        if (props.error) {
            setError(true);
            setErrorMessage(props.error);
            setIsValid(false);
            return;
        }

        // Required field validation
        if (props.required && !selectedValue) {
            setError(true);
            const fieldName = props.label || 'Selection';
            setErrorMessage(`${fieldName} is required`);
            setIsValid(false);
            return;
        }

        // Clear error if validation passes and set valid state
        setError(false);
        setErrorMessage('');
        // Only show success state if required and has selection
        setIsValid(props.required && !!selectedValue);
    };

    // Validate when props change
    useEffect(() => {
        const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
        const selectedOption = propOptions?.find(option => option.value === true);
        const selectedValue = selectedOption ? selectedOption.label : null;
        
        if (dirty) {
            validateSelection(selectedValue);
        }
    }, [props.error, props.required, props.options, dirty]);

    const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
    
    // Find the currently selected option
    const selectedOption = propOptions?.find(option => option.value === true);
    const selectedValue = selectedOption ? selectedOption.label : null;
    
    const shouldShowError = props.error || (error && (dirty || props.forceShowErrors));
    const shouldShowValid = !shouldShowError && isValid && (dirty || props.forceShowErrors);
                
    return (
        <div className="mb-2">
            {props.label && (
                <label className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}>
                    {props.label}
                    {props.required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            <div className={`flex flex-col ${props?.hideoptions && 'hidden'} ${props.className || ''} 
                rounded-lg border transition-all duration-200 p-3
                ${shouldShowError 
                    ? 'border-red-400 bg-red-50' 
                    : shouldShowValid 
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white'
                }
            `}>
                {props.options && propOptions.map((option, index) => {
                    return (
                        <Radio 
                            key={index}
                            value={option.label} 
                            selectedValue={selectedValue}
                            id={option.label} 
                            name={props.label} 
                            label={option.label}
                            onClick={handleChange} 
                            disabled={props.disabled}
                            builder={props.builder ? props.builder : false} 
                            index={index}
                            updateOptionLabel={props.updateOptionLabel} 
                            handleRemoveOption={props.handleRemoveOption} 
                            size={props.size || 'medium'}
                            hasError={shouldShowError}
                        />
                    )
                })
                }
            </div>
            {shouldShowError && (
                <div className="mt-1.5 flex items-center">
                    <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
                </div>
            )}
            {/* {shouldShowValid && (
                <div className="mt-1.5 flex items-center">
                    <svg className="h-4 w-4 text-green-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-green-600 text-sm font-medium">Selection confirmed</p>
                </div>
            )} */}
        </div>
    )
}
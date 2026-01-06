import React, { useEffect, useState } from "react";

const SelectComponent = (props) => {
    const [value, setValue] = useState(props.value || '');
    const [options, setOptions] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleOnChange = (selected) => {
        setValue(selected.label);
        props.onChange(selected);
        setDropdownOpen(false);
    }

    const handleClear = (e) => {
        e.stopPropagation();
        setValue('');
        props.onChange(null);
        setDropdownOpen(false);
    }

    const handleOpenDropdown = () => {
        if(props.hasOwnProperty("disabled")) {
            if (props.disabled) {
                setDropdownOpen(false);
            } else {
                setDropdownOpen(true);
            }
        } else {
            setDropdownOpen(true);
        }
    }

    useEffect(() => {
        if (props.options) {
            const optionArr = (props.options && typeof props.options === 'string') ? JSON.parse(props.options) : props.options;
            setOptions(optionArr);
        }
    }, [props.options]);

    useEffect(() => {
        if (props.value) {
            setValue(props.value == 0 ? '0' : props.value);
        }
    }, [props.value]);

    return (
        <div className="mb-6" style={{ width: props.width }}>
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700 !text-left">{props.label}</label>}
            
            <div 
                className="flex justify-between items-center px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:border-slate-400 focus:outline-none cursor-pointer min-h-[42px]" 
                onClick={handleOpenDropdown}
                title={value || props.placeholder} // Add tooltip for full text
            >
                <div className="flex-1 flex items-center min-w-0"> {/* min-w-0 allows flex item to shrink */}
                    <input
                        placeholder={props.placeholder ? props.placeholder : "Select"}
                        className="focus:outline-none text-gray-900 placeholder:text-gray-500 w-full bg-transparent border-0 p-0 m-0 cursor-pointer"
                        type="text" 
                        value={value}
                        disabled={props.disabled}
                        readOnly
                        title={value} // Tooltip on input as well
                        style={{
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    />
                </div>
                
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {/* Clear button - only show if clearable and has value */}
                    {props.isClearable && value && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="hover:bg-gray-100 rounded p-1 transition-colors"
                            title="Clear selection"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                strokeWidth="2" 
                                stroke="currentColor" 
                                className="w-4 h-4 text-gray-400 hover:text-gray-600"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    
                    {/* Dropdown arrow */}
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        strokeWidth="1.5" 
                        stroke="currentColor" 
                        className={`w-5 h-5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </div>
            </div>
            
            {dropdownOpen && (
                <div className="relative">
                    <div className="absolute drop-shadow-xl mt-1 z-30 top-1 bg-white rounded-lg border border-gray-100 w-full block overflow-x-auto max-h-60 overflow-y-auto">
                        {options.length > 0 ? (
                            <>
                                {options.map((option, index) => {
                                    return (
                                        <div 
                                            key={index} 
                                            className="flex justify-between items-center space-x-2 p-3.5 hover:bg-gray-50 hover:cursor-pointer border-b border-gray-50 last:border-b-0" 
                                            onClick={() => handleOnChange(option)}
                                            title={option.label} // Tooltip for long option labels
                                        >
                                            <div className="flex items-center min-w-0 flex-1"> {/* Allow flex to shrink */}
                                                {option.color && <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${option.color}-400 flex-shrink-0`}></span>}
                                                <label 
                                                    className="font-medium hover:cursor-pointer truncate" 
                                                    title={option.label}
                                                    style={{
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {option.label}
                                                </label>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {value == option.label && (
                                                    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M14.6668 1L5.50016 10.1667L1.3335 6" stroke="#00467F" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </>
                        ) : (
                            <span className="flex justify-between items-center space-x-2 p-3.5 text-gray-400">No options to select</span>
                        )}
                    </div>
                    <div className="dropdown-wrapper fixed inset-0 z-20" onClick={() => setDropdownOpen(false)}></div>
                </div>
            )}
            {(!value && props.required && props.error) && <p className="mt-1.5 text-red-500">{props.error}</p>}
        </div>
    )
}

export default SelectComponent;
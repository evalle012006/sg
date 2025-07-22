import { Fragment, useEffect, useState } from "react";

const SelectField = (props) => {
    const [options, setOptions] = useState(props.options || []);
    const [value, setValue] = useState(props.value || (props.isMulti !== false ? [] : null));
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [valueLabel, setValueLabel] = useState('');
    const [builderMode, setBuilderMode] = useState(false);
    const isMulti = props.isMulti !== false;

    const handleOnChange = (selected) => {
        if (!builderMode) {
            if (isMulti) {
                let selectedArr = Array.isArray(value) ? [...value] : [];
                const existingIndex = selectedArr.findIndex(v => v === selected.value);
                
                if (existingIndex !== -1) {
                    selectedArr.splice(existingIndex, 1);
                } else {
                    selectedArr.push(selected.value);
                }

                setValue(selectedArr);
                props.onChange(selectedArr);
            } else {
                // For single select, we pass the entire selected option
                if (value && value.value === selected.value) {
                    setValue(null);
                    props.onChange(null);
                } else {
                    setValue(selected);
                    props.onChange(selected);
                }
                setDropdownOpen(false);
            }
        }
    }

    const handleClear = (e) => {
        e.stopPropagation();
        if (isMulti) {
            setValue([]);
            props.onChange([]);
        } else {
            setValue(null);
            props.onChange(null);
        }
    };

    // Initialize value from props
    useEffect(() => {
        if (props.value !== undefined && props.value !== null) {
            if (isMulti) {
                // Handle multi-select case
                const newValue = Array.isArray(props.value) ? props.value : [];
                setValue(newValue.map(v => {
                    if (v && v.includes(' ')) {
                        const option = options.find(opt => opt.label === v);
                        return option ? option.value : v.toLowerCase().replace(/ /g, '-');
                    }
                    return v;
                }));
            } else {
                // For single select, store the entire option object
                setValue(props.value);
            }
        } else {
            setValue(isMulti ? [] : null);
        }
    }, [props.value, options, isMulti]);

    // Update the display label whenever value changes
    useEffect(() => {
        if (value) {
            if (isMulti) {
                const labels = Array.isArray(value) 
                    ? value.map(v => {
                        const option = options.find(opt => opt.value === v);
                        return option ? option.label : v;
                    }).join(', ')
                    : '';
                setValueLabel(labels);
            } else {
                // For single select, we already have the full object with label
                setValueLabel(value.label || '');
            }
        } else {
            setValueLabel('');
        }
    }, [value, options, isMulti]);

    useEffect(() => {
        setOptions(props.options);
    }, [props.options]);

    useEffect(() => {
        setBuilderMode(props.builder || false);
    }, [props.builder]);

    const isOptionSelected = (option) => {
        if (isMulti) {
            return Array.isArray(value) && value.includes(option.value);
        }
        // For single select, compare the values
        return value && value.value === option.value;
    };

    return (
        <div className="mb-2" style={{ width: props.width }}>
            {props.label && (
                <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>
            )}
            <div 
                className={`cursor-pointer flex justify-between items-center w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none
                ${props.className || 'border-gray-300 focus:border-slate-400'}`}
                onClick={() => setDropdownOpen(true)}
            >
                <input
                    placeholder={isMulti ? "Select multiple" : "Select one"}
                    className="w-full focus:outline-none text-gray-900 placeholder:text-gray-500"
                    type="text"
                    value={valueLabel}
                    onChange={() => {}}
                    disabled={props?.disabled}
                    readOnly
                />
                <div className="flex items-center space-x-2">
                    {!isMulti && value && (isMulti ? value.length > 0 : true) && (
                        <button
                            onClick={handleClear}
                            className="p-1 hover:bg-gray-100 rounded-full"
                            title="Clear selection"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-gray-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        strokeWidth="1.5" 
                        stroke="currentColor" 
                        className="w-6 h-5"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                </div>
            </div>
            
            {(dropdownOpen && !props?.disabled) && (
                <div className="relative" style={{ width: props.width }}>
                    <div className="absolute drop-shadow-xl mt-1 z-30 top-1 bg-white rounded-lg border border-gray-100 w-full">
                        {options.map((option, index) => (
                            <div 
                                key={index} 
                                className="flex items-center space-x-3 p-3.5 hover:bg-gray-50 hover:cursor-pointer" 
                                onClick={() => handleOnChange(option)}
                            >
                                {builderMode ? (
                                    <div className="flex flex-row group/field">
                                        <input 
                                            type={isMulti ? "checkbox" : "radio"}
                                            name="select-option"
                                            checked={isOptionSelected(option)}
                                            onChange={() => {}}
                                            className={`
                                                appearance-none bg-transparent w-5 h-5 border 
                                                ${isMulti ? 'rounded-md' : 'rounded-full'}
                                                hover:cursor-pointer
                                                ${isOptionSelected(option) ? 'border-sky-800 bg-sky-800' : 'border-gray-300'}
                                                focus:outline-none
                                                ${props.error ? 'ring-2 ring-red-500' : ''}
                                            `}
                                        />
                                        <input 
                                            type="text" 
                                            defaultValue={option.label} 
                                            className={`ml-2 border-b border-zinc-300 outline-none ${props.error ? 'border-red-500' : ''}`}
                                            onBlur={(e) => { props.updateOptionLabel?.(e, { index: index }, 'select'); }}
                                        />
                                        <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
                                            <button 
                                                className='p-1 rounded text-sm mt-2 outline-none' 
                                                onClick={(e) => props.handleRemoveOption?.(e, index, 'select')} 
                                                title="Delete Option"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="ml-1 w-5 h-5 text-zinc-400">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Fragment>
                                        <input 
                                            type={isMulti ? "checkbox" : "radio"}
                                            name="select-option"
                                            checked={isOptionSelected(option)}
                                            onChange={() => {}}
                                            className={`
                                                appearance-none bg-transparent w-5 h-5 border 
                                                ${isMulti ? 'rounded-md' : 'rounded-full'}
                                                hover:cursor-pointer
                                                ${isOptionSelected(option) ? 'border-sky-800 bg-sky-800' : 'border-gray-300'}
                                                focus:outline-none
                                                ${props.error ? 'ring-2 ring-red-500' : ''}
                                            `}
                                        />
                                        <label className="hover:cursor-pointer font-medium">
                                            {option.label}
                                        </label>
                                    </Fragment>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="dropdown-wrapper fixed inset-0 z-20" onClick={() => setDropdownOpen(false)} />
                </div>
            )}
            
            {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
        </div>
    );
}

export default SelectField;
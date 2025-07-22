import React, { useEffect, useState } from "react";

const SelectField = (props) => {
    const [value, setValue] = useState(props.value || '');
    const [options, setOptions] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [builderMode, setBuilderMode] = useState(false);


    const handleOnChange = (selected) => {
        if (!builderMode) {
            setValue(selected.label);
            props.onChange(selected);
            setDropdownOpen(false);
        }
    }

    useEffect(() => {
        if (props.options) {
            const optionArr = (props.options && typeof props.options === 'string') ? JSON.parse(props.options) : props.options;
            setOptions(optionArr);
        }
    }, [props.options]);

    useEffect(() => {
        if (props.builder) {
            setBuilderMode(props.builder);
        } else {
            setBuilderMode(false);
        }
    }, [props.builder]);

    return (
        <div className="mb-2" style={{ width: props.width }}>
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
            <div 
                className={`flex justify-between items-center px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none
                ${props.className || 'border-gray-300 focus:border-slate-400'}`} 
                onClick={() => setDropdownOpen(true)}
            >
                <input
                    placeholder="Select"
                    className="focus:outline-none text-gray-900 placeholder:text-gray-500"
                    type="text" value={value}
                    disabled={props?.disabled}
                    readOnly/>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </div>
            {(dropdownOpen && !props?.disabled) && (
                <div className="relative">
                    <div className="absolute drop-shadow-xl mt-1 z-30 top-1 bg-white rounded-lg border border-gray-100 w-full">
                        {options.map((option, index) => {
                            return (
                                <div key={index} className="flex justify-between items-center space-x-2 p-3.5 hover:bg-gray-50 hover:cursor-pointer" onClick={() => handleOnChange(option)}>
                                    {builderMode ? (
                                        <div className="flex flex-row group/field">
                                            <input type="text" defaultValue={option.label} className="ml-2 border-b border-zinc-300 outline-none" onBlur={(e) => {props.updateOptionLabel(e, {index: index}, 'select');}} />
                                            <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
                                                <button className='p-1 rounded text-sm mt-2 outline-none' onClick={(e) => props.handleRemoveOption(e, index, 'select')} title="Delete Option">
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="ml-1 w-5 h-5 text-zinc-400"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <React.Fragment>
                                            <label className="font-medium hover:cursor-pointer">{option.label}</label>
                                            {value == option.label && <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M14.6668 1L5.50016 10.1667L1.3335 6" stroke="#00467F" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>}
                                        </React.Fragment>
                                    )}
                                </div>
                            )
                        })
                        }
                    </div>
                    <div className="dropdown-wrapper fixed inset-0 z-20" onClick={() => setDropdownOpen(false)}></div>
                </div>
            )}
            {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
        </div>
    )
}

export default SelectField;
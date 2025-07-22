import React, { useEffect, useState } from "react";

const SelectFilterComponent = (props) => {
    const [value, setValue] = useState();
    const [options, setOptions] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleOnClick = () => {
        if (props?.disabled) return;
        setDropdownOpen(!dropdownOpen);
    }

    const handleOnChange = (selected) => {
        setValue(selected.label);
        props.onChange(selected);
        setDropdownOpen(false);
    }

    useEffect(() => {
        if (props.options) {
            const optionArr = (props.options && typeof props.options === 'string') ? JSON.parse(props.options) : props.options;
            setOptions(optionArr);
        }
    }, [props.options]);

    useEffect(() => {
        if (props.value) {
            setValue(props.value);
        }
    }, [props.value]);

    return (
        <div>
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
            <div className="flex justify-between items-center px-2 py-2 text-base font-normal text-gray-500 bg-white bg-clip-padding rounded-full
                                border border-solid border-gray-300 shadow-sm transition ease-in-out m-0 focus:text-gray-400 focus:bg-white 
                                focus:border-slate-400 focus:outline-none;" onClick={handleOnClick}>
                <input placeholder={props.placeholder ? props.placeholder : "Select"}
                    className="focus:outline-none text-gray-600 placeholder:text-gray-500"
                    type="text" defaultValue={value} disabled={props.disabled}
                    readOnly/>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </div>
            {(!props?.disabled && dropdownOpen) && (
                <div className="relative">
                    <div className="absolute drop-shadow-xl z-30 top-1 bg-white rounded-lg border border-gray-100 w-full text-gray-600 h-40 overflow-x-auto">
                        {options.length > 0 ? (
                            <>
                                {options.map((option, index) => {
                                        return (
                                            <div key={index} className="flex justify-between items-center space-x-2 p-3.5 hover:bg-gray-50 hover:cursor-pointer" onClick={() => handleOnChange(option)}>
                                                <div>
                                                    {option.color && <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${option.color}-400`}></span>}
                                                    <label className="font-medium hover:cursor-pointer">{option.label}</label>
                                                </div>
                                                {value == option.value && <svg width="16" height="11" viewBox="0 0 16 11" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M14.6668 1L5.50016 10.1667L1.3335 6" stroke="#00467F" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>}
                                            </div>
                                        )
                                    })
                                }
                            </>
                        ) : (
                            <span className="flex justify-between items-center space-x-2 p-3.5 text-gray-400">No options to select</span>
                        )}
                    </div>
                    <div className="dropdown-wrapper fixed inset-0 z-20" onClick={() => setDropdownOpen(false)}></div>
                </div>
            )}
        </div>
    )
}

export default SelectFilterComponent;
import { useEffect, useState } from "react";

const NumberField = (props) => {
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [value, setValue] = useState();
    
    const handleBlur = (e) => {
        setValue(e.target.value);
        props.onBlur(e.target.value);
        setDirty(true);
    }

    const handleChange = (e) => {
        setValue(e.target.value);
        setDirty(true);
    }

    useEffect(() => {
        if (props.value) {
            setValue(props.value);
            setDirty(true);
        }
    }, [props.value]);

    useEffect(() => {
        if (value) {
            setError(false);
        } else if (!value && props.required) {
            setError(true);
        }
    }, [value]);

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <input
                    type="number"
                    disabled={props?.disabled}
                    className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${props.className || ''} 
                                ${(dirty && error && !props.className) ? 'border-red-400 focus:border-red-500' : !props.className ? 'border-gray-300 focus:border-slate-400' : ''}`}
                    defaultValue={value} 
                    onChange={handleChange} 
                    onBlur={handleBlur} 
                />
                {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
            </div>
        </div>
    );
};

export default NumberField;
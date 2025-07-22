import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const TimeField = (props) => {
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [value, setValue] = useState();

    const handleOnChange = (e) => {
        const valid = e.target.validity.valid;
        if (valid) {
            const val = e.target.value ? e.target.value : '';
            setValue(val);
            props.onChange && props.onChange(val);
        } else {
            setError(true);
            toast.error(props.invalidTimeErrorMsg);
            setTimeout(() => {
                setError(false);
            }, 3000);
        }
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
        } else if (props.required) {
            setError(true);
        }
    }, [value]);

    return (
        <div className="flex w-[9rem]" style={{ width: props.width }}>
            <div className="mb-3 max-w-96 w-full">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <input
                    {...props}
                    type="time"
                    className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${props.className || ''} 
                                ${(error && dirty && !props.className) ? 'border-red-400 focus:border-red-500' : !props.className ? 'border-gray-300 focus:border-slate-400' : ''}`}
                    defaultValue={value}
                    onChange={handleOnChange} />
                {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
            </div>
        </div>
    );
};

export default TimeField;
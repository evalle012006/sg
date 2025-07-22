import React from "react";

function Input({
    label,
    type,
    name,
    labelClass,
    inputClass,
    value,
    onChange,
    onFocus,
    onBlur,
    error,
    status,
    disabled,
    required = false,
}) {
    return (
        <div className="mb-2">
            <label
                htmlFor={name}
                id={name + '-' + label}
                className={`block text-slate-700 text-sm font-medium ml-1 mb-2 ${required ? 'text-left' : 'flex justify-between'} ${labelClass}`}
            >
                <span>{label}</span> {required && <span className="text-red-500">*</span>}
                <span>{status}</span>
            </label>
            <div className="relative">
                <input
                    className={`py-3 px-4 block w-full border-2
          border-gray-200 rounded-md text-sm
          focus:outline-blue-300
          focus:ring-blue-100 shadow-sm ${inputClass}`}
                    aria-describedby={name+'-error'}
                    type={type}
                    aria-labelledby={name + '-' + label}
                    id={`${name}`}
                    name={name}
                    defaultValue={value}
                    onChange={onChange}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    disabled={disabled}
                    placeholder={`Please Input ${label}`}
                />
                {error && <div className="text-red-500 text-sm text-left" id="email-error">{error}</div>}
            </div>
        </div>
    );
}

export default Input;
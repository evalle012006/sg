import React, { useEffect, useRef, useState } from "react";

function RadioButton(props) {
  const ref = useRef();
  const [error, setError] = useState(false);
  const [label, setLabel] = useState(props.label ? props.label : "");
  const [builderMode, setBuilderMode] = useState(false);

  const handleChange = (e) => {
    const value = e.target.value;

    if (value) {
      setLabel(value);
      props.updateOptionLabel(e, {index: props.index, label: value}, 'radio');
    } else {
      setError(true);
    }
  }

  const selectRadio = () => {
    ref.current.checked = !props.checked;
    props.onChange(props.label);
  }

  useEffect(() => {
    if (props.builder) {
      setBuilderMode(true);
    }
  }, [props.builder]);

  return (
    <div className="mt-2 cursor-pointer">
      <div className="flex items-center mr-4 cursor-pointer" onClick={selectRadio}>
        <input
          id={props.id}
          ref={ref}
          type="radio"
          value={props.value}
          onChange={() => props.onChange(props.label)}
          name={props.name}
          checked={props.checked ? props.checked : false}
          className={`${props.size === "lg" ? "w-6 h-6" : "w-w h-w"}
              ${props.disabled ? "text-gray-10" : "text-main"}
              ${props.disabled ? "text-gray-10" : "focus:ring-main"}
              ${props.disabled ? "bg-gray-10" : "bg-gray-100"}
              ${props.disabled ? "bg-gray-10" : "dark:bg-white"}
              border-gray-300
              dark:focus:ring-main
              dark:ring-offset-gray-10 focus:ring-2
              dark:border-gray-10 ${props.className || ''}`}
          disabled={props.disabled}
        />
        {builderMode ? (
          <div className="flex flex-row group/field">
            <input type="text" defaultValue={label} className={`ml-2 ${label.length > 30 && 'w-[40em]'} border-b border-zinc-300 outline-none`} onBlur={(e) => {handleChange(e)}} />
            <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
                <button className='p-1 rounded text-sm mt-2 outline-none' onClick={(e) => props.handleRemoveOption(e, props.index, 'radio')} title="Delete Option">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="ml-1 w-5 h-5 text-zinc-400"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
          </div>
        ) : (
          <label htmlFor={props.name} className={`block md:font-medium md:text-sm ${props?.boldLabel ? 'font-bold text-lg md:hidden' : 'font-medium text-sm'} ml-2 text-gray-900 cursor-pointer`}>
            {!props.hideLabel && label}
          </label>
        )}
      </div>
    </div>
  );
}

export default RadioButton;
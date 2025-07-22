import { useEffect, useRef, useState } from "react";

export default function CheckBox(props) {
  const [builderMode, setBuilderMode] = useState(false);
  const [label, setLabel] = useState(props.label ? props.label : "");
  const ref = useRef();

  const handleChange = (e) => {
    const value = e.target.value;

    if (value) {
      setLabel(value);
      props.updateOptionLabel(e, { index: props.index, label: value }, 'checkbox');
    } else {
      setError(true);
    }
  }

  const checkBox = () => {
    ref.current.checked = !props.value;
    props.onChange(props.label, !props.value, props.notAvailableFlag);
  }

  useEffect(() => {
    if (props.builder) {
      setBuilderMode(props.builder);
    } else {
      setBuilderMode(false);
    }
  }, [props.builder]);
  return (
    <div className="mt-1 cursor-pointer">
      <div className="flex items-center mr-4 cursor-pointer" onClick={checkBox}>
        <input ref={ref} name={props.name} type="checkbox" value={props.value ? props.value : false} checked={props.checked ? props.checked : false} onChange={() => props.onChange(props.label, !props.value)}
          className={`cursor-pointer ${props.size === 'lg' ? 'w-6 h-6' : 'w-w h-w'} rounded text-main bg-gray-100 border-gray-300 ring-gray-10
            ${props.className}`}
          disabled={props.disabled}
        />
        {builderMode ? (
          <div className="flex flex-row group/field">
            <input type="text" defaultValue={label} className={`ml-2 ${label.length > 30 && 'w-[40em]'} border-b border-zinc-300 outline-none`} onBlur={(e) => { handleChange(e) }} />
            <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
              <button className='p-1 rounded text-sm mt-2 outline-none' onClick={(e) => props.handleRemoveOption(e, props.index, 'checkbox')} title="Delete Option">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="ml-1 w-5 h-5 text-zinc-400"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
        ) : (
          props.label && !props.hideLabel && <label htmlFor={props.name} className={`ml-2 text-sm cursor-pointer ${props.bold ? 'font-bold' : 'font-medium'}`}>
            {label}
          </label>
        )}
      </div>
    </div>
  );
}
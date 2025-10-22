import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function CheckboxGeneric(props) {
  const [builderMode, setBuilderMode] = useState(false);
  const [label, setLabel] = useState(props.label ? props.label : "");

  const updateOptionLabel = async (value) => {
    const response = await fetch("/api/settings/goals", {
      method: "POST",
      body: JSON.stringify({ id: props.id, value: value }),
    });

    if (response.ok) {
      toast.success("Option label updated successfully.");
    } else {
      toast.error("Failed to update option label.");
    }
  }

  const handleChange = async (e) => {
    if (e.target.type === 'checkbox') {
      props.onChange(props.id, e.target.checked);
    } else {
      const value = e.target.value;
      if (value) {
        setLabel(value);
      } else {
        setError(true);
      }
    }
  }

  useEffect(() => {
    if (props.builder) {
      setBuilderMode(props.builder);
    } else {
      setBuilderMode(false);
    }
  }, [props.builder]);

  // Generate a unique id for the checkbox
  const checkboxId = `checkbox-${props.id}`;

  return (
    <div className="flex flex-col">
      <div className="mt-1 cursor-pointer">
        <div className="flex items-center mr-4">
          <input 
            id={checkboxId}
            name={props.name} 
            type="checkbox" 
            checked={props.checked || false}
            onChange={handleChange}
            className={`cursor-pointer ${props.size === 'lg' ? 'w-6 h-6' : 'w-w h-w'} rounded text-main bg-gray-100 border-gray-300 ring-gray-10
              ${props.className}`}
            disabled={props.disabled}
          />
          {builderMode ? (
            <div className="flex flex-row group/field">
              <input 
                type="text" 
                value={label} 
                className={`ml-2 ${label.length > 30 && 'w-[40em]'} border-b border-zinc-300 outline-none`} 
                onChange={handleChange} 
              />
              <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
                <button 
                  className='p-1 rounded text-sm mt-2 outline-none' 
                  onClick={() => updateOptionLabel(label)} 
                  title="Save Changes"
                >
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="ml-1 w-5 h-5 text-zinc-400">
                    <rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor"/>
                    <rect x="4" y="4" width="16" height="16" fill="white"/>
                    <path d="M4 4h12v4H4z" fill="currentColor"/>
                    <rect x="6" y="10" width="12" height="8" fill="currentColor"/>
                    <rect x="16" y="2" width="4" height="4" fill="white"/>
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            props.label && !props.hideLabel && 
            <label htmlFor={checkboxId} className={`ml-2 text-sm cursor-pointer ${props.bold ? 'font-bold' : 'font-medium'}`}>
              {label}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
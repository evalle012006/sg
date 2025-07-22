import React, { useEffect, useState } from "react";
import CheckBox from "./checkbox";

export default function CheckBoxField(props) {

  const handleChange = (label, checked) => {
    let newOptions = props.options && props.options.map((option) => {
      if (option.label === label && checked) {
        return { ...option, value: checked };
      }
    });
    props.onChange && props.onChange(props.label, newOptions);
  };

  const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
  
  return (
    <div className="mb-2">
      {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
      <div className={`flex flex-col ${props?.hideoptions && 'hidden'}`}>
        {props.options && propOptions.map((option, index) => {
          return (
            <div key={index} className="flex justify-between items-center space-x-2 p-1 hover:bg-gray-50 hover:cursor-pointer">
              <CheckBox value={option.value} checked={option.value} name={option.label} label={option.label}
                onChange={handleChange} disabled={props.disabled}
                builder={props.builder ? props.builder : false} index={index}
                updateOptionLabel={props.updateOptionLabel} handleRemoveOption={props.handleRemoveOption} />
            </div>
          )
        })
        }
      </div>
    </div>
  )
}

// USAGE EXAMPLE

{/* <GetField type='checkbox' label='This is the question?'
options={[
  { label: 'Option 1', value: true },
  { label: 'Option 2', value: false },
  { label: 'Option 3', value: true },
  { label: 'Option 4', value: false }
]}

onChange={(option, status) => {
  console.log(option, status)
}}
error="Please select one or more options." /> */}
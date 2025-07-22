import React, { useEffect, useState } from "react";
import CheckBox from "./checkbox";
import Image from "next/image";

export default function EquipmentCheckBoxField(props) {

    const handleChange = (label, checked) => {
        const newOptions = props.options && props.options.map((option) => {
            if (option.label === label) {
                return { ...option, value: checked };
            } else {
                return option;
            }
        });
        if (props.onChange) {
            props.onChange(props.label, newOptions);
        }
    };

    return (
        <div className={`mb-2 ${props.className || ''}`}>
            <div className="flex flex-row">
                {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
                {props.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
            </div>
            <div className={`flex flex-col ${props.error ? 'p-3 bg-red-50 border-2 border-red-500 rounded-md' : ''}`}>
                {props.options && props.options.sort((a, b) => a.id - b.id).map((option, index) => {
                    const url = option?.image_url ? option.image_url : option?.image_filename ? `/equipments/${option.image_filename}` : '';
                    return (
                        <div key={index} className="flex justify-between items-center space-x-2 p-1 hover:bg-gray-50 hover:cursor-pointer">
                            <CheckBox 
                                value={option.value} 
                                checked={option.value} 
                                name={option.label} 
                                label={option.label}
                                onChange={handleChange} 
                                disabled={props.disabled}
                                builder={props.builder ? props.builder : false} 
                                index={index}
                                updateOptionLabel={props.updateOptionLabel} 
                                handleRemoveOption={props.handleRemoveOption} 
                                className={props.error ? 'ring-2 ring-red-500' : ''}
                            />
                            {url &&
                                <>
                                    <div>
                                        <Image className="w-fit rounded-md" src={url} width={100} height={100} />
                                    </div>
                                </>}
                        </div>
                    )
                })}
            </div>
            {/* {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>} */}
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
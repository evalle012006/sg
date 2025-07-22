import Image from "next/image";
import Radio from "./radioButton";

export default function EquipmentRadioField(props) {

    const handleChange = (label) => {
        const newOptions = props.options.map((option) => {
            if (option.label === label) {
                return { ...option, value: true };
            } else {
                return { ...option, value: false };
            }
        });

        if (props.hasOwnProperty('onChange')) {
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
                {props.options && props.options.map((option, index) => {
                    const url = option?.image_url ? option.image_url : option?.image_filename ? `/equipments/${option.image_filename}` : '';
                    return (
                        <div key={index} className="flex justify-between items-center p-1 hover:bg-gray-50 hover:cursor-pointer" onClick={() => handleChange(option.label)}>
                            <Radio 
                                value={option.value} 
                                checked={option.value} 
                                id={option.label} 
                                name={props.label} 
                                label={option.label}
                                onChange={() => {}} // change handle using onClick on div
                                disabled={props.disabled}
                                builder={props.builder ? props.builder : false} 
                                index={index}
                                updateOptionLabel={props.updateOptionLabel} 
                                handleRemoveOption={props.handleRemoveOption} 
                                className={props.error ? 'ring-2 ring-red-500' : ''}
                            />
                            {url &&
                                <div>
                                    <Image className="w-fit rounded-md" alt={option.label} src={url} width={100} height={100} />
                                </div>}
                        </div>
                    )
                })}
            </div>
            {/* {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>} */}
        </div>
    )
}

// USAGE EXAMPLE

{/* <GetField type='radio' label='This is the question?'
options={[
  { label: 'Option 1', value: 'false' },
  { label: 'Option 2', value: 'false' },
  { label: 'Option 3', value: 'false' },
  { label: 'Option 4', value: 'false' }
]}

onChange={(option, status) => {
  console.log(option, status)
}}
error="Please select one or more options." /> */}
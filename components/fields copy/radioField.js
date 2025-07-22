import Radio from "./radioButton";

export default function RadioField(props) {

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

    const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
                
    return (
        <div className="mb-2">
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
            <div className={`flex flex-col ${props?.hideoptions && 'hidden'} ${props.className || ''}`}>
                {props.options && propOptions.map((option, index) => {
                    return (
                        <div key={index} className="flex justify-between items-center p-1 hover:bg-gray-50 hover:cursor-pointer">
                            <Radio 
                                value={option.value} 
                                checked={option.value} 
                                id={option.label} 
                                name={props.label} 
                                label={option.label}
                                onChange={handleChange} 
                                disabled={props.disabled}
                                builder={props.builder ? props.builder : false} 
                                index={index}
                                updateOptionLabel={props.updateOptionLabel} 
                                handleRemoveOption={props.handleRemoveOption} 
                                className={props.error ? 'ring-2 ring-red-500' : ''}
                            />
                        </div>
                    )
                })
                }
                {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
            </div>
        </div>
    )
}
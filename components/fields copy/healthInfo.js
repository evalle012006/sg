import { useEffect, useState } from "react";
import Checkbox from "./checkbox";
import Box from "../booking-comp/box";

export default function HealthInfo(props) {
    const [options, setOptions] = useState(props.options || []);

    const handleChange = (label, checked) => {
        const newList = options.map((list) => {
            let item = {...list};
            if (list.label === label) {
                item.value = checked;
            }

            return item;
        });
        setOptions(newList);
        props.onChange && props.onChange(label, newList);
    };

    return (
        <div className={`mb-2 w-full ${props.className || ''}`}>
            <div className="flex justify-between">
                <p className="p-4 font-bold">Description</p>
                <div className="flex justify-between">
                    {/* <p class="p-4">Option</p> */}
                </div>
            </div>
            {options.map((info, index) =>
                <Box key={index} bg={(index % 2) !== 0 && 'bg-white'}>
                    <div className="flex justify-between">
                        <p className="max-w-[50%]">{info.label}</p>
                        <div className="flex justify-between">
                            <Checkbox 
                                name={`checkbox-${index}`} 
                                value={info.value} 
                                checked={info.value} 
                                label={info.label} 
                                hideLabel={true} 
                                onChange={handleChange} 
                                disabled={props.disabled} 
                                className={props.error ? 'ring-2 ring-red-500' : ''}
                            />
                        </div>
                    </div>
                </Box>
            )}
            {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
        </div>
    );
}
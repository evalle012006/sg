import React, { useEffect, useRef, useState } from "react";

function RadioButtonNDIS(props) {
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
    <div className="flex flex-col">
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
      {(props.checked && !builderMode) && (
          <div className="ml-4">
            <PricingTable option={props?.index}/>
          </div>
      )}
    </div>
  );
}

export default RadioButtonNDIS;


const PricingTable = ({ option = 0 }) => {
  const [dataOption, setDataOption] = useState([]);

  useEffect(() => {
    switch (option) {
      case 0:
        setDataOption([
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Weekday",
            lineItem: "01_054_0115_1_1",
            price: "$950.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Saturday",
            lineItem: "01_055_0115_1_1", 
            price: "$1,100.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Sunday",
            lineItem: "01_056_0115_1_1",
            price: "$1,250.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday",
            lineItem: "01_057_0115_1_1",
            price: "$1,500.00"
          }
        ]);
        break;
      case 1:
        setDataOption([
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Weekday",
            lineItem: "01_054_0115_1_1",
            price: "$1,100.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Saturday",
            lineItem: "01_055_0115_1_1", 
            price: "$1,400.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Sunday",
            lineItem: "01_056_0115_1_1",
            price: "$1,750.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday",
            lineItem: "01_057_0115_1_1",
            price: "$2,000.00"
          }
        ]);
        break;
      case 2:
        setDataOption([
          {
            package: "STA And Assistance (Inc. Respite) - 1:1 Weekday",
            lineItem: "01_058_0115_1_1",
            price: "$1,740.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:1 Saturday",
            lineItem: "01_059_0115_1_1", 
            price: "$1,850.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:1 Sunday",
            lineItem: "01_060_0115_1_1",
            price: "$2,000.00"
          },
          {
            package: "STA And Assistance (Inc. Respite) - 1:1 Public Holiday",
            lineItem: "01_061_0115_1_1",
            price: "$2,250.00"
          }
        ]);
        break;
      default:
        break;
    }
  }, [option]);

  return (
    <div className="w-full max-w-4xl">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-[#20485A] text-white">
            <th className="p-3 text-left border border-gray-300 w-2/5">{ option == 2 ? '1:1 STA Package' : '1:2 STA Package' }</th>
            <th className="p-3 text-left border border-gray-300 w-2/5">Line Item</th>
            <th className="p-3 text-left border border-gray-300">Our New Price/night</th>
          </tr>
        </thead>
        <tbody>
          {dataOption.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-3 border border-gray-300">{row.package}</td>
              <td className="p-3 border border-gray-300">{row.lineItem}</td>
              <td className="p-3 border border-gray-300">{row.price}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
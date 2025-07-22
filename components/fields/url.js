import React, { useEffect, useState } from "react";

const URLField = (props) => {
    const [builderMode, setBuilderMode] = useState(false);
    const [label, setLabel] = useState();
    const [url, setUrl] = useState();

    const updateData = () => {
        const data = {
            label: label,
            url: url
        };

        props.onChange(data);
    }

    useEffect(() => {
        if (props.url) {
            setUrl(props.url);
        }

        if (props.label) {
            setLabel(props.label);
        }

        if (props.builderMode) {
            setBuilderMode(true);
        } else {
            setBuilderMode(false);
        }
    }, [props]);

    useEffect(() => {
        if (props.builderMode) {
            setBuilderMode(true);
        } else {
            setBuilderMode(false);
        }
    }, [props.builderMode]);

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="flex flex-col max-w-96 w-full">
                {builderMode ? (
                    <React.Fragment>
                        <input
                            defaultValue={label}
                            type="text"
                            placeholder="Input link label here"
                            className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                        rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none disabled:opacity-80
                                        ${props.className || 'border-gray-300 focus:border-slate-400'}`}
                            onChange={(e) => setLabel(e.target.value)}
                            onBlur={updateData} 
                            disabled={props?.disabled}
                        />
                        <input
                            defaultValue={url}
                            placeholder="Input url here"
                            type="text"
                            className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                        rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none disabled:opacity-80
                                        ${props.className || 'border-gray-300 focus:border-slate-400'}`}
                            onChange={(e) => setUrl(e.target.value)}
                            onBlur={updateData} 
                            disabled={props?.disabled}
                        />
                    </React.Fragment>
                ) : (
                    <a href={url} target='_blank' rel="noreferrer" className="text-sm underline text-sargood-blue mt-4">{ label }</a>
                )}
                {props.error && <span className="text-red-500 text-xs">{props.error}</span>}
            </div>
        </div>
    );
};

export default URLField;
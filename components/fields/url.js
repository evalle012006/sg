import React, { useEffect, useState } from "react";

const URLField = (props) => {
    // Initialize builderMode based on props, defaulting to false
    const [builderMode, setBuilderMode] = useState(props.builderMode || false);
    const [label, setLabel] = useState(props.label || '');
    const [url, setUrl] = useState(props.url || '');

    const updateData = () => {
        const data = {
            label: label,
            url: url
        };

        if (props.onChange) {
            props.onChange(data);
        }
    }

    useEffect(() => {
        if (props.url) {
            setUrl(props.url);
        }

        if (props.label) {
            setLabel(props.label);
        }

        // Explicitly handle builderMode prop
        setBuilderMode(props.builderMode === true);
    }, [props]);

    // Additional useEffect to handle builderMode changes specifically
    useEffect(() => {
        setBuilderMode(props.builderMode === true);
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
                    // Display mode - only show if we have both label and url
                    (label && url) ? (
                        <a 
                            href={url} 
                            target='_blank' 
                            rel="noreferrer" 
                            className="text-sm underline text-sargood-blue mt-4 hover:text-blue-700 transition-colors duration-200"
                        >
                            {label}
                        </a>
                    ) : (
                        // Show placeholder if no data is provided
                        <div className="text-gray-500 text-sm italic mt-4">
                            No link configured
                        </div>
                    )
                )}
                {props.error && <span className="text-red-500 text-xs mt-1">{props.error}</span>}
            </div>
        </div>
    );
};

export default URLField;
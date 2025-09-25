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

    const getContainerClasses = () => {
        const baseClasses = "flex flex-col w-full flex-1";
        if (props.error) {
            return `${baseClasses} border-2 border-red-400 bg-red-50 rounded-lg p-3`;
        }
        return baseClasses;
    };

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className={getContainerClasses()}>
                {props.label && (
                    <span className={`font-bold text-xl mb-2 ${props.error ? 'text-red-700' : 'text-sargood-blue'}`}>
                        {props.label}
                    </span>
                )}
                
                {props.builderMode ? (
                    <div className="flex flex-col gap-2">
                        {/* Builder mode inputs */}
                        <input
                            type="text"
                            placeholder="Link Label"
                            value={props.label || ''}
                            onChange={(e) => props.onChange({ label: e.target.value, url: props.url })}
                            className={`px-3 py-2 border rounded ${props.error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                        <input
                            type="url"
                            placeholder="https://example.com"
                            value={props.url || ''}
                            onChange={(e) => props.onChange({ label: props.label, url: e.target.value })}
                            className={`px-3 py-2 border rounded ${props.error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        />
                    </div>
                ) : (
                    // Display mode
                    (props.url && props.label) ? (
                        <a 
                            href={props.url} 
                            target='_blank' 
                            rel="noreferrer" 
                            className={`text-sm underline mt-4 hover:text-blue-700 transition-colors duration-200 ${
                                props.error ? 'text-red-600' : 'text-sargood-blue'
                            }`}
                        >
                            {props.label}
                        </a>
                    ) : (
                        <div className="text-gray-500 text-sm italic mt-4">
                            No link configured
                        </div>
                    )
                )}
                
                {/* Enhanced error message */}
                {props.error && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{props.error}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default URLField;
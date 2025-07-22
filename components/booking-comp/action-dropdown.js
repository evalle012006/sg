import React, { useState } from "react";

const ActionDropDown = ({ options }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative inline-block text-left">

            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="cursor-pointer w-6 h-6" onClick={() => setIsOpen(!isOpen)}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </svg>

            {isOpen && (
                <>
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="options-menu"
                    >
                        <div className="py-1" role="none">
                            {options.map((option, index) => {
                                return (
                                    <React.Fragment key={index}>
                                        {!option.hidden && (
                                            <button
                                                key={option.label}
                                                className="flex text-gray-700 block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900"
                                                role="menuitem"
                                                onClick={() => {
                                                    setIsOpen(false);
                                                    option.action();
                                                }}
                                            >
                                                {option.icon && option.icon()}
                                                {option.label}
                                            </button>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                        </div>
                    </div>
                    <div className="fixed z-10 inset-0" onClick={() => setIsOpen(false)}></div>
                </>
            )}
        </div>
    );
};

export default ActionDropDown;

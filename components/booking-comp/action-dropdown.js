import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

const ActionDropDown = ({ options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState({});
    const containerRef = useRef(null);
    const triggerRef = useRef(null);
    const menuRef = useRef(null); // ref on the portal menu

    const handleToggle = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const opensUpward = spaceBelow < 220;

            setMenuStyle({
                position: 'fixed',
                right: window.innerWidth - rect.right,
                zIndex: 9999,
                ...(opensUpward
                    ? { bottom: window.innerHeight - rect.top + 4 }
                    : { top: rect.bottom + 4 }
                ),
            });
        }
        setIsOpen(prev => !prev);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            const clickedInsideTrigger = containerRef.current?.contains(e.target);
            const clickedInsideMenu = menuRef.current?.contains(e.target);
            if (!clickedInsideTrigger && !clickedInsideMenu) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const menu = isOpen ? ReactDOM.createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            className="w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
            role="menu"
            aria-orientation="vertical"
        >
            <div className="py-1" role="none">
                {options.map((option, index) => (
                    <React.Fragment key={index}>
                        {!option.hidden && (
                            <button
                                className="flex text-gray-700 w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900"
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
                ))}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div ref={containerRef} className="relative inline-block text-left">
            <svg
                ref={triggerRef}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="cursor-pointer w-6 h-6"
                onClick={handleToggle}
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </svg>
            {menu}
        </div>
    );
};

export default ActionDropDown;
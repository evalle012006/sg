import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

// Same portal/positioning approach as ./action-dropdown.js, but with a
// labeled button trigger (icon + text + chevron) instead of a bare
// three-dot icon - used for grouping a document's Download/Email actions
// under one control instead of two separate icon-only buttons.
const DocumentActionsDropdown = ({ label, icon, options }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

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

  const visibleOptions = options.filter(o => !o.hidden);
  if (visibleOptions.length === 0) return null;

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const opensUpward = spaceBelow < 160;

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

  const menu = isOpen ? ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={menuStyle}
      className="w-52 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
      role="menu"
      aria-orientation="vertical"
    >
      <div className="py-1" role="none">
        {visibleOptions.map((option, index) => (
          <button
            key={index}
            className="flex items-center text-gray-700 w-full text-left px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              option.action();
            }}
          >
            {option.icon && option.icon()}
            {option.label}
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        title={label}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {menu}
    </div>
  );
};

export default DocumentActionsDropdown;
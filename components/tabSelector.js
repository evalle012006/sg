export const TabSelector = ({
    isActive,
    children,
    onClick,
}) => (
    <button
        className={`mr-8 group inline-flex items-center px-2 py-4 border-b-4 font-bold text-sm leading-5 cursor-pointer whitespace-nowrap focus:outline-none ${isActive
            ? "border-emerald-500 text-emerald-600 focus:outline-none"
            : "border-transparent text-gray-500 hover:text-gray-600 hover:border-gray-300"
            }`}
        onClick={onClick}
    >
        {children}
    </button>
);
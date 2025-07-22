export default function ToggleButton({ status, disabled = false, title }) {
    return (
        <label htmlFor="default-toggle" className={`inline-flex relative items-center ${disabled ? 'cursor-not-allowed':'cursor-pointer'}`} onClick={(e) => e.preventDefault()} title={title}>
            <input type="checkbox" checked={status} id="default-toggle" className="sr-only peer" readOnly />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-seafoam"></div>
        </label>
    )
}
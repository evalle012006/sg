export default function Modal(props) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={props.onClose}
        >
            <div
                className="w-full sm:w-auto sm:min-w-[420px] sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag-handle affordance, mobile only */}
                <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="px-6 pt-4 sm:pt-6 pb-2 shrink-0">
                    {props.title && (
                        <h2 className="text-xl sm:text-2xl font-bold text-sargood-blue">{props.title}</h2>
                    )}
                    {props.description && (
                        <p className="text-sm text-gray-600 mt-2">{props.description}</p>
                    )}
                </div>

                <div className="px-6 overflow-y-auto flex-1">
                    {props.children}
                </div>

                <div className="px-6 py-4 sm:py-5 mt-2 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-center gap-3 sm:space-x-12">
                    {props?.external ? (
                        <a
                            className="text-center font-bold text-neutral-500 uppercase py-2 sm:py-0"
                            href={props.externalUrl}
                        >
                            {props.cancelLabel ? props.cancelLabel : 'Cancel'}
                        </a>
                    ) : (
                        <button
                            className="font-bold text-neutral-500 uppercase py-2 sm:py-0"
                            onClick={props.onClose}
                        >
                            {props.cancelLabel ? props.cancelLabel : 'Cancel'}
                        </button>
                    )}
                    <button
                        className="font-bold text-sky-800 uppercase disabled:text-red-200 py-2 sm:py-0"
                        disabled={props.disabled || false}
                        onClick={props.onConfirm}
                    >
                        {props.confirmLabel ? props.confirmLabel : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}

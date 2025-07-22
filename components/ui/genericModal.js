export default function Modal(props) {
    return (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={props.onClose}>
            <div className="flex items-center justify-center xl:h-full">
                <div className="bg-white rounded-xl shadow-lg p-4 min-w-[40%] lg:max-w-[60%] sm:w-screen overflow-auto" onClick={(e) => e.stopPropagation()}>
                    <div className="p-11" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                        <h2 className="text-2xl font-bold text-sargood-blue">{props.title}</h2>
                        <p className="text-sm mt-3">{props.description}</p>
                        <div className="overflow-auto sm:h-[95%] sm:w-full">
                            {props.children}
                        </div>
                        <div className="flex justify-center space-x-12 mt-10">
                            { props?.external ? (
                                <a className="font-bold text-neutral-500 uppercase" href={props.externalUrl}>{ props.cancelLabel ? props.cancelLabel : 'Cancel' }</a>
                            ) : (
                                <button className="font-bold text-neutral-500 uppercase" onClick={props.onClose}>
                                    {props.cancelLabel ? props.cancelLabel : 'Cancel'}
                                </button>
                            )}
                            <button className="font-bold text-sky-800 uppercase disabled:text-red-200" disabled={props.disabled || false} onClick={props.onConfirm}>
                                {props.confirmLabel ? props.confirmLabel : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
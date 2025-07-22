export default function Modal(props) {
    return (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={props.modalHide ? props.modalHide : props.onClose}>
            <div className="flex items-center justify-center h-screen">
                <div className="bg-white rounded-xl shadow-lg p-4 min-w-[30%]" onClick={(e) => e.stopPropagation()}>
                    <div className="text-center p-11">
                        {props?.icon}
                        <h2 className={`text-2xl font-bold ${props.titleColor ? props.titleColor : 'text-sargood-blue'}`}>{props.title}</h2>
                        <p className="text-sm mt-3">{props.description}</p>
                        <div>
                            {props.children}
                        </div>
                        <div className="flex justify-center space-x-12 mt-10">
                            <button className={`font-bold ${props.cancelColor ? props.cancelColor : 'text-natural-500'}  uppercase`} onClick={props.onClose}>
                                {props.cancelLabel ? props.cancelLabel : 'Cancel'}
                            </button>
                            <button className={`font-bold ${props.confirmColor ? props.confirmColor : 'text-red-600'}  uppercase`} onClick={props.onConfirm}>
                                {props.confirmLabel ? props.confirmLabel : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    )
}
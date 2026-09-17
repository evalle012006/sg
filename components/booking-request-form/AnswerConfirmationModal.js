import { createPortal } from 'react-dom';

/**
 * Confirmation modal specific to the answer-confirmation-prompt feature
 * (e.g. "Sargood Foundation" answer offering to switch to "NDIS").
 *
 * Deliberately separate from components/ui/genericModal.js rather than reusing it:
 * genericModal.js is rendered inline wherever its caller sits in the component tree, and if
 * that caller is nested inside an ancestor with a CSS property that creates a new containing
 * block for `position: fixed` (transform, filter, perspective, contain, will-change — common on
 * animated accordion/collapse wrappers), the modal gets trapped inside that ancestor's box
 * instead of covering the viewport. That's what was happening here: the modal was confined to
 * the accordion section it was rendered inside instead of centering over the whole page.
 *
 * The fix is architectural, not a CSS tweak: render via a portal directly into document.body,
 * so the modal's DOM position is always a direct child of body regardless of where in the
 * component tree it's declared, and `position: fixed` always resolves against the real viewport.
 */
export default function AnswerConfirmationModal({ title = 'Please confirm', message, confirmLabel = 'Yes', cancelLabel = 'No', onConfirm, onClose }) {
    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={onClose}
        >
            <div
                className="w-full sm:w-auto sm:min-w-[420px] sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
                    <div className="h-1 w-10 rounded-full bg-gray-300" />
                </div>

                <div className="px-6 pt-4 sm:pt-6 pb-2 shrink-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-sargood-blue">{title}</h2>
                    {message && <p className="text-sm text-gray-600 mt-2">{message}</p>}
                </div>

                <div className="px-6 py-4 sm:py-5 mt-2 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-center gap-3 sm:space-x-12">
                    <button
                        type="button"
                        className="font-bold text-neutral-500 uppercase py-2 sm:py-0"
                        onClick={onClose}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="font-bold text-sky-800 uppercase py-2 sm:py-0"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

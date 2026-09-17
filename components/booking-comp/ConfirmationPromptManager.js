import React, { useState } from "react";
import { Bell, X, Trash2 } from "lucide-react";
import { getOptionsForQuestion, hasSelectableAnswers, getQuestionText } from "../../utilities/questionOptionsHelper";

/**
 * Confirmation Prompt manager for a single question, used inside fieldBuilder.js.
 *
 * Scope (deliberate, see conversation this was designed in):
 * - One prompt per question for now.
 * - Both the trigger answer and the target answer are constrained to that question's
 *   own real options (via getOptionsForQuestion) — never free text. This is load-bearing:
 *   a typo'd trigger/target string that doesn't match a real option value will make the
 *   card-selection field render as "required" even though an answer is stored, because
 *   cardField.js's isValueInOptions check won't find a match. Don't loosen this to a
 *   text input without re-solving that problem first.
 * - Target excludes whichever option is currently chosen as the trigger — switching an
 *   answer to itself isn't a meaningful confirmation prompt and would only confuse admins
 *   later wondering why it does nothing.
 *
 * Responsive behavior: on narrow screens the panel renders as a bottom sheet (full-width,
 * anchored to the viewport bottom, internal scroll, sticky header/footer) since a centered
 * modal with this many fields doesn't fit comfortably under ~400px wide. At sm: and up it
 * becomes a normal centered dialog.
 *
 * Props:
 *   question        - the full question object (needs .id, .type, .options, .QuestionAnswerPrompts)
 *   onSaved(prompt)  - called after a create/delete succeeds so the parent can refresh its
 *                      local question state (fieldBuilder.js owns persistence elsewhere via
 *                      syncOptions; this component only talks to the answer-prompts API).
 */
export default function ConfirmationPromptManager({ question, onSaved }) {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const options = getOptionsForQuestion(question);
    const existingPrompt = (question?.QuestionAnswerPrompts || [])[0] || null;

    const [form, setForm] = useState(() => ({
        trigger_answer: existingPrompt?.trigger_answer || '',
        target_answer: existingPrompt?.target_answer || '',
        modal_message: existingPrompt?.modal_message || '',
        confirm_label: existingPrompt?.confirm_label || 'Yes',
        cancel_label: existingPrompt?.cancel_label || 'No',
        is_active: existingPrompt?.is_active ?? true,
    }));

    if (!hasSelectableAnswers(question)) return null;

    const openPanel = () => {
        setForm({
            trigger_answer: existingPrompt?.trigger_answer || '',
            target_answer: existingPrompt?.target_answer || '',
            modal_message: existingPrompt?.modal_message || '',
            confirm_label: existingPrompt?.confirm_label || 'Yes',
            cancel_label: existingPrompt?.cancel_label || 'No',
            is_active: existingPrompt?.is_active ?? true,
        });
        setError(null);
        setIsOpen(true);
    };

    const targetOptions = options.filter(o => o.answerValue !== form.trigger_answer);

    const isValid = form.trigger_answer && form.target_answer && form.modal_message?.trim();

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        setError(null);
        try {
            // Mirrors the existing question-dependencies API: no PUT, edit = delete + recreate.
            if (existingPrompt) {
                const delRes = await fetch(`/api/booking-templates/questions/answer-prompts/${existingPrompt.id}`, {
                    method: 'DELETE',
                });
                if (!delRes.ok) throw new Error('Failed to update existing prompt');
            }

            const createRes = await fetch('/api/booking-templates/questions/answer-prompts/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: question.id,
                    trigger_answer: form.trigger_answer,
                    target_answer: form.target_answer,
                    modal_message: form.modal_message.trim(),
                    confirm_label: form.confirm_label?.trim() || 'Yes',
                    cancel_label: form.cancel_label?.trim() || 'No',
                    is_active: form.is_active,
                }),
            });
            if (!createRes.ok) throw new Error('Failed to save prompt');
            const createdBody = await createRes.json();
            const created = createdBody.prompt;

            setIsOpen(false);
            onSaved && onSaved(created);
        } catch (e) {
            setError(e.message || 'Something went wrong saving the prompt.');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        if (!existingPrompt) return;
        if (!window.confirm('Remove this confirmation prompt?')) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`/api/booking-templates/questions/answer-prompts/${existingPrompt.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to remove prompt');
            setIsOpen(false);
            onSaved && onSaved(null);
        } catch (e) {
            setError(e.message || 'Something went wrong removing the prompt.');
        } finally {
            setSaving(false);
        }
    };

    const optionLabel = (answerValue) => options.find(o => o.answerValue === answerValue)?.label || answerValue;

    const inputClasses = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors";
    const labelClasses = "block text-sm font-medium text-gray-700 mb-1.5";

    return (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
                <div className="flex items-start gap-2 min-w-0 text-sm text-gray-700">
                    <Bell size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    {existingPrompt ? (
                        <span className="min-w-0 break-words">
                            <span className="font-medium">Confirmation Prompt:</span>{' '}
                            &quot;{optionLabel(existingPrompt.trigger_answer)}&quot; asks to switch to &quot;{optionLabel(existingPrompt.target_answer)}&quot;
                            {!existingPrompt.is_active && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-xs bg-gray-200 text-gray-500 align-middle">
                                    inactive
                                </span>
                            )}
                        </span>
                    ) : (
                        <span className="text-gray-500">Confirmation Prompt: Not set</span>
                    )}
                </div>
                <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-800 active:text-blue-900"
                    onClick={openPanel}
                >
                    {existingPrompt ? 'Edit' : '+ Add'}
                </button>
            </div>

            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
                    onClick={() => !saving && setIsOpen(false)}
                >
                    <div
                        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[92vh] sm:max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag-handle affordance, mobile only */}
                        <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0">
                            <div className="h-1 w-10 rounded-full bg-gray-300" />
                        </div>

                        {/* Sticky header */}
                        <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-2 pb-3 sm:pt-4 border-b border-gray-100 shrink-0">
                            <div className="min-w-0">
                                <h3 className="text-base font-semibold text-gray-900">Confirmation Prompt</h3>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                    For: <span className="font-medium text-gray-600">{getQuestionText(question)}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="shrink-0 p-1.5 -m-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable body */}
                        <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto">
                            <div>
                                <label className={labelClasses}>When this answer is selected</label>
                                <select
                                    className={inputClasses}
                                    value={form.trigger_answer}
                                    onChange={e => setForm({ ...form, trigger_answer: e.target.value, target_answer: '' })}
                                >
                                    <option value="">Select an option…</option>
                                    {options.map(o => (
                                        <option key={o.answerValue} value={o.answerValue}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className={labelClasses}>Show this message</label>
                                <textarea
                                    className={`${inputClasses} resize-none`}
                                    rows={2}
                                    placeholder="e.g. Do you perhaps have an NDIS account?"
                                    value={form.modal_message}
                                    onChange={e => setForm({ ...form, modal_message: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className={labelClasses}>Offer to switch to</label>
                                <select
                                    className={`${inputClasses} disabled:bg-gray-100 disabled:text-gray-400`}
                                    value={form.target_answer}
                                    onChange={e => setForm({ ...form, target_answer: e.target.value })}
                                    disabled={!form.trigger_answer}
                                >
                                    <option value="">Select an option…</option>
                                    {targetOptions.map(o => (
                                        <option key={o.answerValue} value={o.answerValue}>{o.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClasses}>Confirm label</label>
                                    <input
                                        className={inputClasses}
                                        value={form.confirm_label}
                                        onChange={e => setForm({ ...form, confirm_label: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className={labelClasses}>Cancel label</label>
                                    <input
                                        className={inputClasses}
                                        value={form.cancel_label}
                                        onChange={e => setForm({ ...form, cancel_label: e.target.value })}
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    checked={form.is_active}
                                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                                />
                                Active
                            </label>

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )}
                        </div>

                        {/* Sticky footer */}
                        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
                            {existingPrompt ? (
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center gap-1.5 text-sm text-red-600 hover:text-red-800 py-2 sm:py-0"
                                    onClick={handleRemove}
                                    disabled={saving}
                                >
                                    <Trash2 size={14} />
                                    Remove
                                </button>
                            ) : <span className="hidden sm:block" />}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                                    onClick={() => setIsOpen(false)}
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600"
                                    onClick={handleSave}
                                    disabled={!isValid || saving}
                                >
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

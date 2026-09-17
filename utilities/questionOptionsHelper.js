/**
 * Shared question/option resolution helpers.
 *
 * NOTE: This is a deliberate copy of the equivalent logic in
 * pages/settings/booking-templates/conditionalsBuilder.js, not a refactor of it.
 * conditionalsBuilder.js is a live admin page; the answer-prompt builder needs
 * identical "pull the real question, resolve its real answer options" behavior,
 * but importing this here instead of touching that file avoids any risk of
 * altering its existing behavior. If these ever drift, that's the cost of this
 * choice — worth reconciling into one source later, deliberately, with its own review.
 */

// Types whose answer-change handler in questions.js has been wired to check for
// and fire a confirmation prompt (handleCardSelectionFieldChange,
// handleSelectFieldChange's single-value branch, handleRadioButtonFieldChange).
// Keep this in lockstep with that wiring — adding a type here without also
// wiring its handler lets an admin configure a prompt that can never fire.
//
// Deliberately excluded, even though they're "selection-style" fields:
// - multi-select, checkbox, checkbox-button: store an array of selected values,
//   not one flat answer, so a single trigger_answer/target_answer string doesn't
//   apply.
// - card-selection-multi, horizontal-card-multi: share a handler with the
//   included card types, but their value is an array of selections, same
//   mismatch as above.
// - service-cards / service-cards-multi: composite per-sub-service answers
//   (e.g. "wifi:yes"), not one flat answer.
// - health-info: structured, not a flat answer.
export const selectableAnswerTypes = [
    'card-selection', 'horizontal-card',
    'select', 'radio', 'radio-ndis',
];

export const cardSelectionFields = [
    'card-selection', 'card-selection-multi',
    'horizontal-card', 'horizontal-card-multi',
];

const isHtmlContent = (text) => {
    if (!text) return false;
    return /<[a-z][\s\S]*>/i.test(text);
};

const stripHtml = (text) => {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const parseMaybeJson = (val, fallback) => {
    if (typeof val !== 'string') return val || fallback;
    try { return JSON.parse(val); } catch { return fallback; }
};

/**
 * Human-readable label for a question, regardless of type.
 * Mirrors conditionalsBuilder.js's getQuestionText — see file header note.
 */
export const getQuestionText = (q) => {
    if (!q) return '';

    const qText = q.question?.trim();
    if (qText) return isHtmlContent(qText) ? stripHtml(qText) : qText;

    const labelText = q.label?.trim();
    if (labelText) return labelText;

    const details = parseMaybeJson(q.details, {});
    if (details?.label?.trim()) return details.label.trim();
    if (details?.title?.trim()) return details.title.trim();

    if (q.question_key?.trim()) {
        return q.question_key
            .split('-')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    return q.type || 'Unknown Question';
};

/**
 * Whether a question type has a discrete, selectable set of answers a
 * confirmation prompt could trigger on / switch to. Scoped to exactly the
 * types wired in questions.js — see selectableAnswerTypes above.
 */
export const hasSelectableAnswers = (q) => {
    if (!q) return false;
    return selectableAnswerTypes.includes(q.type);
};

/**
 * Extract selectable options for a question as [{ label, answerValue }].
 * Mirrors conditionalsBuilder.js's getOptionsForQuestion — see file header note.
 *
 * card-selection / horizontal-card: answerValue = option.value
 * select / radio / radio-ndis: answerValue = option.label
 */
export const getOptionsForQuestion = (q) => {
    if (!q || !hasSelectableAnswers(q)) return [];

    const rawOpts = parseMaybeJson(q.options, []);

    if (cardSelectionFields.includes(q.type)) {
        return rawOpts.map(opt => ({ label: opt.label, answerValue: opt.value }));
    }

    return rawOpts.map(opt => ({ label: opt.label, answerValue: opt.label }));
};

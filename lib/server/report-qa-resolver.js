import { Package, Course } from '../../models';

// question_type values that store a raw package id as the answer
export const PACKAGE_QUESTION_TYPES = new Set(['package-selection', 'package-selection-multi']);
// question_type values that store a raw service-cards map ({ [value]: { selected, subOptions } }) as the answer
export const SERVICE_CARD_QUESTION_TYPES = new Set(['service-cards', 'service-cards-multi']);

export const isNumericId = (val) => /^\d+$/.test(String(val ?? '').trim());

/**
 * Resolves a service-cards / service-cards-multi answer (a keyed object, not an array)
 * into a human-readable, comma-separated list of selected service labels — using the
 * option labels defined on the Question itself (Question.options).
 *
 * Without this, the raw answer object gets passed through to processAnswer(), which has
 * no way to know what each key means and falls back to Object.values().join(), producing
 * the literal string "[object Object], [object Object], ...".
 */
export const resolveServiceCardsAnswer = (answer, questionOptions) => {
    try {
        const data = typeof answer === 'string' ? JSON.parse(answer) : answer;
        if (!data || typeof data !== 'object') return '';

        const opts = Array.isArray(questionOptions)
            ? questionOptions
            : (typeof questionOptions === 'string' ? JSON.parse(questionOptions) : []);

        const selectedLabels = [];
        opts.forEach(opt => {
            const entry = data[opt.value];
            if (!entry || entry.selected !== true) return;

            const subOptionValues = Array.isArray(entry.subOptions) ? entry.subOptions : [];
            const subLabels = subOptionValues.map(subVal =>
                opt.subOptions?.find(so => so.value === subVal)?.label || subVal
            );

            selectedLabels.push(subLabels.length ? `${opt.label} (${subLabels.join(', ')})` : opt.label);
        });

        return selectedLabels.join(', ');
    } catch (e) {
        console.error('Error resolving service-cards answer:', e);
        return '';
    }
};

/**
 * Scans a flat list of { question_type, answer, Question } QaPair-like objects and
 * batch-fetches the Package/Course names referenced by id, so callers can resolve
 * every row with in-memory lookups instead of N+1 queries.
 */
export const buildPackageAndCourseLookups = async (qaPairs) => {
    const packageIds = new Set();
    const courseIds  = new Set();

    qaPairs.forEach(qa => {
        if (!qa.answer || !isNumericId(qa.answer)) return;
        if (PACKAGE_QUESTION_TYPES.has(qa.question_type)) {
            packageIds.add(parseInt(qa.answer, 10));
        } else if (qa.Question?.option_type === 'course') {
            courseIds.add(parseInt(qa.answer, 10));
        }
    });

    const [packages, courses] = await Promise.all([
        packageIds.size
            ? Package.findAll({ where: { id: [...packageIds] }, attributes: ['id', 'name'], raw: true })
            : Promise.resolve([]),
        courseIds.size
            ? Course.findAll({ where: { id: [...courseIds] }, attributes: ['id', 'title'], raw: true })
            : Promise.resolve([]),
    ]);

    return {
        packageNameById: new Map(packages.map(p => [p.id, p.name])),
        courseTitleById: new Map(courses.map(c => [c.id, c.title])),
    };
};

/**
 * Resolves a single QaPair-like object { question_type, answer, Question } into
 * { answer, question_type } ready for processAnswer() / display — no raw ids,
 * no unresolved keyed objects.
 */
export const resolveQaAnswer = (qa, lookups) => {
    let resolvedAnswer = qa.answer ?? '';
    let resolvedType   = qa.question_type || '';

    if (PACKAGE_QUESTION_TYPES.has(qa.question_type) && isNumericId(qa.answer)) {
        const id = parseInt(qa.answer, 10);
        resolvedAnswer = lookups.packageNameById.get(id) || `Package #${id} (not found)`;
        resolvedType   = 'text';
    } else if (qa.Question?.option_type === 'course' && isNumericId(qa.answer)) {
        const id = parseInt(qa.answer, 10);
        resolvedAnswer = lookups.courseTitleById.get(id) || `Course #${id} (not found)`;
        resolvedType   = 'text';
    } else if (SERVICE_CARD_QUESTION_TYPES.has(qa.question_type) && qa.answer) {
        resolvedAnswer = resolveServiceCardsAnswer(qa.answer, qa.Question?.options) || '—';
        resolvedType   = 'text';
    }

    return { answer: resolvedAnswer, question_type: resolvedType };
};
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import dynamic from "next/dynamic";
import { fetchTemplate } from "../../../store/templateSlice";
import Layout from "../../../components/layout";
import { truncate } from "lodash";
import { toast } from "react-toastify";
import parse from 'html-react-parser';

const Button = dynamic(() => import('../../../components/ui-v2/Button'));

export default function ConditionalsBuilder() {

    const router = useRouter();
    const dispatch = useDispatch();

    const { template_uuid } = router.query;
    const template = useSelector(state => state.builder.template);

    // ── State ────────────────────────────────────────────────────────────
    const [questions, setQuestions] = useState([]);
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [filteredQuestions, setFilteredQuestions] = useState([]);
    const [searchQuestionQuery, setSearchQuestionQuery] = useState("");
    const [globalSearchQuery, setGlobalSearchQuery] = useState("");

    const [selectedQuestionConditions, setSelectedQuestionConditions] = useState([]);
    const [allQuestionsConditions, setAllQuestionsConditions] = useState([]);

    // Add Condition page state
    const [isAddPage, setIsAddPage] = useState(false);
    const [newConditionAnswer, setNewConditionAnswer] = useState(null);
    const [newConditionNextId, setNewConditionNextId] = useState(null);
    const [addPageNQSearch, setAddPageNQSearch] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // ── Constants ────────────────────────────────────────────────────────
    const fieldWithSelectOptions = [
        'select', 'multi-select', 'checkbox', 'checkbox-button', 'radio',
        'health-info', 'radio-ndis', 'card-selection', 'card-selection-multi',
        'horizontal-card', 'horizontal-card-multi', 'service-cards', 'service-cards-multi'
    ];

    const cardSelectionFields = [
        'card-selection', 'card-selection-multi',
        'horizontal-card', 'horizontal-card-multi',
    ];

    const serviceCardFields = ['service-cards', 'service-cards-multi'];

    // ── Helpers ──────────────────────────────────────────────────────────
    const isHtmlContent = (text) => {
        if (!text) return false;
        return /<[a-z][\s\S]*>/i.test(text);
    };

    const stripHtml = (text) => {
        if (!text) return '';
        return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    };

    /**
     * Get the best human-readable display text for any question type.
     *
     * Priority order:
     *  1. q.question (most question types store text here)
     *  2. q.label (simple-checkbox, some others)
     *  3. q.details.label (url type stores its link text here)
     *  4. q.question_key converted to title case (last resort readable fallback)
     *  5. Type-based label (e.g. "Goal Table", "Care Table") — always better than [goal-table]
     */
    const getQuestionText = (q) => {
        if (!q) return '';

        // 1. question field
        const qText = q.question?.trim();
        if (qText) return isHtmlContent(qText) ? stripHtml(qText) : qText;

        // 2. label field
        const labelText = q.label?.trim();
        if (labelText) return labelText;

        // 3. details.label — url type stores its link label here (e.g. "Privacy Policy")
        //    Only used when question is empty; url questions with a real question field
        //    are already handled by step 1 above.
        const details = typeof q.details === 'string'
            ? (() => { try { return JSON.parse(q.details); } catch { return {}; } })()
            : (q.details || {});
        if (details?.label?.trim()) return details.label.trim();
        if (details?.title?.trim()) return details.title.trim();

        // 4. For checkbox / simple-checkbox / checkbox-button — use first option label.
        //    These questions often have meaningful option text (e.g. "I agree to the terms")
        //    but an empty question field.
        const checkboxTypes = ['checkbox', 'simple-checkbox', 'checkbox-button'];
        if (checkboxTypes.includes(q.type)) {
            const rawOpts = typeof q.options === 'string'
                ? (() => { try { return JSON.parse(q.options); } catch { return []; } })()
                : (q.options || []);
            const firstLabel = rawOpts[0]?.label?.trim();
            if (firstLabel) return firstLabel;
        }

        // 5. question_key → title case (e.g. "my-question-key" → "My Question Key")
        if (q.question_key?.trim()) {
            return q.question_key
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
        }

        // 6. Type-based human-readable fallback — last resort
        const typeLabels = {
            'goal-table': 'Goal Table',
            'care-table': 'Care Table',
            'url': 'URL Link',
            'simple-checkbox': 'Checkbox',
            'checkbox': 'Checkbox',
            'checkbox-button': 'Checkbox',
            'rich-text': 'Rich Text Block',
            'rooms': 'Room Selection',
            'equipment': 'Equipment Selection',
            'package-selection': 'Package Selection',
            'service-cards': 'Service Cards',
            'service-cards-multi': 'Service Cards',
            'care-plan': 'Care Plan',
            'health-info': 'Health Information',
        };
        return typeLabels[q.type] || q.type || 'Unknown Question';
    };

    const getQDisplayText = (q, maxLen = null) => {
        const text = getQuestionText(q);
        return maxLen ? truncate(text, { length: maxLen }) : text;
    };

    const getPageGroups = (questionList) => {
        if (!template?.Pages) return [];
        return template.Pages.map(page => {
            const pageQs = page.Sections
                .flatMap(s => s.Questions)
                .filter(q => questionList.some(fq => fq.id === q.id));
            return { pageTitle: page.title, questions: pageQs };
        }).filter(pg => pg.questions.length > 0);
    };

    const getConditionCountForQuestion = (questionId) => {
        return questions.filter(q =>
            q.QuestionDependencies?.some(dep => dep.dependence_id === questionId)
        ).length;
    };

    const getQuestionPage = (questionId) => {
        if (!template?.Pages) return '';
        for (const page of template.Pages) {
            for (const section of page.Sections) {
                if (section.Questions.some(q => q.id === questionId)) {
                    return page.title;
                }
            }
        }
        return '';
    };

    /**
     * Extract selectable options for a question for use in the Add Condition panel.
     * Returns [{ label, answerValue }]
     *
     * service-cards: "ServiceName → Yes", "ServiceName → No", "ServiceName › SubOption"
     * card-selection variants: use option.value as answerValue
     * other option types: use option.label as answerValue
     * no-options types (goal-table, url, etc.): return []
     */
    const getOptionsForQuestion = (q) => {
        if (!q) return [];

        const rawOpts = typeof q.options === 'string'
            ? (() => { try { return JSON.parse(q.options); } catch { return []; } })()
            : (q.options || []);

        if (serviceCardFields.includes(q.type)) {
            const result = [];
            rawOpts.forEach(opt => {
                const svcLabel = opt.label || opt.value || '';
                const svcValue = opt.value || opt.label || '';
                result.push({ label: `${svcLabel} → Yes`, answerValue: `${svcValue}:yes` });
                result.push({ label: `${svcLabel} → No`, answerValue: `${svcValue}:no` });
                if (Array.isArray(opt.subOptions)) {
                    opt.subOptions.forEach(sub => {
                        result.push({
                            label: `${svcLabel} › ${sub.label || sub.value}`,
                            answerValue: `${svcValue}:${sub.value || sub.label}`,
                        });
                    });
                }
            });
            return result;
        }

        if (cardSelectionFields.includes(q.type)) {
            return rawOpts.map(opt => ({ label: opt.label, answerValue: opt.value }));
        }

        if (fieldWithSelectOptions.includes(q.type)) {
            return rawOpts.map(opt => ({ label: opt.label, answerValue: opt.label }));
        }

        return [];
    };

    // ── Data effects ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!template_uuid) return;
        dispatch(fetchTemplate(template_uuid));
    }, [template_uuid]);

    useEffect(() => {
        if (!template?.uuid) return;
        const questionsData = template.Pages
            .flatMap(page => page.Sections.flatMap(section => section.Questions));
        questionsData.sort((a, b) => a.section_id - b.section_id);
        setQuestions(questionsData);
        setFilteredQuestions(questionsData);
    }, [template]);

    useEffect(() => {
        const lo = searchQuestionQuery.toLowerCase();
        setFilteredQuestions(
            lo === ''
                ? questions
                : questions.filter(q => getQDisplayText(q).toLowerCase().includes(lo))
        );
    }, [searchQuestionQuery, questions]);

    useEffect(() => {
        if (!selectedQuestion || !questions.length) return;
        generateSelectedQuestionConditions();
    }, [selectedQuestion, questions]);

    useEffect(() => {
        if (!template || !questions.length) return;
        generateAllQuestionsConditions();
    }, [questions, template]);

    // ── Condition generators ─────────────────────────────────────────────

    const generateSelectedQuestionConditions = () => {
        if (!selectedQuestion) return;
        const conditions = [];

        if (serviceCardFields.includes(selectedQuestion.type)) {
            const rawOpts = typeof selectedQuestion.options === 'string'
                ? JSON.parse(selectedQuestion.options)
                : (selectedQuestion.options || []);

            questions
                .filter(q => q.QuestionDependencies?.some(dep => dep.dependence_id === selectedQuestion.id))
                .forEach(q => {
                    q.QuestionDependencies
                        .filter(dep => dep.dependence_id === selectedQuestion.id)
                        .forEach(dep => {
                            const [svcValue, ...rest] = (dep.answer || '').split(':');
                            const restStr = rest.join(':');
                            const matchedService = rawOpts.find(o => o.value === svcValue || o.label === svcValue);
                            const svcLabel = matchedService?.label || svcValue;
                            let displayAnswer = dep.answer;
                            if (restStr === 'yes') displayAnswer = `${svcLabel} → Yes`;
                            else if (restStr === 'no') displayAnswer = `${svcLabel} → No`;
                            else if (restStr) displayAnswer = `${svcLabel} › ${restStr}`;

                            conditions.push({
                                depId: dep.id,
                                answer: displayAnswer,
                                answerValue: dep.answer,
                                nextQuestion: getQDisplayText(q),     // ← uses getQDisplayText, not page title
                                nextQuestionId: q.id,
                                nextQuestionPage: getQuestionPage(q.id),
                            });
                        });
                });

        } else if (fieldWithSelectOptions.includes(selectedQuestion.type)) {
            const rawOpts = typeof selectedQuestion.options === 'string'
                ? JSON.parse(selectedQuestion.options)
                : (selectedQuestion.options || []);

            rawOpts.forEach(option => {
                const answerValue = cardSelectionFields.includes(selectedQuestion.type)
                    ? option.value
                    : option.label;
                const displayValue = option.label;

                questions
                    .filter(q => q.QuestionDependencies?.some(dep =>
                        dep.dependence_id === selectedQuestion.id && dep.answer === answerValue
                    ))
                    .forEach(q => {
                        const dep = q.QuestionDependencies.find(d =>
                            d.dependence_id === selectedQuestion.id && d.answer === answerValue
                        );
                        conditions.push({
                            depId: dep.id,
                            answer: displayValue,
                            answerValue,
                            nextQuestion: getQDisplayText(q),     // ← uses getQDisplayText
                            nextQuestionId: q.id,
                            nextQuestionPage: getQuestionPage(q.id),
                        });
                    });
            });

        } else {
            // no-options types — read dependencies directly
            questions
                .filter(q => q.QuestionDependencies?.some(dep => dep.dependence_id === selectedQuestion.id))
                .forEach(q => {
                    q.QuestionDependencies
                        .filter(dep => dep.dependence_id === selectedQuestion.id)
                        .forEach(dep => {
                            conditions.push({
                                depId: dep.id,
                                answer: dep.answer || 'Any',
                                answerValue: dep.answer,
                                nextQuestion: getQDisplayText(q),     // ← uses getQDisplayText
                                nextQuestionId: q.id,
                                nextQuestionPage: getQuestionPage(q.id),
                            });
                        });
                });
        }

        setSelectedQuestionConditions(conditions);
    };

    const generateAllQuestionsConditions = () => {
        if (!template?.Pages) return;
        const conditions = [];

        // Iterate every question's dependencies — catches all types including goal-table, url, etc.
        questions.forEach(q => {
            if (!q.QuestionDependencies?.length) return;

            q.QuestionDependencies.forEach(dep => {
                const depQ = questions.find(dq => dq.id === dep.dependence_id);
                if (!depQ) return;

                // Build human-readable display answer
                let displayAnswer = dep.answer || 'Any';
                if (serviceCardFields.includes(depQ.type)) {
                    const [svcValue, ...rest] = (dep.answer || '').split(':');
                    const restStr = rest.join(':');
                    const rawOpts = typeof depQ.options === 'string'
                        ? JSON.parse(depQ.options)
                        : (depQ.options || []);
                    const matchedService = rawOpts.find(o => o.value === svcValue || o.label === svcValue);
                    const svcLabel = matchedService?.label || svcValue;
                    if (restStr === 'yes') displayAnswer = `${svcLabel} → Yes`;
                    else if (restStr === 'no') displayAnswer = `${svcLabel} → No`;
                    else if (restStr) displayAnswer = `${svcLabel} › ${restStr}`;
                }

                conditions.push({
                    depId: dep.id,
                    question: getQDisplayText(depQ),    // ← the "depQ" = trigger question
                    questionId: depQ.id,
                    questionPage: getQuestionPage(depQ.id),
                    answer: displayAnswer,
                    nextQuestion: getQDisplayText(q),   // ← "q" = question that becomes visible
                    nextQuestionId: q.id,
                    nextQuestionPage: getQuestionPage(q.id),
                });
            });
        });

        setAllQuestionsConditions(conditions);
    };

    // ── API calls ─────────────────────────────────────────────────────────

    // DELETE — pages/api/booking-templates/questions/dependencies/[id]/index.js
    const handleDeleteCondition = async (depId) => {
        try {
            const res = await fetch(`/api/booking-templates/questions/dependencies/${depId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Delete failed');
            await dispatch(fetchTemplate(template_uuid));
            toast.success('Condition removed');
        } catch {
            toast.error('Failed to remove condition');
        }
    };

    // CREATE — pages/api/booking-templates/questions/dependencies/create.js
    const saveNewCondition = async () => {
        if (!newConditionNextId || !selectedQuestion) return;
        if (getOptionsForQuestion(selectedQuestion).length > 0 && !newConditionAnswer) return;
        setIsSaving(true);
        try {
            const res = await fetch('/api/booking-templates/questions/dependencies/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question_id: newConditionNextId,
                    answer: newConditionAnswer,
                    dependence_id: selectedQuestion.id,
                }),
            });
            if (!res.ok) throw new Error('Save failed');
            await dispatch(fetchTemplate(template_uuid));
            toast.success('Condition saved successfully');
            handleGoBack();
        } catch {
            toast.error('Failed to save condition');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Navigation ────────────────────────────────────────────────────────
    const handleGoToAddPage = () => {
        setNewConditionAnswer(null);
        setNewConditionNextId(null);
        setAddPageNQSearch("");
        setIsAddPage(true);
    };

    const handleGoBack = () => {
        setIsAddPage(false);
        setNewConditionAnswer(null);
        setNewConditionNextId(null);
        setAddPageNQSearch("");
    };

    // ── Derived data ──────────────────────────────────────────────────────
    const selectedQuestionOptions = getOptionsForQuestion(selectedQuestion);
    const hasOptions = selectedQuestionOptions.length > 0;

    const addPageNQFiltered = (() => {
        const lo = addPageNQSearch.toLowerCase();
        if (!selectedQuestion) return [];
        return questions.filter(q =>
            q.id !== selectedQuestion.id &&
            (!lo || getQDisplayText(q).toLowerCase().includes(lo) || `q ${q.id}`.includes(lo))
        );
    })();

    const addPageNQGroups = getPageGroups(addPageNQFiltered);

    const filteredAllConditions = globalSearchQuery.trim()
        ? allQuestionsConditions.filter(c => {
            const lo = globalSearchQuery.toLowerCase();
            return c.question.toLowerCase().includes(lo) ||
                c.answer.toLowerCase().includes(lo) ||
                c.nextQuestion.toLowerCase().includes(lo);
        })
        : allQuestionsConditions;

    const sidebarGroups = getPageGroups(filteredQuestions);

    const canSave = !!newConditionNextId && (!hasOptions || !!newConditionAnswer);

    // ── Answer Pill ───────────────────────────────────────────────────────
    const getPillClass = (answer) => {
        const a = (answer || '').toLowerCase();
        if (a === 'yes' || a.endsWith('→ yes')) return 'bg-teal-50 border border-teal-200 text-teal-800';
        if (a === 'no' || a.endsWith('→ no')) return 'bg-red-50 border border-red-200 text-red-700';
        if (a === 'other') return 'bg-amber-50 border border-amber-200 text-amber-800';
        if (a.includes('ndia') || a.includes('managed') || a === 'ndis')
            return 'bg-blue-50 border border-blue-200 text-blue-800';
        if (a.includes('›')) return 'bg-purple-50 border border-purple-200 text-purple-800';
        return 'bg-gray-50 border border-gray-200 text-gray-600';
    };

    const AnswerPill = ({ answer }) => (
        <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap ${getPillClass(answer)}`}
            title={answer}
        >
            {answer?.length > 30 ? answer.slice(0, 30) + '…' : answer}
        </span>
    );

    // ════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════
    return (
        <Layout>
            <div className="relative overflow-hidden bg-gray-50" style={{ minHeight: 'calc(100vh - 64px)' }}>

                {/* ════════ PAGE 1: LIST VIEW ════════ */}
                <div
                    className="absolute inset-0 flex flex-col"
                    style={{
                        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.32s',
                        transform: isAddPage ? 'translateX(-60%)' : 'translateX(0)',
                        opacity: isAddPage ? 0.4 : 1,
                        pointerEvents: isAddPage ? 'none' : 'auto',
                    }}
                >
                    {/* ── Page header ── */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">
                                        Template Name
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <h1 className="text-xl font-semibold text-gray-900">
                                            {template?.name || 'Loading…'}
                                        </h1>
                                        <span className="text-sm font-semibold rounded-full px-3 py-1"
                                            style={{ background: '#FFC107', color: '#1a2744' }}>
                                            {questions.length} questions
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="relative flex-shrink-0">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">⌕</span>
                                <input
                                    type="text"
                                    placeholder="Search conditions…"
                                    value={globalSearchQuery}
                                    onChange={e => setGlobalSearchQuery(e.target.value)}
                                    className="border border-gray-300 rounded-lg text-sm pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-56 bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                                Conditionals Builder
                            </div>
                            <span className="text-sm text-gray-500">
                                {allQuestionsConditions.length} total condition{allQuestionsConditions.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    {/* ── 2-col layout ── */}
                    <div className="flex flex-1 overflow-hidden">

                        {/* LEFT: Question list */}
                        <div className="flex flex-col border-r border-gray-200 bg-white overflow-hidden" style={{ width: 272 }}>
                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Questions</p>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">⌕</span>
                                    <input
                                        type="text"
                                        placeholder="Filter…"
                                        value={searchQuestionQuery}
                                        onChange={e => setSearchQuestionQuery(e.target.value)}
                                        className="w-full text-sm rounded-lg py-2 pl-7 pr-3 border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1">
                                {sidebarGroups.map(pg => (
                                    <div key={pg.pageTitle}>
                                        <div className="px-4 pt-3 pb-1">
                                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                                {pg.pageTitle}
                                            </span>
                                        </div>
                                        {pg.questions.map(q => {
                                            const cnt = getConditionCountForQuestion(q.id);
                                            const active = selectedQuestion?.id === q.id;
                                            const displayText = getQDisplayText(q, 46);
                                            return (
                                                <div
                                                    key={q.id}
                                                    onClick={() => setSelectedQuestion(active ? null : q)}
                                                    className={`px-4 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 transition-all ${
                                                        active
                                                            ? 'bg-blue-50 text-blue-900 font-medium border-l-2 border-blue-600'
                                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-2 border-transparent'
                                                    }`}
                                                >
                                                    <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap leading-snug">
                                                        {displayText}
                                                    </span>
                                                    {cnt > 0 && (
                                                        <span className="flex-shrink-0 text-xs font-semibold rounded-full px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700">
                                                            {cnt}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                                {sidebarGroups.length === 0 && (
                                    <div className="p-4 text-sm text-center text-gray-400">No questions found</div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Detail panel */}
                        <div className="flex-1 overflow-y-auto">
                            {!selectedQuestion ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 p-10">
                                    <span className="text-5xl opacity-20">⟶</span>
                                    <p className="text-base font-semibold text-gray-500">Select a question</p>
                                    <p className="text-sm text-center max-w-xs leading-relaxed text-gray-400">
                                        Pick any question from the left panel to view and manage its conditional logic.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-5">

                                    {/* Question info card */}
                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-5 p-4 flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-teal-600 mb-1">Q.{selectedQuestion.id}</p>
                                            <p className="text-base font-semibold text-gray-900 leading-snug mb-2">
                                                {(() => {
                                                    const raw = selectedQuestion.question?.trim() || selectedQuestion.label?.trim() || '';
                                                    if (raw && isHtmlContent(raw)) return parse(raw);
                                                    return getQDisplayText(selectedQuestion);
                                                })()}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-600">
                                                    {selectedQuestion.type}
                                                </span>
                                                <span className="text-xs px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700">
                                                    {getQuestionPage(selectedQuestion.id)}
                                                </span>
                                            </div>
                                        </div>
                                        <Button
                                            color="primary"
                                            size="medium"
                                            label="+ ADD CONDITION"
                                            onClick={handleGoToAddPage}
                                        />
                                    </div>

                                    {/* Conditions for this question */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Conditions</p>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-medium">
                                            {selectedQuestionConditions.length}
                                        </span>
                                    </div>

                                    {selectedQuestionConditions.length === 0 ? (
                                        <div className="rounded-lg mb-6 p-6 text-center border-2 border-dashed border-gray-200 bg-gray-50">
                                            <div className="text-2xl mb-2 opacity-30">⚡</div>
                                            <p className="text-sm text-gray-500 mb-3">No conditions yet for this question.</p>
                                            <Button
                                                color="primary"
                                                size="medium"
                                                label="+ ADD FIRST CONDITION"
                                                onClick={handleGoToAddPage}
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2 mb-6">
                                            {selectedQuestionConditions.map((cond, i) => (
                                                <div
                                                    key={`${cond.depId}-${i}`}
                                                    className="bg-white rounded-lg border border-gray-200 shadow-sm flex items-center gap-3 px-4 py-3"
                                                >
                                                    <AnswerPill answer={cond.answer} />
                                                    <span className="text-gray-400 text-base">→</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 leading-snug overflow-hidden text-ellipsis whitespace-nowrap">
                                                            {cond.nextQuestion}
                                                        </p>
                                                        <p className="text-xs text-gray-400 mt-0.5">{cond.nextQuestionPage}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteCondition(cond.depId)}
                                                        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 text-sm transition-all hover:border-red-300 hover:text-red-500 hover:bg-red-50"
                                                        title="Remove condition"
                                                    >✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <hr className="my-5 border-gray-200" />

                                    {/* All template conditions */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">All Template Conditions</p>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 font-medium">
                                            {filteredAllConditions.length}
                                        </span>
                                    </div>

                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                        <table className="w-full text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200">
                                                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-2/5">Question</th>
                                                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-1/5">Response</th>
                                                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 w-1/3">Next Question</th>
                                                    <th className="w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAllConditions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-8 text-gray-400 text-sm">
                                                            No conditions to show
                                                        </td>
                                                    </tr>
                                                ) : filteredAllConditions.map((cond, i) => (
                                                    <tr
                                                        key={`all-${cond.depId}-${i}`}
                                                        onClick={() => {
                                                            const q = questions.find(q => q.id === cond.questionId);
                                                            if (q) setSelectedQuestion(q);
                                                        }}
                                                        className={`border-b border-gray-100 cursor-pointer group transition-colors hover:bg-gray-50 ${
                                                            selectedQuestion?.id === cond.questionId ? 'bg-blue-50' : ''
                                                        }`}
                                                    >
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm font-medium text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap max-w-xs" title={cond.question}>
                                                                {truncate(cond.question, { length: 50 })}
                                                            </div>
                                                            <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                                                                {cond.questionPage}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <AnswerPill answer={cond.answer} />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="text-sm text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap max-w-xs" title={cond.nextQuestion}>
                                                                {truncate(cond.nextQuestion, { length: 46 })}
                                                            </div>
                                                            {cond.nextQuestionPage && (
                                                                <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">
                                                                    {cond.nextQuestionPage}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleDeleteCondition(cond.depId); }}
                                                                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 text-xs transition-all hover:border-red-300 hover:text-red-500 hover:bg-red-50"
                                                            >✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ════════ PAGE 2: ADD CONDITION ════════ */}
                <div
                    className="absolute inset-0 flex flex-col bg-gray-50"
                    style={{
                        transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
                        transform: isAddPage ? 'translateX(0)' : 'translateX(100%)',
                        pointerEvents: isAddPage ? 'auto' : 'none',
                    }}
                >
                    {/* Header */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">Template Name</div>
                                <h1 className="text-xl font-semibold text-gray-900">{template?.name}</h1>
                            </div>
                        </div>
                        <div className="flex items-center mt-3 pt-3 border-t border-gray-100">
                            <button
                                onClick={handleGoBack}
                                className="text-sm font-medium text-teal-600 hover:underline p-0"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Conditionals Builder
                            </button>
                            <span className="px-2 text-sm text-gray-400">/</span>
                            <span className="text-sm text-gray-500">Q.{selectedQuestion?.id}</span>
                            <span className="px-2 text-sm text-gray-400">/</span>
                            <span className="text-sm font-semibold text-gray-900">Add Condition</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-5">
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                {hasOptions
                                    ? <>Choose which <strong className="text-gray-800">response</strong> triggers this condition, then select the <strong className="text-gray-800">next question</strong> that should appear.</>
                                    : <>Select the <strong className="text-gray-800">next question</strong> to show when this question is answered.</>
                                }
                            </p>

                            <p className="text-xs font-semibold text-teal-600 mb-1">Q.{selectedQuestion?.id}</p>
                            <div className="text-sm font-semibold text-gray-900 leading-snug rounded-lg px-4 py-3 mb-6 bg-gray-50 border border-gray-200">
                                {selectedQuestion && (() => {
                                    const raw = selectedQuestion.question?.trim() || selectedQuestion.label?.trim() || '';
                                    if (raw && isHtmlContent(raw)) return parse(raw);
                                    return getQDisplayText(selectedQuestion);
                                })()}
                            </div>

                            <div className={`grid gap-6 ${hasOptions ? 'grid-cols-[220px_1fr]' : 'grid-cols-1'}`}>

                                {/* Response options — only for option-based types */}
                                {hasOptions && (
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                            When answer is
                                        </p>
                                        <div className="flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: 380 }}>
                                            {selectedQuestionOptions.map((opt, i) => {
                                                const isSelected = newConditionAnswer === opt.answerValue;
                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => setNewConditionAnswer(opt.answerValue)}
                                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer text-sm font-medium transition-all ${
                                                            isSelected
                                                                ? 'border-2 border-blue-600 bg-blue-50 text-blue-900'
                                                                : 'border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
                                                            isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                                        }`}>
                                                            {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                        </div>
                                                        <span>{opt.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Next question picker */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                        Show this question next
                                    </p>
                                    <div className="relative mb-3">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">⌕</span>
                                        <input
                                            type="text"
                                            placeholder="Search questions…"
                                            value={addPageNQSearch}
                                            onChange={e => setAddPageNQSearch(e.target.value)}
                                            className="w-full text-sm rounded-lg pl-9 pr-3 py-2 border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 380 }}>
                                        {addPageNQGroups.map(pg => (
                                            <div key={pg.pageTitle}>
                                                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 py-2">
                                                    {pg.pageTitle}
                                                </span>
                                                {pg.questions.map(q => {
                                                    const isSelected = newConditionNextId === q.id;
                                                    return (
                                                        <div
                                                            key={q.id}
                                                            onClick={() => setNewConditionNextId(q.id)}
                                                            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-sm mb-1 transition-all ${
                                                                isSelected
                                                                    ? 'border-2 border-blue-600 bg-blue-50 text-blue-900'
                                                                    : 'border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center border-2 mt-0.5 transition-all ${
                                                                isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                                            }`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                            </div>
                                                            <span className="leading-snug">
                                                                <span className="block text-xs text-gray-400 mb-0.5">Q {q.id}</span>
                                                                {getQDisplayText(q, 68)}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                        {addPageNQGroups.length === 0 && (
                                            <div className="text-sm p-3 text-gray-400">No questions found</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Live preview strip */}
                            {canSave && (() => {
                                const nq = questions.find(q => q.id === newConditionNextId);
                                return (
                                    <div className="flex items-center gap-3 flex-wrap mt-5 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Preview</span>
                                        <span className="text-sm font-medium text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap max-w-48">
                                            {getQDisplayText(selectedQuestion, 32)}
                                        </span>
                                        {newConditionAnswer && (
                                            <>
                                                <span className="font-bold text-teal-500 text-base">→</span>
                                                <AnswerPill answer={
                                                    selectedQuestionOptions.find(o => o.answerValue === newConditionAnswer)?.label || newConditionAnswer
                                                } />
                                            </>
                                        )}
                                        <span className="font-bold text-teal-500 text-base">→</span>
                                        <span className="text-sm font-medium text-gray-800 overflow-hidden text-ellipsis whitespace-nowrap max-w-48">
                                            {nq ? getQDisplayText(nq, 32) : ''}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={handleGoBack}
                                className="px-5 py-2 text-sm font-semibold rounded-lg border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <Button
                                color="primary"
                                size="medium"
                                label={isSaving ? 'SAVING…' : 'SAVE CONDITION'}
                                onClick={saveNewCondition}
                                disabled={!canSave || isSaving}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </Layout>
    );
}
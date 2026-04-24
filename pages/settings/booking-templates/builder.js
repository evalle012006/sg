import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import Layout from "../../../components/layout";
import PagesBuilder from "./pagesBuilder";
import { omitAttribute } from "../../../utilities/common";
import { useDebouncedCallback } from 'use-debounce';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Page } from "../../../components/drag-and-drop/Page";
import { Field } from "../../../components/drag-and-drop/Field";
import { useDispatch, useSelector } from "react-redux";
import { templateActions, fetchTemplate, createTemplate } from "../../../store/templateSlice";

import { toast } from 'react-toastify';

const fields = [
    { type: 'string',                  label: 'Text',                       description: 'Single line text' },
    { type: 'text',                    label: 'Long Text',                  description: 'Multiple lines of text' },
    { type: 'email',                   label: 'Email',                      description: 'Email address' },
    { type: 'url',                     label: 'URL',                        description: 'URL with label' },
    { type: 'phone-number',            label: 'Phone Number',               description: 'Phone Number field' },
    { type: 'select',                  label: 'Select',                     description: 'Select options from a list' },
    { type: 'multi-select',            label: 'Multi Select',               description: 'Select multiple options from a list' },
    { type: 'integer',                 label: 'Number',                     description: 'numbers' },
    { type: 'date',                    label: 'Date',                       description: 'Enter or Select date' },
    { type: 'date-range',              label: 'Date Range',                 description: 'Enter or Select a range of dates' },
    { type: 'year',                    label: 'Year',                       description: 'Enter or Select year' },
    { type: 'time',                    label: 'Time',                       description: 'Enter or Select time' },
    { type: 'checkbox',                label: 'Checkbox',                   description: 'Select one or more options' },
    { type: 'checkbox-button',         label: 'Checkbox Button',            description: 'Select one or more options' },
    { type: 'radio',                   label: 'Radio',                      description: 'Select one option' },
    { type: 'radio-ndis',              label: 'Radio For NDIS',             description: 'Select one option' },
    { type: 'card-selection',          label: 'Card',                       description: 'Select one option in cards' },
    { type: 'card-selection-multi',    label: 'Card (Multi)',               description: 'Select one or more options in cards' },
    { type: 'horizontal-card',         label: 'Horizontal Card',            description: 'Select one option in horizontal cards' },
    { type: 'horizontal-card-multi',   label: 'Horizontal Card (Multi)',    description: 'Select one or more options in horizontal cards' },
    { type: 'package-selection',       label: 'Package Selection',          description: 'Select one package based on funder type' },
    { type: 'package-selection-multi', label: 'Package Selection (Multi)',  description: 'Select multiple packages based on funder type' },
    { type: 'health-info',             label: 'Health Info',                description: 'Health Info' },
    { type: 'file-upload',             label: 'File Upload',                description: 'File Upload' },
    { type: 'rooms',                   label: 'Room',                       description: 'Room' },
    { type: 'equipment',               label: 'Equipment',                  description: 'Equipment' },
    { type: 'rich-text',               label: 'Rich Text',                  description: 'Rich Text' },
    { type: 'goal-table',              label: 'Exercise Goal Table',        description: 'Select one or more options' },
    { type: 'care-table',              label: 'Care Selection Table',       description: 'Choose Care per Day' },
    { type: 'service-cards',           label: 'Service Cards',              description: 'Service cards with Yes/No and sub-options' },
    { type: 'service-cards-multi',     label: 'Service Cards (Multi)',      description: 'Service cards with multi-select and sub-options' },
];

export default function TemplateBuilder() {
    const router   = useRouter();
    const dispatch = useDispatch();

    const builderMode = useSelector(state => state.builder.builderMode);
    const template    = useSelector(state => state.builder.template);
    const currentPage = useSelector(state => state.builder.currentPage);

    const { template_uuid, type } = router.query;

    const [fieldList, setFieldList]     = useState(fields);
    const [searchValue, setSearchValue] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const stripRef = useRef(null);
    const [hasOverflow, setHasOverflow] = useState(false);

    useEffect(() => {
        const el = stripRef.current;
        if (!el) return;
        const check = () => setHasOverflow(el.scrollWidth > el.clientWidth);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [template?.Pages]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchValue(value);
        setFieldList(value
            ? fields.filter(f => f.label.toLowerCase().includes(value.toLowerCase()))
            : fields
        );
    };

    useEffect(() => {
        if (type && type === 'new') {
            dispatch(templateActions.updateBuilderMode("new"));
            dispatch(createTemplate({ name: "New Template", Pages: [] })).then(({ payload }) =>
                router.push("/settings/booking-templates/builder?template_uuid=" + payload.uuid)
            );
        }
        if (!template_uuid) return;
        dispatch(fetchTemplate(template_uuid));
    }, [router]);

    const updateCurrentPage = (page) => dispatch(templateActions.updateCurrentPage(page));

    const debounceHandleTemplateChanges = useDebouncedCallback(() => handleTemplateChanges(), 1300);

    const handleTemplateChanges = () => {
        if (builderMode === "new" && template_uuid === undefined) {
            dispatch(createTemplate({ ...template }));
        }
        if (builderMode === "edit") updateTemplate(template);
    };

    const updateTemplate = async (tmpl) => {
        return await fetch("/api/booking-templates/" + template_uuid, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(omitAttribute(tmpl, "Pages")),
        }).then(res => res.json());
    };

    const handleRemovePage = async (e, page) => {
        e.stopPropagation();
        if (!page) return;
        await fetch(`/api/booking-templates/${template_uuid}/pages/${page.id}`, { method: 'DELETE' })
            .then(res => {
                if (res.status === 200) {
                    if (template.Pages.length > 1) updateCurrentPage(template.Pages[template.Pages.length - 2]);
                    dispatch(fetchTemplate(template_uuid));
                    toast("Page deleted successfully.", { type: 'success' });
                } else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            }).catch(() => toast("Sorry, something went wrong. Please try again.", { type: 'error' }));
    };

    const handleRemoveSection = async (e, page, section) => {
        e.stopPropagation();
        if (!page) return;
        await fetch(`/api/booking-templates/${template_uuid}/pages/${page.id}/sections/${section.id}`, { method: 'DELETE' })
            .then(res => {
                if (res.status === 200) {
                    dispatch(fetchTemplate(template_uuid));
                    toast("Section deleted successfully.", { type: 'success' });
                } else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            }).catch(() => toast("Sorry, something went wrong. Please try again.", { type: 'error' }));
    };

    const handleRemoveQuestion = async (e, question) => {
        e.stopPropagation();
        if (!question) return;
        await fetch('/api/booking-templates/questions/' + question.id, { method: 'DELETE' })
            .then(res => {
                if (res.status === 200) {
                    dispatch(fetchTemplate(template_uuid));
                    toast("Question deleted successfully.", { type: 'success' });
                } else toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            }).catch(() => toast("Sorry, something went wrong. Please try again.", { type: 'error' }));
    };

    const handleBack = () => router.push("/settings/booking-templates");

    // Field panel only shown when there are sections — preserves original behaviour
    const showFieldPanel = currentPage?.Sections?.length > 0;

    return (
        <DndProvider backend={HTML5Backend}>
            <Layout noScroll={true} hideTitleBar={true}>
                <div className="flex flex-col h-screen overflow-hidden">

                    {/* ── Top bar ──────────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 bg-white flex-shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            {/* Mobile field-panel toggle — slides LEFT panel on mobile */}
                            {showFieldPanel && (
                                <button
                                    className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                                    onClick={() => setSidebarOpen(true)}
                                    aria-label="Open field panel"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                                    </svg>
                                </button>
                            )}

                            {/* Back */}
                            <button
                                onClick={handleBack}
                                className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                </svg>
                                Back
                            </button>

                            <div className="hidden sm:block w-px h-5 bg-gray-200" />

                            {/* Template name — inline editable */}
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md bg-sky-600 flex items-center justify-center flex-shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="white" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                                    </svg>
                                </div>
                                <input
                                    className="text-sm font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0"
                                    style={{ width: template?.name ? Math.max(120, template.name.length * 8) + 'px' : '160px' }}
                                    value={template?.name || ''}
                                    placeholder="Template name"
                                    onChange={(e) => {
                                        dispatch(templateActions.updateTemplate({ ...template, name: e.target.value }));
                                        debounceHandleTemplateChanges();
                                    }}
                                />
                            </div>
                        </div>

                        {currentPage && (
                            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-gray-300">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                                <span className="font-medium text-gray-700 truncate max-w-[200px]">{currentPage.title}</span>
                            </div>
                        )}

                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0
                            ${builderMode === 'new'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${builderMode === 'new' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                            {builderMode === 'new' ? 'New' : 'Editing'}
                        </span>
                    </div>

                    {/* ── Pages strip ──────────────────────────────────────── */}
                    <div className="border-b border-gray-100 bg-gray-50/60 flex-shrink-0 relative">
                        <PagesBuilder
                            ref={stripRef}
                            template={template}
                            currentPage={currentPage}
                            updateCurrentPage={updateCurrentPage}
                            handleRemovePage={handleRemovePage}
                        />
                        {hasOverflow && (
                            <div
                                className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 flex items-center justify-end pr-2"
                                style={{ background: 'linear-gradient(to right, transparent, rgba(248,250,252,0.95))' }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4 text-gray-400">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* ── Body ─────────────────────────────────────────────── */}
                    {template && (
                        <div className="flex flex-1 min-h-0 overflow-hidden">

                            {/* ══ LEFT: Field palette (moved from right) ══════ */}
                            {/* Mobile overlay */}
                            {sidebarOpen && (
                                <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
                            )}

                            {showFieldPanel && (
                                <aside className={`
                                    fixed lg:static inset-y-0 left-0 z-40 lg:z-auto
                                    w-64 xl:w-72 flex flex-col flex-shrink-0
                                    bg-white border-r border-gray-200
                                    transition-transform duration-200 ease-in-out
                                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                                `}>
                                    <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fields</p>
                                        <button
                                            className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                            onClick={() => setSidebarOpen(false)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="px-4 pb-3 flex-shrink-0">
                                        <div className="relative">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                                                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                            </svg>
                                            <input
                                                type="text"
                                                placeholder="Search fields…"
                                                value={searchValue}
                                                onChange={handleSearchChange}
                                                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Field list — original Field component, all props unchanged */}
                                    <div className="flex-1 overflow-y-auto px-3 pb-4">
                                        {fieldList.map((field, index) => (
                                            <Field
                                                key={index}
                                                currentPage={currentPage}
                                                type={field.type}
                                                label={field.label}
                                                description={field.description}
                                                template_uuid={template?.uuid}
                                            />
                                        ))}
                                    </div>

                                    <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
                                        <p className="text-xs text-gray-400 text-center">Drag fields onto the canvas</p>
                                    </div>
                                </aside>
                            )}

                            {/* ══ RIGHT/CENTER: Canvas ════════════════════════ */}
                            <div className="flex-1 overflow-auto py-6 px-4 sm:px-8 bg-gray-50">
                                {template?.Pages?.length > 0 ? (
                                    <>
                                        {currentPage && (
                                            <div className="flex items-center gap-3 mb-5">
                                                <div className="w-1 h-6 rounded-full bg-sky-500 flex-shrink-0" />
                                                <h2 className="text-base font-semibold text-gray-800">{currentPage.title}</h2>
                                            </div>
                                        )}
                                        {/* Exact same Page call as original */}
                                        <Page
                                            key={currentPage?.id}
                                            template_uuid={template.uuid}
                                            currentPage={currentPage}
                                            handleRemoveSection={handleRemoveSection}
                                            handleRemoveQuestion={handleRemoveQuestion}
                                        />
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center px-4">
                                        <div className="w-14 h-14 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6 text-sky-500">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                            </svg>
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-700 mb-1">No pages yet</h3>
                                        <p className="text-sm text-gray-400 max-w-xs">
                                            Create a new page using the strip above to start building your template.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Layout>
        </DndProvider>
    );
}
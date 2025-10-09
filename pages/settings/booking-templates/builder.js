import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Layout from "../../../components/layout";
import PagesBuilder from "./pagesBuilder";
import { omitAttribute } from "../../../utilities/common";
import { useDebouncedCallback } from 'use-debounce';

import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Page } from "./../../../components/drag-and-drop/Page";
import { Field } from "./../../../components/drag-and-drop/Field";
import { useDispatch, useSelector } from "react-redux";
import { templateActions, fetchTemplate, createTemplate } from "../../../store/templateSlice";

import { toast } from 'react-toastify';

const fields = [
    { type: 'string', label: 'Text', description: 'Single line text' },
    { type: 'text', label: 'Long Text', description: 'Multiple lines of text' },
    { type: 'email', label: 'Email', description: 'Email address' },
    { type: 'url', label: 'URL', description: 'URL with label' },
    { type: 'phone-number', label: 'Phone Number', description: 'Phone Number field' },
    { type: 'select', label: 'Select', description: 'Select options from a list' },
    { type: 'multi-select', label: 'Multi Select', description: 'Select multiple options from a list' },
    { type: 'integer', label: 'Number', description: 'numbers' },
    { type: 'date', label: 'Date', description: 'Enter or Select date' },
    { type: 'date-range', label: 'Date Range', description: 'Enter or Select date a range of dates' },
    { type: 'year', label: 'Year', description: 'Enter or Select year' },
    { type: 'time', label: 'Time', description: 'Enter or Select time' },
    { type: 'checkbox', label: 'Checkbox', description: 'Select one or more options' },
    { type: 'checkbox-button', label: 'Checkbox Button', description: 'Select one or more options' },
    { type: 'radio', label: 'Radio', description: 'Select one option' },
    { type: 'radio-ndis', label: 'Radio For NDIS', description: 'Select one option' },
    { type: 'card-selection', label: 'Card', description: 'Select one option in cards' },
    { type: 'card-selection-multi', label: 'Card (Multi)', description: 'Select one or more options in cards' },
    { type: 'horizontal-card', label: 'Horizontal Card', description: 'Select one option in horizontal cards' },
    { type: 'horizontal-card-multi', label: 'Horizontal Card (Multi)', description: 'Select one or more options in horizontal cards' },
    { type: 'package-selection', label: 'Package Selection', description: 'Select one package based on funder type' },
    { type: 'package-selection-multi', label: 'Package Selection (Multi)', description: 'Select multiple packages based on funder type' },
    { type: 'health-info', label: 'Health Info', description: 'Health Info' },
    // { type: 'info', label: 'Info', description: 'Information' },
    { type: 'file-upload', label: 'File Upload', description: 'File Upload' },
    { type: 'rooms', label: 'Room', description: 'Room' },
    { type: 'equipment', label: 'Equipment', description: 'Equipment' },
    { type: 'rich-text', label: 'Rich Text', description: 'Rich Text' },
    { type: 'goal-table', label: 'Exercise Goal Table', description: 'Select one or more options' },
    { type: 'care-table', label: 'Care Selection Table', description: 'Choose Care per Day' },
    { type: 'service-cards', label: 'Service Cards', description: 'Service cards with Yes/No and sub-options' },
    { type: 'service-cards-multi', label: 'Service Cards (Multi)', description: 'Service cards with multi-select and sub-options' },
]

export default function TemplateBuilder() {
    const router = useRouter();
    const dispatch = useDispatch();

    const builderMode = useSelector(state => state.builder.builderMode);
    const template = useSelector(state => state.builder.template);
    const currentPage = useSelector(state => state.builder.currentPage);

    const { template_uuid, type } = router.query;

    const [fieldList, setFieldList] = useState(fields);
    const [searchValue, setSearchValue] = useState();

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchValue(value);

        if (value) {
            const searchResult = fields.filter((field) => {
                if (field.label.toLowerCase().includes(value.toLowerCase())) {
                    return field;
                }
            });
            setFieldList(searchResult);
        } else {
            setFieldList(fields);
        }
    }

    useEffect(() => {
        // creates a new template with type = 'new' is passed in the url
        if (type && type == 'new') {
            // dispatch(templateActions.removeTemplate());
            dispatch(templateActions.updateBuilderMode("new"));
            dispatch(createTemplate({ name: "New Template", Pages: [] })).then(({ payload }) =>
                router.push("/settings/booking-templates/builder?template_uuid=" + payload.uuid))
        }

        // ensures the router queries are loaded before fetching the template
        if (!template_uuid) {
            return;
        }

        // fetches the template if template_uuid is passed in the url
        dispatch(fetchTemplate(template_uuid));
    }, [router]);

    const updateCurrentPage = (page) => {
        dispatch(templateActions.updateCurrentPage(page));
    };

    const debounceHandleTemplateChanges = useDebouncedCallback(() => handleTemplateChanges(), 1300);

    const handleTemplateChanges = () => {
        if (builderMode === "new" && template_uuid == undefined) {
            dispatch(createTemplate({ ...template }));
        }

        if (builderMode === "edit") {
            updateTemplate(template);
        }
    };

    const updateTemplate = async (template) => {
        return await fetch("/api/booking-templates/" + template_uuid, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(omitAttribute(template, "Pages")),
        }).then((res) => res.json()).then((data) => data);
    };

    const handleRemovePage = async (e, page) => {
        e.stopPropagation();

        if (page) {
            await fetch(`/api/booking-templates/${template_uuid}/pages/${page.id}`, {
                method: 'DELETE'
            }).then((res) => {
                if (res.status === 200) {
                    if (template.Pages.length > 1) {
                        updateCurrentPage(template.Pages[template.Pages.length - 2]);
                    }

                    dispatch(fetchTemplate(template_uuid));
                    toast("Page deleted sucessfully.", { type: 'success' });
                }
                else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

            }).catch((error) => {
                toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            });
        }
    }

    const handleRemoveSection = async (e, page, section) => {
        e.stopPropagation();

        if (page) {
            await fetch(`/api/booking-templates/${template_uuid}/pages/${page.id}/sections/${section.id}`, {
                method: 'DELETE'
            }).then((res) => {
                if (res.status === 200) {
                    dispatch(fetchTemplate(template_uuid));
                    toast("Section deleted sucessfully.", { type: 'success' });
                }
                else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

            }).catch((error) => {
                toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            });
        }
    }

    const handleRemoveQuestion = async (e, question) => {
        e.stopPropagation();

        if (question) {
            await fetch('/api/booking-templates/questions/' + question.id, {
                method: 'DELETE'
            }).then((res) => {
                if (res.status === 200) {
                    dispatch(fetchTemplate(template_uuid));
                    toast("Question deleted sucessfully.", { type: 'success' });
                }
                else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

            }).catch((error) => {
                toast("Sorry, something went wrong. Please try again.", { type: 'error' });
            });
        }
    }

    const handleBack = () => {
        // route back to settings page
        router.push("/settings/booking-templates");
    }

    return (<DndProvider backend={HTML5Backend}>
        <Layout noScroll={true} hideTitleBar={true}>
            <div className="max-w-[99%] overflow-hidden h-screen flex flex-col">
                <div className="header border border-transparent border-b-gray-300 px-10 py-6 w-full flex-shrink-0">
                    <div className="flex flex-row cursor-pointer float-right" onClick={handleBack}>
                        <svg fill="#000000" width="20px" height="15px" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M222.927 580.115l301.354 328.512c24.354 28.708 20.825 71.724-7.883 96.078s-71.724 20.825-96.078-7.883L19.576 559.963a67.846 67.846 0 01-13.784-20.022 68.03 68.03 0 01-5.977-29.488l.001-.063a68.343 68.343 0 017.265-29.134 68.28 68.28 0 011.384-2.6 67.59 67.59 0 0110.102-13.687L429.966 21.113c25.592-27.611 68.721-29.247 96.331-3.656s29.247 68.721 3.656 96.331L224.088 443.784h730.46c37.647 0 68.166 30.519 68.166 68.166s-30.519 68.166-68.166 68.166H222.927z" /></svg>
                        <span className="pl-2 pb-2 -mt-1">Go back</span>
                    </div>
                    <label className="label block">Template Name</label>
                    <input className="auto-save-input font-bold p-1 w-2/3"
                        value={template?.name}
                        data-tip="edit template name"
                        data-effect="solid"
                        onChange={(e) => {
                            dispatch(templateActions.updateTemplate({ ...template, name: e.target.value }));
                            debounceHandleTemplateChanges()
                            e.target.style.width = e.target.value.length > 10 ? ((e.target.value.length + 5) * 8) + 'px' : '150px';
                        }} />
                </div>
                {template && <div className="flex w-full" style={{height: 'calc(100vh - 140px)'}}>
                    <div className="flex-1 py-6 px-10 overflow-auto">
                        <PagesBuilder template={template} updatePages={(pages) => dispatch(updateTemplate({ ...template, Pages: [...template.Pages, ...pages] }))}
                            currentPage={currentPage} updateCurrentPage={(page) => updateCurrentPage(page)}
                            handleRemovePage={handleRemovePage} />
                        {template?.Pages?.length > 0 ?
                            <Page key={currentPage.id} template_uuid={template.uuid} currentPage={currentPage} handleRemoveSection={handleRemoveSection} handleRemoveQuestion={handleRemoveQuestion} />
                            : <p className="w-full bg-gray-100 font-bold text-slate-500 mt-6 p-24 text-center">Create a new page to get started.</p>}
                    </div>
                    {currentPage?.Sections?.length > 0 && (
                        <div className="w-80 flex-shrink-0" style={{height: 'calc(100vh - 140px)'}}>
                            <div className="bg-white border border-transparent border-l-gray-300 h-full flex flex-col">
                                <div className="p-4 flex-shrink-0">
                                    <div className="flex justify-center">
                                        <label className="relative block w-11/12">
                                            <span className="absolute inset-y-0 left-0 flex items-center p-3 pt-5 h-5">
                                                <svg className="h-5 w-5 fill-black" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 30 30">
                                                    <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z"></path>
                                                </svg>
                                            </span>
                                            <input className="w-full bg-white placeholder:font-italitc border border-slate-300 rounded-full py-2 pl-10 pr-4 focus:outline-none" value={searchValue} onChange={handleSearchChange} placeholder="Search for field" type="text" />
                                        </label>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 pb-4">
                                    {fieldList.map((field, index) => {
                                        return <Field 
                                            currentPage={currentPage} 
                                            key={index} 
                                            type={field.type} 
                                            label={field.label} 
                                            description={field.description} 
                                            template_uuid={template?.uuid} 
                                        />
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>}
            </div>
        </Layout>
    </DndProvider >)
}
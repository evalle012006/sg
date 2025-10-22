import { useEffect, useCallback, useState } from 'react';
import { Section } from './Section';
import { useDebouncedCallback } from 'use-debounce';
import { arrayMoveImmutable } from 'array-move';
import { useDispatch, useSelector } from 'react-redux';
import { templateActions, fetchTemplate } from '../../store/templateSlice';
import { globalActions } from '../../store/globalSlice';

export const Page = (props) => {

    const dispatch = useDispatch();
    const [currentPage, setCurrentPage] = useState(props.currentPage);
    const [sections, setSections] = useState(props.currentPage.Sections);

    useEffect(() => {
        setCurrentPage(props.currentPage);
        setSections(props.currentPage.Sections);
    }, [props.currentPage]);

    useEffect(() => {
        if (sections?.lenth > 0) {
            dispatch(templateActions.updateSections(sections));
            setCurrentPage({ ...currentPage, Sections: sections });
        }

        dispatch(globalActions.setLoading(false));
    }, [sections?.length]);

    const createSection = async (type) => {
        const newSection = {
            label: '',
            type
        }

        const response = await fetch(`/api/booking-templates/${props.template_uuid}/pages/${props.currentPage.id}/sections/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newSection),
        });

        const data = await response.json();
        dispatch(templateActions.addSection(data));
    }

    const debouncedSyncSectionOrder = useDebouncedCallback(async (hoverIndex, section) => {
        const response = await fetch(`/api/booking-templates/${props.template_uuid}/pages/${props.currentPage.id}/sections/${section.id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ order: hoverIndex + 1 }),
        });

        const data = await response.json();
    }, 1000);

    const debounceUpdatePageDescription = useDebouncedCallback(async (updatedPage) => {
        await fetch("/api/booking-templates/" + props.template_uuid + "/pages/" + updatedPage.id, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedPage)
        }).then(() => {
            dispatch(fetchTemplate(props.template_uuid));
        });
    }, 1300);

    const handleDescriptionChange = (e) => {
        const updatedPage = { ...currentPage, description: e.target.value };
        setCurrentPage(updatedPage);
        debounceUpdatePageDescription(updatedPage);
    };

    const moveSection = useCallback((dragIndex, hoverIndex, section, sectionsList) => {
        dispatch(globalActions.setLoading(true));
        const newSections = arrayMoveImmutable(sectionsList, dragIndex, hoverIndex)
            .map((section, index) => { return { ...section, order: index + 1 } });
        debouncedSyncSectionOrder(hoverIndex, section);
        setSections(newSections);
        dispatch(globalActions.setLoading(false));
    }, []);

    const renderSection = useCallback((section, index) => {
        return (
            <Section
                key={section.id}
                index={index}
                currentPage={currentPage}
                sections={sections}
                section={section}
                moveSection={moveSection}
                handleRemoveSection={props.handleRemoveSection}
                handleRemoveQuestion={props.handleRemoveQuestion}
            />)
    }, [sections]);

    return (
        <div className='h-full'>
            {/* Page Description Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
                <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Page Description
                    </label>
                    <textarea
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
                        placeholder="Add a description for this page..."
                        rows="3"
                        value={currentPage.description || ''}
                        onChange={handleDescriptionChange}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    This description will help users understand what information is collected on this page.
                </p>
            </div>

            {/* Existing Sections */}
            {sections && sections.map((section, index) => renderSection(section, index))}

            {/* Add New Section Area */}
            <div className="p-10 my-10 text-center text-sky-800 font-bold bg-stone-50">
                <div className='relative mx-auto w-fit'>
                    <p>Select to add new section</p>
                    <div className='flex space-x-4 mt-10'>
                        <div className='opacity-70 hover:opacity-100 cursor-pointer' onClick={() => createSection('rows')}>
                            <div className='flex flex-col justify-between border-2 border-dashed border-sky-800/60 w-28 h-28 rounded-xl p-2'>
                                <div className='w-full bg-sky-700 h-6 rounded my-2'></div>
                                <div className='w-full bg-sky-700 h-6 rounded my-2'></div>
                                <div className='w-full bg-sky-700 h-6 rounded my-2'></div>
                            </div>
                            <p className='m-1'>rows</p>
                        </div>
                        <div className='opacity-70 hover:opacity-100 cursor-pointer' onClick={() => createSection('2_columns')}>
                            <div className='flex space-x-2 justify-between border-2 border-dashed border-sky-800/60 w-28 h-28 rounded-xl p-2'>
                                <div className='w-12 bg-sky-700 h-full rounded'></div>
                                <div className='w-12 bg-sky-700 h-full rounded'></div>
                            </div>
                            <p className='m-1'>2 columns</p>
                        </div>
                        <div className='opacity-70 hover:opacity-100 cursor-pointer' onClick={() => createSection('3_columns')}>
                            <div className='flex space-x-1 justify-between border-2 border-dashed border-sky-800/60 w-28 h-28 rounded-xl p-2'>
                                <div className='w-6 bg-sky-700 h-full rounded'></div>
                                <div className='w-6 bg-sky-700 h-full rounded'></div>
                                <div className='w-6 bg-sky-700 h-full rounded'></div>
                            </div>
                            <p className='m-1'>3 columns</p>
                        </div>
                        <div className='opacity-70 hover:opacity-100 cursor-pointer' onClick={() => createSection('4_columns')}>
                            <div className='flex space-x-1 justify-between border-2 border-dashed border-sky-800/60 w-28 h-28 rounded-xl p-2'>
                                <div className='w-4 bg-sky-700 h-full rounded'></div>
                                <div className='w-4 bg-sky-700 h-full rounded'></div>
                                <div className='w-4 bg-sky-700 h-full rounded'></div>
                                <div className='w-4 bg-sky-700 h-full rounded'></div>
                            </div>
                            <p className='m-1'>4 columns</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
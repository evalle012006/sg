import { useDrag } from 'react-dnd'
import { useDispatch, useSelector } from 'react-redux';
import { ItemTypes } from './itemTypes'
import { templateActions, fetchTemplate } from './../../store/templateSlice';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const style = {
    border: '1px dashed gray',
    backgroundColor: 'white',
    padding: '0.5rem 1rem',
    marginRight: '1.5rem',
    marginBottom: '1.5rem',
    cursor: 'move',
    float: 'left',
}

export const Field = function Field({ type, label, description, currentPage, template_uuid }) {
    const dispatch = useDispatch();

    const router = useRouter();
    const { template_uuid: routerTemplateUuid } = router.query;
    
    // Use the prop first, fallback to router query
    const effectiveTemplateUuid = template_uuid || routerTemplateUuid;

    // Field types that need enhanced options (with description and imageUrl)
    const cardSelectionFields = [
        'card-selection',
        'card-selection-multi',
        'horizontal-card',
        'horizontal-card-multi'
    ];

    // Package selection fields
    const packageSelectionFields = [
        'package-selection',
        'package-selection-multi'
    ];

    useEffect(() => {
        console.log('Field component props:', { type, label, template_uuid, effectiveTemplateUuid });
    }, [type, label, template_uuid, effectiveTemplateUuid]);

    const [{ isDragging }, drag] = useDrag(() => ({
        type: ItemTypes.FIELD,
        item: { type }, // This should contain the correct type
        end: async (item, monitor) => {
            console.log('Drag end - item type:', item.type, 'original type prop:', type);
            
            const dropResult = monitor.getDropResult()
            if (item && dropResult) {
                let newQuestion = { 
                    type: item.type, 
                    question: "", 
                    label: "", 
                    required: false, 
                    order: dropResult.order, 
                    options: [], 
                    details: {} 
                };

                console.log('Creating question with type:', item.type);

                // Special handling for card selection fields
                if (cardSelectionFields.includes(item.type)) {
                    newQuestion = {
                        ...newQuestion,
                        option_type: 'funder', // Default to funder
                        options: [] // Ensure options is an empty array for card fields
                    };
                    console.log('Added option_type for card selection:', newQuestion);
                }

                // Special handling for package selection fields
                if (packageSelectionFields.includes(item.type)) {
                    newQuestion = {
                        ...newQuestion,
                        details: { 
                            funder: 'NDIS', // Default funder
                            ndis_package_type: 'sta' // Default NDIS package type
                        },
                        options: [] // Not used for package selection, but kept for consistency
                    };
                    console.log('Added funder and ndis_package_type to details for package selection:', newQuestion);
                }

                // Special handling for URL fields
                if (item.type === "url") {
                    newQuestion = { 
                        ...newQuestion, 
                        details: { label: '', url: '' } 
                    };
                }

                // Special handling for rich text fields
                if (item.type === "rich-text") {
                    newQuestion = { 
                        ...newQuestion, 
                        details: { description: '' } 
                    };
                }

                console.log('Final question payload:', newQuestion);
                console.log('API URL will be:', `/api/booking-templates/${effectiveTemplateUuid}/pages/${currentPage?.id}/sections/${dropResult.section.id}/questions/create`);

                const response = await fetch(`/api/booking-templates/${effectiveTemplateUuid}/pages/${currentPage?.id}/sections/${dropResult.section.id}/questions/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(newQuestion),
                });

                const data = await response.json();

                console.log('Created question response:', data);
                dispatch(templateActions.addQuestion(data))
                dispatch(fetchTemplate(effectiveTemplateUuid));
            }
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId(),
        }),
    }))
    
    const opacity = isDragging ? 0.4 : 1
    
    return (
        <div ref={drag} style={{ opacity }} className="flex items-center p-5 hover:bg-stone-50 rounded-xl hover:cursor-grab drag:cursor-grabbing" data-testid={`box`}>
            <svg width="10" height="17" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 14.5C4 15.6 3.1 16.5 2 16.5C0.9 16.5 0 15.6 0 14.5C0 13.4 0.9 12.5 2 12.5C3.1 12.5 4 13.4 4 14.5ZM2 6.5C0.9 6.5 0 7.4 0 8.5C0 9.6 0.9 10.5 2 10.5C3.1 10.5 4 9.6 4 8.5C4 7.4 3.1 6.5 2 6.5ZM2 0.5C0.9 0.5 0 1.4 0 2.5C0 3.6 0.9 4.5 2 4.5C3.1 4.5 4 3.6 4 2.5C4 1.4 3.1 0.5 2 0.5ZM8 4.5C9.1 4.5 10 3.6 10 2.5C10 1.4 9.1 0.5 8 0.5C6.9 0.5 6 1.4 6 2.5C6 3.6 6.9 4.5 8 4.5ZM8 6.5C6.9 6.5 6 7.4 6 8.5C6 9.6 6.9 10.5 8 10.5C9.1 10.5 10 9.6 10 8.5C10 7.4 9.1 6.5 8 6.5ZM8 12.5C6.9 12.5 6 13.4 6 14.5C6 15.6 6.9 16.5 8 16.5C9.1 16.5 10 15.6 10 14.5C10 13.4 9.1 12.5 8 12.5Z" fill="black" fillOpacity="0.5" />
            </svg>
            <div className="ml-8">
                <h5 className='font-semibold'>{label}</h5>
                <p className='text-black/70'>{description}</p>
                <p className='text-xs text-blue-600'>Type: {type}</p> {/* Debug info */}
            </div>
        </div>
    )
}
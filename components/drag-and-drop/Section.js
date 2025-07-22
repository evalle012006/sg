import { useEffect, useRef, useState } from "react";
import { SubSection } from "./subSection";
import { useDrop, useDrag } from "react-dnd";
import { ItemTypes } from "./itemTypes";

export const Section = ({ index, currentPage, sections, section, moveSection, handleRemoveSection, handleRemoveQuestion }) => {
    const [hasLockedQuestion, setHasLockedQuestion] = useState(false);
    const dragRef = useRef(null);
    const previewRef = useRef(null);

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.SECTION,
        collect: (monitor) => {
            return {
                handlerId: monitor.getHandlerId(),
            }
        },
        hover: (item, monitor) => {
            if (!previewRef.current) {
                return;
            }
            const dragIndex = item.index;
            const hoverIndex = index;
            // Don't replace items with themselves
            if (dragIndex === hoverIndex) {
                return;
            }

            // Determine rectangle on screen
            const hoverBoundingRect = previewRef.current?.getBoundingClientRect()
            // Get vertical middle
            const hoverMiddleY =
                (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
            // Determine mouse position
            const clientOffset = monitor.getClientOffset()
            // Get pixels to the top
            const hoverClientY = clientOffset.y - hoverBoundingRect.top
            // Only perform the move when the mouse has crossed half of the items height
            // When dragging downwards, only move when the cursor is below 50%
            // When dragging upwards, only move when the cursor is above 50%
            // Dragging downwards
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
                return
            }
            // Dragging upwards
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
                return
            }
            // Time to actually perform the action
            moveSection(dragIndex, hoverIndex, item.section, sections)
            // Note: we're mutating the monitor item here!
            // Generally it's better to avoid mutations,
            // but it's good here for the sake of performance
            // to avoid expensive index searches.
            // item.index = hoverIndex
        },
    });

    const [{ isDragging }, drag, preview] = useDrag({
        type: ItemTypes.SECTION,
        item: () => {
            return { section, index };
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    })

    const opacity = isDragging ? 0 : 1

    drag(dragRef)
    drop(preview(previewRef))

    const [questions, setQuestions] = useState([]);

    useEffect(() => {
        let tempQuestions = [];
        const columnsLength = 1;
        if (section.type === "2_columns") {
            columnsLength = 2;
        } else if (section.type === "3_columns") {
            columnsLength = 3;
        } else if (section.type === "4_columns") {
            columnsLength = 4;
        }

        for (let i = 0; i < columnsLength; i++) {
            const questionExists = section.Questions && section.Questions.find(question => question && question.order == i);
            if (questionExists) {
                if (questionExists.is_locked) {
                    setHasLockedQuestion(true);
                }
                tempQuestions.push(questionExists);
            } else {
                tempQuestions.push(null);
            }
        }
        setQuestions(tempQuestions);
    }, [section.Questions]);

    return (<div className={`${isDragging ? 'opacity-40' : 'opacity-1'} group/section flex flex-col bg-stone-50 my-4 relative border border-gray-200 rounded-md hover:border-gray-400 group-hover/delete:border-red-300`} ref={previewRef} data-handler-id={handlerId}>

        <div className="flex flex-row justify-between pr-4 mb-6 absolute w-full">
            <div className="h-10 w-10 m-2 invisible group-hover/section:visible hover:cursor-grab" ref={dragRef}>
                <svg width="10" height="17" viewBox="0 0 10 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 14.5C4 15.6 3.1 16.5 2 16.5C0.9 16.5 0 15.6 0 14.5C0 13.4 0.9 12.5 2 12.5C3.1 12.5 4 13.4 4 14.5ZM2 6.5C0.9 6.5 0 7.4 0 8.5C0 9.6 0.9 10.5 2 10.5C3.1 10.5 4 9.6 4 8.5C4 7.4 3.1 6.5 2 6.5ZM2 0.5C0.9 0.5 0 1.4 0 2.5C0 3.6 0.9 4.5 2 4.5C3.1 4.5 4 3.6 4 2.5C4 1.4 3.1 0.5 2 0.5ZM8 4.5C9.1 4.5 10 3.6 10 2.5C10 1.4 9.1 0.5 8 0.5C6.9 0.5 6 1.4 6 2.5C6 3.6 6.9 4.5 8 4.5ZM8 6.5C6.9 6.5 6 7.4 6 8.5C6 9.6 6.9 10.5 8 10.5C9.1 10.5 10 9.6 10 8.5C10 7.4 9.1 6.5 8 6.5ZM8 12.5C6.9 12.5 6 13.4 6 14.5C6 15.6 6.9 16.5 8 16.5C9.1 16.5 10 15.6 10 14.5C10 13.4 9.1 12.5 8 12.5Z" fill="black" fillOpacity="0.5" />
                </svg>
            </div>
            {!hasLockedQuestion && (
                <button className='group/delete rounded text-sm outline-none invisible group-hover/section:visible absolute right-0' onClick={(e) => handleRemoveSection(e, currentPage, section)} title="Delete Section">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="m-1 bg-white rounded-md border border-slate-400 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            )}
        </div>
        <div className="flex space-x-4 px-10">
            {questions.map((question, index) => (<SubSection key={index} order={index} question={question} section={section} handleRemoveQuestion={handleRemoveQuestion} />))}
        </div>
    </div>)
}
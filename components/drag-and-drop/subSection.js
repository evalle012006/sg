import { useEffect, useState } from 'react'
import { useDrop } from 'react-dnd'
import FieldBuilder from '../../pages/settings/booking-templates/fieldBuilder.js'
import { ItemTypes } from './itemTypes.js'

export const SubSection = (props) => {
    const [question, setQuestion] = useState(props.question);

    useEffect(() => {
        setQuestion(props.question);
    }, [props.question]);

    const [{ canDrop, isOver }, drop] = useDrop(() => ({
        accept: ItemTypes.FIELD,
        drop: () => { return { name: 'section', order: props.order, section: props.section } },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    }))
    const isActive = canDrop && isOver
    let backgroundColor = '#222'
    if (isActive) {
        backgroundColor = 'darkgreen'
    } else if (canDrop) {
        backgroundColor = 'darkkhaki'
    }

    return (
        <div className='group/field w-full flex flex-col relative'>
            {(question && !question.is_locked) && (
                <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible absolute right-0">
                    <button className='p-1 rounded text-sm mt-2 outline-none' onClick={(e) => props.handleRemoveQuestion(e, question)} title="Delete Question">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="m-1 bg-white rounded-md border border-slate-400 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            )}
            <div ref={drop} data-testid="section">
                {question ? <FieldBuilder {...props} /> :
                    <div className={isActive ? 'border-2 border-dashed border-sky-800/90 p-4 text-center' : 'border-2 border-dashed border-sky-800/30 p-4 text-center'}>
                        <p>{isActive ? 'Release to drop' : 'Drag a field here'}</p>
                    </div>}
            </div>
        </div>
    )
}

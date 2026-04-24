import { forwardRef, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useDebouncedCallback } from 'use-debounce';
import { addNewPage, fetchTemplate } from "../../../store/templateSlice";

// ─── Pointer-drag reorder hook ───────────────────────────────────────────────
function useDragReorder(pages, onReorder) {
    const [orderedPages, setOrderedPages] = useState(pages);
    const [dragIndex, setDragIndex]       = useState(null);
    const [overIndex, setOverIndex]       = useState(null);

    const dragRef = useRef({ active: false, startX: 0, startIndex: null });

    useEffect(() => { setOrderedPages(pages); }, [pages]);

    const getTabRects = (stripEl) => {
        if (!stripEl) return [];
        return Array.from(stripEl.querySelectorAll('[data-page-tab]'))
            .map(el => el.getBoundingClientRect());
    };

    const resolveOverIndex = (clientX, stripEl) => {
        const rects = getTabRects(stripEl);
        for (let i = 0; i < rects.length; i++) {
            if (clientX < (rects[i].left + rects[i].right) / 2) return i;
        }
        return rects.length - 1;
    };

    const onPointerDown = (e, index, stripEl) => {
        if (e.button !== 0) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        dragRef.current = { active: false, startX: e.clientX, startIndex: index };
        let currentOver = index;

        const onMove = (ev) => {
            if (!dragRef.current.active && Math.abs(ev.clientX - dragRef.current.startX) > 5) {
                dragRef.current.active = true;
                setDragIndex(index);
            }
            if (dragRef.current.active) {
                currentOver = resolveOverIndex(ev.clientX, stripEl);
                setOverIndex(currentOver);
            }
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            if (dragRef.current.active) {
                const from = dragRef.current.startIndex;
                const to   = currentOver;
                if (from !== to) {
                    setOrderedPages(prev => {
                        const next = [...prev];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        onReorder(next);
                        return next;
                    });
                }
            }
            dragRef.current.active = false;
            setDragIndex(null);
            setOverIndex(null);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return { orderedPages, dragIndex, overIndex, onPointerDown };
}

// ─── PagesBuilder ─────────────────────────────────────────────────────────────
// forwardRef so TemplateBuilder can attach its stripRef for overflow detection.
const PagesBuilder = forwardRef(function PagesBuilder(props, ref) {
    const dispatch   = useDispatch();
    const innerRef   = useRef(null);

    // Combine forwarded ref + inner ref
    const setRef = (el) => {
        innerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
    };

    const pages = props.template?.Pages ?? [];

    const handleReorder = async (reorderedPages) => {
        await Promise.all(
            reorderedPages.map((page, index) =>
                fetch(`/api/booking-templates/${props.template.uuid}/pages/${page.id}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...page, sort_order: index }),
                })
            )
        );
        dispatch(fetchTemplate(props.template.uuid));
    };

    const { orderedPages, dragIndex, overIndex, onPointerDown } =
        useDragReorder(pages, handleReorder);

    return (
        <div
            ref={setRef}
            className="flex items-center gap-1.5 px-4 sm:px-6 py-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
            {orderedPages.map((page, index) => (
                <Page
                    key={page.id ?? index}
                    page={page}
                    pageNumber={index + 1}
                    isSelected={(page?.id) === (props.currentPage?.id)}
                    template_uuid={props.template?.uuid}
                    updateCurrentPage={() => props.updateCurrentPage(page)}
                    handleRemovePage={props.handleRemovePage}
                    onPointerDown={(e) => onPointerDown(e, index, innerRef.current)}
                    isBeingDragged={dragIndex === index}
                    showDropBefore={dragIndex !== null && overIndex === index && overIndex !== dragIndex}
                />
            ))}

            {/* Add page */}
            <button
                onClick={() => dispatch(addNewPage(props.template?.uuid))}
                className="
                    flex items-center gap-1.5 px-3 py-1.5 ml-1
                    text-xs font-medium text-gray-500
                    rounded-lg border border-dashed border-gray-300
                    hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50
                    transition-all duration-150 whitespace-nowrap flex-shrink-0
                    min-h-[36px] cursor-pointer select-none
                "
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                New Page
            </button>
        </div>
    );
});

export default PagesBuilder;

// ─── Page tab ─────────────────────────────────────────────────────────────────
function Page(props) {
    const [page, setPage] = useState(props.page);
    const dispatch        = useDispatch();

    useEffect(() => { setPage(props.page); }, [props.page]);

    const debounceUpdatePage = useDebouncedCallback((updatedPage) => updatePage(updatedPage), 1300);

    const updatePage = async (updatedPage) => {
        await fetch(`/api/booking-templates/${props.template_uuid}/pages/${updatedPage.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedPage),
        }).then(() => dispatch(fetchTemplate(props.template_uuid)));
    };

    if (!page) return null;

    const titleWidth = page.title.length > 10
        ? Math.min((page.title.length + 5) * 8, 200) + 'px'
        : '120px';

    return (
        <div
            data-page-tab
            onPointerDown={props.onPointerDown}
            onClick={props.updateCurrentPage}
            className={`
                group relative flex items-center gap-2 px-3 py-1.5 rounded-lg border
                transition-all duration-100 flex-shrink-0 min-h-[36px] select-none
                ${props.isBeingDragged ? 'opacity-40 scale-95' : ''}
                ${props.showDropBefore ? 'border-l-[3px] border-l-sky-500' : ''}
                ${props.isSelected
                    ? 'bg-sky-600 border-sky-600 shadow-sm cursor-pointer'
                    : 'bg-white border-gray-200 hover:border-sky-300 hover:bg-sky-50 cursor-grab active:cursor-grabbing'
                }
            `}
        >
            {/* Grip dots */}
            <svg viewBox="0 0 10 16" fill="currentColor"
                className={`w-2.5 h-3.5 flex-shrink-0 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none
                    ${props.isSelected ? 'text-white' : 'text-gray-500'}`}>
                <circle cx="2.5" cy="2"  r="1.5"/><circle cx="7.5" cy="2"  r="1.5"/>
                <circle cx="2.5" cy="8"  r="1.5"/><circle cx="7.5" cy="8"  r="1.5"/>
                <circle cx="2.5" cy="14" r="1.5"/><circle cx="7.5" cy="14" r="1.5"/>
            </svg>

            {/* Page number badge */}
            <span className={`
                text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0
                ${props.isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}
            `}>
                {props.pageNumber}
            </span>

            {/* Editable title — only when selected */}
            <input
                className={`
                    text-xs font-medium bg-transparent border-none outline-none min-w-0
                    ${props.isSelected ? 'text-white placeholder-sky-200 cursor-text' : 'text-gray-700 cursor-grab'}
                `}
                style={{ width: titleWidth }}
                value={page.title}
                readOnly={!props.isSelected}
                onChange={(e) => {
                    if (!props.isSelected) return;
                    const updated = { ...page, title: e.target.value };
                    setPage(updated);
                    debounceUpdatePage(updated);
                }}
                onClick={(e) => { if (props.isSelected) e.stopPropagation(); }}
            />

            {/* Remove — original (e, page) signature */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    props.handleRemovePage(e, page);
                }}
                className={`
                    flex-shrink-0 p-0.5 rounded transition-colors
                    ${props.isSelected
                        ? 'text-sky-200 hover:text-white hover:bg-sky-500'
                        : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
                    }
                `}
                aria-label="Remove page"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
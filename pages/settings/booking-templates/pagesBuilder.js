import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useDebouncedCallback } from 'use-debounce';
import { addNewPage, fetchTemplate } from "../../../store/templateSlice";


export default function PagesBuilder(props) {
    const dispatch = useDispatch();
    
    return (
        <div className="page-box bg-gray-100 w-full p-1 flex flex-wrap">
            {props.template && props.template?.Pages?.map((page, index) =>
                <Page key={index} page={page} isSelected={(page && page.id) == (props.currentPage && props.currentPage.id)} 
                    template_uuid={props.template.uuid} updateCurrentPage={() => props.updateCurrentPage(page)} 
                    handleRemovePage={props.handleRemovePage} />)
            }
            <div className="m-2 mx-3 px-2 w-fit flex space-x-2 items-center cursor-pointer border border-transparent rounded hover:border-slate-400" onClick={() => dispatch(addNewPage(props.template?.uuid))}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
                New Page
            </div>
        </div>
    )
}

function Page(props) {
    const [page, setPage] = useState(props.page);

    const dispatch = useDispatch();

    useEffect(() => {
        setPage(props.page);
    }, [props.page]);

    const debounceUpdatePage = useDebouncedCallback((updatedPage) => updatePage(updatedPage), 1300);

    const updatePage = async (updatedPage) => {
        await fetch("/api/booking-templates/" + props.template_uuid + "/pages/" + updatedPage.id, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(updatedPage)
        }).then(() => {
            dispatch(fetchTemplate(props.template_uuid));
        });
    }

    return (page && <div className={props.isSelected ?
        "bg-sky-100 p-1 px-2 w-fit border border-sky-800 rounded-md flex items-center m-1" :
        "bg-white p-1 px-2 w-fit border rounded-md flex items-center m-1"}
        onClick={props.updateCurrentPage}>
        {/* <p className={props.isSelected ? 'focus:outline-none bg-transparent text-sky-800 font-bold' : 'focus:outline-none bg-transparent'}>
            {page.title}
        </p> */}
        {/* // THIS SECTION CAN USED TO ALLOW PAGE TITLE EDITING */}
        <input className={props.isSelected ? 'auto-save-input w-28 bg-transparent text-sky-800 font-bold' : 'focus:outline-none w-28 bg-transparent'}
            style={{ width: (page.title.length > 10 ? ((page.title.length + 5) * 8) + 'px' : '150px') }}
            value={page.title}
            onChange={(e) => {
                if (props.isSelected) {
                    setPage({ ...page, title: e.target.value })
                    debounceUpdatePage({ ...page, title: e.target.value })
                    e.target.style.width = e.target.value.length > 10 ? ((e.target.value.length + 5) * 8) + 'px' : '150px';
                }
            }}
            readOnly={!props.isSelected} />
        <button onClick={(e) => props.handleRemovePage(e, page)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className={props.isSelected ? 'ml-1 w-4 h-4 text-slate-500' : 'ml-1 w-4 h-4'}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    </div >)
}
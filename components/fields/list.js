import React from "react";
import { useState, useEffect } from "react";

const ListField = (props) => {
    const [builderMode, setBuilderMode] = useState(false);
    const [title, setTitle] = useState(); // should be the question
    // details
    const [subText, setSubText] = useState();
    const [list, setList] = useState();

    const handleUpdateDetails = () => {
        const data = {
            subtext: subText,
            list: list
        }
        // console.log(data)
        props.onChange(data);
    }

    const handleAddItem = () => {
        let updatedList = [...list];
        updatedList.push({
            title: '',
            content: '',
            items: []
        });

        setList(updatedList);
    }

    const handleUpdateListItem = (index, value, field, subIdx) => {
        const updatedList = list.map((item, idx) => {
            let temp = {...item};
            if (idx === index) {
                if (field === 'list') {
                    const updatedSubList = item.items.map((sub, subI) => {
                        let sTemp = sub;

                        if (subIdx === subI) {
                            sTemp = value;
                        }

                        return sTemp;
                    });

                    temp.items = updatedSubList;
                } else {
                    temp[field] = value;
                }
            }

            return temp;
        });

        setList(updatedList);
    }

    const handleAddList = (index) => {
        const updatedList = list.map((l, idx) => {
            let temp = {...l};
            if (idx === index) {
                let arrItems = [...temp.items];
                arrItems.push('');
            }

            return temp;
        });

        setList(updatedList);
    }

    useEffect(() => {
        handleUpdateDetails();
    }, [list]);

    useEffect(() => {
        if (props.builder) {
          setBuilderMode(props.builder);
        } else {
          setBuilderMode(false);
        }

        if (props.title) {
            setTitle(props.title);
        }

        if (props.subtext) {
            setSubText(props.subtext);
        }

        if (props.list) {
            setList(props.list);
        }
      }, [props]);
    
    return (
        <div className={`flex bg-zinc-100 p-10 text-sm rounded ${props.className || ''}`}>
            {builderMode ? (
                <div className="flex flex-col w-full items-center">
                    <textarea 
                        className={`form-control block w-11/12 px-3 py-1.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded
                                    transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none ${props.error ? 'border-2 border-red-500 bg-red-50' : ''}`}
                        rows="2" 
                        disabled={props?.disabled} 
                        placeholder="Input sub text here" 
                        defaultValue={subText} 
                        onChange={(e) => {setSubText(e.target.value)}} 
                        onBlur={handleUpdateDetails}
                    ></textarea>
                    <div className="mt-2 flex flex-col w-11/12">
                        {list.map((sub, index) => {
                            return (
                                <div className="flex flex-col p-4 bg-white" key={index}>
                                    <input 
                                        type="text" 
                                        placeholder="Input sub title here" 
                                        defaultValue={sub.title} 
                                        className={`${sub.title.length > 30 && 'w-[40em]'} border-b border-zinc-300 outline-none mb-2 ${props.error ? 'border-red-500' : ''}`} 
                                        onBlur={(e) => { handleUpdateListItem(index, e.target.value, 'title') }} 
                                    />
                                    <textarea 
                                        className={`form-control block w-[99%] px-3 py-1.5 text-xs font-normal text-gray-700 bg-white bg-clip-padding border border-solid border-gray-300 rounded
                                                  transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none ${props.error ? 'border-2 border-red-500 bg-red-50' : ''}`}
                                        rows="2" 
                                        placeholder="Input sub text here" 
                                        defaultValue={sub.content} 
                                        onBlur={(e) => { handleUpdateListItem(index, e.target.value, 'content') }}
                                    ></textarea>
                                    <ul className="flex flex-col">
                                        {/* add remove items */}
                                        {sub.items.map((item, idx) => {
                                            return (
                                                <li key={idx} className="flex flex-row ml-2 mt-2 list-disc">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Input list item here" 
                                                        defaultValue={item} 
                                                        className={`w-[98%] border-b border-zinc-300 outline-none mb-2 ${props.error ? 'border-red-500' : ''}`} 
                                                        onBlur={(e) => { handleUpdateListItem(index, e.target.value, 'list', idx) }} 
                                                    />
                                                </li>
                                            )
                                        })}
                                        <div className="mt-8 hover:border border-dashed border-gray-500 rounded p-4 text-base cursor-pointer text-center items-center w-full" onClick={() => handleAddList(index)}>+ Add List</div>
                                    </ul>
                                </div>
                            )
                        })}
                        <div className="hover:border border-dashed border-gray-500 rounded p-4 text-base cursor-pointer text-center items-center w-full" onClick={handleAddItem}>+ Add Item</div>
                    </div>
                </div>
            ) : (
                <React.Fragment>
                    <h4>{ title }</h4>
                    {subText && <p>{subText}</p>}
                    {list && (
                        <React.Fragment>
                            {list.map((sub, index) => {
                                return (
                                    <div className="flex flex-col" key={index}>
                                        <span className="font-bold">{ sub.title }</span>
                                        {sub.content && <p>{sub.content}</p>}
                                        <ul className="flex flex-col">
                                            {sub.items.map((item, idx) => {
                                                return (
                                                    <li key={idx} className="flex flex-row mb-8">
                                                        <span className="mr-4">{ `${idx + 1}.` }</span>
                                                        <span>{ item }</span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                    </div>
                                )
                            })}
                        </React.Fragment>
                    )}
                </React.Fragment>
            )}
            {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
        </div>
    );
};

export default ListField;
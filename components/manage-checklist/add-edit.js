import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { handleResponse } from "../../utilities/api/responseHandler";

const AddEditChecklist = ({ data, updateList, setShowPanel, onDelete, handleAddNew, handleOnClose }) => {
    const list = useSelector(state => state.checklist.list);
    const [addMode, setAddMode] = useState(true);
    const [name, setName] = useState('');
    const [actions, setActions] = useState([]);
    const [action, setAction] = useState('');

    const handleAddNewChecklist = () => {
        setActions([]);
        setAction('');
        setName('');
        handleAddNew();
    }

    const handleAddAction = () => {
        if (action) {
            // const newAction = {
            //     action: action.trim(),
            //     createdAt: new Date(),
            //     updatedAt: new Date(),
            //     status: false
            // };

            // if (data.hasOwnProperty('id')) {
            //     newAction = {
            //         ...newAction,
            //         ChecklistId: data.id,
            //         checklist_id: data.id
            //     }
            // }

            const temp = [...actions];
            temp.push(action);
            setActions(temp);
            setAction('');
        }
    }

    const handleOnChange = (e, index) => {
        e.preventDefault();
        e.stopPropagation();
        const updated = actions.map((action, idx) => {
            let temp = {...action};
            if (index === idx) {
                temp.status = e.target.checked;
            }

            return temp;
        });

        setActions(updated);
    }

    const handleCancel = () => {
        setAction('');

        if (Object.keys(data).length > 0) {
            setActions(data.actions);
        }

        setShowPanel(false);
        handleOnClose();
    }

    const handleSave = async () => {
        let upsertChecklist;

        if (addMode) {
            upsertChecklist = {
                name: name,
                actions: actions,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        } else {
            upsertChecklist = {
                ...data,
                updatedAt: new Date(),
                name: name,
                actions: actions
            };
        }

        const response = await fetch('/api/manage-checklist/add-update', {
            method: 'POST',
            body: JSON.stringify(upsertChecklist),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        const updatedData = await handleResponse(response);

        if (updatedData.success) {
            await refreshData(updatedData.id);
            toast.success('Checklist successfully saved!');
            // setShowPanel(false);
            handleOnClose();
        }
    }

    const handleSaveAction = (selected, index) => {
        if (selected) {
            let actionArr = [...actions];
            actionArr[index] = selected;
            setActions(actionArr);
        } else {
            toast.error("Action must not be empty.");
        }
    }

    const handleDeleteAction = (selected) => {
        setActions(actions.filter(a => a !== selected));
    }

    const refreshData = async (checklistId) => {
        const resp = await fetch('/api/manage-checklist/get-checklist?id=' + checklistId);

        const response = await handleResponse(resp);

        if (response.success) {
            let arr = [...list];
            const newData = response.data;
            
            if (addMode) {
                arr.push(newData);
            } else {
                arr = arr.map(o => {
                    let temp = {...o};
                    if (temp.id === newData.id) {
                        temp = newData;
                    }

                    return temp;
                });
            }

            updateList(arr);
        }

    }

    const handleMoveUp = (index, arr) => {
        if (index > 0) {
            let actionList = [...arr];
            let temp = actionList[index - 1];
            actionList[index - 1] = actionList[index];
            actionList[index] = temp;
            setActions(actionList);
        }
    }

    const handleMoveDown = (index, arr) => {
        if (index < arr.length - 1) {
            let actionList = [...arr];
            let temp = actionList[index + 1];
            actionList[index + 1] = actionList[index];
            actionList[index] = temp;
            setActions(actionList);
        }
    }

    useEffect(() => {
        if (Object.keys(data).length > 0) {
            setAddMode(false);
            setName(data.name);
            setActions(data.actions);
        } else {
            setAddMode(true);
        }
    }, [data]);
    
    return (
        <div className="flex flex-col pl-4 overflow-x-auto">
            <div className="flex flex-row justify-between">
                <span className="text-lg font-bold text-sargood-blue">{ addMode ? 'Add new checklist' : 'Update checklist'  }</span>
                {!addMode && <button className='border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' onClick={handleAddNewChecklist}>+ Add New Checklist</button>}
            </div>
            
            <div className="mt-4 flex flex-col">
                <label className="text-sm">Name</label>
                <input name="title" type="text" value={name} onChange={(e) => setName(e.target.value)} className='rounded border border-gray-300 p-2 w-11/12' placeholder='Enter title' />
                {actions.map((action, index) => {
                    return (
                        <div key={index} className={`${index === 0 && 'mt-4'}`}>
                            <label className="flex flex-row items-start p-2">
                                {/* <input
                                    type="checkbox"
                                    name={`${action.name}-${index}`}
                                    className="w-4 h-4 text-green-600 border-0 rounded-md focus:ring-0"
                                    value={action.status}
                                    onChange={(e) => handleOnChange(e, index)}
                                    checked={action.status}
                                /> */}
                                <input type="text" value={action} className={`ml-2 w-[40em] border-b border-zinc-300 outline-none mr-10`} onChange={(e) => { handleSaveAction(e.target.value, index) }} />
                                <span className="text-sm text-gray-500 hover:underline cursor-pointer" onClick={() => handleDeleteAction(action)} title="Delete action">x</span>
                                <div className={`flex flex-col ml-2 ${index == 0 ? 'my-auto' : index == actions.length - 1 ? 'my-auto' : '-mt-2'}`}>
                                    <span className={`text-sm text-gray-500 hover:underline cursor-pointer ${index == 0 && 'hidden'}`} onClick={() => handleMoveUp(index, actions)} title="Move Up">
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M18.2929 15.2893C18.6834 14.8988 18.6834 14.2656 18.2929 13.8751L13.4007 8.98766C12.6195 8.20726 11.3537 8.20757 10.5729 8.98835L5.68257 13.8787C5.29205 14.2692 5.29205 14.9024 5.68257 15.2929C6.0731 15.6835 6.70626 15.6835 7.09679 15.2929L11.2824 11.1073C11.673 10.7168 12.3061 10.7168 12.6966 11.1073L16.8787 15.2893C17.2692 15.6798 17.9024 15.6798 18.2929 15.2893Z" fill="#0F0F0F"/>
                                        </svg>
                                    </span>
                                    <span className={`text-sm text-gray-500 hover:underline cursor-pointer ${index == actions.length - 1 && 'hidden'}`} onClick={() => handleMoveDown(index, actions)} title="Move Down">
                                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M5.70711 9.71069C5.31658 10.1012 5.31658 10.7344 5.70711 11.1249L10.5993 16.0123C11.3805 16.7927 12.6463 16.7924 13.4271 16.0117L18.3174 11.1213C18.708 10.7308 18.708 10.0976 18.3174 9.70708C17.9269 9.31655 17.2937 9.31655 16.9032 9.70708L12.7176 13.8927C12.3271 14.2833 11.6939 14.2832 11.3034 13.8927L7.12132 9.71069C6.7308 9.32016 6.09763 9.32016 5.70711 9.71069Z" fill="#0F0F0F"/>
                                        </svg>
                                    </span>
                                </div>
                            </label>
                        </div>
                    )
                })}
                <div className="flex flex-row mt-4">
                    <input name="newAction" type="text" value={action} onChange={(e) => setAction(e.target.value)} className='rounded border border-gray-300 p-2 w-2/4 mr-4' placeholder='Enter here' />
                    <button className='border border-gray-400 py-2 px-4 rounded text-sm bg-sargood-blue text-white' onClick={handleAddAction}>Add Item</button>
                </div>
            </div>
            <div className="flex flex-row justify-end bg-gray-100 mt-4 py-5">
                {!addMode && (<button className="mr-6 text-red-500" onClick={(e) => onDelete(e, data)}>Delete</button>)}
                <button className="mr-6" onClick={handleCancel}>Cancel</button>
                <button className='mr-4 border border-gray-400 py-2 px-4 rounded text-sm bg-sargood-blue text-white' onClick={handleSave}>{ addMode ? 'Add' : 'Save' }</button>
            </div>
        </div>
    )
}

export default AddEditChecklist;
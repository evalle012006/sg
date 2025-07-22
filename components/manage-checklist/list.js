import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { checklistActions } from '../../store/checklistSlice';
import moment from 'moment';
import dynamic from 'next/dynamic';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const AddEditChecklist = dynamic(() => import('./add-edit'));
const Modal = dynamic(() => import('../ui/modal'));

const CheckList = () => {
    const dispatch = useDispatch();
    const checklistData = useSelector(state => state.checklist.list);
    const [list, setList] = useState([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filteredData, setFilteredData] = useState([]);
    const [addEditMode, setAddEditMode] = useState(false);
    const [selectedData, setSelectedData] = useState({});
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleSearch = (e) => {
        const value = e.target.value.trim().toLowerCase();
        setIsFiltering(false);
        if (value) {
            setIsFiltering(true);
            const temp = list.filter(o => o.name.toLowerCase().includes(value));
            setFilteredData(temp);
            setList(temp);
        } else {
            setIsFiltering(false);
        }
    }

    const handleRowClick = (selected) => {
        setAddEditMode(true);
        setSelectedData(selected);
    }

    const handleAddNew = () => {
        setSelectedData({});
        setAddEditMode(true);
    }

    const handleBeforeDelete = (e, selected) => {
        e.stopPropagation();
        setSelectedData(selected);
        setShowWarningModal(true);
    }

    const handleDelete = async (e, selected) => {
        e.stopPropagation();

        if (selected) {
            if (selected.booking_id) {
                toast.error('This checklist is currently in use!');
            } else {
                const response = await fetch('/api/manage-checklist/delete/', { method: 'DELETE', body: JSON.stringify(selected) });
                if (response.ok) {
                    toast.success('Selected checklist was successfully deleted.');
                    setAddEditMode(false);
                    setShowWarningModal(false);
                    const arr = checklistData.filter(o => o.id !== selected.id);
                    dispatch(checklistActions.setList(arr));
                }
            }
        }
    }

    const handleUpdateList = (updates) => {
        dispatch(checklistActions.setList(updates));
    }

    const handleOnClose = () => {
        setSelectedData({});
        setAddEditMode(false);
    }

    // Function to handle drag end event
    const onDragEnd = async (result) => {
        setIsDragging(false);
        
        if (!result.destination) return;
        
        const startIndex = result.source.index;
        const endIndex = result.destination.index;
        
        if (startIndex === endIndex) return;
        
        const reorderedList = Array.from(list);
        const [removed] = reorderedList.splice(startIndex, 1);
        reorderedList.splice(endIndex, 0, removed);
        
        // Update local state immediately for UI responsiveness
        setList(reorderedList);
        
        // Prepare updated order data
        const updatedItems = reorderedList.map((item, index) => ({
            id: item.id,
            order: index + 1
        }));
        
        // Send to API
        try {
            const response = await fetch('/api/manage-checklist/reorder', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedItems),
            });
            
            if (response.ok) {
                // Update Redux store with the new order
                const updatedChecklistData = checklistData.map(item => {
                    const updatedItem = updatedItems.find(updated => updated.id === item.id);
                    if (updatedItem) {
                        return { ...item, order: updatedItem.order };
                    }
                    return item;
                });
                
                dispatch(checklistActions.setList(updatedChecklistData));
                toast.success('Checklist order updated successfully');
            } else {
                // Revert to previous state if API fails
                setList(list);
                toast.error('Failed to update checklist order');
            }
        } catch (error) {
            console.error('Error updating order:', error);
            setList(list);
            toast.error('An error occurred while updating the order');
        }
    };
    
    const onDragStart = () => {
        setIsDragging(true);
    };

    useEffect(() => {
        if (isFiltering) {
            setList(filteredData);
        } else {
            // Sort by order field (ascending)
            const sortedList = [...checklistData].sort((a, b) => a.order - b.order);
            setList(sortedList);
        }
    }, [isFiltering, checklistData, filteredData]);

    return (
        <div className='h-full'>
            <div className='flex flex-row w-full overflow-hidden'>
                <div className='flex flex-col w-1/3 border-r border-gray-300 pt-4 overflow-auto h-[71vh] border-b'>
                    {checklistData.length === 0 ? (
                        <React.Fragment>
                            <span className='text-base text-gray-400 flex items-center justify-center'>No data found</span>
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            <div className='flex justify-center w-full px-4 mb-4'>
                                <div className="relative w-full">
                                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                                        </svg>
                                    </div>
                                    <input 
                                        type="search" 
                                        className="block w-full p-3 pl-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
                                        placeholder="Search checklists..." 
                                        onChange={(e) => handleSearch(e)} 
                                        autoComplete='off'
                                    />
                                </div>
                            </div>

                            <div className='flex flex-col pt-6'>
                                <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                                    <Droppable droppableId="checklist-templates">
                                        {(provided) => (
                                            <div 
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className="flex flex-col w-full"
                                            >
                                                {list && list.map((item, index) => (
                                                    <Draggable key={item.id.toString()} draggableId={item.id.toString()} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={`py-2 border-b border-gray-300 flex flex-row justify-between items-center align-middle cursor-pointer
                                                                    ${snapshot.isDragging ? 'bg-blue-50 shadow-md' : 'hover:bg-gray-100'}
                                                                    transition-all duration-200`}
                                                                onClick={() => !isDragging && handleRowClick(item)}
                                                            >
                                                                <div 
                                                                    {...provided.dragHandleProps}
                                                                    className="px-2 cursor-grab hover:cursor-grabbing flex items-center"
                                                                    title="Drag to reorder"
                                                                >
                                                                    <div className="flex flex-col">
                                                                        <div className="flex space-x-1 mb-1">
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                        </div>
                                                                        <div className="flex space-x-1 mb-1">
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                        </div>
                                                                        <div className="flex space-x-1">
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                            <div className="w-1 h-1 rounded-full bg-gray-400"></div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className='flex flex-col px-2 flex-grow'>
                                                                    <span>{item.name}</span>
                                                                    <span className='text-xs text-gray-400'>Last updated on {moment(item.updatedAt).format('DD/MM/YYYY')}</span>
                                                                </div>
                                                                <div className='relative w-5 h-5 px-4 mr-2' onClick={(e) => handleBeforeDelete(e, item)}>
                                                                    <Image alt='' layout='fill' objectFit="contain" src="/icons/delete.png" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </div>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            </div>
                        </React.Fragment>
                    )}
                </div>
                <div className='flex flex-col w-4/6 p-4 border-r border-b border-gray-300 h-[71vh]'>
                    {!addEditMode || selectedData.length === 0 ? (
                        <div className='flex flex-col justify-center align-middle items-center h-96'>
                            <span className='text-base'>Add New Checklist</span>
                            <button className='border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' onClick={handleAddNew}>+ Add New</button>
                        </div>
                    ) : (
                        <React.Fragment>
                            {addEditMode && (
                                <AddEditChecklist data={selectedData} updateList={handleUpdateList} setShowPanel={setAddEditMode} onDelete={handleDelete} handleAddNew={handleAddNew} handleOnClose={handleOnClose} />
                            )}
                        </React.Fragment>
                    )}
                </div>
                {showWarningModal && <Modal title="Delete selected checklist?"
                    description="Selected checklist will be permanently removed."
                    onClose={() => {
                        setShowWarningModal(false)
                    }}
                    onConfirm={(e) => {
                        handleDelete(e, selectedData)
                        setShowWarningModal(false)
                    }} />}
            </div>
        </div>
    )
}

export default CheckList;
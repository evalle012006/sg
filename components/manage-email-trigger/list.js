import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { handleResponse } from '../../utilities/api/responseHandler';
import { EmailTriggerUpdateForm } from './updateForm';
import ToggleButton from '../ui/toggle';
import dynamic from 'next/dynamic';
const Table = dynamic(() => import('../ui/table'));

const EmailTriggerList = ({ refreshData }) => {
    const dispatch = useDispatch();
    const emailTriggerData = useSelector(state => state.emailTrigger.list);
    const [list, setList] = useState([]);
    const [isFiltering, setIsFiltering] = useState(false);
    const [filteredData, setFilteredData] = useState([]);
    const [selectedData, setSelectedData] = useState({});
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    const handleSearch = (e) => {
        const value = e.target.value.trim().toLowerCase();
        setIsFiltering(false);
        if (value) {
            setIsFiltering(true);
            const temp = list.filter(o => o?.recipient?.toLowerCase().includes(value));
            setFilteredData(temp);
            setList(temp);
        } else {
            setIsFiltering(false);
        }
    }

    const handleSave = async (supplier) => {
        if (supplier) {
            const response = await fetch('/api/email-triggers/update', {
                method: 'POST',
                body: JSON.stringify(supplier),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const resp = await handleResponse(response);

            if (resp.success) {
                toast.success("Email Trigger successfully saved.");
            }

            onClose();
        }
    }

    function showUpateModalHandler(data) {
        setSelectedData(data);
        setShowUpdateModal(prev => !prev);
    }

    const onClose = () => {
        refreshData();
        setSelectedData({});
        setShowUpdateModal(false);
    }

    const columns = useMemo(
        () => [
            {
                Header: "Recipient",
                accessor: "recipient"
            },
            {
                Header: "Email Template",
                accessor: "email_template_str"
            },
            {
                Header: () => {
                    return (
                        <div className="flex items-center justify-center">
                            <span>Trigger Questions</span>
                            <div className='relative group/info ml-2'>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                                </svg>
                                <div className='hidden group-hover/info:block absolute w-96 bottom-2 left-2 bg-black/50 p-2 py-3 rounded-md text-white'>List of all the questions and their required answer that trigger a notification to the recipient.</div>
                            </div>
                        </div>
                    );
                },
                accessor: "trigger_questions",
                Cell: function ({ row: { original } }) {
                    return (
                        <div className="flex flex-col">
                            {original.trigger_questions.map((question, index) => (
                                <div className="w-96 rounded-md p-1 m-1" key={index}>
                                    <p>{index + 1 + '. ' + question.question}</p>
                                    {question.answer && <p className='text-sm italic'>{'Answer: ' + question.answer}</p>}
                                </div>
                            ))}
                        </div>
                    );
                }
            },
            {
                Header: "Status",
                accessor: "enabled",
                Cell: function ({ row: { original } }) {
                    return (
                        <div className="w-fit" onClick={() => toggleEmailTriggerEnabled(original)}>
                            <ToggleButton status={original.enabled} />
                        </div>
                    );
                }
            },
            {
                Header: "Action",
                accessor: "action",
                Cell: function ({ row: { original } }) {
                    return (
                        <div className="flex ">
                            <button className="mr-4" onClick={showUpateModalHandler.bind(this, original)}>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth="1.5"
                                    stroke="currentColor"
                                    className="w-5 h-5"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                    />
                                </svg>
                            </button>
                        </div>
                    );
                },
            },
        ],
        []
    );

    useEffect(() => {
        if (isFiltering) {
            setList(filteredData);
        } else {
            setList(emailTriggerData);
        }
    }, [isFiltering]);

    useEffect(() => {
        setList(emailTriggerData);
    }, [emailTriggerData]);


    const toggleEmailTriggerEnabled = async (data) => {
        const response = await fetch('/api/email-triggers/update', {
            method: 'POST',
            body: JSON.stringify({ ...data, enabled: !data.enabled }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const resp = await handleResponse(response);

        if (resp.success) {
            toast.success("Email Trigger successfully updated.");
        }

        refreshData();
    }
    return (
        <div className='pt-4 pb-16'>
            <div className='flex flex-row justify-between'>
                <label className="relative block w-4/12 mb-6">
                    <span className="absolute inset-y-0 left-0 flex items-center p-3 pt-5 h-5">
                        <svg className="h-5 w-5 fill-black" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 30 30">
                            <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z"></path>
                        </svg>
                    </span>
                    <form>
                        <input className="w-full bg-white placeholder:font-italitc border border-slate-300 rounded-full py-2 pl-10 pr-4 focus:outline-none" onChange={(e) => handleSearch(e)} placeholder="Search" type="text" autoComplete='off' />
                    </form>
                </label>
            </div>
            <Table columns={columns} apiResult={list} />
            {showUpdateModal && (
                <div className={`z-50 w-3/4 h-3/4 absolute`}>
                    <EmailTriggerUpdateForm selectedData={selectedData} closeModal={onClose} saveData={handleSave} />
                </div>
            )}
        </div>
    )
}

export default EmailTriggerList;
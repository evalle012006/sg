import _ from "lodash";
import { GetField } from '../fields/index.js'
import React, { useEffect, useState } from "react";
import { toast } from 'react-toastify';
export default function BookingEditView({ booking, updateEditStatus }) {

    const [sections, setSections] = useState([]);
    const [changedQaPairs, setChangedQaPairs] = useState([]);

    useEffect(() => {
        let sortedSectionsList = {};

        booking.Sections.sort((a, b) => a.order - b.order)
        .map(section => {
            if (section.QaPairs.length > 0) {
                const pageTitle = section.QaPairs[0].Question.Section.Page.title;
                const pageId = section.QaPairs[0].Question.Section.Page.id;

                if (pageTitle && sortedSectionsList.hasOwnProperty(pageTitle)) {
                    sortedSectionsList[pageTitle].push({ pageId, section });
                } else {
                    sortedSectionsList[pageTitle] = [{ pageId, section }];
                }
            }
        });

        // Sort the keys based on page.id
        sortedSectionsList = Object.entries(sortedSectionsList)
            .sort((a, b) => a[1][0].pageId - b[1][0].pageId)
            .reduce((obj, [key, value]) => {
                obj[key] = value.map(({ section }) => section);
                return obj;
            }, {});
            console.log(sortedSectionsList)

        setSections(sortedSectionsList);
    }, [booking]);

    const returnGridColumns = (type) => {
        switch (type) {
            case 'rows':
                return 'grid-cols-1';
            case '2_columns':
                return 'grid-cols-2';
            case '3_columns':
                return 'grid-cols-3';
            case '4_columns':
                return 'grid-cols-4';
            default:
                return 'grid-cols-1';
        }
    }

    const updateChangedQaPairs = (qaPair) => {
        const changedQaPairsClone = [...changedQaPairs];
        const index = changedQaPairsClone.findIndex(q => q.id == qaPair.id);
        if (index > -1) {
            changedQaPairsClone[index] = qaPair;
        } else {
            changedQaPairsClone.push(qaPair);
        }
        setChangedQaPairs(changedQaPairsClone);
    }

    const updateQaPairs = async () => {
        const response = await fetch(`/api/booking-request-form/save-qa-pair`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(changedQaPairs)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong!');
        }
        setChangedQaPairs([]);
        toast("Booking updated successfully.", { type: 'success' });
        updateEditStatus(false)
        setTimeout(() => {
            location.reload();
        }, 1000);
    }

    return (
        <div className="flex flex-col h-screen">
            <div className="flex flex-row justify-between">
                <h1 className="text-sargood-blue text-lg font-bold mb-2">{_.startCase(booking.Rooms[0]?.RoomType.name)}</h1>
                <div className="flex flex-row justify-between">
                    <button className="font-bold" onClick={() => updateEditStatus(false)}>Cancel</button>
                    <button className="font-bold px-4 rounded text-white py-2 bg-sargood-blue ml-6" onClick={() => updateQaPairs()}>Update</button>
                </div>
            </div>

            <div className="overflow-x: auto">
                {Object.keys(sections).map((sectionTitle, index) =>
                    <div key={index} className="mt-4">
                        <div className="flex justify-between items-center">
                            <h1 className="text-2xl text-sargood-blue font-bold mt-10">{sectionTitle}</h1>
                        </div>
                        <div className="mt-4">
                            {sections[sectionTitle].map((section, secIdx) => {
                                return (
                                    <React.Fragment key={secIdx}>
                                        {section.QaPairs.some(qa => {
                                            if (typeof qa.answer == 'object' && qa.answer != null) {
                                                return qa.answer.length > 0
                                            } else {
                                                return qa.answer
                                            }
                                        }) && <div key={index} className={`bg-gray-100 p-4 my-6 rounded-md grid gap-4 ${returnGridColumns(section.type)}`}>
                                                {section.QaPairs.map((qa, qaIndex) => qa.answer && <div key={qaIndex}>
                                                    <QaPairFields key={qaIndex} qaPair={qa} onChange={(qaPair) => { updateChangedQaPairs(qaPair) }} />
                                                </div>)}
                                            </div>}
                                    </React.Fragment>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const QaPairFields = ({ qaPair, onChange }) => {
    const [qaPairState, setQaPairState] = useState(qaPair);

    const updateQaPairState = (qaPair) => {
        let updatedQaPair = { ...qaPair };
        if (qaPair.question_type == 'select' || qaPair.question_type == 'multi-select') {
            updatedQaPair.answer = qaPair.answer?.label;
        }

        setQaPairState(updatedQaPair);
        onChange(updatedQaPair);
    }

    const handleCheckboxQaPairChange = (option) => {
        const answer = JSON.parse(qaPairState.answer);
        if (answer) {
            if (answer.includes(option)) {
                updateQaPairState({ ...qaPairState, answer: JSON.stringify(answer.filter(a => a != option)) })
            } else {
                updateQaPairState({ ...qaPairState, answer: JSON.stringify([...answer, option]) })
            }
        }
    }

    const qaPairStateQuestionOptions = typeof qaPairState.Question.options == 'string' ? JSON.parse(qaPairState.Question.options) : qaPairState.Question.options;

    return (
        <div>
            {qaPairState.Question.type == 'radio' &&
                <>
                    <div className="flex flex-col w-full mr-32">
                        {qaPairState.label && <span className="font-bold text-sargood-blue text-xl mb-2">{qaPairState.label}</span>}
                        <div className="text-xs flex flex-row">
                            <span className="font-bold">{qaPairState.question}</span>
                            {qaPairState.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                        </div>
                        <div className="flex flex-col align-middle ml-4">
                            {qaPairStateQuestionOptions.map((option, optIdx) => {
                                return (
                                    <GetField key={optIdx} type='simple-radio'
                                        id={`radio-${option.value}-${qaPairState.id}`}
                                        name={`radio-${qaPairState.id}`}
                                        checked={option.label === qaPairState.answer}
                                        label={option.label} value={option.value}
                                        required={qaPairState.required ? true : false}
                                        onChange={(e) => updateQaPairState({ ...qaPairState, answer: e })} />
                                )
                            })}
                        </div>
                    </div>
                </>}
            {qaPairState.Question.type == 'checkbox' &&
                <>
                    <div className="flex flex-col w-full mr-32">
                        {qaPairState.label && <span className="font-bold text-sargood-blue text-xl mb-2">{qaPairState.label}</span>}
                        {qaPairStateQuestionOptions && qaPairStateQuestionOptions.length > 0 ? (
                            <>
                                <div className="text-xs flex flex-row">
                                    <span className="font-bold">{qaPairState.question}</span>
                                    {qaPairState.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                </div>
                                <div className="flex flex-col align-middle ml-4">
                                    {qaPairStateQuestionOptions.map((option, optIdx) => {
                                        return (
                                            <GetField key={optIdx} type='simple-checkbox' name={`checkbox-${optIdx}`}
                                                value={qaPairState.answer} label={option.label}
                                                checked={qaPairState.answer.includes(option.label)}
                                                required={qaPairState.required ? true : false}
                                                onChange={(option, value) => handleCheckboxQaPairChange(option, value)} />
                                        )
                                    })}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="text-xs flex flex-row ml-4">
                                    {qaPairState.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                    <GetField type='simple-checkbox' name={`checkbox-${qaPairState.id}`}
                                        value={qaPairState.answer}
                                        checked={qaPairState.answer}
                                        label={qaPairState.question}
                                        required={qaPairState.required ? true : false}
                                        onChange={(option, value) => handleCheckboxQaPairChange(option, value)} />
                                </div>
                            </>
                        )}
                    </div>
                </>}
            {qaPairState.Question.type != 'radio' && qaPairState.Question.type != 'checkbox' &&
                <>
                    <GetField type={qaPairState.Question.type}
                        label={qaPairState.question}
                        options={qaPairState.options ? qaPairState.options : qaPairState.Question.options}
                        value={qaPairState.answer}
                        onChange={(e) => { updateQaPairState({ ...qaPairState, answer: e }) }} />
                </>}
        </div>
    )
}
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { GetField } from "../fields/index";
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';

const QuestionPage = ({ updatePageData, guest, updateEquipmentData, equipmentChanges }) => {
    const dispatch = useDispatch();
    const currentPage = useSelector(state => state.bookingRequestForm.currentPage);
    const [updatedCurrentPage, setUpdatedCurrentPage] = useState();
    // Track user interaction per question
    const [questionInteractions, setQuestionInteractions] = useState({});

    const markQuestionAsInteracted = (secIdx, qIdx) => {
        const questionKey = `${secIdx}-${qIdx}`;
        setQuestionInteractions(prev => ({
            ...prev,
            [questionKey]: true
        }));
    };

    const updateSections = (value, field, secIdx, qIdx, equipments = [], error = false) => {
        const currentValue = currentPage.Sections[secIdx]?.Questions[qIdx]?.[field];
        const currentError = currentPage.Sections[secIdx]?.Questions[qIdx]?.error;
        
        const isSameValue = 
            (currentValue === value) || 
            (JSON.stringify(currentValue) === JSON.stringify(value));
        
        const isSameError = currentError === error;
        
        // If both value and error are the same, and no equipment changes, don't update
        if (isSameValue && isSameError && !equipments.length) {
            return;
        }
    
        let list = currentPage.Sections.map((section, index) => {
            let sTemp = { ...section };
            sTemp.dirty = true;
            sTemp.questionDependencies = [];
            sTemp.hideQuestionDependencies = [];
            if (index === secIdx) {
                sTemp.Questions = section.Questions.map((q, idx) => {
                    let qTemp = { ...q };
                    if (qIdx === idx) {
                        // ALWAYS set the error state first, regardless of field type
                        if (error !== false) {
                            qTemp.error = error;
                        } else if (error === false || error === null || error === '') {
                            qTemp.error = null;
                        }

                        if (qTemp.type === 'select' || qTemp.type === 'multi-select') {
                            qTemp[field] = value.label;
                            qTemp.dirty = true;
                        } else if (qTemp.type === 'checkbox') {
                            if (qTemp.options.length > 0) {
                                let currentAnswer = [];
                                if (qTemp?.has_not_available_option && value?.notAvailableFlag || (qTemp.answer && qTemp.answer.includes('Not Applicable'))) {
                                    qTemp.answer = null;
                                }
                                
                                if (qTemp.answer) {
                                    if (typeof qTemp.answer === 'string') {
                                        try {
                                            currentAnswer = JSON.parse(qTemp.answer);
                                        } catch (e) {
                                            console.error('Error parsing answer:', e);
                                            currentAnswer = [];
                                        }
                                    } else if (Array.isArray(qTemp.answer)) {
                                        currentAnswer = qTemp.answer;
                                    }
                                }
    
                                if (!Array.isArray(currentAnswer)) {
                                    currentAnswer = [];
                                }
    
                                if (value.value) {
                                    currentAnswer = [...currentAnswer, value.label];
                                } else {
                                    const answerIdx = currentAnswer.findIndex(a => a === value.label);
                                    if (answerIdx > -1) {
                                        currentAnswer = currentAnswer.filter(a => a !== value.label);
                                    }
                                }
    
                                qTemp[field] = currentAnswer;
                                qTemp.dirty = true;
                                const qTempOptions = typeof qTemp.options === 'string' ? JSON.parse(qTemp.options) : qTemp.options;
                                const updatedOptions = qTempOptions.map(option => {
                                    let o = { ...option };
                                    if (option.label === value.label) {
                                        o.value = value.value;
                                    }
    
                                    return o;
                                });
    
                                qTemp.options = updatedOptions;
                            } else {
                                qTemp.dirty = true;
                                qTemp[field] = value;
                            }
                        } else if (qTemp.type === 'checkbox-button') {
                            if (qTemp.options.length > 0) {
                                let currentAnswer = [];
                                if (qTemp?.has_not_available_option && value?.notAvailableFlag || (qTemp.answer && qTemp.answer.includes('Not Applicable'))) {
                                    qTemp.answer = null;
                                }
                                
                                if (qTemp.answer) {
                                    if (typeof qTemp.answer === 'string') {
                                        try {
                                            currentAnswer = JSON.parse(qTemp.answer);
                                        } catch (e) {
                                            console.error('Error parsing answer:', e);
                                            currentAnswer = [];
                                        }
                                    } else if (Array.isArray(qTemp.answer)) {
                                        currentAnswer = qTemp.answer;
                                    }
                                }
    
                                if (!Array.isArray(currentAnswer)) {
                                    currentAnswer = [];
                                }
    
                                if (value.value) {
                                    currentAnswer = [...currentAnswer, value.label];
                                } else {
                                    const answerIdx = currentAnswer.findIndex(a => a === value.label);
                                    if (answerIdx > -1) {
                                        currentAnswer = currentAnswer.filter(a => a !== value.label);
                                    }
                                }
    
                                qTemp[field] = currentAnswer;
                                qTemp.dirty = true;
                                const qTempOptions = typeof qTemp.options === 'string' ? JSON.parse(qTemp.options) : qTemp.options;
                                const updatedOptions = qTempOptions.map(option => {
                                    let o = { ...option };
                                    if (option.label === value.label) {
                                        o.value = value.value;
                                    }
    
                                    return o;
                                });
    
                                qTemp.options = updatedOptions;
                            } else {
                                qTemp.dirty = true;
                                qTemp[field] = value;
                            }
                        } else {
                            qTemp.dirty = true;
                            qTemp[field] = value;
                        }
    
                        if (qTemp.dirty && qTemp.prefill) {
                            qTemp.prefilledAnswerChange = true;
                        }
                    }
                    return qTemp;
                });
            }
    
            return sTemp;
        });
    
        if (equipments.length > 0) {
            updateEquipmentData(equipments);
        }
    
        setUpdatedCurrentPage({ ...currentPage, Sections: list, dirty: true });
    }

    useEffect(() => {
        if (updatedCurrentPage && updatedCurrentPage.dirty) {
            updatePageData(updatedCurrentPage.Sections);
        }
    }, [updatedCurrentPage]);

    useEffect(() => {
        // Function to handle autofill detection
        const detectAutofill = () => {
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                // Check if the input might have been autofilled
                if (input.value && !input.dataset.userFilled) {
                    const name = input.name;
                    const value = input.value;
                    
                    // Find the corresponding question field and update it
                    currentPage.Sections.forEach((section, sectionIndex) => {
                        section.Questions.forEach((question, questionIndex) => {
                            // Match by name, id, or question text
                            if (
                                (question.id && name === question.id) ||
                                (question.question && name === question.question)
                            ) {
                                updateSections(value, 'answer', sectionIndex, questionIndex);
                                input.dataset.userFilled = 'true';
                            }
                        });
                    });
                }
            });
        };
    
        // Run detection when component mounts or when page changes
        detectAutofill();
        
        // Also check after a slight delay to catch browser autofill
        const timer = setTimeout(detectAutofill, 500);
        
        return () => clearTimeout(timer);
    }, [currentPage]);

    return (
        <React.Fragment>
            <div className="w-full flex flex-col">
                <div className="min-h-screen flex flex-col w-full">
                    <div className="mt-2 px-8 py-4">
                        {currentPage && guest && currentPage.Sections.map((section, idx) => {
                            let s = { ...section };
                            const label = s.label;
                            const type = s.type;
                            let sec_css = '';

                            switch (type) {
                                case 'row':
                                case 'rows':
                                    sec_css = 'flex flex-col';
                                    break;
                                case '2_columns':
                                    sec_css = 'grid grid-cols-1 sm:grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4';
                                    break;
                                case '3_columns':
                                    sec_css = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4';
                                    break;
                                case '4_columns':
                                    sec_css = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4';
                                    break;
                                default:
                                    break;
                            }

                            return (
                                <div key={idx} className={`flex flex-col ${s.hidden && 'hidden'}`}>
                                    <div className={`${sec_css} p-2 mb-6 w-full`}>
                                        {s.Questions && s.Questions.map((question, index) => {
                                            let q = { ...question };
                                            const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                                            const details = typeof q.details === 'string' ? JSON.parse(q.details) : q.details;
                                            const url = q.url ? q.url : '';

                                            const fieldIdx = `${q.id || q.question}-index`;
                                            const questionKey = `${idx}-${index}`;
                                            const hasUserInteracted = questionInteractions[questionKey];

                                            // UPDATED: Improved array handling for checkbox and checkbox-button types
                                            if (q.type === "checkbox" || q.type === 'simple-checkbox') {
                                                if (options && options.length > 0) {
                                                    // Ensure answer is always an array for multi-option checkboxes
                                                    if (!Array.isArray(q.answer)) {
                                                        if (typeof q.answer === 'string' && q.answer.trim()) {
                                                            try {
                                                                // Only try to parse if it looks like JSON
                                                                if (q.answer.startsWith('[') || q.answer.startsWith('{')) {
                                                                    q.answer = JSON.parse(q.answer);
                                                                } else {
                                                                    q.answer = [];
                                                                }
                                                            } catch (error) {
                                                                console.error('Error parsing JSON:', error);
                                                                q.answer = [];
                                                            }
                                                        } else {
                                                            q.answer = [];
                                                        }
                                                    }
                                                } else {
                                                    q.answer = q.answer ? q.answer : false;
                                                }
                                            }

                                            // UPDATED: Same improved array handling for checkbox-button
                                            if (q.type === "checkbox-button") {
                                                if (options && options.length > 0) {
                                                    // Ensure answer is always an array for multi-option checkbox-buttons
                                                    if (!Array.isArray(q.answer)) {
                                                        if (typeof q.answer === 'string' && q.answer.trim()) {
                                                            try {
                                                                // Only try to parse if it looks like JSON
                                                                if (q.answer.startsWith('[') || q.answer.startsWith('{')) {
                                                                    q.answer = JSON.parse(q.answer);
                                                                } else {
                                                                    q.answer = [];
                                                                }
                                                            } catch (error) {
                                                                console.error('Error parsing JSON:', error);
                                                                q.answer = [];
                                                            }
                                                        } else {
                                                            q.answer = [];
                                                        }
                                                    }
                                                    // If q.answer is already an array (like from profile data), keep it as-is
                                                } else {
                                                    q.answer = q.answer ? q.answer : false;
                                                }
                                            }

                                            const handleCardSelectionFieldChange = (value, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(value, 'answer', secIdx, qIdx);
                                            }

                                            if (q.type === "health-info") {
                                                q.answer = q.answer ? JSON.parse(q.answer) : [];
                                            }

                                            // Helper function to get validation styling for checkbox containers
                                            const getCheckboxContainerClasses = () => {
                                                if (q.error) {
                                                    return 'border-red-400 bg-red-50';
                                                }
                                                // Only show success state if user has interacted AND there's an answer AND it's required
                                                if (hasUserInteracted && q.required && q.answer && 
                                                    ((Array.isArray(q.answer) && q.answer.length > 0) || 
                                                     (typeof q.answer === 'boolean' && q.answer) ||
                                                     (typeof q.answer === 'string' && q.answer.trim()))) {
                                                    return 'border-green-400 bg-green-50';
                                                }
                                                return 'border-gray-300 bg-white';
                                            };

                                            const handleTextNumberFieldChange = (e, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(e, 'answer', secIdx, qIdx);
                                            }

                                            const handleSelectFieldChange = (e, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(e, 'answer', secIdx, qIdx);
                                            }

                                            const handleDateFieldChange = (e, secIdx, qIdx, checkInQuestion, checkOutQuestion, error) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                if (checkInQuestion) {
                                                    dispatch(bookingRequestFormActions.setCheckinDate(e))
                                                }
                                                if (checkOutQuestion) {
                                                    dispatch(bookingRequestFormActions.setCheckoutDate(e))
                                                }

                                                // Pass the error to updateSections - it will handle setting the error state
                                                // Convert empty error to null for consistency
                                                const errorToPass = error && error.trim() !== '' ? error : null;
                                                updateSections(e, 'answer', secIdx, qIdx, [], errorToPass);
                                            }

                                            const handleCheckboxFieldChange = (e, status, flag, secIdx, qIdx, simple) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                let answer;
                                                if (simple) {
                                                    answer = status;
                                                } else {
                                                    answer = { label: e, value: status, notAvailableFlag: flag };
                                                }
                                                updateSections(answer, 'answer', secIdx, qIdx);
                                            }

                                            const handleRadioButtonFieldChange = (e, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(e, 'answer', secIdx, qIdx);
                                            }

                                            const handleFileUploadChange = async (e, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(e, 'answer', secIdx, qIdx);
                                            }

                                            const handleHealthInfoFieldChange = (label, list, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                let answer = [];
                                                list.map((item) => {
                                                    if (item.value) {
                                                        answer.push(item.label);
                                                    }
                                                });
                                                updateSections(answer, 'answer', secIdx, qIdx);
                                            }

                                            const handleRoomFieldChange = (value, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                // Pass the error to updateSections similar to how date, phone, and email fields work
                                                const errorToPass = error && error.trim() !== '' ? error : null;
                                                updateSections(value, 'answer', secIdx, qIdx, [], errorToPass);
                                            }

                                            const handleEquipmentFieldChange = (label, secIdx, qIdx, changes) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(label, 'answer', secIdx, qIdx, changes);
                                            }

                                            const handleGoalTableChange = (goalSelected, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(goalSelected, 'answer', secIdx, qIdx, [], error);
                                            }

                                            const handleCareTableChange = (careData, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(careData, 'answer', secIdx, qIdx, [], error);
                                            }

                                            const handlePhoneNumberFieldChange = (value, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                const errorToPass = error && error.trim() !== '' ? error : null;
                                                updateSections(value, 'answer', secIdx, qIdx, [], errorToPass);
                                            }

                                            const handleEmailFieldChange = (value, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                // Pass the error to updateSections similar to how date and phone fields work
                                                const errorToPass = error && error.trim() !== '' ? error : null;
                                                updateSections(value, 'answer', secIdx, qIdx, [], errorToPass);
                                            }

                                            return (
                                                <div key={index} className="flex flex-col mb-4">
                                                    {((q.type === 'url') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField  key={q.id} type='url' width='100%' url={details.url} error={q.error} label={details.label} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'rich-text') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='rich-text' width='100%' description={typeof q.details == 'string' ? JSON.parse(q.details)?.description : q.details.description} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'string' || q.type === 'text') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='text' 
                                                                        defaultValue={q.answer ? q.answer : ''}
                                                                        width='100%' 
                                                                        placeholder={q.question} 
                                                                        error={q.error} 
                                                                        required={q.required ? true : false} 
                                                                        name={fieldIdx}
                                                                        id={fieldIdx}
                                                                        autoComplete="on"
                                                                        onBlur={(e) => handleTextNumberFieldChange(e, idx, index)} 
                                                                        onChange={(e) => handleTextNumberFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'email' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField 
                                                                        key={q.id} 
                                                                        type='email' 
                                                                        defaultValue={q.answer ? q.answer : ''} 
                                                                        width='100%' 
                                                                        placeholder={q.question} 
                                                                        error={q.error} 
                                                                        required={q.required ? true : false} 
                                                                        onBlur={(value, error) => handleEmailFieldChange(value, error, idx, index)}
                                                                        onChange={(value, error) => handleEmailFieldChange(value, error, idx, index)} 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'phone-number' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField 
                                                                        key={q.id} 
                                                                        type='phone-number' 
                                                                        defaultValue={q.answer ? q.answer : ''} 
                                                                        width='100%' 
                                                                        placeholder={q.question} 
                                                                        error={q.error} 
                                                                        required={q.required ? true : false} 
                                                                        onBlur={(value, error) => handlePhoneNumberFieldChange(value, error, idx, index)}
                                                                        onChange={(value, error) => handlePhoneNumberFieldChange(value, error, idx, index)} 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'select' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full justify-between">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='select' value={q.answer} width='100%' required={q.required ? true : false} options={options} error={q.error} onChange={(e) => handleSelectFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'multi-select' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row mb-6">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='multi-select' value={q.answer} width='100%' placeholder={q.question} required={q.required ? true : false} error={q.error} options={options} onChange={(e) => handleSelectFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'year' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='year' defaultValue={q.answer ? q.answer : ''} width='100%' error={q.error} required={q.required ? true : false} onBlur={(e) => handleTextNumberFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'date' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500  ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='date' 
                                                                        name={q.question == "Check In Date" ? "checkinDate" : q.question == "Check Out Date" ? "checkoutDate" : null}
                                                                        value={q.answer} 
                                                                        width='100%' 
                                                                        placeholder={q.question} 
                                                                        required={q.required ? true : false} 
                                                                        error={q.error} 
                                                                        allowPrevDate={q.question !== "Check In Date" && q.question !== "Check Out Date"}
                                                                        onChange={(e, error) => handleDateFieldChange(e, idx, index, q.question == 'Check In Date', q.question == 'Check Out Date', error)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'date-range' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='date-range'
                                                                        value={q.answer}
                                                                        width='100%'
                                                                        placeholder={q.question}
                                                                        required={q.required ? true : false}
                                                                        error={q.error}
                                                                        allowPrevDate={q.question !== "Check In Date and Check Out Date"}
                                                                        onChange={(e, error) => handleDateFieldChange(e, idx, index, false, false, error)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'integer' || q.type === 'number') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='integer' defaultValue={q.answer} width='100%' placeholder={q.question} required={q.required ? true : false} error={'Required field. Please input value.'} onBlur={(e) => handleTextNumberFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'checkbox' || q.type === 'simple-checkbox') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                {options && options.length > 0 ? (
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            <span className="font-bold">{q.question}</span>
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                        </div>
                                                                        {/* Add container styling around the checkbox group with updated validation logic */}
                                                                        <div className={`flex flex-col align-middle mt-2 rounded-lg border transition-all duration-200 p-3 ${getCheckboxContainerClasses()}`}>
                                                                            {options.map((option, optIdx) => {
                                                                                const checkboxUuid = uuidv4();
                                                                                return (
                                                                                    <GetField 
                                                                                        key={checkboxUuid} 
                                                                                        type='simple-checkbox'
                                                                                        bold={options.length === 1}
                                                                                        name={`checkbox-${index}-${idx}-${checkboxUuid}`}
                                                                                        value={
                                                                                            q.answer && Array.isArray(q.answer)
                                                                                                ? q.answer.includes(option.label)
                                                                                                : false
                                                                                        }
                                                                                        label={option.label}
                                                                                        checked={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        required={q.required ? true : false}
                                                                                        notAvailableFlag={option?.notAvailableFlag ? true : false}
                                                                                        // Remove individual error prop since we handle at group level
                                                                                        onChange={(e, s, f) => handleCheckboxFieldChange(e, s, f, idx, index)}
                                                                                    />
                                                                                )
                                                                            })}
                                                                        </div>
                                                                        {/* Group-level error message */}
                                                                        {q.error && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">{q.error}</p>
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                ) : (
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {/* Single checkbox with container styling and updated validation logic */}
                                                                            <div className={`rounded-lg border transition-all duration-200 p-2 ${getCheckboxContainerClasses()}`}>
                                                                                <GetField 
                                                                                    key={q.id} 
                                                                                    type='simple-checkbox' 
                                                                                    name={`checkbox-${index}-${idx}`} 
                                                                                    value={q.answer} 
                                                                                    checked={q.answer} 
                                                                                    label={q.question} 
                                                                                    required={q.required ? true : false} 
                                                                                    onChange={(e, s) => handleCheckboxFieldChange(e, s, false, idx, index, true)} 
                                                                                />
                                                                            </div>
                                                                            {/* Group-level error message for single checkbox */}
                                                                            {q.error && (
                                                                                <div className="mt-1.5 flex items-center">
                                                                                    <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    <p className="text-red-600 text-sm font-medium">{q.error}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </React.Fragment>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'checkbox-button') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                {options && options.length > 0 ? (
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            <span className="font-bold">{q.question}</span>
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                        </div>
                                                                        {/* Button mode container with flex-wrap for horizontal layout */}
                                                                        <div className={`flex flex-wrap gap-1 align-middle mt-2 rounded-lg border transition-all duration-200 p-3 ${getCheckboxContainerClasses()}`}>
                                                                            {options.map((option, optIdx) => {
                                                                                const checkboxUuid = uuidv4();
                                                                                return (
                                                                                    <GetField 
                                                                                        key={checkboxUuid} 
                                                                                        type='simple-checkbox'
                                                                                        mode="button" // Force button mode
                                                                                        size="small" // Default to small for button mode
                                                                                        bold={options.length === 1}
                                                                                        name={`checkbox-button-${index}-${idx}-${checkboxUuid}`}
                                                                                        value={
                                                                                            q.answer && Array.isArray(q.answer)
                                                                                                ? q.answer.includes(option.label)
                                                                                                : false
                                                                                        }
                                                                                        label={option.label}
                                                                                        checked={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        required={q.required ? true : false}
                                                                                        notAvailableFlag={option?.notAvailableFlag ? true : false}
                                                                                        // Remove individual error prop since we handle at group level
                                                                                        onChange={(e, s, f) => handleCheckboxFieldChange(e, s, f, idx, index)}
                                                                                    />
                                                                                )
                                                                            })}
                                                                        </div>
                                                                        {/* Group-level error message */}
                                                                        {q.error && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">{q.error}</p>
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                ) : (
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {/* Single checkbox button with container styling */}
                                                                            <div className={`rounded-lg border transition-all duration-200 p-2 ${getCheckboxContainerClasses()}`}>
                                                                                <GetField 
                                                                                    key={q.id} 
                                                                                    type='simple-checkbox' 
                                                                                    mode="button" // Force button mode
                                                                                    size="medium" // Medium size for single button
                                                                                    name={`checkbox-button-${index}-${idx}`} 
                                                                                    value={q.answer} 
                                                                                    checked={q.answer} 
                                                                                    label={q.question} 
                                                                                    required={q.required ? true : false} 
                                                                                    onChange={(e, s) => handleCheckboxFieldChange(e, s, false, idx, index, true)} 
                                                                                />
                                                                            </div>
                                                                            {/* Group-level error message for single checkbox button */}
                                                                            {q.error && (
                                                                                <div className="mt-1.5 flex items-center">
                                                                                    <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                    </svg>
                                                                                    <p className="text-red-600 text-sm font-medium">{q.error}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </React.Fragment>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'radio' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                {/* Add container styling around the radio group with success state and updated validation logic */}
                                                                <div className={`flex flex-col align-middle mt-2 rounded-lg border transition-all duration-200 p-3 ${getCheckboxContainerClasses()}`}>
                                                                    {options && options.map((option, optIdx) => {
                                                                        const radioUuid = uuidv4();
                                                                        return (
                                                                            <GetField 
                                                                                key={radioUuid} 
                                                                                type='simple-radio' 
                                                                                id={`radio-${option.value}-${index}`} 
                                                                                name={`radio-${index}-${idx}-${radioUuid}`} 
                                                                                checked={option.label === q.answer} 
                                                                                label={option.label} 
                                                                                value={option.value} 
                                                                                required={q.required ? true : false} 
                                                                                // Remove individual error prop since we handle at group level
                                                                                onChange={(e) => handleRadioButtonFieldChange(e, idx, index)} 
                                                                            />
                                                                        )
                                                                    })}
                                                                </div>
                                                                {/* Group-level error message */}
                                                                {q.error && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">{q.error}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'time' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500  ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle ml-2">
                                                                    <GetField key={q.id} type='time' value={q.answer} min="14:00" max="18:00" placeholder={q.question} error={q.error} invalidTimeErrorMsg={"Please enter a time between 2pm - 10pm"} required={q.required ? true : false} onChange={(e) => handleDateFieldChange(e, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'file-upload' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='file-upload' value={q.answer ? q.answer : ''} url={url} width='100%' error={q.error} required={q.required ? true : false} onChange={(e) => handleFileUploadChange(e, idx, index)} fileType={`booking_request_form/${guest.id}/`} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'health-info' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='health-info' options={options} width='100%' error="Required field" required={q.required ? true : false} onChange={(label, list) => handleHealthInfoFieldChange(label, list, idx, index)} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'rooms' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='rooms' 
                                                                    label={q.question} 
                                                                    value={q.answer ? JSON.parse(q.answer) : q.answer} 
                                                                    width='100%' 
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    onChange={(value, error) => handleRoomFieldChange(value, error, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'equipment' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <GetField key={q.id} type='equipment' label={q.question} value={q.answer} width='100%' error="Required field" required={q.required ? true : false} equipmentChanges={equipmentChanges} onChange={(value, changes) => handleEquipmentFieldChange(value, idx, index, changes)} />
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'radio-ndis' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <div className="flex flex-col align-middle mt-2">
                                                                    {options && options.map((option, optIdx) => {
                                                                        const radioUuid = uuidv4();
                                                                        return (
                                                                            <GetField key={radioUuid} index={optIdx} type='simple-radio-ndis' id={`radio-${option.value}-${index}`} name={`radio-${index}-${idx}-${radioUuid}`} checked={option.label === q.answer} label={option.label} value={option.value} required={q.required ? true : false} error={q.error} onChange={(e) => handleRadioButtonFieldChange(e, idx, index)} />
                                                                        )
                                                                    })}
                                                                    {q.error && <p className="mt-1.5 text-red-500 text-xs">{q.error}</p>}
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'goal-table' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField type='goal-table'
                                                                    name={`goal-table`}
                                                                    value={q.answer}
                                                                    required={q.required ? true : false}
                                                                    onChange={(goalSelected, error) => handleGoalTableChange(goalSelected, error, idx, index)}
                                                                />
                                                                {q.error && <p className="mt-1.5 text-red-500 text-xs">{q.error}</p>}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'care-table' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField type='care-table'
                                                                    name={`care-table`}
                                                                    value={q.answer}
                                                                    required={q.required ? true : false}
                                                                    onChange={(careData, error) => handleCareTableChange(careData, error, idx, index)}
                                                                />
                                                                {q.error && <p className="mt-1.5 text-red-500 text-xs">{q.error}</p>}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'card-selection' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='card-selection' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    option_type={q.option_type}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'card-selection-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='card-selection-multi' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    option_type={q.option_type}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'horizontal-card' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='horizontal-card' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    option_type={q.option_type}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'horizontal-card-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='horizontal-card-multi' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    option_type={q.option_type}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'package-selection' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='package-selection' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    funder={(typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.funder || 'NDIS'}
                                                                    ndis_package_type={(typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'package-selection-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='package-selection-multi' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    funder={(typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.funder || 'NDIS'}
                                                                    ndis_package_type={(typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </React.Fragment>
    )
}

export default QuestionPage;
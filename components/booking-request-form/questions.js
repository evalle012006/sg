import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { GetField } from "../fields/index";
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import { QUESTION_KEYS, questionHasKey } from "../../services/booking/question-helper";

const QuestionPage = ({ 
    currentPage, 
    updatePageData, 
    guest, 
    updateEquipmentData, 
    equipmentChanges,
    funderType = null,
    ndisPackageType = null,
    additionalFilters = {},
    updateAndDispatchPageDataImmediate
}) => {
    const dispatch = useDispatch();
    const [updatedCurrentPage, setUpdatedCurrentPage] = useState();
    // Track user interaction per question
    const [questionInteractions, setQuestionInteractions] = useState({});
    const updateTimeoutRef = useRef({});
    const mountedRef = useRef(true);

    const [localFilterState, setLocalFilterState] = useState({
        funderType: funderType,
        ndisPackageType: ndisPackageType,
        additionalFilters: additionalFilters
    });

    useEffect(() => {
        setLocalFilterState({
            funderType: funderType,
            ndisPackageType: ndisPackageType,
            additionalFilters: additionalFilters
        });
    }, [funderType, ndisPackageType, additionalFilters]);

    const markQuestionAsInteracted = (secIdx, qIdx) => {
        const questionKey = `${secIdx}-${qIdx}`;
        setQuestionInteractions(prev => {
            if (prev[questionKey]) return prev;
            return { ...prev, [questionKey]: true };
        });
    };

    // NEW: Function to calculate filters based on current page answers
    const calculateLocalFilters = (pageData) => {
        let newFunderType = localFilterState.funderType;
        let newNdisPackageType = localFilterState.ndisPackageType;
        
        if (!pageData || !pageData.Sections) return localFilterState;
        
        console.log('Calculating local filters for page:', pageData.title);
        
        // Check answers in current page
        for (const section of pageData.Sections) {
            for (const question of section.Questions || []) {
                // Check funding source
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                    if (question.answer?.toLowerCase().includes('ndis') || question.answer?.toLowerCase().includes('ndia')) {
                        newFunderType = 'NDIS';
                        console.log('✅ NDIS funding detected');
                    } else {
                        newFunderType = 'Non-NDIS';
                        newNdisPackageType = null; // Clear NDIS package type for non-NDIS
                        console.log('✅ Non-NDIS funding detected');
                    }
                }
                
                // Only process NDIS package type logic if NDIS funded
                if (newFunderType === 'NDIS') {
                    // Questions that lead to holiday packages
                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_ALONE) && 
                        question.answer === 'Yes') {
                        newNdisPackageType = 'holiday';
                        console.log('✅ Holiday package: Lives alone');
                    }
                    
                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_IN_SIL) && 
                        question.answer === 'Yes') {
                        newNdisPackageType = 'holiday';
                        console.log('✅ Holiday package: Lives in SIL');
                    }
                    
                    if (questionHasKey(question, QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS) && 
                        question.answer === 'Yes') {
                        newNdisPackageType = 'holiday';
                        console.log('✅ Holiday package: Staying with informal supports');
                    }
                    
                    // Question that leads to STA packages (takes precedence)
                    if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT) && 
                        question.answer === 'Yes') {
                        newNdisPackageType = 'sta';
                        console.log('✅ STA package: STA is stated support (takes precedence)');
                    }
                }
            }
        }
        
        // Default NDIS package type if none determined
        if (newFunderType === 'NDIS' && !newNdisPackageType) {
            newNdisPackageType = 'sta'; // Default to STA
            console.log('✅ Default to STA package type');
        }
        
        const newFilters = {
            funderType: newFunderType,
            ndisPackageType: newNdisPackageType,
            additionalFilters: localFilterState.additionalFilters
        };
        
        console.log('📊 Local filters calculated:', newFilters);
        return newFilters;
    };

    const updateSections = (value, field, secIdx, qIdx, equipments = [], error = false) => {
        const currentValue = currentPage.Sections[secIdx]?.Questions[qIdx]?.[field];
        const currentError = currentPage.Sections[secIdx]?.Questions[qIdx]?.error;
        const question = currentPage.Sections[secIdx]?.Questions[qIdx];
        
        const isSameValue = 
            (currentValue === value) || 
            (JSON.stringify(currentValue) === JSON.stringify(value));
        
        const isSameError = currentError === error;
        
        const affectsOtherQuestions = () => {
            if (!question) return false;
            
            // Check if any other questions depend on this question
            const questionId = question.question_id || question.id;
            const questionKey = question.question_key;
            
            // Search through all pages to see if any questions depend on this one
            return currentPage.Sections?.some(section =>
                section.Questions?.some(otherQuestion =>
                    otherQuestion.QuestionDependencies?.some(dep =>
                        dep.dependence_id === questionId ||
                        dep.dependence_id === question.id ||
                        dep.dependence_id === questionKey
                    )
                )
            );
        };
        
        // FIXED: Don't skip update if this question affects dependencies, even if value seems same
        if (isSameValue && isSameError && !equipments.length && !affectsOtherQuestions()) {
            console.log(`⏭️ Skipping update - same value and no dependency impact for question: ${question?.question}`);
            return;
        }

        // ENHANCED: Log when we're updating a question that affects dependencies
        if (affectsOtherQuestions()) {
            console.log(`🔗 Updating question with dependencies: "${question?.question}" from "${currentValue}" to "${value}"`);
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
                        } else if (['card-selection', 'card-selection-multi', 'horizontal-card', 'horizontal-card-multi', 'package-selection', 'package-selection-multi'].includes(qTemp.type)) {
                            qTemp.dirty = true;
                            qTemp[field] = value;
                            console.log('Card/Package selection updated:', { type: qTemp.type, field, value }); // Debug log
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
        
        const updatedPageData = { ...currentPage, Sections: list, dirty: true };
        
        // Calculate filters for this page update and update local state
        const newFilters = calculateLocalFilters(updatedPageData);
        if (JSON.stringify(newFilters) !== JSON.stringify(localFilterState)) {
            console.log('🔄 Question answered, updating local filters:', newFilters);
            setLocalFilterState(newFilters);
        }

        setUpdatedCurrentPage(updatedPageData);
        
        // ENHANCED: Force immediate dependency refresh for questions that affect other questions
        if (affectsOtherQuestions()) {
            console.log('🔄 Question affects dependencies, forcing immediate update');
            // Clear any pending timeouts and force immediate update
            Object.values(updateTimeoutRef.current).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
            
            // Use a very short timeout to allow React to process the state update
            setTimeout(() => {
                updatePageData(updatedPageData.Sections, currentPage.id);
            }, 10);
        }
    }

    useEffect(() => {
        if (updatedCurrentPage && updatedCurrentPage.dirty) {
            // Check if this update involves questions with dependencies
            const hasDependencyQuestions = updatedCurrentPage.Sections?.some(section =>
                section.Questions?.some(question => {
                    // Check if this question has dependencies OR affects other questions
                    const hasDependencies = question.QuestionDependencies && question.QuestionDependencies.length > 0;
                    const questionId = question.question_id || question.id;
                    const questionKey = question.question_key;
                    
                    // Check if any other question depends on this one
                    const affectsOthers = updatedCurrentPage.Sections?.some(otherSection =>
                        otherSection.Questions?.some(otherQuestion =>
                            otherQuestion.QuestionDependencies?.some(dep =>
                                dep.dependence_id === questionId ||
                                dep.dependence_id === question.id ||
                                dep.dependence_id === questionKey
                            )
                        )
                    );
                    
                    return hasDependencies || affectsOthers;
                })
            );
            
            if (hasDependencyQuestions) {
                console.log('🔗 Update involves dependency questions, ensuring immediate processing');
                // Use immediate update for dependency-related changes
                updateAndDispatchPageDataImmediate?.(updatedCurrentPage.Sections, currentPage.id) || updatePageData(updatedCurrentPage.Sections);
            } else {
                updatePageData(updatedCurrentPage.Sections);
            }
        }
    }, [updatedCurrentPage]);


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

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            Object.values(updateTimeoutRef.current).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
        };
    }, []);

    const supportedQuestionTypes = [
        'url', 'rich-text', 'string', 'text', 'email', 'phone-number', 'select', 
        'multi-select', 'year', 'date', 'date-range', 'integer', 'number', 
        'checkbox', 'simple-checkbox', 'checkbox-button', 'radio', 'time', 
        'file-upload', 'health-info', 'rooms', 'equipment', 'radio-ndis', 
        'goal-table', 'care-table', 'card-selection', 'card-selection-multi', 
        'horizontal-card', 'horizontal-card-multi', 'package-selection', 
        'package-selection-multi'
    ];

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
                                        {s.Questions && s.Questions
                                            .filter(question => {
                                                // Must be a supported question type
                                                if (!supportedQuestionTypes.includes(question.type)) {
                                                    return false;
                                                }
                                                
                                                // For questions with question text, it must not be empty
                                                if (question.question && question.question.trim() !== '') {
                                                    return true;
                                                }
                                                
                                                // For questions without question text, check if they have other content
                                                // This handles cases like checkbox questions where the text is in the options
                                                if (!question.question || question.question.trim() === '') {
                                                    // Allow questions that have options with labels (like checkboxes)
                                                    if (question.options && question.options.length > 0) {
                                                        return question.options.some(option => option.label && option.label.trim() !== '');
                                                    }
                                                    
                                                    // Allow questions that have a label
                                                    if (question.label && question.label.trim() !== '') {
                                                        return true;
                                                    }
                                                    
                                                    // Allow specific question types that might not need question text
                                                    const questionsTypesWithoutText = ['simple-checkbox', 'checkbox'];
                                                    if (questionsTypesWithoutText.includes(question.type)) {
                                                        return true;
                                                    }
                                                }
                                                
                                                return false;
                                            })
                                            .map((question, index) => {
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
                                                console.log("Card selection changed:", value);
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                // Clear any existing error immediately for card selections
                                                const currentQuestion = currentPage.Sections[secIdx]?.Questions[qIdx];
                                                if (currentQuestion && value && (value !== null && value !== undefined && value !== '')) {
                                                    updateSections(value, 'answer', secIdx, qIdx, [], null); // Pass null to clear error
                                                } else {
                                                    updateSections(value, 'answer', secIdx, qIdx);
                                                }
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
                                            };

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
                                                            <div className="flex flex-col w-full flex-1" id={q.id}>
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
                                                                    guestId={guest?.id}
                                                                    bookingId={guest?.id} // fallback
                                                                    currentUser={guest} // fallback
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
                                                                    guestId={guest?.id}
                                                                    bookingId={guest?.id} // fallback
                                                                    currentUser={guest} // fallback
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
                                                                    guestId={guest?.id}
                                                                    bookingId={guest?.id} // fallback
                                                                    currentUser={guest} // fallback
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
                                                                    guestId={guest?.id}
                                                                    bookingId={guest?.id} // fallback
                                                                    currentUser={guest} // fallback
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
                                                                    // Use local filter state for immediate updates
                                                                    funder={localFilterState.funderType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.funder || 'NDIS'}
                                                                    ndis_package_type={localFilterState.ndisPackageType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    additionalFilters={localFilterState.additionalFilters}
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
                                                                    // Use local filter state for immediate updates
                                                                    funder={localFilterState.funderType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.funder || 'NDIS'}
                                                                    ndis_package_type={localFilterState.ndisPackageType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    additionalFilters={localFilterState.additionalFilters}
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
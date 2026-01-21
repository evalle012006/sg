import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { GetField } from "../fields/index";
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import { findByQuestionKey, generateQuestionKey, QUESTION_KEYS, questionHasKey } from "../../services/booking/question-helper";
import { getCrossValidationValue } from "../../utilities/dateUtils";
import { getInfantCareQuestionMapping } from "../../utilities/bookingRequestForm";
import { useAutofillDetection } from '../../hooks/useAutofillDetection';
import TooltipIcon from "../ui-v2/TooltipIcon";
import parse from 'html-react-parser';
import { processCheckboxAnswerWithNoneLogic } from "../../utilities/checkboxHelpers";

const QuestionPage = ({ 
    currentPage, 
    allPages = [],
    updatePageData, 
    guest, 
    updateEquipmentData, 
    equipmentChanges,
    funderType = null,
    funder = null,
    ndisPackageType = null,
    additionalFilters = {},
    updateAndDispatchPageDataImmediate,
    careAnalysisData = null,
    courseAnalysisData = null,
    packageFilterCriteria = {},
    enhancedFormData = {},
    stayDates = { checkInDate: null, checkOutDate: null },
    courseOffers = [],
    courseOffersLoaded = false,
    onCareQuestionUpdate = null,
    isCareRelatedQuestion = null,
    selectedCourseOfferId = null,
    validateDatesWithExistingAPI = null,
    infantCareQuantities = {},
    validationAttempted = false,
    onStayDatesUpdate = null,
    equipmentFieldRef,
    onEquipmentValidationChange,
    isConfirmedBooking = false,
    origin = null,
}) => {
    const dispatch = useDispatch();
    const [updatedCurrentPage, setUpdatedCurrentPage] = useState();
    // Track user interaction per question
    const [questionInteractions, setQuestionInteractions] = useState({});
    const updateTimeoutRef = useRef({});
    const mountedRef = useRef(true);

    const isHtmlContent = (text) => {
        if (!text) return false;
        return /<[a-z][\s\S]*>/i.test(text);
    };

    const [localFilterState, setLocalFilterState] = useState({
        funderType: funderType,
        ndisPackageType: ndisPackageType,
        additionalFilters: additionalFilters
    });

    const handleAutofillDetected = useCallback((fieldId, value, fieldData) => {
        // console.log('📝 Autofill callback - marking question as interacted:', {
        //     fieldId,
        //     sectionIndex: fieldData.sectionIndex,
        //     questionIndex: fieldData.questionIndex
        // });
        
        const interactionKey = `${fieldData.sectionIndex}-${fieldData.questionIndex}`;
        
        setQuestionInteractions(prev => {
            if (prev[interactionKey]) return prev;
            // console.log('✅ Marking autofilled field as interacted:', interactionKey);
            return { ...prev, [interactionKey]: true };
        });
    }, []);

    // Initialize autofill detection with callback
    useAutofillDetection({
        onAutofillDetected: handleAutofillDetected
    });

    const questionInteractionsRef = useRef({});
    const lastPageIdRef = useRef(currentPage?.id);

    // Sync ref with state
    useEffect(() => {
        questionInteractionsRef.current = questionInteractions;
    }, [questionInteractions]);

    // Reset interactions only when page ID actually changes
    useEffect(() => {
        if (currentPage?.id && lastPageIdRef.current !== currentPage.id) {
            console.log('📄 Page changed from', lastPageIdRef.current, 'to', currentPage.id, '- resetting interactions');
            setQuestionInteractions({});
            questionInteractionsRef.current = {};
            lastPageIdRef.current = currentPage.id;
        } else if (currentPage?.id && Object.keys(questionInteractionsRef.current).length > 0 && Object.keys(questionInteractions).length === 0) {
            // Restore interactions if they were lost due to remount but page is the same
            console.log('🔄 Restoring questionInteractions from ref:', questionInteractionsRef.current);
            setQuestionInteractions({...questionInteractionsRef.current});
        }
    }, [currentPage?.id, questionInteractions]);

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

    const getCurrentFormQAData = useCallback(() => {
        const qaPairs = [];
        
        if (!currentPage?.Sections) {
            return qaPairs;
        }

        let foundCareSchedule = false;

        currentPage.Sections.forEach((section) => {
            // Priority 1: Get current Questions (active form answers)
            if (section.Questions && section.Questions.length > 0) {
                section.Questions.forEach(question => {
                    if (question.answer !== null && question.answer !== undefined && question.answer !== '') {
                        qaPairs.push({
                            question_key: question.question_key,
                            question: question.question,
                            answer: question.answer,
                            Question: { question_key: question.question_key },
                            source: 'Questions'
                        });
                        
                        if (question.question_key === 'when-do-you-require-care') {
                            foundCareSchedule = true;
                        }
                    }
                });
            }
            
            // Priority 2: Get QaPairs (saved answers)
            if (section.QaPairs && section.QaPairs.length > 0) {
                section.QaPairs.forEach((qaPair) => {
                    const existingFromQuestions = qaPairs.find(qa => 
                        qa.source === 'Questions' && 
                        (qa.question_key === qaPair.Question?.question_key || 
                        qa.question === qaPair.question)
                    );
                    
                    if (!existingFromQuestions && qaPair.answer !== null && qaPair.answer !== undefined && qaPair.answer !== '') {
                        qaPairs.push({
                            question_key: qaPair.Question?.question_key || qaPair.question_key,
                            question: qaPair.question || qaPair.Question?.question,
                            answer: qaPair.answer,
                            Question: qaPair.Question,
                            source: 'QaPairs'
                        });
                        
                        if (qaPair.Question?.question_key === 'when-do-you-require-care') {
                            foundCareSchedule = true;
                        }
                    }
                });
            }
        });

        return qaPairs;
    }, [currentPage]);

    const validateCourseOfferInRealTime = useCallback(async (question, newAnswer) => {
        // Only validate if this is the course offer question and answer is "yes"
        if (!questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION)) {
            return null;
        }
        
        if (newAnswer?.toLowerCase() !== 'yes') {
            return null;
        }
        
        try {
            // Get the guest ID for fetching course offers
            const guestId = guest?.id;
            if (!guestId) {
                return 'Unable to verify course offers - guest information missing';
            }
            
            // Get stay dates for validation
            const { checkInDate, checkOutDate } = stayDates || {};
            
            // Build API URL with correct parameter name (uuid matches your API)
            let apiUrl = `/api/guests/${guestId}/course-offers`;
            const queryParams = [];
            
            if (checkInDate && checkOutDate) {
                queryParams.push(`checkInDate=${encodeURIComponent(checkInDate)}`);
                queryParams.push(`checkOutDate=${encodeURIComponent(checkOutDate)}`);
            }
            
            if (queryParams.length > 0) {
                apiUrl += `?${queryParams.join('&')}`;
            }
            
            // Fetch current course offers with validation
            const response = await fetch(apiUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    return 'You do not have any course offers';
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            const courseOffers = data.success && Array.isArray(data.courseOffers) ? data.courseOffers : [];
            
            const activeOffers = courseOffers.filter(offer => 
                ['offered', 'accepted'].includes(offer.offerStatus)
            );
            
            if (activeOffers.length === 0) {
                return 'You do not have any course offers';
            }
            
            // Check if any courses are valid
            const validOffers = activeOffers.filter(offer => offer.dateValid !== false);
            const invalidOffers = activeOffers.filter(offer => offer.dateValid === false);
            
            console.log('🎓 Validation results:', {
                total: activeOffers.length,
                valid: validOffers.length,
                invalid: invalidOffers.length
            });
            
            // For single course: validate that specific course
            if (activeOffers.length === 1) {
                const offer = activeOffers[0];
                if (offer.dateValid === false) {
                    return offer.dateValidationMessage || 'Please review your stay dates to match the min dates of stay for your course offer';
                }
            }
            // For multiple courses: only show error if NO courses are valid
            else if (activeOffers.length > 1) {
                if (validOffers.length === 0) {
                    return 'None of your course offers are compatible with your selected stay dates. Please review your dates.';
                }
                // If some courses are valid, don't show error yet - wait for course selection
            }
            
            return null; // No error
            
        } catch (error) {
            console.error('❌ Error in real-time course validation:', error);
            return 'Unable to verify course offers at this time';
        }
    }, [guest?.id, stayDates]);

    // Check if care schedule has been provided
    const hasCareScheduleData = useCallback(() => {
        const currentQAData = getCurrentFormQAData();
        const careScheduleQA = findByQuestionKey(currentQAData, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE);
        return careScheduleQA && careScheduleQA.answer;
    }, [getCurrentFormQAData]);

    const calculateLocalFilters = (pageData) => {
        let newFunderType = localFilterState.funderType;
        let newNdisPackageType = localFilterState.ndisPackageType;
        
        if (!pageData || !pageData.Sections) return localFilterState;
        
        // console.log('Calculating local filters for page:', pageData.title);
        
        // Check answers in current page
        for (const section of pageData.Sections) {
            if (section.hidden) continue;
            for (const question of section.Questions || []) {
                if (question.hidden) continue;
                // Check funding source
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                    if (question.answer?.toLowerCase().includes('ndis') || question.answer?.toLowerCase().includes('ndia')) {
                        newFunderType = 'NDIS';
                        console.log('✅ NDIS funding detected');
                    } else {
                        newFunderType = 'Non-NDIS';
                        newNdisPackageType = null; // Clear NDIS package type for non-NDIS
                        console.log('✅ Non-NDIS funding detected');
                        // FIXED: Exit early since we know it's Non-NDIS
                        break;
                    }
                }
                
                if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT) && 
                    (question.answer && question.answer.toLowerCase() === 'yes')) {
                    newNdisPackageType = 'sta';
                    console.log('✅ STA package: STA is stated support (takes precedence)');
                }

                // If not STA, check for holiday conditions
                if (!newNdisPackageType || newNdisPackageType !== 'sta') {
                    let isHolidayType = false;
                    
                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_ALONE) && 
                        (question.answer && question.answer.toLowerCase() === 'no')) {
                        isHolidayType = true;
                        console.log('✅ Holiday type detected: Lives alone');
                    }

                    if (questionHasKey(question, QUESTION_KEYS.WE_ALSO_NEED_TO_KNOW) && question.answer) {
                        // Handle both array (checkbox) and string answers
                        let answerToCheck = question.answer;
                        if (Array.isArray(answerToCheck)) {
                            // For checkbox/multi-select, check if "None of these apply to me" is in the array
                            const hasNoneApply = answerToCheck.some(a => 
                                typeof a === 'string' && a.toLowerCase() === 'none of these apply to me'
                            );
                            if (hasNoneApply) {
                                isHolidayType = true;
                                console.log('✅ Holiday type detected: Need to know factor (array check)');
                            }
                        } else if (typeof answerToCheck === 'string' && 
                                answerToCheck.toLowerCase() === 'none of these apply to me') {
                            isHolidayType = true;
                            console.log('✅ Holiday type detected: Need to know factor');
                        }
                    }


                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_IN_SIL) && 
                        (question.answer && question.answer.toLowerCase() === 'yes')) {
                        isHolidayType = true;
                        console.log('✅ Holiday type detected: Lives in SIL');
                    }

                    if (questionHasKey(question, QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS) && 
                        (question.answer && question.answer.toLowerCase() === 'yes')) {
                        isHolidayType = true;
                        console.log('✅ Holiday type detected: Staying with informal supports');
                    }
                    
                    if (isHolidayType) {
                        // Get care analysis from the current page
                        const careData = localFilterState?.careAnalysis;
                        const careHours = careData?.totalHoursPerDay || 0;
                        const requiresCare = careData?.requiresCare && careHours > 0;
                        
                        if (requiresCare) {
                            newNdisPackageType = 'holiday-plus';
                            console.log(`✅ Holiday-Plus package: Holiday type with ${careHours}h care required`);
                        } else {
                            newNdisPackageType = 'holiday';
                            console.log('✅ Holiday package: Holiday type with no care required');
                        }
                    }
                }
            }
            // FIXED: Break out of section loop if Non-NDIS detected
            if (newFunderType === 'Non-NDIS') break;
        }
        
        // Default NDIS package type if none determined AND funding is NDIS
        if (newFunderType === 'NDIS' && !newNdisPackageType) {
            newNdisPackageType = 'sta'; // Default to STA
            console.log('✅ Default to STA package type');
        }
        
        const newFilters = {
            funderType: newFunderType,
            ndisPackageType: newFunderType === 'NDIS' ? newNdisPackageType : null, // FIXED: Ensure null for Non-NDIS
            additionalFilters: localFilterState.additionalFilters
        };
        
        // console.log('📊 Local filters calculated:', newFilters);
        return newFilters;
    };

    const updateSections = async (value, field, secIdx, qIdx, equipments = [], error = false) => {
        const pageToUpdate = updatedCurrentPage || currentPage;
    
        const currentValue = pageToUpdate.Sections[secIdx]?.Questions[qIdx]?.[field];
        const currentError = pageToUpdate.Sections[secIdx]?.Questions[qIdx]?.error;
        const question = pageToUpdate.Sections[secIdx]?.Questions[qIdx];
        
        const isSameValue = 
            (currentValue === value) || 
            (JSON.stringify(currentValue) === JSON.stringify(value));
        
        const isSameError = currentError === error;

        const affectsOtherQuestions = () => {
            if (!question) return false;
            
            // For questions moved from QaPairs, we need to find the original question ID
            let questionId = question.question_id || question.id;
            
            // For moved questions (fromQa = true), find the original question ID from QaPairs
            if (question.fromQa && pageToUpdate.Sections) {
                const currentSection = pageToUpdate.Sections[secIdx];
                if (currentSection && currentSection.QaPairs) {
                    const correspondingQaPair = currentSection.QaPairs.find(qa => qa.id === question.id);
                    if (correspondingQaPair && correspondingQaPair.question_id) {
                        questionId = correspondingQaPair.question_id;
                        // console.log(`🔧 Using original question ID ${questionId} instead of QaPair ID ${question.id} for dependency checking`);
                    }
                }
            }
            
            const questionKey = question.question_key;

            // console.log(`🔍 Checking dependencies for question: ${question.question}`);
            // console.log("Question ID for dependency checking:", questionId);
            // console.log("Current question key:", questionKey);
            
            // Search through ALL pages (not just current page) to see if any questions depend on this one
            return allPages.some(page =>
                page.Sections?.some(section =>
                    section.Questions?.some(otherQuestion =>
                        otherQuestion.QuestionDependencies?.some(dep =>
                            dep.dependence_id === questionId ||
                            dep.dependence_id === questionKey
                        )
                    )
                )
            );
        };
        
        // Add real-time course validation
        if (question && questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION) && field === 'answer') {
            // console.log('🎓 Course offer question detected, running real-time validation...');
            
            try {
                const courseValidationError = await validateCourseOfferInRealTime(question, value);
                if (courseValidationError) {
                    error = courseValidationError;
                    console.log('🎓 Course validation error:', courseValidationError);
                } else {
                    // console.log('🎓 Course validation passed');
                }
            } catch (validationError) {
                console.error('🎓 Course validation failed:', validationError);
                error = 'Unable to verify course offers at this time';
            }
        }

        if (question && questionHasKey(question, QUESTION_KEYS.CHECK_IN_OUT_DATE) && field === 'answer' && selectedCourseOfferId && validateDatesWithExistingAPI) {
            console.log('📅 Check-in/Check-out date question detected with course offer, validating...');
            
            try {
                let checkInDate = null;
                let checkOutDate = null;
                
                if (value && typeof value === 'string' && value.includes(' - ')) {
                    const dates = value.split(' - ');
                    checkInDate = dates[0].trim();
                    checkOutDate = dates[1].trim();
                }
                
                if (checkInDate && checkOutDate) {
                    console.log('📅 Validating dates with existing course-offers API:', { 
                        checkInDate, 
                        checkOutDate, 
                        courseOfferId: selectedCourseOfferId 
                    });
                    
                    const validation = await validateDatesWithExistingAPI(checkInDate, checkOutDate, selectedCourseOfferId);
                    if (!validation.valid) {
                        error = validation.message || 'Selected dates are not compatible with your course offer';
                        console.log('📅 Course offer date validation failed:', validation.message);
                    } else {
                        console.log('📅 Course offer date validation passed for course:', validation.courseOffer?.courseName);
                    }
                }
            } catch (validationError) {
                console.error('📅 Course offer date validation error:', validationError);
                error = 'Unable to validate dates against course offer. Please try again.';
            }
        }

        const isCareQuestion = question && (
            questionHasKey(question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) ||
            questionHasKey(question, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
            question.question_key === 'do-you-require-assistance-with-personal-care' ||
            question.question?.toLowerCase().includes('personal care')
        );

        // Check if this is a "No" answer to personal care question
        const isPersonalCareNoAnswer = question && 
            (questionHasKey(question, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) || 
            question.question_key === 'do-you-require-assistance-with-personal-care' ||
            question.question?.toLowerCase().includes('personal care')) &&
            field === 'answer' && 
            (value === 'No' || value === 'no');
        
        // Don't skip update if this question affects dependencies, even if value seems same
        if (isSameValue && isSameError && !equipments.length && !affectsOtherQuestions()) {
            // console.log(`⏭️ Skipping update - same value and no dependency impact for question: ${question?.question}`);
            return;
        }

        let list = pageToUpdate.Sections.map((section, index) => {
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

                        if (qTemp.type === 'service-cards' || qTemp.type === 'service-cards-multi') {
                            qTemp[field] = value;
                            qTemp.dirty = true;
                        } else if (qTemp.type === 'select' || qTemp.type === 'multi-select') {
                            qTemp[field] = value.label;
                            qTemp.dirty = true;
                        } else if (qTemp.type === 'checkbox') {
                            if (qTemp.options.length > 0) {
                                let currentAnswer = [];
                                
                                // Parse existing answer
                                if (qTemp.answer) {
                                    if (typeof qTemp.answer === 'string') {
                                        try {
                                            currentAnswer = JSON.parse(qTemp.answer);
                                        } catch (e) {
                                            console.error('Error parsing answer:', e);
                                            currentAnswer = [];
                                        }
                                    } else if (Array.isArray(qTemp.answer)) {
                                        currentAnswer = [...qTemp.answer];
                                    }
                                }

                                if (!Array.isArray(currentAnswer)) {
                                    currentAnswer = [];
                                }

                                // Get the options array for reference
                                const qTempOptions = typeof qTemp.options === 'string' 
                                    ? JSON.parse(qTemp.options) 
                                    : qTemp.options;

                                // Use the new utility function to process the answer
                                const processedAnswer = processCheckboxAnswerWithNoneLogic(
                                    currentAnswer, 
                                    value, 
                                    qTempOptions
                                );

                                qTemp[field] = processedAnswer;
                                qTemp.dirty = true;

                                // Update options to reflect the new state
                                const updatedOptions = qTempOptions.map(option => ({
                                    ...option,
                                    value: processedAnswer.includes(option.label)
                                }));

                                qTemp.options = updatedOptions;
                            } else {
                                qTemp.dirty = true;
                                qTemp[field] = value;
                            }
                        } else if (qTemp.type === 'checkbox-button') {
                            if (qTemp.options.length > 0) {
                                let currentAnswer = [];
                                
                                // Parse existing answer
                                if (qTemp.answer) {
                                    if (typeof qTemp.answer === 'string') {
                                        try {
                                            currentAnswer = JSON.parse(qTemp.answer);
                                        } catch (e) {
                                            console.error('Error parsing answer:', e);
                                            currentAnswer = [];
                                        }
                                    } else if (Array.isArray(qTemp.answer)) {
                                        currentAnswer = [...qTemp.answer];
                                    }
                                }

                                if (!Array.isArray(currentAnswer)) {
                                    currentAnswer = [];
                                }

                                // Get the options array for reference
                                const qTempOptions = typeof qTemp.options === 'string' 
                                    ? JSON.parse(qTemp.options) 
                                    : qTemp.options;

                                // Use the new utility function to process the answer
                                const processedAnswer = processCheckboxAnswerWithNoneLogic(
                                    currentAnswer, 
                                    value, 
                                    qTempOptions
                                );

                                qTemp[field] = processedAnswer;
                                qTemp.dirty = true;

                                // Update options to reflect the new state
                                const updatedOptions = qTempOptions.map(option => ({
                                    ...option,
                                    value: processedAnswer.includes(option.label)
                                }));

                                qTemp.options = updatedOptions;
                            } else {
                                qTemp.dirty = true;
                                qTemp[field] = value;
                            }
                        } else if (['card-selection', 'card-selection-multi', 'horizontal-card', 'horizontal-card-multi'].includes(qTemp.type)) {
                            qTemp.dirty = true;
                            qTemp[field] = value;
                        } else if (['package-selection', 'package-selection-multi'].includes(qTemp.type)) {
                            // CRITICAL FIX: Preserve oldAnswer when updating package selection
                            if (field === 'answer' && qTemp.answer !== value && qTemp.oldAnswer === undefined) {
                                qTemp.oldAnswer = qTemp.answer;
                            }
                            
                            qTemp.dirty = true;
                            qTemp[field] = value;
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
        
        // If this is a care-related question, notify parent component
        if (isCareQuestion || isPersonalCareNoAnswer) {
            console.log('🏥 Care-related question detected:', {
                questionKey: question.question_key,
                question: question.question,
                newValue: value,
                isCareQuestion,
                isPersonalCareNoAnswer
            });
            
            // Call the force update function if it's passed as a prop
            if (typeof updateAndDispatchPageDataImmediate === 'function') {
                setTimeout(() => {
                    // Trigger immediate update for care questions
                    updateAndDispatchPageDataImmediate(updatedPageData.Sections, currentPage.id);
                    
                    // Additional callback for care-specific updates if provided
                    if (typeof onCareQuestionUpdate === 'function') {
                        onCareQuestionUpdate(question, value);
                    }
                }, 50);
            }
        } else {
            // Enhanced logic for questions that affect dependencies
            if (affectsOtherQuestions()) {
                // console.log('🔄 Question affects dependencies, forcing immediate update');
                Object.values(updateTimeoutRef.current).forEach(timeout => {
                    if (timeout) clearTimeout(timeout);
                });
                
                setTimeout(() => {
                    updatePageData(updatedPageData.Sections, currentPage.id);
                }, 10);
            }
        }
    };

    useEffect(() => {
        if (updatedCurrentPage && updatedCurrentPage.dirty) {
            // Check if this update involves questions with dependencies
            const hasDependencyQuestions = updatedCurrentPage.Sections?.some(section =>
                section.Questions?.some(question => {
                    // Check if this question has dependencies OR affects other questions
                    const hasDependencies = question.QuestionDependencies && question.QuestionDependencies.length > 0;
                    
                    // FIXED: Get the correct question ID for moved questions
                    let questionId = question.question_id || question.id;
                    if (question.fromQa && section.QaPairs) {
                        const correspondingQaPair = section.QaPairs.find(qa => qa.id === question.id);
                        if (correspondingQaPair && correspondingQaPair.question_id) {
                            questionId = correspondingQaPair.question_id;
                        }
                    }
                    
                    const questionKey = question.question_key;
                    
                    // FIXED: Check across ALL pages if any other question depends on this one
                    const affectsOthers = allPages.some(page =>
                        page.Sections?.some(otherSection =>
                            otherSection.Questions?.some(otherQuestion =>
                                otherQuestion.QuestionDependencies?.some(dep =>
                                    dep.dependence_id === questionId ||
                                    dep.dependence_id === questionKey
                                )
                            )
                        )
                    );
                    
                    return hasDependencies || affectsOthers;
                })
            );
            
            if (hasDependencyQuestions) {
                // console.log('🔗 Update involves dependency questions, ensuring immediate processing');
                updateAndDispatchPageDataImmediate?.(updatedCurrentPage.Sections, currentPage.id) || updatePageData(updatedCurrentPage.Sections);
            } else {
                updatePageData(updatedCurrentPage.Sections);
            }
        }
    }, [updatedCurrentPage, allPages]);

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
    }, [currentPage?.id]);

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
        'package-selection-multi', 'service-cards', 'service-cards-multi'   
    ];

    // Helper function to get validation styling for card/special field containers
    const getCardContainerClasses = (question, hasInteracted, hasPrefill) => {
        const hasError = question.error && (validationAttempted || hasInteracted);
        
        // Check if has valid answer
        let hasValidAnswer = false;
        if (question.answer !== null && question.answer !== undefined && question.answer !== '') {
            if (Array.isArray(question.answer)) {
                hasValidAnswer = question.answer.length > 0;
            } else if (typeof question.answer === 'object') {
                hasValidAnswer = Object.keys(question.answer).length > 0;
            } else {
                hasValidAnswer = true;
            }
        }
        
        const showGreen = (hasInteracted || hasPrefill) && hasValidAnswer;
        
        if (hasError) {
            return 'border-red-400 bg-red-50';
        }
        if (showGreen) {
            return 'border-green-400 bg-green-50';
        }
        return 'border-gray-200 bg-white';
    };

    return (
        <React.Fragment>
            <div className="w-full flex flex-col">
                <div className="flex flex-col w-full">
                    <div className="mt-2 px-8 py-2">
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
                                    <div className={`${sec_css} p-2 w-full`}>
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
                                                    const questionsTypesWithoutText = [
                                                        'simple-checkbox', 
                                                        'checkbox',
                                                        'goal-table',
                                                        'care-table',
                                                        'package-selection'
                                                    ];
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
                                            // Check if question has pre-filled data (from QaPairs or saved answers)
                                            const hasPrefillData = q.fromQa || q.prefill || (q.answer !== null && q.answer !== undefined && q.answer !== '' && !hasUserInteracted);

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

                                            if (q.type === "service-cards" || q.type === "service-cards-multi") {
                                                if (typeof q.answer === 'string' && q.answer.trim()) {
                                                    try {
                                                        q.answer = JSON.parse(q.answer);
                                                    } catch (error) {
                                                        console.error('Error parsing service-cards answer:', error);
                                                        // Initialize with empty object if parsing fails
                                                        q.answer = {};
                                                    }
                                                } else if (!q.answer) {
                                                    // Initialize with empty object if no answer
                                                    q.answer = {};
                                                }
                                            }

                                            const handleCardSelectionFieldChange = (value, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                // Clear any existing error immediately for card selections
                                                const currentQuestion = currentPage.Sections[secIdx]?.Questions[qIdx];
                                                console.log('🃏 Card selection changed:', { value, secIdx, qIdx, currentQuestion });
                                                if (currentQuestion && value && (value !== null && value !== undefined && value !== '')) {
                                                    updateSections(value, 'answer', secIdx, qIdx, [], null); // Pass null to clear error
                                                } else {
                                                    updateSections(value, 'answer', secIdx, qIdx);
                                                }
                                            }

                                            if (q.type === "health-info") {
                                                q.answer = q.answer ? JSON.parse(q.answer) : [];
                                            }

                                            const handleTextNumberFieldChange = (e, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(e, 'answer', secIdx, qIdx);
                                            }

                                            const handleSelectFieldChange = (selectedOptions, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                const question = currentPage.Sections[secIdx]?.Questions[qIdx];
                                                
                                                if (question?.type === 'multi-select' && Array.isArray(selectedOptions)) {
                                                    // Check if user just selected a "none" type option
                                                    const lastSelected = selectedOptions[selectedOptions.length - 1];
                                                    const isNoneType = lastSelected && isNoneTypeOption(lastSelected.label);
                                                    
                                                    if (isNoneType) {
                                                        // Keep only the "none" option
                                                        updateSections({ label: lastSelected.label }, 'answer', secIdx, qIdx);
                                                    } else {
                                                        // Filter out any "none" type options
                                                        const filteredOptions = selectedOptions.filter(opt => !isNoneTypeOption(opt.label));
                                                        updateSections(
                                                            filteredOptions.length === 1 
                                                                ? { label: filteredOptions[0].label }
                                                                : filteredOptions.map(o => o.label), 
                                                            'answer', 
                                                            secIdx, 
                                                            qIdx
                                                        );
                                                    }
                                                } else {
                                                    updateSections(selectedOptions, 'answer', secIdx, qIdx);
                                                }
                                            };

                                            const handleDateFieldChange = (e, secIdx, qIdx, checkInQuestion, checkOutQuestion, error) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                if (checkInQuestion) {
                                                    dispatch(bookingRequestFormActions.setCheckinDate(e))
                                                    onStayDatesUpdate?.({ checkInDate: e, checkOutDate: null });
                                                }
                                                if (checkOutQuestion) {
                                                    dispatch(bookingRequestFormActions.setCheckoutDate(e))
                                                    onStayDatesUpdate?.({ checkInDate: null, checkOutDate: e });
                                                }

                                                // Handle date-range type (combined check-in/check-out)
                                                if (question?.type === 'date-range' && e && typeof e === 'string' && e.includes(' - ')) {
                                                    const dates = e.split(' - ');
                                                    const checkIn = dates[0]?.trim();
                                                    const checkOut = dates[1]?.trim();
                                                    
                                                    console.log('📅 Date range updated:', { checkIn, checkOut });
                                                    
                                                    if (checkIn) {
                                                        dispatch(bookingRequestFormActions.setCheckinDate(checkIn));
                                                    }
                                                    if (checkOut) {
                                                        dispatch(bookingRequestFormActions.setCheckoutDate(checkOut));
                                                    }
                                                    
                                                    // Immediately update parent's stayDates state
                                                    onStayDatesUpdate?.({ checkInDate: checkIn, checkOutDate: checkOut });
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

                                                if (changes && changes.length > 0) {
                                                    // FIXED: Defer Redux update to avoid state update during render
                                                    setTimeout(() => {
                                                        // Update Redux equipment state
                                                        updateEquipmentData(changes);
                                                    }, 0);
                                                    
                                                    // Process equipment changes into QA pair updates
                                                    const qaPairUpdates = [];
                                                    
                                                    changes.forEach(change => {
                                                        if (change.category === 'infant_care' && change.equipments) {
                                                            change.equipments.forEach(equipment => {
                                                                // Generate QA pair updates dynamically for ALL infant care equipment
                                                                const questionMapping = getInfantCareQuestionMapping(equipment.name);
                                                                
                                                                if (questionMapping && equipment.meta_data?.quantity !== undefined) {
                                                                    qaPairUpdates.push({
                                                                        question_key: questionMapping.questionKey,
                                                                        question_text: questionMapping.questionText,
                                                                        answer: equipment.meta_data.quantity.toString(),
                                                                        equipment_related: true,
                                                                        equipment_name: equipment.name,
                                                                        equipment_id: equipment.id
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                    
                                                    // FIXED: Apply QA pair updates by searching through ALL pages, not just currentPage
                                                    if (qaPairUpdates.length > 0) {
                                                        setTimeout(() => {
                                                            // Search through ALL pages to find and update the questions
                                                            const updatedAllPages = allPages.map(page => {
                                                                const updatedSections = page.Sections.map(section => {
                                                                    const updatedQuestions = section.Questions.map(question => {
                                                                        // Check if this question matches any of our updates
                                                                        const matchingUpdate = qaPairUpdates.find(
                                                                            update => question.question_key === update.question_key
                                                                        );
                                                                        
                                                                        if (matchingUpdate) {
                                                                            // console.log(`✅ Found and updating question: "${question.question}" on page "${page.title}"`);
                                                                            return {
                                                                                ...question,
                                                                                answer: matchingUpdate.answer,
                                                                                dirty: true,
                                                                                oldAnswer: question.answer || null,
                                                                                equipment_related: true
                                                                            };
                                                                        }
                                                                        
                                                                        return question;
                                                                    });
                                                                    
                                                                    return {
                                                                        ...section,
                                                                        Questions: updatedQuestions
                                                                    };
                                                                });
                                                                
                                                                return {
                                                                    ...page,
                                                                    Sections: updatedSections,
                                                                    dirty: page.Sections !== updatedSections // Mark page as dirty if sections changed
                                                                };
                                                            });
                                                            
                                                            // Update ALL pages, not just current page
                                                            if (typeof updateAndDispatchPageDataImmediate === 'function') {
                                                                // For each page that was updated, call the immediate update
                                                                updatedAllPages.forEach(page => {
                                                                    if (page.dirty) {
                                                                        // console.log(`📝 Dispatching update for page: "${page.title}"`);
                                                                        updateAndDispatchPageDataImmediate(page.Sections, page.id);
                                                                    }
                                                                });
                                                            }
                                                        }, 10);
                                                    }
                                                }
                                                
                                                // DON'T update the equipment field answer as a regular question
                                                // This prevents the empty "Select/Review Equipment Options" from being saved
                                                // updateSections(label, 'answer', secIdx, qIdx, changes);
                                            };

                                            const handleGoalTableChange = (goalSelected, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                updateSections(goalSelected, 'answer', secIdx, qIdx, [], error);
                                            }

                                            const handleCareTableChange = (careData, error, secIdx, qIdx) => {
                                                markQuestionAsInteracted(secIdx, qIdx);
                                                
                                                // Enhanced error handling for date mismatches and validation
                                                let finalError = error;
                                                
                                                // If error is specifically about date mismatch, provide more context
                                                if (error && typeof error === 'string' && error.includes('date')) {
                                                    finalError = 'Please set up your care schedule for your current stay dates';
                                                }
                                                
                                                // If there's no care data but it's required, show appropriate error
                                                if ((!careData || careData.length === 0) && currentPage.Sections[secIdx]?.Questions[qIdx]?.required) {
                                                    if (!finalError) {
                                                        finalError = 'Please complete your care schedule';
                                                    }
                                                }
                                                
                                                updateSections(careData, 'answer', secIdx, qIdx, [], finalError);
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField  key={q.id} type='url' width='100%' url={details.url} error={q.error} label={details.label} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'rich-text') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='rich-text' width='100%' description={typeof q.details == 'string' ? JSON.parse(q.details)?.description : q.details.description} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {((q.type === 'string' || q.type === 'text') && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
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
                                                                        forceShowErrors={validationAttempted}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
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
                                                                        forceShowErrors={validationAttempted}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
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
                                                                        forceShowErrors={validationAttempted}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='select' value={q.answer} width='100%' required={q.required ? true : false} options={options} error={q.error} onChange={(e) => handleSelectFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'multi-select' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row mb-6">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='multi-select' value={q.answer} width='100%' placeholder={q.question} required={q.required ? true : false} error={q.error} options={options} onChange={(e) => handleSelectFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'year' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='year' defaultValue={q.answer ? q.answer : ''} width='100%' error={q.error} required={q.required ? true : false} onBlur={(e) => handleTextNumberFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'date' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500  ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                {selectedCourseOfferId && questionHasKey(q, QUESTION_KEYS.CHECK_IN_OUT_DATE) && (
                                                                    <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                                                        <div className="flex items-start gap-2">
                                                                            <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                            </svg>
                                                                            <div className="text-sm">
                                                                                <p className="font-medium text-amber-800">Course Date Requirements</p>
                                                                                <p className="text-amber-700">Your selected dates must be compatible with the course offer requirements. The system will validate your selection automatically.</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='date' 
                                                                        name={QUESTION_KEYS.CHECK_IN_DATE === q.question_key ? "checkinDate" : QUESTION_KEYS.CHECK_OUT_DATE === q.question_key ? "checkoutDate" : q.question_key ? q.question_key : generateQuestionKey(q.question)}
                                                                        value={q.answer} 
                                                                        crossValidationValue={getCrossValidationValue(
                                                                            QUESTION_KEYS.CHECK_IN_DATE === q.question_key ? "checkinDate" : QUESTION_KEYS.CHECK_OUT_DATE === q.question_key ? "checkoutDate" : null, 
                                                                            currentPage.Sections
                                                                        )}
                                                                        width='100%' 
                                                                        placeholder={q.question} 
                                                                        required={q.required ? true : false} 
                                                                        error={q.error} 
                                                                        forceShowErrors={validationAttempted}
                                                                        allowPrevDate={QUESTION_KEYS.CHECK_IN_DATE === q.question_key || QUESTION_KEYS.CHECK_OUT_DATE === q.question_key ? false : true}
                                                                        isConfirmedBooking={isConfirmedBooking} 
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='date-range'
                                                                        value={q.answer}
                                                                        width='100%'
                                                                        placeholder={q.question}
                                                                        required={q.required ? true : false}
                                                                        error={q.error}
                                                                        forceShowErrors={validationAttempted}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='integer' defaultValue={q.answer} width='100%' placeholder={q.question} required={q.required ? true : false} error={'Required field. Please input value.'} onBlur={(e) => handleTextNumberFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
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
                                                                            {isHtmlContent(q.question) ? (
                                                                                <div className="text-sm rich-text-container">
                                                                                    {parse(q.question)}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="font-bold text-sm">
                                                                                    {q.question}
                                                                                </span>
                                                                            )}
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                        </div>
                                                                        <div className={`
                                                                            flex flex-col align-middle mt-2 rounded-lg border transition-all duration-200 p-3
                                                                            ${
                                                                                !!(q.error || (validationAttempted && q.required && 
                                                                                    (!q.answer || (Array.isArray(q.answer) && q.answer.length === 0))))
                                                                                    ? 'border-red-400 bg-red-50'
                                                                                    : !!((hasUserInteracted || hasPrefillData) && q.answer && Array.isArray(q.answer) && q.answer.length > 0)
                                                                                        ? 'border-green-400 bg-green-50'
                                                                                        : 'border-gray-300 bg-white'
                                                                            }
                                                                        `}>
                                                                            {options.map((option, optIdx) => {
                                                                                const checkboxUuid = uuidv4();
                                                                                return (
                                                                                    <GetField 
                                                                                        key={checkboxUuid} 
                                                                                        type='simple-checkbox'
                                                                                        bold={options.length === 1}
                                                                                        name={`checkbox-${index}-${idx}-${checkboxUuid}`}
                                                                                        value={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        label={option.label}
                                                                                        checked={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        required={q.required ? true : false}
                                                                                        notAvailableFlag={option?.notAvailableFlag ? true : false}
                                                                                        forceShowErrors={validationAttempted}
                                                                                        onChange={(e, s, f) => handleCheckboxFieldChange(e, s, f, idx, index)}
                                                                                    />
                                                                                )
                                                                            })}
                                                                        </div>
                                                                        {!!(q.error || (validationAttempted && q.required && 
                                                                            (!q.answer || (Array.isArray(q.answer) && q.answer.length === 0)))) && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">
                                                                                    {q.error || 'Please select at least one option'}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                ) : (
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                            <div className={`rounded-lg border transition-all duration-200 p-2 
                                                                                ${
                                                                                    !!(q.error || (validationAttempted && q.required && !q.answer))
                                                                                        ? 'border-red-400 bg-red-50'
                                                                                        : !!((hasUserInteracted || hasPrefillData) && q.answer)
                                                                                            ? 'border-green-400 bg-green-50'
                                                                                            : 'border-gray-300 bg-white'
                                                                                }
                                                                            `}>
                                                                                <GetField 
                                                                                    key={q.id} 
                                                                                    type='simple-checkbox' 
                                                                                    name={`checkbox-${index}-${idx}`} 
                                                                                    value={q.answer} 
                                                                                    checked={q.answer} 
                                                                                    label={q.question} 
                                                                                    required={q.required ? true : false} 
                                                                                    forceShowErrors={validationAttempted}
                                                                                    onChange={(e, s) => handleCheckboxFieldChange(e, s, false, idx, index, true)} 
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {!!(q.error || (validationAttempted && q.required && !q.answer)) && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">
                                                                                    {q.error || 'This field is required'}
                                                                                </p>
                                                                            </div>
                                                                        )}
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
                                                                            {isHtmlContent(q.question) ? (
                                                                                <div className="text-sm rich-text-container">
                                                                                    {parse(q.question)}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="font-bold text-sm">
                                                                                    {q.question}
                                                                                </span>
                                                                            )}
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                        </div>
                                                                        <div className={`
                                                                            flex flex-wrap gap-1 align-middle mt-2 rounded-lg border transition-all duration-200 p-3
                                                                            ${
                                                                                !!(q.error || (validationAttempted && q.required && 
                                                                                    (!q.answer || (Array.isArray(q.answer) && q.answer.length === 0))))
                                                                                    ? 'border-red-400 bg-red-50'
                                                                                    : !!((hasUserInteracted || hasPrefillData) && q.answer && Array.isArray(q.answer) && q.answer.length > 0)
                                                                                        ? 'border-green-400 bg-green-50'
                                                                                        : 'border-gray-300 bg-white'
                                                                            }
                                                                        `}>
                                                                            {options.map((option, optIdx) => {
                                                                                const checkboxUuid = uuidv4();
                                                                                return (
                                                                                    <GetField 
                                                                                        key={checkboxUuid} 
                                                                                        type='simple-checkbox'
                                                                                        mode="button"
                                                                                        size="small"
                                                                                        bold={options.length === 1}
                                                                                        name={`checkbox-button-${index}-${idx}-${checkboxUuid}`}
                                                                                        value={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        label={option.label}
                                                                                        checked={q.answer && Array.isArray(q.answer) ? q.answer.includes(option.label) : false}
                                                                                        required={q.required ? true : false}
                                                                                        notAvailableFlag={option?.notAvailableFlag ? true : false}
                                                                                        forceShowErrors={validationAttempted}
                                                                                        onChange={(e, s, f) => handleCheckboxFieldChange(e, s, f, idx, index)}
                                                                                    />
                                                                                )
                                                                            })}
                                                                        </div>
                                                                        {!!(q.error || (validationAttempted && q.required && 
                                                                            (!q.answer || (Array.isArray(q.answer) && q.answer.length === 0)))) && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">
                                                                                    {q.error || 'Please select at least one option'}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                ) : (
                                                                    // Single checkbox-button
                                                                    <React.Fragment>
                                                                        <div className="text-xs flex flex-row">
                                                                            {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                            {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                            <div className={`rounded-lg border transition-all duration-200 p-2 
                                                                                ${
                                                                                    !!(q.error || (validationAttempted && q.required && !q.answer))
                                                                                        ? 'border-red-400 bg-red-50'
                                                                                        : !!((hasUserInteracted || hasPrefillData) && q.answer)
                                                                                            ? 'border-green-400 bg-green-50'
                                                                                            : 'border-gray-300 bg-white'
                                                                                }
                                                                            `}>
                                                                                <GetField 
                                                                                    key={q.id} 
                                                                                    type='simple-checkbox' 
                                                                                    mode="button"
                                                                                    size="medium"
                                                                                    name={`checkbox-button-${index}-${idx}`} 
                                                                                    value={q.answer} 
                                                                                    checked={q.answer} 
                                                                                    label={q.question} 
                                                                                    required={q.required ? true : false} 
                                                                                    forceShowErrors={validationAttempted}
                                                                                    onChange={(e, s) => handleCheckboxFieldChange(e, s, false, idx, index, true)} 
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {!!(q.error || (validationAttempted && q.required && !q.answer)) && (
                                                                            <div className="mt-1.5 flex items-center">
                                                                                <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                                </svg>
                                                                                <p className="text-red-600 text-sm font-medium">
                                                                                    {q.error || 'This field is required'}
                                                                                </p>
                                                                            </div>
                                                                        )}
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
                                                                    {isHtmlContent(q.question) ? (
                                                                        <div className="text-sm rich-text-container">
                                                                            {parse(q.question)}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="font-bold text-sm">
                                                                            {q.question}
                                                                        </span>
                                                                    )}
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className={`
                                                                    flex flex-col align-middle mt-2 rounded-lg border transition-all duration-200 p-3
                                                                    ${
                                                                        !!(q.error || (validationAttempted && q.required && (!q.answer || q.answer === '')))
                                                                            ? 'border-red-400 bg-red-50' 
                                                                            : !!((hasUserInteracted || hasPrefillData) && q.answer)
                                                                                ? 'border-green-400 bg-green-50'
                                                                                : 'border-gray-300 bg-white'
                                                                    }
                                                                `}>
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
                                                                                forceShowErrors={validationAttempted}
                                                                                onChange={(e) => handleRadioButtonFieldChange(e, idx, index)} 
                                                                            />
                                                                        )
                                                                    })}
                                                                </div>
                                                                {!!(q.error || (validationAttempted && q.required && (!q.answer || q.answer === ''))) && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">
                                                                            {q.error || 'Please select an option'}
                                                                        </p>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500  ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle ml-2">
                                                                    <GetField key={q.id} type='time' value={q.answer} min="14:00" max="18:00" placeholder={q.question} error={q.error} invalidTimeErrorMsg={"Please enter a time between 2pm - 10pm"} required={q.required ? true : false} onChange={(e) => handleDateFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'file-upload' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='file-upload' value={q.answer ? q.answer : ''} url={url} width='100%' error={q.error} required={q.required ? true : false} onChange={(e) => handleFileUploadChange(e, idx, index)} fileType={`booking_request_form/${guest.id}/`} forceShowErrors={validationAttempted} />
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'health-info' && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex align-middle mt-2">
                                                                    <GetField key={q.id} type='health-info' options={options} width='100%' error="Required field" required={q.required ? true : false} onChange={(label, list) => handleHealthInfoFieldChange(label, list, idx, index)} forceShowErrors={validationAttempted} />
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
                                                                    forceShowErrors={validationAttempted}
                                                                    ndis_package_type={localFilterState.ndisPackageType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    onChange={(value, error) => handleRoomFieldChange(value, error, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {q.type === 'equipment' && (
                                                        <GetField 
                                                            key={q.id} 
                                                            type='equipment' 
                                                            ref={equipmentFieldRef}
                                                            label={q.question} 
                                                            value={q.answer} 
                                                            width='100%' 
                                                            error="Required field" 
                                                            required={q.required ? true : false}
                                                            infantCareQuantities={infantCareQuantities}
                                                            forceShowErrors={validationAttempted}
                                                            onChange={(isValid, equipmentChanges) => {
                                                                // Call existing handler
                                                                handleEquipmentFieldChange(isValid, idx, index, equipmentChanges);
                                                                // Notify parent - but mark this as NOT user-triggered (it's from onChange)
                                                                // User-triggered validation only happens via ref.validate()
                                                            }}
                                                        />
                                                    )}
                                                    {(q.type === 'radio-ndis' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    {isHtmlContent(q.question) ? (
                                                                        <div className="text-sm rich-text-container">
                                                                            {parse(q.question)}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="font-bold text-sm">
                                                                            {q.question}
                                                                        </span>
                                                                    )}
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className="flex flex-col align-middle mt-2">
                                                                    {options && options.map((option, optIdx) => {
                                                                        const radioUuid = uuidv4();
                                                                        return (
                                                                            <GetField key={radioUuid} index={optIdx} type='simple-radio-ndis' id={`radio-${option.value}-${index}`} name={`radio-${index}-${idx}-${radioUuid}`} checked={option.label === q.answer} label={option.label} value={option.value} required={q.required ? true : false} error={q.error} onChange={(e) => handleRadioButtonFieldChange(e, idx, index)} forceShowErrors={validationAttempted} />
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <GetField type='goal-table'
                                                                    name={`goal-table`}
                                                                    value={q.answer}
                                                                    required={q.required ? true : false}
                                                                    onChange={(goalSelected, error) => handleGoalTableChange(goalSelected, error, idx, index)}
                                                                    forceShowErrors={validationAttempted}
                                                                />
                                                                {q.error && <p className="mt-1.5 text-red-500 text-xs">{q.error}</p>}
                                                            </div>
                                                        </React.Fragment>
                                                    )}
                                                    {(q.type === 'care-table' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col max-w-screen-xl-1 flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <span className="italic text-sm my-2">Please note, we do not provide scheduled care between midnight and 6:30am</span>
                                                                <GetField type='care-table'
                                                                    name={`care-table`}
                                                                    value={q.answer}
                                                                    required={q.required ? true : false}
                                                                    stayDates={stayDates} // Add this line
                                                                    onChange={(careData, error) => handleCareTableChange(careData, error, idx, index)}
                                                                    forceShowErrors={validationAttempted}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>

                                                                {selectedCourseOfferId && questionHasKey(q, QUESTION_KEYS.WHICH_COURSE) && (
                                                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                                        <div className="flex items-center gap-2">
                                                                            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                                            </svg>
                                                                            <div className="text-sm">
                                                                                <p className="font-medium text-blue-800">Course Pre-selected</p>
                                                                                <p className="text-blue-700">This course was automatically selected based on your booking choice. You can change this selection if needed.</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                
                                                                <div className={`
                                                                    mt-2 rounded-xl border-2 transition-all duration-200 p-3
                                                                    ${getCardContainerClasses(q, hasUserInteracted, hasPrefillData)}
                                                                `}>
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
                                                                        bookingId={guest?.id}
                                                                        currentUser={guest}
                                                                        stayDates={stayDates}
                                                                        courseOffers={courseOffers}
                                                                        courseOffersLoaded={courseOffersLoaded}
                                                                        localFilterState={localFilterState}
                                                                        forceShowErrors={validationAttempted}
                                                                        onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    />
                                                                </div>
                                                                {!!(q.error && (validationAttempted || hasUserInteracted)) && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">
                                                                            {q.error || 'Please select an option'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'card-selection-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                
                                                                <div className={`
                                                                    mt-2 rounded-xl border-2 transition-all duration-200 p-3
                                                                    ${getCardContainerClasses(q, hasUserInteracted, hasPrefillData)}
                                                                `}>
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
                                                                        bookingId={guest?.id}
                                                                        currentUser={guest}
                                                                        stayDates={stayDates}
                                                                        courseOffers={courseOffers}
                                                                        courseOffersLoaded={courseOffersLoaded}
                                                                        localFilterState={localFilterState}
                                                                        forceShowErrors={validationAttempted}
                                                                        onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    />
                                                                </div>
                                                                {!!(q.error && (validationAttempted || hasUserInteracted)) && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">
                                                                            {q.error || 'Please select at least one option'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'horizontal-card' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                <div className={`
                                                                    mt-2 rounded-xl border-2 transition-all duration-200 p-3
                                                                    ${getCardContainerClasses(q, hasUserInteracted, hasPrefillData)}
                                                                `}>
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
                                                                        bookingId={guest?.id}
                                                                        currentUser={guest}
                                                                        stayDates={stayDates}
                                                                        courseOffers={courseOffers}
                                                                        courseOffersLoaded={courseOffersLoaded}
                                                                        localFilterState={localFilterState}
                                                                        forceShowErrors={validationAttempted}
                                                                        onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    />
                                                                </div>
                                                                {!!(q.error && (validationAttempted || hasUserInteracted)) && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">
                                                                            {q.error || 'Please select an option'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'horizontal-card-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                
                                                                <div className={`
                                                                    mt-2 rounded-xl border-2 transition-all duration-200 p-3
                                                                    ${getCardContainerClasses(q, hasUserInteracted, hasPrefillData)}
                                                                `}>
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
                                                                        bookingId={guest?.id}
                                                                        currentUser={guest}
                                                                        stayDates={stayDates} 
                                                                        courseOffers={courseOffers}
                                                                        courseOffersLoaded={courseOffersLoaded}
                                                                        localFilterState={localFilterState}
                                                                        forceShowErrors={validationAttempted}
                                                                        onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    />
                                                                </div>
                                                                {!!(q.error && (validationAttempted || hasUserInteracted)) && (
                                                                    <div className="mt-1.5 flex items-center">
                                                                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                        </svg>
                                                                        <p className="text-red-600 text-sm font-medium">
                                                                            {q.error || 'Please select at least one option'}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'package-selection' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='package-selection' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    funder={localFilterState.funderType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.funder || 'NDIS'}
                                                                    selectedFunder={funder}
                                                                    ndis_package_type={localFilterState.ndisPackageType || (typeof q.details === 'string' ? JSON.parse(q.details) : q.details)?.ndis_package_type || 'sta'}
                                                                    additionalFilters={localFilterState.additionalFilters}
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    localFilterState={localFilterState}
                                                                    careAnalysisData={careAnalysisData}
                                                                    courseAnalysisData={courseAnalysisData}
                                                                    packageFilterCriteria={packageFilterCriteria}
                                                                    formData={enhancedFormData}
                                                                    qaData={getCurrentFormQAData()}
                                                                    forceShowErrors={validationAttempted}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    origin={origin}
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'package-selection-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
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
                                                                    localFilterState={localFilterState}
                                                                    forceShowErrors={validationAttempted}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                    origin={origin}
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'service-cards' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='service-cards' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    option_type={q.option_type || 'service'}
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    forceShowErrors={validationAttempted}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
                                                            </div>
                                                        </React.Fragment>
                                                    )}

                                                    {(q.type === 'service-cards-multi' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1 col-span-full">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                    {q.tooltip && <TooltipIcon tooltip={q.tooltip} />}
                                                                </div>
                                                                
                                                                <GetField 
                                                                    key={q.id} 
                                                                    type='service-cards-multi' 
                                                                    value={q.answer} 
                                                                    width='100%' 
                                                                    options={options} 
                                                                    option_type={q.option_type || 'service'}
                                                                    error={q.error} 
                                                                    required={q.required ? true : false} 
                                                                    size={q.size || 'medium'}
                                                                    forceShowErrors={validationAttempted}
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
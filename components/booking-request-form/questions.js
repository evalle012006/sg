import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { GetField } from "../fields/index";
import { v4 as uuidv4 } from 'uuid';
import { useDispatch } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import { findByQuestionKey, generateQuestionKey, QUESTION_KEYS, questionHasKey } from "../../services/booking/question-helper";
import { getCrossValidationValue } from "../../utilities/dateUtils";
import { getInfantCareQuestionMapping } from "../../utilities/bookingRequestForm";

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
                        // FIXED: Exit early since we know it's Non-NDIS
                        break;
                    }
                }
                
                if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT) && 
                    question.answer === 'Yes') {
                    newNdisPackageType = 'sta';
                    console.log('✅ STA package: STA is stated support (takes precedence)');
                }

                // If not STA, check for holiday conditions
                if (!newNdisPackageType || newNdisPackageType !== 'sta') {
                    let isHolidayType = false;
                    
                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_ALONE) && 
                        question.answer === 'Yes') {
                        isHolidayType = true;
                        console.log('✅ Holiday type detected: Lives alone');
                    }

                    if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_IN_SIL) && 
                        question.answer === 'Yes') {
                        isHolidayType = true;
                        console.log('✅ Holiday type detected: Lives in SIL');
                    }

                    // if (questionHasKey(question, QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS) && 
                    //     question.answer === 'Yes') {
                    //     isHolidayType = true;
                    //     console.log('✅ Holiday type detected: Staying with informal supports');
                    // }
                    
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
        
        console.log('📊 Local filters calculated:', newFilters);
        return newFilters;
    };

    const updateSections = async (value, field, secIdx, qIdx, equipments = [], error = false) => {
        const currentValue = currentPage.Sections[secIdx]?.Questions[qIdx]?.[field];
        const currentError = currentPage.Sections[secIdx]?.Questions[qIdx]?.error;
        const question = currentPage.Sections[secIdx]?.Questions[qIdx];
        
        const isSameValue = 
            (currentValue === value) || 
            (JSON.stringify(currentValue) === JSON.stringify(value));
        
        const isSameError = currentError === error;

        const affectsOtherQuestions = () => {
            if (!question) return false;
            
            // For questions moved from QaPairs, we need to find the original question ID
            let questionId = question.question_id || question.id;
            
            // For moved questions (fromQa = true), find the original question ID from QaPairs
            if (question.fromQa && currentPage.Sections) {
                const currentSection = currentPage.Sections[secIdx];
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

                        if (qTemp.type === 'service-cards' || qTemp.type === 'service-cards-multi') {
                            qTemp[field] = value;
                            qTemp.dirty = true;
                        } else if (qTemp.type === 'select' || qTemp.type === 'multi-select') {
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
                console.log('🔄 Question affects dependencies, forcing immediate update');
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
        if (!currentPage?.Sections) return;
        
        let needsUpdate = false;
        const updatedSections = currentPage.Sections.map(section => {
            const updatedQuestions = section.Questions.map(question => {
                if ((question.type === 'service-cards' || question.type === 'service-cards-multi') && !question.answer) {
                    needsUpdate = true;
                    
                    // Initialize answer with all services as "No" (selected: false)
                    const options = typeof question.options === 'string' 
                        ? JSON.parse(question.options) 
                        : question.options;
                    
                    const initialAnswer = {};
                    options.forEach(option => {
                        initialAnswer[option.value] = {
                            selected: false,
                            subOptions: []
                        };
                    });
                    
                    return { ...question, answer: initialAnswer };
                }
                return question;
            });
            
            return { ...section, Questions: updatedQuestions };
        });
        
        if (needsUpdate) {
            const updatedPage = { ...currentPage, Sections: updatedSections };
            setUpdatedCurrentPage(updatedPage);
        }
    }, [currentPage?.id]);

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
        'package-selection-multi', 'service-cards', 'service-cards-multi'   
    ];

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
                                                console.log("EQUIPMENT CHANGES DETECTED: ", changes);
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
                                                    console.log("QA PAIR UPDATES TO PROCESS: ", qaPairUpdates);
                                                    // Apply QA pair updates to current page sections if any
                                                    if (qaPairUpdates.length > 0) {
                                                        // FIXED: Defer page updates as well
                                                        setTimeout(() => {
                                                            const updatedSections = [...currentPage.Sections];
                                                            
                                                            qaPairUpdates.forEach(qaPairUpdate => {
                                                                // Find the section and question for this QA pair update
                                                                for (let sectionIndex = 0; sectionIndex < updatedSections.length; sectionIndex++) {
                                                                    const section = updatedSections[sectionIndex];
                                                                    
                                                                    for (let questionIndex = 0; questionIndex < section.Questions.length; questionIndex++) {
                                                                        const question = section.Questions[questionIndex];
                                                                        console.log("FOUND QUESTION: ", question)
                                                                        if (question.question_key === qaPairUpdate.question_key) {
                                                                            // Update the question's answer
                                                                            updatedSections[sectionIndex].Questions[questionIndex] = {
                                                                                ...question,
                                                                                answer: qaPairUpdate.answer,
                                                                                dirty: true,
                                                                                oldAnswer: question.answer || null,
                                                                                equipment_related: true
                                                                            };
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            });
                                                            
                                                            // Update the page with the modified sections
                                                            const updatedPageData = { ...currentPage, Sections: updatedSections, dirty: true };
                                                            setUpdatedCurrentPage(updatedPageData);
                                                            
                                                            // Also trigger immediate update
                                                            if (typeof updateAndDispatchPageDataImmediate === 'function') {
                                                                updateAndDispatchPageDataImmediate(updatedSections, currentPage.id);
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500  ml-1 font-bold">*</span>}
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
                                                                        allowPrevDate={QUESTION_KEYS.CHECK_IN_DATE === q.question_key || QUESTION_KEYS.CHECK_OUT_DATE === q.question_key ? false : true}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                            <span className="font-bold text-sm">{q.question}</span>
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
                                                                            <span className="font-bold text-sm">{q.question}</span>
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
                                                            {questionHasKey(q, QUESTION_KEYS.COURSE_OFFER_QUESTION) && console.log('🎓 Rendering course offer question:', {
                                                                question: q.question,
                                                                answer: q.answer,
                                                                prePopulated: q.prePopulated,
                                                                protected: q.protected,
                                                                options: options?.map(opt => opt.label)
                                                            })}
                                                            <div className="flex flex-col w-full flex-1" id={q.id}>
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                            label={q.question} 
                                                            value={q.answer} 
                                                            width='100%' 
                                                            error="Required field" 
                                                            required={q.required ? true : false}
                                                            infantCareQuantities={infantCareQuantities}
                                                            onChange={(isValid, equipmentChanges) => {
                                                                handleEquipmentFieldChange('', idx, index, equipmentChanges);
                                                            }} 
                                                        />
                                                    )}
                                                    {(q.type === 'radio-ndis' && !q.hidden) && (
                                                        <React.Fragment>
                                                            <div className="flex flex-col w-full flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                            <div className="flex flex-col max-w-screen-2xl flex-1">
                                                                {q.label && <span className="font-bold text-sargood-blue text-xl mb-2">{q.label}</span>}
                                                                <div className="text-xs flex flex-row">
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                                                                </div>
                                                                <span className="italic text-sm my-2">Please note, we do not provide scheduled care between midnight and 6:30am</span>
                                                                <GetField type='care-table'
                                                                    name={`care-table`}
                                                                    value={q.answer}
                                                                    required={q.required ? true : false}
                                                                    stayDates={stayDates} // Add this line
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
                                                                    {q.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
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
                                                                    stayDates={stayDates} // Add this line
                                                                    courseOffers={courseOffers}
                                                                    courseOffersLoaded={courseOffersLoaded}
                                                                    localFilterState={localFilterState}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    stayDates={stayDates}
                                                                    courseOffers={courseOffers}
                                                                    courseOffersLoaded={courseOffersLoaded}
                                                                    localFilterState={localFilterState}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    stayDates={stayDates}
                                                                    courseOffers={courseOffers}
                                                                    courseOffersLoaded={courseOffersLoaded}
                                                                    localFilterState={localFilterState}
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    stayDates={stayDates} 
                                                                    courseOffers={courseOffers}
                                                                    courseOffersLoaded={courseOffersLoaded}
                                                                    localFilterState={localFilterState}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
                                                                />
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
                                                                    <span className="font-bold text-sm">{q.question}</span>
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
                                                                    localFilterState={localFilterState}
                                                                    onChange={(value) => handleCardSelectionFieldChange(value, idx, index)} 
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
import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import { globalActions } from "../../store/globalSlice";
import { toast } from "react-toastify";
import moment from 'moment';
import { useDebouncedCallback } from "use-debounce";
import _, { get, update } from "lodash";
import { omitAttribute, validateEmail, validatePhoneNumber } from "../../utilities/common";
import { analyzeCourseFromBookingData, createCourseFilterCriteria } from '../../utilities/courseAnalysisHelper';
import { generateSummaryData } from "../../services/booking/create-summary-data";
import {
    findByQuestionKey,
    QUESTION_KEYS,
    questionHasKey,
    questionMatches,
} from "../../services/booking/question-helper";

import { 
    postProcessPagesForNdis,
    analyzeNdisProcessingNeeds,
    processFormDataForNdisPackages,
    applyQuestionDependenciesAcrossPages,
    validateProcessedData,
    checkAndUpdateNdisFundingStatus,
    convertQAtoQuestionWithNdisFilter,
    forceRefreshAllDependencies,
    getStayDatesFromForm,
    clearHiddenQuestionAnswers,
    shouldMoveQuestionToNdisPage,
    extractCurrentFundingAnswer,
    getInfantCareQuestionMapping,
    getCurrentFunder,
    detectNdisFundingFromSections,
} from "../../utilities/bookingRequestForm";

import { 
    batchUpdateFirstTimeGuestCompletions,
    forceUpdateFirstTimeGuestPageCompletion,
    calculateFirstTimeGuestPageCompletion,
    validateFirstTimeGuestCompletionConsistency 
} from '../../utilities/firstTimeGuestCompletionHelper';

import { 
    calculateReturningGuestPageCompletion, 
    batchUpdateReturningGuestCompletions,
    forceUpdateReturningGuestPageCompletion, 
} from "../../utilities/returningGuestCompletionHelper";

import dynamic from 'next/dynamic';
import Modal from "../../components/ui/modal";
import SummaryOfStay from "../../components/booking-request-form/summary";
import { useAutofillDetection } from "../../hooks/useAutofillDetection";
import { BOOKING_TYPES } from "../../components/constants";
import { calculateCareHours, createPackageFilterCriteria } from '../../utilities/careHoursCalculator';
import { getBestMatchPackageId, getCurrentPackageAnswer } from "../../utilities/packageMatchChecker";
import { scroller, Element } from 'react-scroll';

const BookingProgressHeader = dynamic(() => import('../../components/booking-request-form/booking-progress-header'));
const QuestionPage = dynamic(() => import('../../components/booking-request-form/questions'));
const BookingFormLayout = dynamic(() => import('../../components/booking-request-form/BookingFormLayout'), { ssr: false });
const Accordion = dynamic(() => import('../../components/ui-v2/Accordion'), { ssr: false });

const BookingRequestForm = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.user);
    const bookingRequestFormData = useSelector(state => state.bookingRequestForm.data);
    const questionDependenciesData = useSelector(state => state.bookingRequestForm.questionDependencies);
    const currentPage = useSelector(state => state.bookingRequestForm.currentPage);
    const equipmentChangesState = useSelector(state => state.bookingRequestForm.equipmentChanges);
    const bookingSubmitted = useSelector(state => state.bookingRequestForm.bookingSubmitted);
    const isNdisFunded = useSelector(state => state.bookingRequestForm.isNdisFunded);
    const bookingFormRoomSelected = useSelector(state => state.bookingRequestForm.rooms);

    const [booking, setBooking] = useState();
    const [guest, setGuest] = useState();
    const router = useRouter();
    const { uuid, prevBookingId, origin } = router.query;
    const [currentBookingType, setCurrentBookingType] = useState(BOOKING_TYPES.FIRST_TIME_GUEST);
    const [currentBookingStatus, setCurrentBookingStatus] = useState();
    const [equipmentPageCompleted, setEquipmentPageCompleted] = useState(false);
    const funder = useSelector(state => state.bookingRequestForm.funder);

    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [bookingData, setBookingData] = useState();
    const [summaryData, setSummaryData] = useState({ uuid: null, guestName: null, rooms: [], data: [], agreement_tc: null, signature: null });

    const [bookingAmended, setBookingAmended] = useState(false);
    const [activeAccordionIndex, setActiveAccordionIndex] = useState(0);
    const [profileDataLoaded, setProfileDataLoaded] = useState(false);
    const [pendingProfileSaves, setPendingProfileSaves] = useState(new Map());

    const [processedFormData, setProcessedFormData] = useState([]);
    const [isProcessingNdis, setIsProcessingNdis] = useState(false);

    const [isUpdating, setIsUpdating] = useState(false);
    const lastDispatchedDataRef = useRef(null);

    const prevFormDataRef = useRef(null);
    const prevIsNdisFundedRef = useRef(null);

    const layoutRef = useRef(null);
    const profilePreloadInProgressRef = useRef(false);
    const profileSaveInProgressRef = useRef(false);
    const lastProcessingTimeRef = useRef(0);
    const processingTimeoutRef = useRef(null);
    const deletedCourseHandledRef = useRef(false);

    useAutofillDetection();

    const [ndisFormFilters, setNdisFormFilters] = useState({
        funderType: 'NDIS',
        ndisPackageType: 'sta',
        additionalFilters: {
            region: 'NSW',
            priceRange: { min: 100, max: 500 }
        }
    });

    const [courseOffers, setCourseOffers] = useState([]);
    const [courseOffersLoaded, setCourseOffersLoaded] = useState(false);

    const [careAnalysisData, setCareAnalysisData] = useState(null);
    const [packageFilterCriteria, setPackageFilterCriteria] = useState({});

    const [stayDates, setStayDates] = useState({ checkInDate: null, checkOutDate: null });

    const [courseAnalysisData, setCourseAnalysisData] = useState({
        hasCourse: false,
        courseId: null,
        courseName: null,
        courseOffered: false,
        analysis: 'Initializing...',
        dataSource: 'none'
    });

    const [packageAutoUpdateInProgress, setPackageAutoUpdateInProgress] = useState(false);
    const lastAutoUpdateCheckRef = useRef(null);
    const autoUpdateTimeoutRef = useRef(null);

    const careQuestionUpdateRef = useRef(null);
    const lastCareQuestionUpdateRef = useRef(0);

    const [visitedPages, setVisitedPages] = useState(new Set());
    const [pagesWithSavedData, setPagesWithSavedData] = useState(new Set());

    const [selectedCourseOfferId, setSelectedCourseOfferId] = useState(null);

    const [completedEquipments, setCompletedEquipments] = useState(false);
    const [hasFutureCourseOffers, setHasFutureCourseOffers] = useState(null); // null = not checked yet, true/false = has/doesn't have offers
    const [futureCourseOffersChecked, setFutureCourseOffersChecked] = useState(false);
    const courseValidationRef = useRef(false);

    const initialDatesExtractedRef = useRef(false);
    const stayDatesRef = useRef(stayDates);

    const equipmentFieldRef = useRef(null);
    
    useEffect(() => {
        console.log('📊 CARE DATA DEBUG:', {
            currentCareAnalysis: {
                totalHours: currentCareAnalysis?.totalHoursPerDay,
                dataSource: currentCareAnalysis?.dataSource,
                pattern: currentCareAnalysis?.carePattern
            },
            careAnalysisData: {
                totalHours: careAnalysisData?.totalHoursPerDay,
                dataSource: careAnalysisData?.dataSource,
                pattern: careAnalysisData?.carePattern
            },
            formDataLength: processedFormData?.length || bookingRequestFormData?.length || 0
        });
    }, [currentCareAnalysis, careAnalysisData, processedFormData?.length, bookingRequestFormData?.length]);

    // Callback to immediately update stay dates when changed in child component
    const updateStayDatesImmediate = useCallback((newDates) => {
        if (newDates.checkInDate || newDates.checkOutDate) {
            // console.log('📅 Immediate stay dates update:', newDates);
            
            const updatedDates = {
                checkInDate: newDates.checkInDate || stayDatesRef.current?.checkInDate || null,
                checkOutDate: newDates.checkOutDate || stayDatesRef.current?.checkOutDate || null
            };
            
            // console.log('📅 Final updated dates:', updatedDates);
            
            // Update both state and ref immediately
            stayDatesRef.current = updatedDates;
            setStayDates(updatedDates);
            
            if (updatedDates.checkInDate) {
                dispatch(bookingRequestFormActions.setCheckinDate(updatedDates.checkInDate));
            }
            if (updatedDates.checkOutDate) {
                dispatch(bookingRequestFormActions.setCheckoutDate(updatedDates.checkOutDate));
            }
        }
    }, [dispatch]);

    const fetchAllFutureCourseOffers = useCallback(async () => {
        const guestId = getGuestId();
        if (!guestId) {
            console.log('❌ No guest ID available for fetching future course offers');
            setHasFutureCourseOffers(false);
            setFutureCourseOffersChecked(true);
            return { hasOffers: false, offers: [] };
        }

        try {
            console.log('📚 Fetching all future course offers for guest:', guestId);
            
            // API endpoint to get all future offers without date restrictions
            const apiUrl = `/api/guests/${guestId}/course-offers-future`;
            
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                const futureOffers = data.courseOffers || [];
                
                const hasOffers = data.hasFutureOffers === true && futureOffers.length > 0;
                
                // console.log(`📚 Future course offers check complete:`, {
                //     total: futureOffers.length,
                //     hasOffers: hasOffers,
                //     summary: data.summary
                // });
                
                setHasFutureCourseOffers(hasOffers);
                setFutureCourseOffersChecked(true);
                
                return {
                    hasOffers: hasOffers,
                    offers: futureOffers,
                    summary: data.summary
                };
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Failed to fetch future course offers:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData.message
                });
                setHasFutureCourseOffers(false);
                setFutureCourseOffersChecked(true);
                return { hasOffers: false, offers: [], error: errorData.message };
            }
        } catch (error) {
            console.error('❌ Error fetching future course offers:', error);
            setHasFutureCourseOffers(false);
            setFutureCourseOffersChecked(true);
            return { hasOffers: false, offers: [], error: error.message };
        }
    }, [getGuestId]);

    const hasExistingCourseSelection = useCallback((pages) => {
        for (const page of pages) {
            for (const section of page.Sections || []) {
                // Check QaPairs for existing course selections
                if (section.QaPairs && section.QaPairs.length > 0) {
                    const courseOfferQaPair = section.QaPairs.find(qaPair => 
                        questionHasKey(qaPair.Question, QUESTION_KEYS.COURSE_OFFER_QUESTION)
                    );
                    
                    // Check if answered "Yes" to course offer
                    const hasCourseOfferYes = courseOfferQaPair && 
                        courseOfferQaPair.answer?.toLowerCase() === 'yes';
                    
                    const whichCourseQaPair = section.QaPairs.find(qaPair =>
                        questionHasKey(qaPair.Question, QUESTION_KEYS.WHICH_COURSE)
                    );
                    
                    const hasWhichCourseAnswer = whichCourseQaPair &&
                        whichCourseQaPair.answer !== null &&
                        whichCourseQaPair.answer !== undefined &&
                        whichCourseQaPair.answer !== '';
                    
                    if (hasCourseOfferYes || hasWhichCourseAnswer) {
                        // console.log(`✅ Found existing course selection in "${page.title}" QaPairs`, {
                        //     hasCourseOfferYes,
                        //     courseOfferAnswer: courseOfferQaPair?.answer,
                        //     hasWhichCourseAnswer,
                        //     whichCourseAnswer: whichCourseQaPair?.answer
                        // });
                        return true;
                    }
                }
                
                // Also check Questions array for answered course questions
                if (section.Questions && section.Questions.length > 0) {
                    const courseOfferQuestion = section.Questions.find(question =>
                        questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION)
                    );
                    
                    const hasCourseOfferYes = courseOfferQuestion &&
                        courseOfferQuestion.answer?.toLowerCase() === 'yes';
                    
                    const whichCourseQuestion = section.Questions.find(question =>
                        questionHasKey(question, QUESTION_KEYS.WHICH_COURSE)
                    );
                    
                    const hasWhichCourseAnswer = whichCourseQuestion &&
                        whichCourseQuestion.answer !== null &&
                        whichCourseQuestion.answer !== undefined &&
                        whichCourseQuestion.answer !== '';
                    
                    if (hasCourseOfferYes || hasWhichCourseAnswer) {
                        // console.log(`✅ Found existing course selection in "${page.title}" Questions`, {
                        //     hasCourseOfferYes,
                        //     courseOfferAnswer: courseOfferQuestion?.answer,
                        //     hasWhichCourseAnswer,
                        //     whichCourseAnswer: whichCourseQuestion?.answer
                        // });
                        return true;
                    }
                }
            }
        }
        console.log('❌ No existing course selection found in any page');
        return false;
    }, []);

    const filterCoursesPageIfNoOffers = useCallback((pages, hasOffers) => {
        // If we haven't checked yet or if offers exist, don't filter anything
        if (hasOffers === null || hasOffers === true) {
            return pages;
        }

        // EXCEPTION: Check if there's already a saved course selection
        const hasExistingSelection = hasExistingCourseSelection(pages);
        
        if (hasExistingSelection) {
            // console.log('Keeping courses page - existing course selection found in QaPairs');
            return pages; // Don't filter - keep the courses page
        }

        // console.log('No future course offers available - filtering out courses page');

        // Filter out pages that contain course-related questions
        const filteredPages = pages.filter(page => {
            const hasCourseQuestions = page.Sections?.some(section =>
                section.Questions?.some(question =>
                    questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION) ||
                    questionHasKey(question, QUESTION_KEYS.WHICH_COURSE)
                )
            );

            if (hasCourseQuestions) {
                // console.log(`Hiding page: "${page.title}" (no future course offers and no existing selection)`);
                return false; // Exclude this page
            }

            return true; // Keep this page
        });

        return filteredPages;
    }, [hasExistingCourseSelection]);

    const useCompletionLock = () => {
        const completionLockRef = useRef(new Set());
        
        const lockPageCompletion = useCallback((pageId) => {
            if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                completionLockRef.current.add(pageId);
                // console.log(`🔒 Completion locked for returning guest page: ${pageId}`);
            }
        }, [currentBookingType, prevBookingId]);
        
        const unlockPageCompletion = useCallback((pageId) => {
            completionLockRef.current.delete(pageId);
            // console.log(`🔓 Completion unlocked for page: ${pageId}`);
        }, []);
        
        const isCompletionLocked = useCallback((pageId) => {
            return completionLockRef.current.has(pageId);
        }, []);
        
        const lockAllPagesForReturningGuest = useCallback(() => {
            if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                // Lock all pages except equipment (which the helper handles specially)
                if (stableProcessedFormData) {
                    stableProcessedFormData.forEach(page => {
                        if (page.id !== 301) { // Don't lock equipment page
                            completionLockRef.current.add(page.id);
                        }
                    });
                    // console.log(`🔒 All pages locked for returning guest. Locked pages:`, Array.from(completionLockRef.current));
                }
            }
        }, [currentBookingType, prevBookingId, stableProcessedFormData]);
        
        return {
            lockPageCompletion,
            unlockPageCompletion,
            isCompletionLocked,
            lockAllPagesForReturningGuest
        };
    };

    const { lockPageCompletion, unlockPageCompletion, isCompletionLocked, lockAllPagesForReturningGuest } = useCompletionLock();

    useEffect(() => {
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId && stableProcessedFormData?.length > 0) {
            lockAllPagesForReturningGuest();
        }
    }, [currentBookingType, prevBookingId, stableProcessedFormData?.length, lockAllPagesForReturningGuest]);

    const validateDatesWithExistingAPI = useCallback(async (checkInDate, checkOutDate, courseOfferId) => {
        if (!courseOfferId || !checkInDate || !checkOutDate) {
            return { valid: true, message: null };
        }

        try {
            const guestId = getGuestId();
            if (!guestId) {
                return { valid: false, message: 'Unable to validate - guest information missing' };
            }

            const params = new URLSearchParams({
                checkInDate: checkInDate,
                checkOutDate: checkOutDate
            });
            
            const response = await fetch(`/api/guests/${guestId}/course-offers?${params}`);

            if (!response.ok) {
                throw new Error(`API call failed: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success && Array.isArray(result.courseOffers)) {
                const targetOffer = result.courseOffers.find(offer => 
                    offer.id?.toString() === courseOfferId.toString() ||
                    offer.courseId?.toString() === courseOfferId.toString()
                );
                
                if (targetOffer) {
                    return {
                        valid: targetOffer.dateValid !== false,
                        message: targetOffer.dateValidationMessage || null,
                        courseOffer: {
                            id: targetOffer.id,
                            courseId: targetOffer.courseId,
                            courseName: targetOffer.courseName,
                            offerStatus: targetOffer.offerStatus
                        }
                    };
                } else {
                    return {
                        valid: false,
                        message: 'Course offer not found or no longer available'
                    };
                }
            } else {
                return {
                    valid: false,
                    message: 'Unable to validate course offer'
                };
            }
            
        } catch (error) {
            console.error('❌ Error validating dates with existing API:', error);
            return {
                valid: false,
                message: 'Unable to validate dates against course offer. Please try again.'
            };
        }
    }, [getGuestId]);

    const isCareRelatedQuestion = useCallback((question) => {
        if (!question) return false;
        
        return questionHasKey(question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) ||
            questionHasKey(question, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
            question.question_key === 'do-you-require-assistance-with-personal-care' ||
            question.question?.toLowerCase().includes('personal care');
    }, []);

    const forceCareAnalysisAndPackageUpdate = useCallback(async () => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastCareQuestionUpdateRef.current;
        
        // Debounce to prevent excessive calls (500ms)
        if (timeSinceLastUpdate < 500) {
            return;
        }
        
        lastCareQuestionUpdateRef.current = now;
        
        console.log('🏥 Care-related question updated, forcing analysis refresh...');
        
        // Clear any pending timeouts
        if (careQuestionUpdateRef.current) {
            clearTimeout(careQuestionUpdateRef.current);
        }
        
        // Use timeout to ensure form data is updated first
        careQuestionUpdateRef.current = setTimeout(async () => {
            try {
                // Force recalculation of care analysis by updating a trigger
                const currentData = stableProcessedFormData || stableBookingRequestFormData;
                if (currentData && currentData.length > 0) {
                    // Re-trigger NDIS filters calculation
                    const newFilters = calculateNdisFilters(currentData);
                    if (JSON.stringify(newFilters) !== JSON.stringify(ndisFormFilters)) {
                        console.log('🔄 Care question update - updating NDIS filters:', newFilters);
                        setNdisFormFilters(newFilters);
                    }
                    
                    // Force package auto-update with a slight delay to ensure care analysis is updated
                    setTimeout(() => {
                        console.log('🔄 Care question update - triggering package auto-update...');
                        autoUpdatePackageSelection();
                    }, 100);
                }
            } catch (error) {
                console.error('❌ Error in forceCareAnalysisAndPackageUpdate:', error);
            }
        }, 150);
    }, [
        stableProcessedFormData, 
        stableBookingRequestFormData, 
        calculateNdisFilters, 
        ndisFormFilters, 
        autoUpdatePackageSelection
    ]);

    const savePackageSelection = useCallback(async (updatedQuestion, sectionId, packagePage) => {
        try {
            console.log('💾 Saving auto-updated package selection to backend...');

            // Create qa_pair object for the updated package question
            const qa_pair = {
                question: updatedQuestion.question,
                answer: updatedQuestion.answer,
                question_type: updatedQuestion.type,
                question_id: updatedQuestion.fromQa ? updatedQuestion.question_id : updatedQuestion.id,
                section_id: sectionId,
                submit: false, // Not submitting, just saving
                updatedAt: new Date().toISOString(),
                dirty: true,
                oldAnswer: updatedQuestion.oldAnswer,
                question_key: updatedQuestion.question_key
            };

            // If this is from a QaPair (existing answer), include the QaPair ID
            if (updatedQuestion.fromQa && updatedQuestion.id) {
                qa_pair.id = updatedQuestion.id;
            }

            // Prepare the save request
            const saveData = {
                qa_pairs: [qa_pair],
                flags: { 
                    origin: origin, 
                    bookingUuid: uuid || null,
                    pageId: packagePage.id, 
                    templateId: packagePage.template_id,
                    autoUpdate: true // Flag to indicate this is an auto-update
                }
            };

            // Make the API call
            const response = await fetch('/api/booking-request-form/save-qa-pair', {
                method: 'POST',
                body: JSON.stringify(saveData),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Package selection auto-update saved successfully:', {
                    questionId: updatedQuestion.id,
                    newAnswer: updatedQuestion.answer,
                    saved: true
                });

                // Update booking amended status if needed
                if (result.success && result.bookingAmended && bookingAmended === false) {
                    setBookingAmended(true);
                }
            } else {
                console.error('❌ Failed to save auto-updated package selection:', response.statusText);
            }

        } catch (error) {
            console.error('❌ Error saving auto-updated package selection:', error);
        }
    }, [uuid, origin, bookingAmended, setBookingAmended]);

    const autoUpdatePackageSelection = useCallback(async () => {
        // Only check if we have stable data and not processing
        if (!stableProcessedFormData || stableProcessedFormData.length === 0 || 
            isProcessingNdis || isUpdating || !careAnalysisData || !courseAnalysisData ||
            packageAutoUpdateInProgress) {
            return;
        }

        // CRITICAL FIX: For returning guests, only run if user has visited the Packages page
        // or if there's a real saved QaPair (not just prefilled temporary data)
        if (prevBookingId) {
            // Find the Packages page
            const packagesPage = stableProcessedFormData.find(page => 
                page.title === 'Packages' || 
                page.Sections?.some(section =>
                    section.Questions?.some(question =>
                        question.type === 'package-selection' || 
                        question.type === 'package-selection-multi'
                    )
                )
            );
            
            if (packagesPage) {
                const hasVisitedPackagesPage = visitedPages.has(packagesPage.id);
                const hasSavedPackagesData = pagesWithSavedData.has(packagesPage.id);
                
                // Check if there's a real saved QaPair for package selection (not just prefilled)
                const hasRealSavedPackageQaPair = packagesPage.Sections?.some(section =>
                    section.QaPairs?.some(qaPair => {
                        const isPackageQuestion = qaPair.Question?.type === 'package-selection' || 
                                                qaPair.Question?.type === 'package-selection-multi';
                        // Check if it's a real save (has createdAt/updatedAt) and not temporary prefill
                        const isRealSave = isPackageQuestion && 
                                        (qaPair.createdAt || qaPair.updatedAt) && 
                                        !qaPair.temporaryFromPreviousBooking;
                        return isRealSave;
                    })
                );
                
                if (!hasVisitedPackagesPage && !hasSavedPackagesData && !hasRealSavedPackageQaPair) {
                    console.log('⏸️ Skipping package auto-update - user has not visited Packages page yet and no real saved QaPair');
                    return;
                }
            }
        }

        try {
            // Create a stable key for checking if we need to run this update
            const currentCheckKey = JSON.stringify({
                careHours: careAnalysisData.totalHoursPerDay,
                carePattern: careAnalysisData.carePattern,
                hasCourse: courseAnalysisData.hasCourse,
                courseOffered: courseAnalysisData.courseOffered,
                isNdisFunded: isNdisFunded,
                ndisPackageType: ndisFormFilters.ndisPackageType,
                dataLength: stableProcessedFormData.length
            });

            // Skip if we just checked with the same criteria
            if (lastAutoUpdateCheckRef.current === currentCheckKey) {
                return;
            }

            lastAutoUpdateCheckRef.current = currentCheckKey;
            setPackageAutoUpdateInProgress(true);

            const currentFilterState = {
                funderType: isNdisFunded ? 'NDIS' : 'Non-NDIS',
                ndisPackageType: isNdisFunded ? (ndisFormFilters.ndisPackageType || 'sta') : null,
                additionalFilters: ndisFormFilters.additionalFilters || {}
            };

            // Get current package answer
            const currentAnswer = getCurrentPackageAnswer(stableProcessedFormData);
            
            // Only proceed if there's already an answer
            if (!currentAnswer) {
                return;
            }

            // Get the best match package ID
            const bestMatchId = await getBestMatchPackageId(
                stableProcessedFormData,
                careAnalysisData,
                courseAnalysisData,
                currentFilterState
            );

            // If bestMatch is different from current answer, update it
            if (bestMatchId && Number(currentAnswer) !== bestMatchId) {
                console.log('🔄 Auto-updating package selection:', {
                    from: currentAnswer,
                    to: bestMatchId,
                    reason: 'Best match changed due to updated requirements'
                });

                // Find the package page and question
                const packagePageIndex = stableProcessedFormData.findIndex(page =>
                    page.Sections?.some(section =>
                        section.Questions?.some(question =>
                            questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)
                        )
                    )
                );

                if (packagePageIndex !== -1) {
                    const updatedPages = structuredClone(stableProcessedFormData);
                    const packagePage = updatedPages[packagePageIndex];

                    // Find and update the package question
                    let updatedQuestion = null;
                    let updatedSectionId = null;
                    let questionUpdated = false;

                    for (const section of packagePage.Sections) {
                        for (const question of section.Questions) {
                            if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) {
                                // Update the answer and mark as dirty
                                question.answer = bestMatchId;
                                question.dirty = true;
                                
                                updatedQuestion = question;
                                updatedSectionId = section.id;
                                questionUpdated = true;
                                
                                console.log('✅ Package question updated automatically:', {
                                    questionId: question.id,
                                    newAnswer: bestMatchId,
                                    dirty: true
                                });
                                break;
                            }
                        }
                        if (questionUpdated) break;
                    }

                    if (questionUpdated && updatedQuestion) {
                        // Update the processed form data first
                        setProcessedFormData(updatedPages);
                        
                        // Use immediate update handler to update Redux
                        updateAndDispatchPageDataImmediate?.(packagePage.Sections, packagePage.id);

                        // Save the updated package selection to backend
                        await savePackageSelection(updatedQuestion, updatedSectionId, packagePage);
                    }
                }
            } else if (bestMatchId) {
                console.log('📦 Package selection already matches best match:', currentAnswer);
            }

        } catch (error) {
            console.error('❌ Error auto-updating package selection:', error);
        } finally {
            setPackageAutoUpdateInProgress(false);
        }
    }, [
        stableProcessedFormData,
        isProcessingNdis,
        isUpdating,
        careAnalysisData,
        courseAnalysisData,
        isNdisFunded,
        ndisFormFilters.ndisPackageType,
        ndisFormFilters.additionalFilters,
        packageAutoUpdateInProgress,
        updateAndDispatchPageDataImmediate,
        setProcessedFormData,
        savePackageSelection,
        prevBookingId, 
        visitedPages,  
        pagesWithSavedData
    ]);

    const cleanReduxStateBeforeDispatch = useCallback((pages, isNdisFunded) => {
        console.log('🧹 Cleaning Redux state before dispatch...');
        
        // STEP 1: Store the original completion status for ALL pages before cleaning
        const originalCompletions = new Map();
        pages.forEach(page => {
            originalCompletions.set(page.id, page.completed);
        });
        
        const ndisPageExists = pages.some(p => p.id === 'ndis_packages_page');
        let movedQuestionKeys = new Set();
        
        // Collect all question keys that are on NDIS page
        if (ndisPageExists) {
            const ndisPage = pages.find(p => p.id === 'ndis_packages_page');
            ndisPage.Sections.forEach(section => {
                section.Questions?.forEach(question => {
                    const questionKey = question.question_key || question.question || question.id;
                    movedQuestionKeys.add(questionKey);
                    movedQuestionKeys.add(`${questionKey}_${section.id}`);
                });
                section.QaPairs?.forEach(qaPair => {
                    const question = qaPair.Question;
                    if (question) {
                        const questionKey = question.question_key || question.question || qaPair.question_id;
                        movedQuestionKeys.add(questionKey);
                        movedQuestionKeys.add(`${questionKey}_${section.id}`);
                    }
                });
            });
        }
        
        // Clean original pages
        const cleanedPages = pages.map(page => {
            if (page.id === 'ndis_packages_page') return page; // Skip NDIS page
            
            // Step 1: Filter out moved questions and QaPairs
            const sectionsWithFilteredContent = page.Sections.map(section => ({
                ...section,
                Questions: section.Questions?.filter(question => {
                    const questionKey = question.question_key || question.question || question.id;
                    const compositeKey = `${questionKey}_${section.id}`;
                    
                    // Remove if it's an NDIS question that should be moved
                    const isNdisQuestion = question.ndis_only || shouldMoveQuestionToNdisPage?.(question, isNdisFunded);
                    const shouldRemove = isNdisQuestion && isNdisFunded && ndisPageExists && 
                                    (movedQuestionKeys.has(questionKey) || movedQuestionKeys.has(compositeKey));
                    
                    return !shouldRemove;
                }) || [],
                QaPairs: section.QaPairs?.filter(qaPair => {
                    const question = qaPair.Question;
                    if (!question) return true;
                    
                    const questionKey = question.question_key || question.question || qaPair.question_id;
                    const compositeKey = `${questionKey}_${section.id}`;
                    
                    const isNdisQuestion = question.ndis_only || shouldMoveQuestionToNdisPage?.(question, isNdisFunded);
                    const shouldRemove = isNdisQuestion && isNdisFunded && ndisPageExists && 
                                    (movedQuestionKeys.has(questionKey) || movedQuestionKeys.has(compositeKey));
                    
                    return !shouldRemove;
                }) || []
            }));

            // Step 2: Remove empty sections after filtering
            const sectionsWithContent = sectionsWithFilteredContent.filter(section => {
                const hasQuestions = section.Questions && section.Questions.length > 0;
                const hasQaPairs = section.QaPairs && section.QaPairs.length > 0;
                return hasQuestions || hasQaPairs;
            });

            return {
                ...page,
                Sections: sectionsWithContent
            };
        });
        
        // FIXED: Recalculate completion after cleanup with proper preservation for special pages
        const updatedCleanedPages = cleanedPages.map(page => {
            let updatedPage = {...page};
            const originalCompleted = originalCompletions.get(updatedPage.id);
            
            // CRITICAL FIX: Preserve specific page completion during cleaning
            if (currentBookingType === BOOKING_TYPES.FIRST_TIME_GUEST) {
                updatedPage.completed = equipmentPageCompleted || originalCompleted;
                // console.log(`🛡️ Equipment page completion for First Time Guest: ${equipmentPageCompleted}`);
            } else if (updatedPage.id === 'ndis_packages_page' && originalCompleted !== undefined) {
                // FIXED: Preserve NDIS page completion during cleaning operations
                updatedPage.completed = originalCompleted;
                // console.log(`🛡️ Preserved NDIS Requirements page completion during cleaning: ${originalCompleted}`);
            } else {
                // For all other pages, recalculate normally
                updatedPage.completed = calculatePageCompletion(updatedPage);
            }

            return updatedPage;
        });
        
        return updatedCleanedPages;
    }, [calculatePageCompletion, equipmentPageCompleted]);

    const removeDuplicateQuestions = useCallback((pages, isNdisFunded) => {
        const seenQuestions = new Set();
        const seenQuestionIds = new Set(); // ✅ NEW: Track by ID too
        const ndisPageExists = pages.some(p => p.id === 'ndis_packages_page');
        
        console.log('🔧 Starting enhanced duplicate removal with NDIS page cleanup...');
        
        return pages.map(page => {
            const sectionsWithFilteredContent = page.Sections.map(section => {
                const filteredQuestions = section.Questions?.filter(question => {
                    const questionKey = question.question_key || question.question || question.id;
                    const questionId = question.question_id || question.id;
                    const compositeKey = `${questionKey}_${questionId}`;
                    
                    // STEP 1: Remove NDIS questions from non-NDIS pages
                    if (page.id !== 'ndis_packages_page' && question.ndis_only && isNdisFunded && ndisPageExists) {
                        // console.log(`🗑️ Removing NDIS question from ${page.title}: "${question.question}"`);
                        return false;
                    }
                    
                    // STEP 2: Remove duplicates by composite key AND ID
                    if (seenQuestions.has(compositeKey) || seenQuestionIds.has(questionId)) {
                        // console.log(`🗑️ Removing duplicate: "${question.question}" from ${page.title}`);
                        return false;
                    }
                    
                    seenQuestions.add(compositeKey);
                    seenQuestionIds.add(questionId);
                    return true;
                }) || [];

                const filteredQaPairs = section.QaPairs?.filter(qaPair => {
                    const question = qaPair.Question;
                    if (!question) return true;
                    
                    const questionKey = question.question_key || question.question || question.id;
                    const questionId = qaPair.question_id || question.id;
                    const compositeKey = `${questionKey}_${questionId}`;
                    
                    // STEP 1: Remove NDIS QaPairs from non-NDIS pages
                    if (page.id !== 'ndis_packages_page' && question.ndis_only && isNdisFunded && ndisPageExists) {
                        console.log(`🗑️ Removing NDIS QaPair from ${page.title}: "${question.question}"`);
                        return false;
                    }
                    
                    // STEP 2: Remove duplicate QaPairs
                    if (seenQuestions.has(compositeKey) || seenQuestionIds.has(questionId)) {
                        console.log(`🗑️ Removing duplicate QaPair from ${page.title}`);
                        return false;
                    }
                    
                    return true;
                }) || [];

                return {
                    ...section,
                    Questions: filteredQuestions,
                    QaPairs: filteredQaPairs
                };
            });

            // Remove empty sections
            const sectionsWithContent = sectionsWithFilteredContent.filter(section => {
                const hasQuestions = section.Questions && section.Questions.length > 0;
                const hasQaPairs = section.QaPairs && section.QaPairs.length > 0;
                
                if (!hasQuestions && !hasQaPairs) {
                    console.log(`🗑️ Removing empty section "${section.label}" from "${page.title}"`);
                }
                
                return hasQuestions || hasQaPairs;
            });

            return {
                ...page,
                Sections: sectionsWithContent
            };
        });
    }, []);

    const processNdisWithDebounce = useCallback((formData, ndisFunded) => {
        // Clear any pending processing
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
        }
        
        // Debounce the processing to prevent rapid-fire execution
        processingTimeoutRef.current = setTimeout(async () => {
            if (isProcessingNdis) {
                console.log('⏳ NDIS processing already in progress, skipping...');
                return;
            }
            
            setIsProcessingNdis(true);
            
            try {
                console.log('🔄 Running debounced NDIS processing...');
                
                // STEP 1: Process and move NDIS questions to NDIS page
                const processed = processFormDataForNdisPackages(
                    formData,
                    ndisFunded,
                    calculatePageCompletion,
                    (page, allPages) => applyQuestionDependenciesAcrossPages(page, allPages, bookingFormRoomSelected),
                    bookingFormRoomSelected
                );

                // ✅ CRITICAL FIX: Protect profile data during processing
                const protectedProcessed = processed.map(page => ({
                    ...page,
                    Sections: page.Sections.map(section => ({
                        ...section,
                        Questions: section.Questions.map(question => {
                            // Don't override answers that came from profile
                            if (question.fromProfile && question.protected) {
                                const originalQuestion = formData
                                    .find(p => p.id === page.id)
                                    ?.Sections.find(s => s.id === section.id)
                                    ?.Questions.find(q => q.id === question.id || q.question_key === question.question_key);
                                
                                if (originalQuestion?.fromProfile) {
                                    return {
                                        ...question,
                                        answer: originalQuestion.answer, // Preserve profile answer
                                        fromProfile: true,
                                        protected: true
                                    };
                                }
                            }
                            return question;
                        })
                    }))
                }));
                
                // STEP 2: Remove duplicates AND clean up empty sections
                const deduplicated = removeDuplicateQuestions(protectedProcessed, ndisFunded);
                
                // STEP 3: Apply dependencies
                const withDependencies = forceRefreshAllDependencies(deduplicated, bookingFormRoomSelected);
                
                // STEP 4: ✅ CRITICAL FIX: Use guarded completion calculation
                const withCompletion = withDependencies.map(page => {
                    const wasCompleted = page.completed;
                    let newCompleted;
                    
                    // ✅ FIXED: For returning guests, ONLY use the helper - ignore other calculations
                    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                        newCompleted = calculateReturningGuestPageCompletion(page, {
                            visitedPages,
                            pagesWithSavedData,
                            equipmentPageCompleted,
                            equipmentChangesState,
                            prevBookingId,
                            currentBookingType
                        });
                        // console.log(`🔒 NDIS Processing: Using helper completion for "${page.title}": ${wasCompleted} → ${newCompleted}`);
                    } else {
                        // For first-time guests, use standard calculation
                        if (page.id === 'ndis_packages_page') {
                            newCompleted = calculateNdisPageCompletion(page);
                        } else {
                            newCompleted = calculatePageCompletion(page, visitedPages, pagesWithSavedData);
                        }
                    }
                    
                    return { ...page, completed: newCompleted };
                });
                
                // Final validation
                const validation = validateProcessedData(withCompletion, ndisFunded);
                if (!validation.isValid) {
                    console.warn('⚠️ Processed data validation failed:', validation.issues);
                }
                
                setProcessedFormData(withCompletion);
                safeDispatchData(withCompletion, 'Debounced NDIS processing with completion lock');
                
            } catch (error) {
                console.error('❌ NDIS processing error:', error);
                // Fallback with guarded completion calculation
                const fallback = forceRefreshAllDependencies(formData, bookingFormRoomSelected);
                const fallbackWithCompletion = fallback.map(page => {
                    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                        return { ...page, completed: calculateReturningGuestPageCompletion(page, {
                            visitedPages,
                            pagesWithSavedData,
                            equipmentPageCompleted,
                            equipmentChangesState,
                            prevBookingId,
                            currentBookingType
                        })};
                    } else {
                        if (page.id === 'ndis_packages_page') {
                            return { ...page, completed: calculateNdisPageCompletion(page) };
                        } else {
                            return { ...page, completed: calculatePageCompletion(page) };
                        }
                    }
                });
                setProcessedFormData(fallbackWithCompletion);
                safeDispatchData(fallbackWithCompletion, 'NDIS processing fallback with completion lock');
            } finally {
                setIsProcessingNdis(false);
                setTimeout(() => setIsUpdating(false), 300);
            }
        }, 150); // 150ms debounce
    }, [
        isProcessingNdis, 
        bookingFormRoomSelected, 
        calculatePageCompletion, 
        calculateNdisPageCompletion, 
        currentBookingType,
        prevBookingId,
        visitedPages,
        pagesWithSavedData,
        equipmentPageCompleted,
        equipmentChangesState
    ]);

    const extractAllQAPairsFromForm = useCallback((formData = null) => {
        let dataToUse = formData;
        
        if (!dataToUse || dataToUse.length === 0) {
            if (stableProcessedFormData && stableProcessedFormData.length > 0) {
                dataToUse = stableProcessedFormData;
            } else if (stableBookingRequestFormData && stableBookingRequestFormData.length > 0) {
                dataToUse = stableBookingRequestFormData;
            }
        }
        
        const allQAPairs = [];
        
        if (!dataToUse || dataToUse.length === 0) {
            return allQAPairs;
        }

        dataToUse.forEach((page, pageIndex) => {
            if (!page.Sections) return;
            
            page.Sections.forEach((section, sectionIndex) => {
                // PRIORITY 1: Check Questions array (current answers)
                if (section.Questions && section.Questions.length > 0) {
                    const answeredQuestions = section.Questions.filter(q => 
                        q.answer !== null && q.answer !== undefined && q.answer !== ''
                    );
                    
                    answeredQuestions.forEach((question) => {
                        const qaData = {
                            question_key: question.question_key,
                            question: question.question,
                            answer: question.answer,
                            Question: { question_key: question.question_key },
                            source: 'Questions',
                            pageTitle: page.title,
                            sectionId: section.id,
                            questionId: question.id
                        };
                        allQAPairs.push(qaData);
                    });
                }
                
                // PRIORITY 2: Check QaPairs array (saved answers)
                if (section.QaPairs && section.QaPairs.length > 0) {
                    section.QaPairs.forEach((qaPair) => {
                        // Check if we already have this from Questions
                        const existingFromQuestions = allQAPairs.find(qa => 
                            qa.source === 'Questions' && 
                            (qa.question_key === qaPair.Question?.question_key || 
                            qa.question === qaPair.question)
                        );
                        
                        if (existingFromQuestions || !qaPair.answer) return;
                        
                        const qaData = {
                            question_key: qaPair.Question?.question_key || qaPair.question_key,
                            question: qaPair.question || qaPair.Question?.question,
                            answer: qaPair.answer,
                            Question: qaPair.Question,
                            source: 'QaPairs',
                            pageTitle: page.title,
                            sectionId: section.id,
                            qaPairId: qaPair.id
                        };
                        allQAPairs.push(qaData);
                    });
                }
            });
        });

        const summary = {
            total: allQAPairs.length,
            fromQuestions: allQAPairs.filter(qa => qa.source === 'Questions').length,
            fromQaPairs: allQAPairs.filter(qa => qa.source === 'QaPairs').length,
            careScheduleSpecific: allQAPairs.filter(qa => 
                qa.question_key === 'when-do-you-require-care'
            ).length
        };

        return allQAPairs;
    }, [stableProcessedFormData, stableBookingRequestFormData]);

    const currentCareAnalysis = useMemo(() => {
        let formDataToUse = null;
        let dataSource = 'none';

        // CRITICAL: Log what data sources are available
        console.log('🏥 Care Analysis Starting:', {
            hasProcessedFormData: !!processedFormData && processedFormData.length > 0,
            hasBookingRequestFormData: !!bookingRequestFormData && bookingRequestFormData.length > 0,
            processedFormDataLength: processedFormData?.length || 0,
            bookingRequestFormDataLength: bookingRequestFormData?.length || 0
        });
        
        if (processedFormData && processedFormData.length > 0) {
            formDataToUse = processedFormData;
            dataSource = 'processedFormData';
        } else if (bookingRequestFormData && bookingRequestFormData.length > 0) {
            formDataToUse = bookingRequestFormData;
            dataSource = 'bookingRequestFormData';
        }

        if (!formDataToUse) {
            return {
                requiresCare: false,
                totalHoursPerDay: 0,
                carePattern: 'no-care',
                recommendedPackages: ['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT'],
                analysis: 'No form data available yet',
                dataSource: 'none'
            };
        }

        // Extract both Questions and QaPairs
        const allQAPairs = [];
        
        formDataToUse.forEach((page) => {
            if (!page.Sections) return;
            
            page.Sections.forEach((section) => {
                // PRIORITY 1: Add current Questions (immediate answers)
                if (section.Questions && section.Questions.length > 0) {
                    section.Questions.forEach(question => {
                        if (question.answer !== null && question.answer !== undefined && question.answer !== '') {
                            const qaData = {
                                question_key: question.question_key,
                                question: question.question,
                                answer: question.answer,
                                Question: { question_key: question.question_key },
                                source: 'Questions',
                                pageTitle: page.title,
                                sectionId: section.id,
                                questionId: question.id
                            };
                            allQAPairs.push(qaData);
                        }
                    });
                }
                
                // PRIORITY 2: Add QaPairs (saved answers) - only if not already in Questions
                if (section.QaPairs && section.QaPairs.length > 0) {
                    section.QaPairs.forEach(qaPair => {
                        // Skip if we already have this from Questions
                        const alreadyHave = allQAPairs.find(qa => 
                            qa.source === 'Questions' && 
                            (qa.question_key === qaPair.Question?.question_key || 
                            qa.question === qaPair.question)
                        );
                        
                        if (!alreadyHave && qaPair.answer) {
                            const qaData = {
                                question_key: qaPair.Question?.question_key || qaPair.question_key,
                                question: qaPair.question || qaPair.Question?.question,
                                answer: qaPair.answer,
                                Question: qaPair.Question,
                                source: 'QaPairs',
                                pageTitle: page.title,
                                sectionId: section.id,
                                qaPairId: qaPair.id
                            };
                            allQAPairs.push(qaData);
                        }
                    });
                }
            });
        });

        // CRITICAL DEBUG: Log all care-related QA pairs found
        // const careRelatedQAs = allQAPairs.filter(qa => 
        //     qa.question_key?.includes('care') || 
        //     qa.question?.toLowerCase().includes('care')
        // );
        // console.log('🏥 Care-related QA pairs found:', careRelatedQAs.map(qa => ({
        //     key: qa.question_key,
        //     question: qa.question?.substring(0, 50),
        //     hasAnswer: !!qa.answer,
        //     answerType: typeof qa.answer,
        //     source: qa.source
        // })));
        
        // Look for care schedule data
        const careScheduleQA = findByQuestionKey(allQAPairs, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE);
        // console.log('🏥 Care schedule search result:', {
        //     found: !!careScheduleQA,
        //     searchKey: QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE,
        //     answer: careScheduleQA?.answer ? 'HAS_DATA' : 'NO_DATA',
        //     answerType: typeof careScheduleQA?.answer
        // });
        const personalCareQA = findByQuestionKey(allQAPairs, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
                        allQAPairs.find(qa => 
                            qa.question_key === QUESTION_KEYS.ASSISTANCE_WITH_PERSONAL_CARE ||
                            qa.question?.toLowerCase().includes('personal care')
                        );

        if (personalCareQA && (personalCareQA.answer === 'No' || personalCareQA.answer === 'no')) {
            return {
                requiresCare: false,
                totalHoursPerDay: 0,
                carePattern: 'no-care',
                recommendedPackages: ['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT'],
                analysis: 'Personal care assistance not required',
                dataSource: dataSource
            };
        }
        
        if (!careScheduleQA || !careScheduleQA.answer) {
            return {
                requiresCare: false,
                totalHoursPerDay: 0,
                carePattern: 'no-care',
                recommendedPackages: ['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT'],
                analysis: 'No care schedule found in saved answers',
                dataSource: dataSource
            };
        }

        try {
            const careData = typeof careScheduleQA.answer === 'string' 
                ? JSON.parse(careScheduleQA.answer) 
                : careScheduleQA.answer;

            // Check if this is the nested structure with defaultValues
            let dataForCalculation;
            let careDataArray;
            
            if (careData && typeof careData === 'object' && !Array.isArray(careData)) {
                // This is the nested structure: { careData: [...], defaultValues: {...}, careVaries: false }
                careDataArray = careData.careData || [];
                
                // ========== THE FIX ==========
                // Pass the FULL object to calculateCareHours so it can access defaultValues
                // when careVaries is false and individual entries have empty duration
                dataForCalculation = careData;
                // ========== END FIX ==========
                
                // console.log('🏥 Passing full care object to calculateCareHours:', {
                //     careDataLength: careDataArray.length,
                //     hasDefaultValues: !!careData.defaultValues,
                //     careVaries: careData.careVaries
                // });
            } else if (Array.isArray(careData)) {
                // Legacy format - just an array
                careDataArray = careData;
                dataForCalculation = careData;
            } else {
                console.warn('⚠️ Unexpected care data format:', typeof careData);
                return {
                    requiresCare: false,
                    totalHoursPerDay: 0,
                    carePattern: 'no-care',
                    recommendedPackages: [],
                    analysis: 'Unexpected care data format',
                    dataSource: dataSource
                };
            }

            // Validate we have data
            if (!careDataArray || careDataArray.length === 0) {
                // Check if we can still use defaultValues
                if (careData?.defaultValues && careData?.careVaries === false) {
                    console.log('🏥 careData array is empty but have defaultValues, passing full object');
                    dataForCalculation = careData;
                } else {
                    console.warn('⚠️ Care data is empty and no defaults available');
                    return {
                        requiresCare: false,
                        totalHoursPerDay: 0,
                        carePattern: 'no-care',
                        recommendedPackages: [],
                        analysis: 'No care data entries',
                        dataSource: dataSource
                    };
                }
            }

            // Calculate care hours - now passing the FULL object!
            const analysis = calculateCareHours(dataForCalculation);
            
            console.log('🏥 Care analysis result:', {
                totalHoursPerDay: analysis.totalHoursPerDay,
                carePattern: analysis.carePattern,
                usedDefaults: analysis.usedDefaults || false
            });

            return {
                requiresCare: analysis.totalHoursPerDay > 0,
                ...analysis,
                rawCareData: careDataArray,
                dataSource: dataSource
            };
        } catch (error) {
            console.error('❌ Error parsing care schedule:', error);
            return {
                requiresCare: false,
                totalHoursPerDay: 0,
                carePattern: 'care-error',
                recommendedPackages: [],
                analysis: 'Error parsing care schedule data',
                dataSource: dataSource
            };
        }
    }, [
        // Keep your existing dependencies
        bookingRequestFormData?.length || 0,
        processedFormData?.length || 0,
        // Your existing enhanced dependency tracking...
        bookingRequestFormData?.map(p => {
            const careQuestions = [];
            p.Sections?.forEach(s => {
                s.Questions?.forEach(q => {
                    if (questionHasKey(q, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) || 
                        questionHasKey(q, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
                        q.question_key === 'do-you-require-assistance-with-personal-care') {
                        careQuestions.push(`${q.question_key}:${q.answer}`);
                    }
                });
                s.QaPairs?.forEach(qa => {
                    if (questionHasKey(qa.Question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) || 
                        questionHasKey(qa.Question, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
                        qa.Question?.question_key === 'do-you-require-assistance-with-personal-care') {
                        careQuestions.push(`${qa.Question?.question_key}:${qa.answer}`);
                    }
                });
            });
            return `${p.id}-${careQuestions.join(',')}`;
        }).join('|') || '',
        processedFormData?.map(p => {
            const careQuestions = [];
            p.Sections?.forEach(s => {
                s.Questions?.forEach(q => {
                    if (questionHasKey(q, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) || 
                        questionHasKey(q, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
                        q.question_key === 'do-you-require-assistance-with-personal-care') {
                        careQuestions.push(`${q.question_key}:${q.answer}`);
                    }
                });
                s.QaPairs?.forEach(qa => {
                    if (questionHasKey(qa.Question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) || 
                        questionHasKey(qa.Question, QUESTION_KEYS.DO_YOU_REQUIRE_ASSISTANCE_WITH_PERSONAL_CARE) ||
                        qa.Question?.question_key === 'do-you-require-assistance-with-personal-care') {
                        careQuestions.push(`${qa.Question?.question_key}:${qa.answer}`);
                    }
                });
            });
            return `${p.id}-${careQuestions.join(',')}`;
        }).join('|') || ''
    ]);

    useEffect(() => {
        setCareAnalysisData(currentCareAnalysis);
        
        // Only update course analysis if it has actually changed
        if (JSON.stringify(courseAnalysisData) !== JSON.stringify(courseAnalysisData)) {
            setCourseAnalysisData(courseAnalysisData);
        }
        
        // Create package filter criteria for package selection components
        const careFilterCriteria = createPackageFilterCriteria(currentCareAnalysis.rawCareData || []);
        const courseFilterCriteria = createCourseFilterCriteria(courseAnalysisData);
        
        const newPackageFilterCriteria = {
            ...careFilterCriteria,
            ...courseFilterCriteria,
            funder_type: funder,
            // Add other form-derived criteria here
        };
        
        // Only update if criteria actually changed
        if (JSON.stringify(newPackageFilterCriteria) !== JSON.stringify(packageFilterCriteria)) {
            setPackageFilterCriteria(newPackageFilterCriteria);
        }
    }, [
        currentCareAnalysis.totalHoursPerDay, // Only depend on the actual care hours
        currentCareAnalysis.carePattern,      // and care pattern
        courseAnalysisData?.hasCourse,        // and course participation
        courseAnalysisData?.courseOffered,
        funder,
    ]);

    useEffect(() => {
        // Only update if currentCareAnalysis has real data (not 'none' source)
        if (currentCareAnalysis && currentCareAnalysis.dataSource !== 'none') {
            // Check if values actually changed to prevent unnecessary re-renders
            const shouldUpdate = 
                careAnalysisData?.totalHoursPerDay !== currentCareAnalysis.totalHoursPerDay ||
                careAnalysisData?.carePattern !== currentCareAnalysis.carePattern ||
                careAnalysisData?.dataSource !== currentCareAnalysis.dataSource;
            
            if (shouldUpdate) {
                console.log('🏥 Updating careAnalysisData state:', {
                    from: careAnalysisData?.totalHoursPerDay,
                    to: currentCareAnalysis.totalHoursPerDay,
                    dataSource: currentCareAnalysis.dataSource
                });
                setCareAnalysisData(currentCareAnalysis);
            }
        }
    }, [
        currentCareAnalysis.totalHoursPerDay,
        currentCareAnalysis.carePattern,
        currentCareAnalysis.dataSource
    ]);

    // Enhanced function to get course-specific and care-specific form data for package selection
    const getEnhancedFormDataForPackages = useCallback(() => {
        const baseFormData = {
            funder,
            isNdisFunded,
            careAnalysis: careAnalysisData,
            courseAnalysis: courseAnalysisData, // Use courseAnalysisData instead of currentCourseAnalysis
            filterCriteria: packageFilterCriteria
        };

        // Add care-specific data if available
        if (careAnalysisData?.rawCareData) {
            baseFormData.careSchedule = careAnalysisData.rawCareData;
            baseFormData.careHours = careAnalysisData.totalHoursPerDay;
            baseFormData.carePattern = careAnalysisData.carePattern;
            baseFormData.recommendedPackages = careAnalysisData.recommendedPackages;
        }

        // Add course-specific data if available
        if (courseAnalysisData) {
            baseFormData.hasCourse = courseAnalysisData.hasCourse;
            baseFormData.courseOffered = courseAnalysisData.courseOffered;
            baseFormData.courseId = courseAnalysisData.courseId;
            baseFormData.courseName = courseAnalysisData.courseName;
        }

        return baseFormData;
    }, [funder, isNdisFunded, careAnalysisData, courseAnalysisData, packageFilterCriteria]);

    useEffect(() => {
        stayDatesRef.current = stayDates;
    }, [stayDates]);

    const fetchCourseOffers = useCallback(
        _.debounce(async () => {
            const guestId = getGuestId();
            if (!guestId) {
                setCourseOffers([]);
                setCourseOffersLoaded(true);
                return;
            }

            // Use ref for latest values instead of closure
            const currentStayDates = stayDatesRef.current;
            
            // CRITICAL FIX: Only fetch if both dates are available
            if (!currentStayDates?.checkInDate || !currentStayDates?.checkOutDate) {
                // console.log('📅 fetchCourseOffers: Missing dates', currentStayDates);
                setCourseOffers([]);
                setCourseOffersLoaded(false);
                return;
            }

            const apiParams = {
                guestId,
                checkInDate: currentStayDates.checkInDate,
                checkOutDate: currentStayDates.checkOutDate
            };
            
            const paramString = JSON.stringify(apiParams);
            if (lastFetchParamsRef.current === paramString) {
                setCourseOffersLoaded(true);
                return;
            }
            lastFetchParamsRef.current = paramString;

            try {
                // console.log('📅 fetchCourseOffers with dates:', currentStayDates);
                
                const apiUrl = `/api/guests/${guestId}/course-offers?checkInDate=${encodeURIComponent(currentStayDates.checkInDate)}&checkOutDate=${encodeURIComponent(currentStayDates.checkOutDate)}`;
                
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    setCourseOffers(data.courseOffers || []);
                } else {
                    setCourseOffers([]);
                }
            } catch (error) {
                console.error('Error fetching course offers:', error);
                setCourseOffers([]);
            }
            
            setCourseOffersLoaded(true);
        }, 500),
        [getGuestId]
    );

    const lastFetchParamsRef = useRef(null);

    const safeDispatchData = useCallback((data, context) => {
        try {
            // For returning guests, preserve completion from helper
            if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                // console.log(`🔒 Completion lock active - preserving helper completion during dispatch: ${context}`);
                
                // Store completion from the helper BEFORE cleaning
                const completionMap = new Map();
                data.forEach(page => {
                    completionMap.set(page.id, page.completed);
                });
                
                // Clean the data before dispatching to Redux
                const cleanedData = cleanReduxStateBeforeDispatch(data, isNdisFunded);
                
                // Restore completion from helper after cleaning
                cleanedData.forEach(page => {
                    if (completionMap.has(page.id)) {
                        page.completed = completionMap.get(page.id);
                        // console.log(`🔒 Restored completion for "${page.title}": ${page.completed}`);
                    }
                });
                
                const dataStr = JSON.stringify(cleanedData);
                const lastDataStr = JSON.stringify(lastDispatchedDataRef.current);
                
                if (dataStr !== lastDataStr) {
                    console.log(`📤 Dispatching data with preserved completion: ${context}`);
                    dispatch(bookingRequestFormActions.setData(cleanedData));
                    lastDispatchedDataRef.current = structuredClone(cleanedData);
                }
            } else {
                // Find Equipment page and ensure it uses the equipmentPageCompleted flag
                const updatedData = data.map(page => {
                    if (page.title === 'Equipment') {
                        return {
                            ...page,
                            completed: equipmentPageCompleted
                        };
                    }
                    return page;
                });
                // Original logic for first-time guests
                const cleanedData = cleanReduxStateBeforeDispatch(updatedData, isNdisFunded);
                
                const dataStr = JSON.stringify(cleanedData);
                const lastDataStr = JSON.stringify(lastDispatchedDataRef.current);
                
                if (dataStr !== lastDataStr) {
                    console.log(`📤 Dispatching cleaned data to Redux: ${context}`);
                    dispatch(bookingRequestFormActions.setData(cleanedData));
                    lastDispatchedDataRef.current = structuredClone(cleanedData);
                }
            }
        } catch (error) {
            console.error('❌ Error in enhanced safeDispatchData:', error);
            // Fallback to original dispatch if cleaning fails
            dispatch(bookingRequestFormActions.setData(data));
        }
    }, [dispatch, cleanReduxStateBeforeDispatch, isNdisFunded, currentBookingType, prevBookingId, equipmentPageCompleted]);

    const stableBookingRequestFormData = useMemo(() => {
        return bookingRequestFormData;
    }, [JSON.stringify(bookingRequestFormData)]);

    const stableProcessedFormData = useMemo(() => {
        return processedFormData;
    }, [JSON.stringify(processedFormData)]);

    const calculateNdisFilters = useCallback((formData) => {
        let funderType = null;
        let ndisPackageType = null;

        // Find funding source answer
        for (const page of formData) {
            for (const section of page.Sections || []) {
                for (const question of section.Questions || []) {
                    // Check funding source
                    if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                        if (question.answer?.toLowerCase().includes('ndis') || question.answer?.toLowerCase().includes('ndia')) {
                            funderType = 'NDIS';
                            bookingRequestFormActions.setIsNdisFunded(true);
                        } else {
                            funderType = 'Non-NDIS';
                            ndisPackageType = null;
                            bookingRequestFormActions.setIsNdisFunded(false);
                            bookingRequestFormActions.setFunder(question?.answer?.toLowerCase())
                            break;
                        }
                    }

                    if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT) &&
                        (question.answer && question.answer.toLowerCase() === 'yes')) {
                        ndisPackageType = 'sta';
                        console.log('✅ STA package: STA is stated support (takes precedence)');
                    }

                    // If not STA, check for holiday conditions
                    if (!ndisPackageType || ndisPackageType !== 'sta') {
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

                        if ((questionHasKey(question, QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS)) &&
                            (question.answer && question.answer.toLowerCase() === 'yes')) {
                            isHolidayType = true;
                            console.log('✅ Holiday type detected: Staying with informal supports');
                        }
                        
                        // ✅ FIX: Calculate care hours from the CURRENT formData instead of relying on currentCareAnalysis
                        if (isHolidayType) {
                            // Get care hours from the form data
                            const careHours = extractCareHoursFromFormData(formData);
                            
                            // ✅ FIX: Only use holiday-plus if care hours is EXPLICITLY greater than 0
                            if (careHours > 0) {
                                ndisPackageType = 'holiday-plus';
                                console.log(`✅ Holiday-Plus package: Holiday type with ${careHours}h care required`);
                            } else {
                                ndisPackageType = 'holiday';  // Default to regular holiday for 0 care
                                console.log('✅ Holiday package: Holiday type with no care required');
                            }
                        }
                    }
                }
                if (funderType === 'Non-NDIS') break;
            }
            if (funderType === 'Non-NDIS') break;
        }

        // Default NDIS package type if none determined AND funding is NDIS
        if (funderType === 'NDIS' && !ndisPackageType) {
            ndisPackageType = 'sta'; // Default to STA
        }

        const newFilters = {
            funderType: funderType,
            ndisPackageType: funderType === 'NDIS' ? ndisPackageType : null,
            additionalFilters: {
                ...ndisFormFilters.additionalFilters
            }
        };

        console.log('Calculated NDIS filters:', newFilters);
        return newFilters;
    }, [ndisFormFilters.additionalFilters]);

    // ✅ NEW HELPER FUNCTION: Extract care hours directly from form data
    const extractCareHoursFromFormData = (formData) => {
        try {
            // Find the care schedule question
            for (const page of formData) {
                for (const section of page.Sections || []) {
                    // Check Questions array first
                    for (const question of section.Questions || []) {
                        if (questionHasKey(question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) && question.answer) {
                            return calculateCareHoursFromAnswer(question.answer);
                        }
                    }
                    
                    // Check QaPairs as fallback
                    for (const qaPair of section.QaPairs || []) {
                        if (questionHasKey(qaPair.Question, QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE) && qaPair.answer) {
                            return calculateCareHoursFromAnswer(qaPair.answer);
                        }
                    }
                }
            }
            
            return 0; // No care data found
        } catch (error) {
            console.error('Error extracting care hours:', error);
            return 0;
        }
    };

    // ✅ NEW HELPER FUNCTION: Calculate care hours from answer data
    const calculateCareHoursFromAnswer = (answer) => {
        try {
            let careData = typeof answer === 'string' ? JSON.parse(answer) : answer;
            
            // Handle nested structure
            let careDataArray = careData;
            if (careData && typeof careData === 'object' && !Array.isArray(careData)) {
                if (Array.isArray(careData.careData)) {
                    careDataArray = careData.careData;
                }
            }
            
            if (!Array.isArray(careDataArray) || careDataArray.length === 0) {
                return 0;
            }
            
            // Calculate using the imported utility
            const analysis = calculateCareHours(careDataArray);
            return analysis.totalHoursPerDay || 0;
        } catch (error) {
            console.error('Error calculating care hours from answer:', error);
            return 0;
        }
    };

    const fetchProfileData = async (guestId) => {
        try {
            const timestamp = Date.now();
            const response = await fetch(`/api/my-profile/${guestId}?_t=${timestamp}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (response.ok) {
                const profileData = await response.json();
                console.log('✅ Fresh profile data loaded for guest:', guestId, 'Fields:', Object.keys(profileData));
                return profileData;
            }
            console.warn('⚠️ Failed to fetch profile data, status:', response.status);
            return null;
        } catch (error) {
            console.error('❌ Error fetching profile data:', error);
            return null;
        }
    };

    // Helper function to process sci_type_level data - UPDATED for array handling
    const processSciTypeLevelData = (levelData) => {
        if (!levelData) return [];

        if (Array.isArray(levelData)) {
            // Already an array, return as-is
            return [...levelData];
        } else if (typeof levelData === 'object' && levelData !== null) {
            // If it's an object, try to extract values or convert to array
            if (Object.keys(levelData).length === 0) return [];
            // If it's an object with values, convert to array of values
            return Object.values(levelData).filter(val => val);
        } else if (typeof levelData === 'string' && levelData.trim() !== '') {
            // Legacy string format, convert to array
            return levelData.split(',').map(item => item.trim()).filter(item => item);
        }

        return [];
    };

    const processSciLevelForProfile = (value) => {
        if (!value) return [];

        // If it's already an array, return it
        if (Array.isArray(value)) {
            return value;
        }

        // If it's a string, check if it's JSON
        if (typeof value === 'string') {
            // Check if the string looks like JSON array
            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    const parsed = JSON.parse(value);
                    if (Array.isArray(parsed)) {
                        return parsed;
                    }
                } catch (e) {
                    console.error('Error parsing JSON string:', e);
                }
            }

            // Treat as comma-separated string
            return value.split(',').map(item => item.trim()).filter(item => item);
        }

        return [];
    };

    const loadAndApplyProfileData = async (templatePages) => {
        const guestId = getGuestId();

        if (!guestId) {
            console.log('❌ No guest ID available for profile loading');
            setProfileDataLoaded(true);
            return;
        }

        // ADD: More robust guard - check if we're loading for the CORRECT guest
        if (profileDataLoaded && guest?.id === guestId) {
            console.log('⏸️ Profile already loaded for this guest');
            return;
        }
        
        // ADD: Reset if guest changed
        if (guest?.id && guest.id !== guestId) {
            console.log('🔄 Guest changed, resetting profile data');
            profilePreloadInProgressRef.current = false;
            setProfileDataLoaded(false);
        }

        if (profilePreloadInProgressRef.current) {
            console.log('⏸️ Profile load already in progress');
            return;
        }

        profilePreloadInProgressRef.current = true;
        console.log(`🔄 Loading profile data for guest ${guestId}`);

        try {
            const profileData = await fetchProfileData(guestId);
            
            // ADD: Verify we're still mounted and guest hasn't changed
            if (!profileData) {
                console.log('⚠️ No profile data found for guest:', guestId);
                setProfileDataLoaded(true);
                return;
            }
            
            // ADD: Double-check guest ID matches to prevent race conditions
            const currentGuestId = getGuestId();
            if (currentGuestId !== guestId) {
                console.log('⚠️ Guest changed during profile load, discarding stale data');
                profilePreloadInProgressRef.current = false;
                return;
            }

            // console.log('✅ Profile data fetched successfully for guest:', guestId);

            const updatedPages = mapProfileDataToQuestions(profileData, templatePages);
            // Preserve Equipment page completion before dependency processing
            const equipmentPageFromTemplate = templatePages.find(p => p.title === 'Equipment');
            const equipmentWasCompleted = equipmentPageFromTemplate?.completed || completedEquipments || equipmentPageCompleted;

            const finalPages = applyQuestionDependencies(updatedPages).map(page => {
                // Ensure Equipment page completion is preserved from API/template
                if (page.title === 'Equipment' && equipmentWasCompleted) {
                    // console.log(`🔧 Restoring Equipment page completion after profile data: true`);
                    return { ...page, completed: true };
                }
                return page;
            });

            setProcessedFormData(finalPages);
            safeDispatchData(finalPages, 'Profile data applied after template load');
            setProfileDataLoaded(true);
            
        } catch (error) {
            console.error('❌ Error loading profile data:', error);
            setProfileDataLoaded(true);
        } finally {
            profilePreloadInProgressRef.current = false;
        }
    };

    const mapProfileDataToQuestions = (profileData, pages) => {
        if (!profileData || !pages || pages.length === 0) return pages;

        console.log('🔄 Applying comprehensive profile data mapping - PROFILE ALWAYS TAKES PRECEDENCE');

        const updatedPages = pages.map(page => {
            const updatedSections = page.Sections.map(section => {
                const updatedQuestions = section.Questions.map(question => {
                    let updatedQuestion = { ...question };
                    const questionKey = question.question_key || '';

                    // REMOVED: Don't skip any questions - profile should ALWAYS take precedence
                    // for profile-mapped fields, regardless of protected/prePopulated flags
                    
                    let mapped = false;
                    // IMPORTANT: Store the BOOKING answer (from QaPairs/saved data) separately
                    const bookingAnswer = question.answer;

                    // COMPREHENSIVE MAPPING - BASIC FIELDS
                    switch (questionKey) {
                        case 'first-name':
                            if (profileData.first_name) {
                                updatedQuestion.answer = profileData.first_name;
                                mapped = true;
                            }
                            break;
                        case 'last-name':
                            if (profileData.last_name) {
                                updatedQuestion.answer = profileData.last_name;
                                mapped = true;
                            }
                            break;
                        case 'email':
                            if (profileData.email) {
                                updatedQuestion.answer = profileData.email;
                                mapped = true;
                            }
                            break;
                        case 'phone-number':
                        case 'mobile-no':
                            if (profileData.phone_number) {
                                updatedQuestion.answer = profileData.phone_number;
                                mapped = true;
                            }
                            break;
                        case 'gender-person-with-sci':
                            if (profileData.gender) {
                                updatedQuestion.answer = profileData.gender;
                                mapped = true;
                            }
                            break;
                        case 'date-of-birth-person-with-sci':
                            if (profileData.dob) {
                                const dobDate = new Date(profileData.dob);
                                const formattedDob = dobDate.toISOString().split('T')[0];
                                updatedQuestion.answer = formattedDob;
                                mapped = true;
                            }
                            break;

                        // ADDRESS FIELDS
                        case 'street-address':
                        case 'street-address-line-1':
                            if (profileData.address_street1) {
                                updatedQuestion.answer = profileData.address_street1;
                                mapped = true;
                            }
                            break;
                        case 'street-address-line-2-optional':
                        case 'street-address-line-2':
                            if (profileData.address_street2) {
                                updatedQuestion.answer = profileData.address_street2;
                                mapped = true;
                            }
                            break;
                        case 'city':
                            if (profileData.address_city) {
                                updatedQuestion.answer = profileData.address_city;
                                mapped = true;
                            }
                            break;
                        case 'state-province':
                            if (profileData.address_state_province) {
                                updatedQuestion.answer = profileData.address_state_province;
                                mapped = true;
                            }
                            break;
                        case 'post-code':
                            if (profileData.address_postal) {
                                updatedQuestion.answer = profileData.address_postal;
                                mapped = true;
                            }
                            break;
                        case 'country':
                            if (profileData.address_country) {
                                updatedQuestion.answer = profileData.address_country;
                                mapped = true;
                            }
                            break;

                        // HEALTH INFO - EMERGENCY CONTACT
                        case 'emergency-contact-name':
                            if (profileData.HealthInfo?.emergency_name) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_name;
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-phone':
                            if (profileData.HealthInfo?.emergency_mobile_number) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_mobile_number;
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-email':
                            if (profileData.HealthInfo?.emergency_email) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_email;
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-relationship-to-you':
                            if (profileData.HealthInfo?.emergency_relationship) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_relationship;
                                mapped = true;
                            }
                            break;

                        // HEALTH INFO - GP/SPECIALIST
                        case 'gp-or-specialist-name':
                            if (profileData.HealthInfo?.specialist_name) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_name;
                                mapped = true;
                            }
                            break;
                        case 'gp-or-specialist-phone':
                            if (profileData.HealthInfo?.specialist_mobile_number) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_mobile_number;
                                mapped = true;
                            }
                            break;
                        case 'gp-or-specialist-practice-name':
                            if (profileData.HealthInfo?.specialist_practice_name) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_practice_name;
                                mapped = true;
                            }
                            break;

                        // HEALTH INFO - CULTURAL/LANGUAGE
                        case 'do-you-identify-as-aboriginal-or-torres-strait-islander-person-with-sci':
                            if (profileData.HealthInfo?.identify_aboriginal_torres !== null && profileData.HealthInfo?.identify_aboriginal_torres !== undefined) {
                                updatedQuestion.answer = profileData.HealthInfo.identify_aboriginal_torres ? 'Yes' : 'No';
                                mapped = true;
                            }
                            break;
                        case 'do-you-speak-a-language-other-than-english-at-home-person-with-sci':
                            // Always map this field - default to "No" if language is null/empty
                            if (profileData.HealthInfo?.language === null || profileData.HealthInfo?.language === undefined || profileData.HealthInfo?.language === '') {
                                updatedQuestion.answer = 'No';
                                mapped = true;
                            } else if (profileData.HealthInfo.language === 'rather_not_say') {
                                updatedQuestion.answer = 'Rather not to say';
                                mapped = true;
                            } else if (profileData.HealthInfo.language) {
                                updatedQuestion.answer = 'Yes';
                                mapped = true;
                            }
                            break;
                        case 'language-spoken-at-home':
                            if (profileData.HealthInfo?.language && profileData.HealthInfo.language !== '' && profileData.HealthInfo.language !== 'rather_not_say') {
                                updatedQuestion.answer = profileData.HealthInfo.language;
                                mapped = true;
                            }
                            break;
                        case 'do-you-require-an-interpreter':
                            if (profileData.HealthInfo?.require_interpreter !== null && profileData.HealthInfo?.require_interpreter !== undefined) {
                                updatedQuestion.answer = profileData.HealthInfo.require_interpreter ? 'Yes' : 'No';
                                mapped = true;
                            }
                            break;
                        case 'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of':
                            // Always map this field - default to "No" if cultural_beliefs is null/empty
                            if (profileData.HealthInfo?.cultural_beliefs === null || profileData.HealthInfo?.cultural_beliefs === undefined || profileData.HealthInfo?.cultural_beliefs === '') {
                                updatedQuestion.answer = 'No';
                                mapped = true;
                            } else if (profileData.HealthInfo.cultural_beliefs) {
                                updatedQuestion.answer = 'Yes';
                                mapped = true;
                            }
                            break;
                        case 'please-give-details-on-cultural-beliefs-or-values-you-would-like-our-staff-to-be-aware-of':
                            if (profileData.HealthInfo?.cultural_beliefs && profileData.HealthInfo.cultural_beliefs !== '') {
                                updatedQuestion.answer = profileData.HealthInfo.cultural_beliefs;
                                mapped = true;
                            }
                            break;

                        // HEALTH INFO - SCI DETAILS
                        case 'what-year-did-you-begin-living-with-your-spinal-cord-injury':
                            if (profileData.HealthInfo?.sci_year) {
                                updatedQuestion.answer = profileData.HealthInfo.sci_year;
                                mapped = true;
                            }
                            break;
                        case 'leveltype-of-spinal-cord-injury':
                            if (profileData.HealthInfo?.sci_injury_type) {
                                // Map internal values to display values
                                const injuryTypeMap = {
                                    'cervical': '(C) Cervical',
                                    'thoracic': '(T) Thoracic',
                                    'lumbar': '(L) Lumbar',
                                    'sacral': '(S) Sacral',
                                    'spina_bifida': 'Spina Bifida',
                                    'cauda_equina': 'Cauda Equina',
                                    'other': 'Other'
                                };
                                const displayValue = injuryTypeMap[profileData.HealthInfo.sci_injury_type] || profileData.HealthInfo.sci_injury_type;
                                updatedQuestion.answer = displayValue;
                                mapped = true;
                            }
                            break;
                        case 'level-of-function-or-asia-scale-score-movementsensation':
                            if (profileData.HealthInfo?.sci_type) {
                                // Map single letter to exact form option text
                                const asiaScaleMap = {
                                    'A': 'A - Complete, no motor or sensory function below the level of injury',
                                    'B': 'B - Some sensation, no motor function below the level of injury',
                                    'C': 'C - Less than 50% motor function below level of injury but cannot move against gravity',
                                    'D': 'D - More than 50% motor function below level of injury and can move against gravity',
                                    'E': 'E - All muscle, motor and sensory functions have returned',
                                };
                                const displayValue = asiaScaleMap[profileData.HealthInfo.sci_type] || profileData.HealthInfo.sci_type;
                                updatedQuestion.answer = displayValue;
                                mapped = true;
                            }
                            break;
                        case 'where-did-you-complete-your-initial-spinal-cord-injury-rehabilitation':
                            if (profileData.HealthInfo?.sci_intial_spinal_rehab) {
                                updatedQuestion.answer = profileData.HealthInfo.sci_intial_spinal_rehab;
                                mapped = true;
                            }
                            break;
                        case 'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility':
                            if (profileData.HealthInfo?.sci_inpatient !== null && profileData.HealthInfo?.sci_inpatient !== undefined) {
                                updatedQuestion.answer = profileData.HealthInfo.sci_inpatient ? 'Yes' : 'No';
                                mapped = true;
                            }
                            break;

                        // HEALTH INFO - SCI LEVEL DETAILS (multiple levels)
                        case 'c-cervical-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_type_level) {
                                const levels = processSciTypeLevelData(profileData.HealthInfo.sci_type_level);
                                const cervicalLevels = levels.filter(level => level && level.toString().toUpperCase().startsWith('C'));
                                if (cervicalLevels.length > 0) {
                                    updatedQuestion.answer = cervicalLevels;
                                    mapped = true;
                                }
                            }
                            break;
                        case 't-thoracic-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_type_level) {
                                const levels = processSciTypeLevelData(profileData.HealthInfo.sci_type_level);
                                const thoracicLevels = levels.filter(level => level && level.toString().toUpperCase().startsWith('T'));
                                if (thoracicLevels.length > 0) {
                                    updatedQuestion.answer = thoracicLevels;
                                    mapped = true;
                                }
                            }
                            break;
                        case 'l-lumbar-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_type_level) {
                                const levels = processSciTypeLevelData(profileData.HealthInfo.sci_type_level);
                                const lumbarLevels = levels.filter(level => level && level.toString().toUpperCase().startsWith('L'));
                                if (lumbarLevels.length > 0) {
                                    updatedQuestion.answer = lumbarLevels;
                                    mapped = true;
                                }
                            }
                            break;
                        case 's-sacral-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_type_level) {
                                const levels = processSciTypeLevelData(profileData.HealthInfo.sci_type_level);
                                const sacralLevels = levels.filter(level => level && level.toString().toUpperCase().startsWith('S'));
                                if (sacralLevels.length > 0) {
                                    updatedQuestion.answer = sacralLevels;
                                    mapped = true;
                                }
                            }
                            break;

                        default:
                            // No mapping found
                            break;
                    }

                    // CRITICAL: Handle mapped fields properly
                    if (mapped) {
                        // Store the original booking answer for comparison during save
                        updatedQuestion.bookingAnswer = bookingAnswer; // What was saved in the booking QaPairs
                        updatedQuestion.profileAnswer = updatedQuestion.answer; // What came from profile
                        
                        // Clear temporary flags since profile data is now authoritative
                        updatedQuestion.temporaryFromPreviousBooking = false;
                        
                        // Mark as coming from profile
                        updatedQuestion.fromProfile = true;
                        
                        // Set oldAnswer to the BOOKING value (not profile value)
                        // This ensures change detection works correctly:
                        // - If user doesn't change anything: answer === profileAnswer, but we still want to save to sync
                        // - If user changes the value: answer !== oldAnswer, will be detected as dirty
                        updatedQuestion.oldAnswer = bookingAnswer;
                        
                        // Mark as dirty if profile differs from what was in booking
                        // This ensures the booking QaPairs get updated to match profile
                        const profileValue = updatedQuestion.answer;
                        const bookingValue = bookingAnswer;
                        
                        // Compare values (handle arrays and objects)
                        let valuesAreDifferent = false;
                        if (Array.isArray(profileValue) && Array.isArray(bookingValue)) {
                            valuesAreDifferent = JSON.stringify(profileValue.sort()) !== JSON.stringify(bookingValue.sort());
                        } else if (typeof profileValue === 'object' && typeof bookingValue === 'object') {
                            valuesAreDifferent = JSON.stringify(profileValue) !== JSON.stringify(bookingValue);
                        } else {
                            valuesAreDifferent = profileValue !== bookingValue;
                        }
                        
                        if (valuesAreDifferent) {
                            updatedQuestion.dirty = true;
                            updatedQuestion.profileOverrideBooking = true; // Flag to indicate profile overrode booking data
                            console.log(`📝 Profile data differs from booking for "${questionKey}":`, {
                                bookingValue: bookingValue,
                                profileValue: profileValue,
                                willSyncToBooking: true
                            });
                        } else {
                            // Values are the same - no need to mark dirty
                            console.log(`✅ Profile matches booking for "${questionKey}": ${profileValue}`);
                        }
                    }

                    return updatedQuestion;
                });

                return { ...section, Questions: updatedQuestions };
            });

            return { ...page, Sections: updatedSections };
        });

        return updatedPages;
    };

    const hasProfileMapping = (questionKey) => {
        if (!questionKey) return false;

        // List of all question keys that map to profile data
        const profileQuestionKeys = [
            'first-name', 'last-name', 'mobile-no', 'phone-number',
            'gender-person-with-sci', 'date-of-birth-person-with-sci',
            'street-address', 'street-address-line-1', 'street-address-line-2-optional', 'street-address-line-2',
            'city', 'state-province', 'post-code', 'country',
            'emergency-contact-name', 'emergency-contact-phone', 'emergency-contact-email', 'emergency-contact-relationship-to-you',
            'gp-or-specialist-name', 'gp-or-specialist-phone', 'gp-or-specialist-practice-name',
            'do-you-identify-as-aboriginal-or-torres-strait-islander-person-with-sci',
            'do-you-speak-a-language-other-than-english-at-home-person-with-sci',
            'language-spoken-at-home', 'do-you-require-an-interpreter',
            'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of',
            'please-give-details-on-cultural-beliefs-or-values-you-would-like-our-staff-to-be-aware-of',
            'what-year-did-you-begin-living-with-your-spinal-cord-injury',
            'leveltype-of-spinal-cord-injury',
            'level-of-function-or-asia-scale-score-movementsensation',
            'where-did-you-complete-your-initial-spinal-cord-injury-rehabilitation',
            'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility',
            'c-cervical-level-select-all-that-apply',
            't-thoracic-level-select-all-that-apply',
            'l-lumbar-level-select-all-that-apply',
            's-sacral-level-select-all-that-apply'
        ];

        return profileQuestionKeys.includes(questionKey);
    };

    // Function to map question_key to profile data structure - UPDATED for array handling
    const mapQuestionKeyToProfileData = (questionKey, value) => {
        const profileData = {};

        switch (questionKey) {
            // Basic guest information
            case 'first-name':
                profileData.first_name = value;
                break;
            case 'last-name':
                profileData.last_name = value;
                break;
            case 'phone-number':
            case 'mobile-no':
                profileData.phone_number = value;
                break;
            case 'gender-person-with-sci':
                profileData.gender = value;
                break;
            case 'date-of-birth-person-with-sci':
                profileData.dob = value;
                break;

            // Address information
            case 'street-address':
            case 'street-address-line-1':
                profileData.address_street1 = value;
                break;
            case 'street-address-line-2-optional':
            case 'street-address-line-2':
                profileData.address_street2 = value;
                break;
            case 'city':
                profileData.address_city = value;
                break;
            case 'state-province':
                profileData.address_state_province = value;
                break;
            case 'post-code':
                profileData.address_postal = value;
                break;
            case 'country':
                profileData.address_country = value;
                break;

            // Emergency contact information
            case 'emergency-contact-name':
                profileData.emergency_name = value;
                break;
            case 'emergency-contact-phone':
                profileData.emergency_mobile_number = value;
                break;
            case 'emergency-contact-email':
                profileData.emergency_email = value;
                break;
            case 'emergency-contact-relationship-to-you':
                profileData.emergency_relationship = value;
                break;

            // GP/Specialist information
            case 'gp-or-specialist-name':
                profileData.specialist_name = value;
                break;
            case 'gp-or-specialist-phone':
                profileData.specialist_mobile_number = value;
                break;
            case 'gp-or-specialist-practice-name':
                profileData.specialist_practice_name = value;
                break;

            // SCI information
            case 'what-year-did-you-begin-living-with-your-spinal-cord-injury':
                profileData.sci_year = value;
                break;
            case 'leveltype-of-spinal-cord-injury':
                const injuryTypeReverseMap = {
                    '(C) Cervical': 'cervical',
                    '(T) Thoracic': 'thoracic',
                    '(L) Lumbar': 'lumbar',
                    '(S) Sacral': 'sacral',
                    'Spina Bifida': 'spina_bifida',
                    'Cauda Equina': 'cauda_equina',
                    'Other': 'other'
                };
                profileData.sci_injury_type = injuryTypeReverseMap[value] || value;
                break;
            case 'level-of-function-or-asia-scale-score-movementsensation':
                if (value) {
                    const match = value.match(/^([A-E])\s*-/);
                    if (match) {
                        profileData.sci_type = match[1];
                    }
                }
                break;
            case 'where-did-you-complete-your-initial-spinal-cord-injury-rehabilitation':
                profileData.sci_intial_spinal_rehab = value;
                break;
            case 'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility':
                profileData.sci_inpatient = value === 'Yes';
                break;

            case 'c-cervical-level-select-all-that-apply':
                profileData.sci_type_level = processSciLevelForProfile(value);
                profileData.sci_type = null;
                break;
            case 't-thoracic-level-select-all-that-apply':
                profileData.sci_type_level = processSciLevelForProfile(value);
                profileData.sci_type = null;
                break;
            case 'l-lumbar-level-select-all-that-apply':
                profileData.sci_type_level = processSciLevelForProfile(value);
                profileData.sci_type = null;
                break;
            case 's-sacral-level-select-all-that-apply':
                profileData.sci_type_level = processSciLevelForProfile(value);
                profileData.sci_type = null;
                break;

            // Cultural and language information
            case 'do-you-identify-as-aboriginal-or-torres-strait-islander-person-with-sci':
                profileData.identify_aboriginal_torres = value === 'Yes' ? true :
                                                        value === 'No' ? false : null;
                break;
            case 'do-you-speak-a-language-other-than-english-at-home-person-with-sci':
                if (value === 'No') {
                    profileData.language = '';
                    profileData.require_interpreter = false;
                } else if (value === 'Rather not to say') {
                    profileData.language = 'rather_not_say';
                    profileData.require_interpreter = false;
                } else {
                    return null; // Don't save anything for "Yes"
                }
                break;
            case 'language-spoken-at-home':
                profileData.language = value;
                break;
            case 'do-you-require-an-interpreter':
                profileData.require_interpreter = value === 'Yes';
                break;
            case 'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of':
                if (value === 'No') {
                    profileData.cultural_beliefs = '';
                } else {
                    return null; // Don't save anything for "Yes"
                }
                break;
            case 'please-give-details-on-cultural-beliefs-or-values-you-would-like-our-staff-to-be-aware-of':
                profileData.cultural_beliefs = value;
                break;

            default:
                console.log(`No mapping found for question key: ${questionKey}`);
                return null;
        }

        return profileData;
    };

    // Debounced function to save profile data (to avoid too many API calls)
    const debouncedBatchSaveProfileData = useDebouncedCallback(async (guestId) => {
        if (pendingProfileSaves.size === 0 || profileSaveInProgressRef.current) {
            console.log('Skipping profile save:', {
                pendingSize: pendingProfileSaves.size,
                inProgress: profileSaveInProgressRef.current
            });
            return;
        }

        profileSaveInProgressRef.current = true;

        try {
            // Create a snapshot of pending saves to avoid race conditions
            const savesToProcess = new Map(pendingProfileSaves);

            // Combine all pending saves into a single request
            const combinedUpdate = {};
            savesToProcess.forEach((value, questionKey) => {
                const profileUpdate = mapQuestionKeyToProfileData(questionKey, value);
                if (profileUpdate) {
                    Object.assign(combinedUpdate, profileUpdate);
                }
            });

            if (Object.keys(combinedUpdate).length > 0) {
                const response = await fetch('/api/my-profile/save-update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        guest_id: guestId,
                        ...combinedUpdate
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    // Only clear the saves that were actually processed
                    setPendingProfileSaves(prevSaves => {
                        const newSaves = new Map(prevSaves);
                        savesToProcess.forEach((_, key) => {
                            newSaves.delete(key);
                        });
                        return newSaves;
                    });
                } else {
                    const errorResult = await response.json();
                    console.error('Failed to batch save profile data:', errorResult.message);
                }
            }
        } catch (error) {
            console.error('Error batch saving profile data:', error);
        } finally {
            profileSaveInProgressRef.current = false;
        }
    }, 2000);

    const getGuestId = useCallback(() => {
        // Priority: booking.Guest.id > booking.guest_id > currentUser.id
        const isGuestUser = currentUser.type === 'guest';

        // For admin viewing a guest's booking, prioritize booking.Guest.id
        if (!isGuestUser) {
            if (booking?.Guest?.id) {
                return booking.Guest.id;
            }
            if (booking?.guest_id) {
                return booking.guest_id;
            }
        }

        if (currentUser?.id) {
            return currentUser.id;
        }
        return null;
    }, [currentUser?.id, currentUser?.type, booking?.Guest?.id, booking?.guest_id]);

    const calculateNdisPageCompletion = useCallback((page) => {
        if (!page || !page.Sections || page.id !== 'ndis_packages_page') {
            return false;
        }

        // FOR RETURNING GUESTS: Use dedicated helper (unchanged)
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
            return calculateReturningGuestPageCompletion(page, {
                visitedPages,
                pagesWithSavedData,
                equipmentPageCompleted,
                equipmentChangesState,
                prevBookingId,
                currentBookingType
            });
        }
        
        // FOR FIRST-TIME GUESTS: Use new helper
        return calculateFirstTimeGuestPageCompletion(page, {
            visitedPages,
            pagesWithSavedData,
            completedEquipments, // NEW: Pass the API flag
            currentBookingType
        });
    }, [
        currentBookingType, 
        prevBookingId, 
        visitedPages, 
        pagesWithSavedData, 
        equipmentPageCompleted, 
        equipmentChangesState,
        completedEquipments
    ]);

    const calculatePageCompletion = useCallback((page, currentVisitedPages = visitedPages, currentSavedPages = pagesWithSavedData) => {
        if (!page || !page.Sections) {
            return false;
        }

        // console.log(`Calculating completion for page: ${page.id}`, {currentBookingType: currentBookingType, prevBookingId: prevBookingId});

        // FOR RETURNING GUESTS: Use dedicated helper (unchanged)
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
            const completed = calculateReturningGuestPageCompletion(page, {
                visitedPages: currentVisitedPages,
                pagesWithSavedData: currentSavedPages,
                equipmentPageCompleted,
                equipmentChangesState,
                prevBookingId,
                currentBookingType
            });
            return completed;
        }
        
        // FOR FIRST-TIME GUESTS: Use new helper
        return calculateFirstTimeGuestPageCompletion(page, {
            visitedPages: currentVisitedPages,
            pagesWithSavedData: currentSavedPages,
            completedEquipments, // NEW: Pass the API flag
            currentBookingType
        });
    }, [
        currentBookingType, 
        prevBookingId, 
        visitedPages, 
        pagesWithSavedData, 
        equipmentPageCompleted, 
        equipmentChangesState,
        completedEquipments
    ]);

    const updatePageCompletionStatus = useCallback((pages, context = 'general') => {
        console.log(`🔄 Updating page completion status: ${context}`);
        
        // FOR RETURNING GUESTS: Use batch update helper (unchanged)
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
            console.log('🔒 Using completion lock for returning guest - only helper determines completion');
            
            let updatedPages = [...pages];
            
            if (context === 'submit') {
                // For submit, use batch helper update
                updatedPages = batchUpdateReturningGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                });
            } else {
                // For regular updates, refresh dependencies first but don't calculate completion
                console.log('🔄 Refreshing dependencies for returning guest...');
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = clearHiddenQuestionAnswers(updatedPages);
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);

                // Then use batch helper update for completion
                updatedPages = batchUpdateReturningGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                });
            }
            
            return updatedPages;
        } else {
            // NEW: FOR FIRST-TIME GUESTS: Use new helper instead of original logic
            console.log('🔄 Using first-time guest completion helper');
            
            let updatedPages = [...pages];
            
            if (context === 'submit') {
                // For submit, refresh dependencies first
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = clearHiddenQuestionAnswers(updatedPages);
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                
                // Use batch helper update for completion
                updatedPages = batchUpdateFirstTimeGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    completedEquipments, // NEW: Pass the API flag
                    currentBookingType
                });
            } else {
                // For regular updates, refresh dependencies first
                console.log('🔄 Refreshing dependencies for first-time guest...');
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = clearHiddenQuestionAnswers(updatedPages);
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);

                // Then use batch helper update for completion
                updatedPages = batchUpdateFirstTimeGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    completedEquipments,
                    currentBookingType
                });
            }
            
            return updatedPages;
        }
    }, [
        visitedPages, 
        pagesWithSavedData,
        currentBookingType,
        prevBookingId,
        equipmentPageCompleted,
        equipmentChangesState,
        completedEquipments,
        bookingFormRoomSelected
    ]);

    const markPageAsVisited = useCallback((pageId) => {
        if (prevBookingId && pageId) {
            setVisitedPages(prev => {
                if (!prev.has(pageId)) {
                    console.log(`📝 Marking page as visited (prevBookingId present): ${pageId}`);
                    const newVisitedPages = new Set([...prev, pageId]);
                    
                    // CRITICAL: Don't trigger additional completion updates here
                    // Let the main state sync handle it
                    
                    return newVisitedPages;
                }
                return prev;
            });
        }
    }, [prevBookingId]);

    const markPageWithSavedData = useCallback((pageId) => {
        if (prevBookingId && pageId) {
            setPagesWithSavedData(prev => {
                if (!prev.has(pageId)) {
                    console.log(`💾 Marking page as having saved data: ${pageId}`);
                    const newSavedPages = new Set([...prev, pageId]);
                    return newSavedPages;
                }
                return prev;
            });
            
            // FOR RETURNING GUESTS: Synchronous completion update
            if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
                const newSavedPages = new Set([...pagesWithSavedData, pageId]);
                
                // ✅ ADD: Verify page exists before updating
                if (stableProcessedFormData && stableProcessedFormData.length > 0) {
                    const pageIndex = stableProcessedFormData.findIndex(p => p.id === pageId);
                    
                    if (pageIndex === -1) {
                        console.warn(`⚠️ Page ${pageId} not found in stableProcessedFormData during save - deferring completion update`);
                        // Defer the update until the page is in the array
                        setTimeout(() => {
                            const laterPageIndex = stableProcessedFormData.findIndex(p => p.id === pageId);
                            if (laterPageIndex !== -1) {
                                console.log(`✅ Found page ${pageId} after defer, updating now`);
                                forcePageCompletionUpdate(pageId, visitedPages, newSavedPages);
                            }
                        }, 100);
                        return;
                    }
                    
                    console.log(`🎯 Forcing completion update for page ${pageId} at index ${pageIndex}`);
                    const updatedPages = forceUpdateReturningGuestPageCompletion(
                        stableProcessedFormData,
                        pageId,
                        {
                            visitedPages,
                            pagesWithSavedData: newSavedPages,
                            equipmentPageCompleted,
                            equipmentChangesState,
                            prevBookingId,
                            currentBookingType
                        }
                    );
                    
                    if (updatedPages !== stableProcessedFormData) {
                        console.log(`✅ Completion updated for ${pageId}, dispatching...`);
                        setProcessedFormData(updatedPages);
                        safeDispatchData(updatedPages, `forced completion for ${pageId}`);
                    } else {
                        console.log(`ℹ️ No changes needed for ${pageId}`);
                    }
                }
            }
        }
    }, [
        prevBookingId, 
        currentBookingType, 
        visitedPages, 
        pagesWithSavedData,
        stableProcessedFormData,
        equipmentPageCompleted,
        equipmentChangesState,
        safeDispatchData
    ]);

    const forcePageCompletionUpdate = useCallback((pageId, newVisitedSet = null, newSavedSet = null) => {
        if (!stableProcessedFormData || stableProcessedFormData.length === 0) return false;
        
        const pageIndex = stableProcessedFormData.findIndex(p => p.id === pageId);
        if (pageIndex === -1) return false;
        
        // Use current state or provided state
        const visitedSet = newVisitedSet || visitedPages;
        const savedSet = newSavedSet || pagesWithSavedData;
        
        // FOR RETURNING GUESTS: Use dedicated helper (unchanged)
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
            const updatedPages = forceUpdateReturningGuestPageCompletion(
                stableProcessedFormData, 
                pageId, 
                {
                    visitedPages: visitedSet,
                    pagesWithSavedData: savedSet,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                }
            );
            
            // Only update if there were actual changes
            if (updatedPages !== stableProcessedFormData) {
                setProcessedFormData(updatedPages);
                safeDispatchData(updatedPages, `forced completion for ${pageId}`);
                return true;
            }
            return false;
        }
        
        // NEW: FOR FIRST-TIME GUESTS: Use new helper
        const updatedPages = forceUpdateFirstTimeGuestPageCompletion(
            stableProcessedFormData, 
            pageId, 
            {
                visitedPages: visitedSet,
                pagesWithSavedData: savedSet,
                completedEquipments, // NEW: Pass the API flag
                currentBookingType
            }
        );
        
        // Only update if there were actual changes
        if (updatedPages !== stableProcessedFormData) {
            setProcessedFormData(updatedPages);
            safeDispatchData(updatedPages, `forced completion for ${pageId}`);
            return true;
        }
        
        return false;
    }, [
        stableProcessedFormData, 
        visitedPages, 
        pagesWithSavedData,
        currentBookingType,
        prevBookingId,
        equipmentPageCompleted,
        equipmentChangesState,
        completedEquipments // NEW: Add to dependencies
    ]);

    const extractInfantCareQuantities = useCallback(() => {
        let formDataToUse = null;
        
        if (processedFormData && processedFormData.length > 0) {
            formDataToUse = processedFormData;
        } else if (bookingRequestFormData && bookingRequestFormData.length > 0) {
            formDataToUse = bookingRequestFormData;
        }

        if (!formDataToUse) {
            return {
                'do-you-need-a-high-chair-if-so-how-many': 0,
                'do-you-need-a-cot-if-so-how-many': 0
            };
        }

        const infantCareQuantities = {
            'do-you-need-a-high-chair-if-so-how-many': 0,
            'do-you-need-a-cot-if-so-how-many': 0
        };

        // Search across all pages and sections for infant care questions
        formDataToUse.forEach((page) => {
            if (!page.Sections) return;
            
            page.Sections.forEach((section) => {
                // PRIORITY 1: Check current Questions (immediate answers)
                if (section.Questions && section.Questions.length > 0) {
                    section.Questions.forEach(question => {
                        if (question.question_key === 'do-you-need-a-high-chair-if-so-how-many' && 
                            question.answer !== null && question.answer !== undefined && question.answer !== '') {
                            infantCareQuantities['do-you-need-a-high-chair-if-so-how-many'] = parseInt(question.answer) || 0;
                        }
                        if (question.question_key === 'do-you-need-a-cot-if-so-how-many' && 
                            question.answer !== null && question.answer !== undefined && question.answer !== '') {
                            infantCareQuantities['do-you-need-a-cot-if-so-how-many'] = parseInt(question.answer) || 0;
                        }
                    });
                }
                
                // PRIORITY 2: Check QaPairs (saved answers) - only if not found in Questions
                if (section.QaPairs && section.QaPairs.length > 0) {
                    section.QaPairs.forEach(qaPair => {
                        const questionKey = qaPair.Question?.question_key || qaPair.question_key;
                        
                        if (questionKey === 'do-you-need-a-high-chair-if-so-how-many' && 
                            qaPair.answer !== null && qaPair.answer !== undefined && qaPair.answer !== '') {
                            // Only use if we haven't found it in Questions already
                            if (infantCareQuantities['do-you-need-a-high-chair-if-so-how-many'] === 0) {
                                infantCareQuantities['do-you-need-a-high-chair-if-so-how-many'] = parseInt(qaPair.answer) || 0;
                            }
                        }
                        if (questionKey === 'do-you-need-a-cot-if-so-how-many' && 
                            qaPair.answer !== null && qaPair.answer !== undefined && qaPair.answer !== '') {
                            // Only use if we haven't found it in Questions already
                            if (infantCareQuantities['do-you-need-a-cot-if-so-how-many'] === 0) {
                                infantCareQuantities['do-you-need-a-cot-if-so-how-many'] = parseInt(qaPair.answer) || 0;
                            }
                        }
                    });
                }
            });
        });

        return infantCareQuantities;
    }, [processedFormData, bookingRequestFormData]);

    // Get the status of a page for accordion display
    const getPageStatus = (page) => {
        if (!page) return null;

        // Check if page has validation errors
        const hasErrors = page.Sections?.some(section =>
            section.Questions?.some(question =>
                question.error && question.error !== ''
            )
        );

        if (hasErrors) return 'error';

        // UPDATED: Use the page's completion status
        if (page.completed) return 'complete';

        // Check if page has any answers (partially completed)
        const hasAnswers = page.Sections?.some(section =>
            section.Questions?.some(question => {
                if (question.hidden) return false;

                if (question.type === 'checkbox' || question.type === 'checkbox-button') {
                    return Array.isArray(question.answer) && question.answer.length > 0;
                } else if (question.type === 'multi-select') {
                    return Array.isArray(question.answer) && question.answer.length > 0;
                } else if (question.type === 'simple-checkbox') {
                    return question.answer === true;
                } else {
                    return question.answer !== null &&
                        question.answer !== undefined &&
                        question.answer !== '';
                }
            })
        );

        return hasAnswers ? 'pending' : null;
    };

    const accordionItems = useMemo(() => {
        if (!stableProcessedFormData || stableProcessedFormData.length === 0) return [];

        return stableProcessedFormData.map((page, index) => {
            const questionCount = page.Sections?.reduce((count, section) => 
                count + (section.Questions?.length || 0), 0) || 0;

            // console.log(`Preparing accordion item for page: ${page.id}`, { pageTitle: page.title, completed: page.completed });
            
            // Stable key that doesn't change unnecessarily
            const contentKey = `page-${page.id}-${questionCount}-${profileDataLoaded}`;

            return {
                title: page.title,
                description: page.description,
                status: getPageStatus(page),
                customContent: (
                    <QuestionPage
                        key={contentKey}
                        currentPage={page}
                        allPages={stableProcessedFormData}
                        updatePageData={(data) => {
                            const updateHandler = getUpdateHandler(page.id);
                            updateHandler(data, page.id);
                        }}
                        guest={guest}
                        updateEquipmentData={(data) => updateAndDispatchEquipmentData(data)}
                        equipmentChanges={equipmentChangesState}
                        funderType={ndisFormFilters.funderType}
                        funder={funder}
                        ndisPackageType={ndisFormFilters.ndisPackageType}
                        additionalFilters={ndisFormFilters.additionalFilters}
                        profileDataLoaded={profileDataLoaded}
                        updateAndDispatchPageDataImmediate={updateAndDispatchPageDataImmediate}
                        careAnalysisData={careAnalysisData}
                        courseAnalysisData={courseAnalysisData}
                        packageFilterCriteria={packageFilterCriteria}
                        enhancedFormData={getEnhancedFormDataForPackages()}
                        stayDates={stayDates}
                        courseOffers={courseOffers}
                        courseOffersLoaded={courseOffersLoaded}
                        onCareQuestionUpdate={forceCareAnalysisAndPackageUpdate}
                        isCareRelatedQuestion={isCareRelatedQuestion}
                        selectedCourseOfferId={selectedCourseOfferId}
                        validateDatesWithExistingAPI={validateDatesWithExistingAPI}
                        infantCareQuantities={extractInfantCareQuantities()}
                        validationAttempted={currentPage?.validationAttempted || false} 
                        onStayDatesUpdate={updateStayDatesImmediate}
                        equipmentFieldRef={equipmentFieldRef}
                        onEquipmentValidationChange={(isValid, wasUserTriggered) => {
                            // Only update state if this was from user interaction, not initialization
                            if (wasUserTriggered) {
                                setEquipmentValidationPassed(isValid);
                            }
                        }}
                        isConfirmedBooking={currentBookingStatus?.name === 'booking_confirmed'}
                    />
                )
            };
        });
    }, [stableProcessedFormData, guest, equipmentChangesState, ndisFormFilters, profileDataLoaded, 
        careAnalysisData, courseAnalysisData, packageFilterCriteria, getEnhancedFormDataForPackages, stayDates,
        courseOffers, courseOffersLoaded]);

    // Centralized scroll function, now explicitly waiting for layoutRef.current.mainContentRef
    const scrollToAccordionItemInLayout = useCallback((index) => {
        // Double RAF ensures DOM is fully painted
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scroller.scrollTo(`accordion-item-${index}`, {
                    duration: 350, // Slightly faster for snappier feel
                    delay: 0,
                    smooth: 'easeInOutQuart',
                    containerId: 'main-content-container',
                    offset: -100,
                    isDynamic: true,
                    ignoreCancelEvents: false
                });
            });
        });
    }, []);

    const handleAccordionNavigation = async (targetIndex, action) => {
        const targetPage = stableProcessedFormData[targetIndex];
        if (!targetPage) return;

        // Mark target page as visited
        if (prevBookingId && targetPage.id) {
            markPageAsVisited(targetPage.id);
        }

        if (action == 'header-click' && !targetPage.completed) {
            return; // Block navigation if target page not complete
        }

        if (action === 'submit') {
            if (validateAllPages()) {
                throw new Error('Validation failed'); 
            }
            showWarningReturningBookingNotSave(currentBookingType, currentBookingStatus, targetPage, true);
            return;
        }

        // Validate and save current page
        if (currentPage && action === 'next') {
            const currentPageInProcessed = stableProcessedFormData.find(p => p.id === currentPage.id);
            const pageToValidate = currentPageInProcessed || currentPage;

            try {
                // ============================================
                // EQUIPMENT PAGE - Special validation via ref
                // ============================================
                if (pageToValidate.title === 'Equipment') {
                    console.log('🔧 Validating Equipment page before navigation...');
                    
                    if (equipmentFieldRef.current && typeof equipmentFieldRef.current.validate === 'function') {
                        const result = equipmentFieldRef.current.validate();
                        console.log('🔧 Equipment validation result:', result);
                        
                        if (!result.allValid) {
                            console.log('❌ Equipment validation failed - blocking navigation');
                            
                            const updatedPages = stableProcessedFormData.map(page => {
                                if (page.id === pageToValidate.id) {
                                    return { 
                                        ...page, 
                                        completed: false,
                                        validationAttempted: true
                                    };
                                }
                                return page;
                            });
                            
                            setProcessedFormData(updatedPages);
                            safeDispatchData(updatedPages, 'Equipment validation failed');
                            
                            toast.error('Please complete all required equipment questions before continuing.');
                            throw new Error('Equipment validation failed');
                        }
                    }
                    
                    // Equipment validation passed, save and continue
                    console.log('✅ Equipment validation passed - proceeding');
                    await saveCurrentPage(pageToValidate, false);
                    
                    // Handle returning guest completion update
                    if (prevBookingId && currentBookingType === BOOKING_TYPES.RETURNING_GUEST && pageToValidate?.id) {
                        const newSavedPages = new Set([...pagesWithSavedData, pageToValidate.id]);
                        setPagesWithSavedData(newSavedPages);
                        
                        const updatedPages = batchUpdateReturningGuestCompletions(
                            stableProcessedFormData,
                            {
                                visitedPages,
                                pagesWithSavedData: newSavedPages,
                                equipmentPageCompleted,
                                equipmentChangesState,
                                prevBookingId,
                                currentBookingType
                            }
                        );
                        
                        setProcessedFormData(updatedPages);
                        safeDispatchData(updatedPages, 'completion update before navigation');
                    }
                    
                    // DON'T return here - let it fall through to navigation below
                    
                } else {
                    // ============================================
                    // NON-EQUIPMENT PAGES - Normal validation
                    // ============================================
                    const latestReduxData = bookingRequestFormData || [];
                    const latestPageData = latestReduxData.find(p => p.id === pageToValidate.id);
                    const pageToValidateWithLatestData = latestPageData || pageToValidate;
                    
                    const pageErrors = validate([pageToValidateWithLatestData], courseOffers);
                    
                    if (pageErrors.length > 0) {
                        console.log('❌ Validation errors found on current page:', pageErrors);
                        
                        const updatedPages = stableProcessedFormData.map(page => {
                            if (page.id === pageToValidateWithLatestData.id) {
                                return { 
                                    ...page, 
                                    completed: false,
                                    validationAttempted: true
                                };
                            }
                            return page;
                        });
                        
                        setProcessedFormData(updatedPages);
                        safeDispatchData(updatedPages, 'Page validation failed');
                        
                        const createNavigationErrorMessage = () => {
                            if (pageErrors.length === 1) {
                                return `Please complete the required field "${pageErrors[0].question}" before continuing.`;
                            } else if (pageErrors.length <= 3) {
                                const questions = pageErrors.map(error => `"${error.question}"`).join(', ');
                                return `Please complete these required fields before continuing: ${questions}`;
                            } else {
                                return `Please complete ${pageErrors.length} required fields on this page before continuing.`;
                            }
                        };
                        
                        toast.error(createNavigationErrorMessage());
                        throw new Error('Validation failed');
                    }
                    
                    // Non-equipment validation passed, save the page
                    await saveCurrentPage(pageToValidate, false);

                    if (prevBookingId && currentBookingType === BOOKING_TYPES.RETURNING_GUEST && pageToValidate?.id) {
                        // console.log(`🔄 Synchronously updating completion for page "${pageToValidate.title}"`);
                        
                        const newSavedPages = new Set([...pagesWithSavedData, pageToValidate.id]);
                        setPagesWithSavedData(newSavedPages);
                        
                        const updatedPages = batchUpdateReturningGuestCompletions(
                            stableProcessedFormData,
                            {
                                visitedPages,
                                pagesWithSavedData: newSavedPages,
                                equipmentPageCompleted,
                                equipmentChangesState,
                                prevBookingId,
                                currentBookingType
                            }
                        );
                        
                        setProcessedFormData(updatedPages);
                        safeDispatchData(updatedPages, 'completion update before navigation');
                    }
                }
                
            } catch (error) {
                console.error('Error validating/saving page:', error);
                // toast.error('Error saving your progress. Please try again.');
                throw error;
            }
        }

        // ============================================
        // NAVIGATION - Happens for both Equipment and non-Equipment pages after validation passes
        // ============================================
        // Batch all state updates together to prevent multiple re-renders
        dispatch(bookingRequestFormActions.setCurrentPage(targetPage));
        setActiveAccordionIndex(targetIndex);

        const paths = router.asPath.split('&&');
        const baseUrl = paths[0];
        const newUrl = `${baseUrl}&&page_id=${targetPage.id}`;

        // Use shallow routing to prevent full page reload
        router.push(newUrl, undefined, { shallow: true });
    };

    useEffect(() => {
        if (currentPage && stableProcessedFormData && stableProcessedFormData.length > 0) {
            const pageIndex = stableProcessedFormData.findIndex(p => p.id === currentPage.id);
            if (pageIndex !== -1) {
                setActiveAccordionIndex(pageIndex);
            }
        }
    }, [currentPage?.id, stableProcessedFormData?.length, courseOffers]);

    const lastProcessedDataLengthRef = useRef(0);

    useEffect(() => {
        if (currentPage && stableProcessedFormData && stableProcessedFormData.length > 0) {
            const currentTotalQuestions = stableProcessedFormData.reduce((total, page) => 
                total + (page.Sections?.reduce((count, section) => 
                    count + (section.Questions?.length || 0), 0) || 0), 0);

            // ✅ Check if the overall question count changed (indicates NDIS processing happened)
            if (currentTotalQuestions !== lastProcessedDataLengthRef.current) {
                lastProcessedDataLengthRef.current = currentTotalQuestions;
                
                const pageIndex = stableProcessedFormData.findIndex(p => p.id === currentPage.id);
                if (pageIndex !== -1) {
                    const processedCurrentPage = stableProcessedFormData[pageIndex];
                    if (processedCurrentPage && currentPage.id === processedCurrentPage.id) {
                        const currentQuestionCount = currentPage.Sections?.reduce((count, section) => 
                            count + (section.Questions?.length || 0), 0) || 0;
                        const processedQuestionCount = processedCurrentPage.Sections?.reduce((count, section) => 
                            count + (section.Questions?.length || 0), 0) || 0;
                        
                        if (currentQuestionCount !== processedQuestionCount) {
                            console.log(`🔄 Syncing current page "${currentPage.title}" after NDIS processing - questions: ${currentQuestionCount} → ${processedQuestionCount}`);
                            dispatch(bookingRequestFormActions.setCurrentPage(processedCurrentPage));
                        }
                    }
                }
            }
        }
    }, [stableProcessedFormData?.length, currentPage?.id, dispatch]);

    const clearPackageQuestionAnswers = (pageOrPages, isNdisFunded) => {
        // Helper function to check if an answer is NDIS-related
        const isNdisAnswer = (answer) => {
            if (!answer) return false;
            return answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia');
        };

        // Helper function to clear answers in a single page
        const clearPageAnswers = (page) => {
            // Only check for package questions that need clearing
            const pageHasPackageQuestion = page.Sections?.some(section =>
                section.Questions?.some(question =>
                    questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)
                )
            );

            if (!pageHasPackageQuestion) {
                return page; // Return unchanged if no package questions
            }

            let pageModified = false;
            const updatedPage = {
                ...page,
                Sections: page.Sections.map(section => ({
                    ...section,
                    Questions: section.Questions.map(question => {
                        if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) {
                            pageModified = true;
                            return { ...question, answer: null };

                            // if (question.type === 'radio') {
                            //     // For radio questions: clear if NDIS funded OR if answer is NDIS-related but not NDIS funded
                            //     if (isNdisFunded || (!isNdisFunded && isNdisAnswer(question.answer))) {
                            //         // console.log(`Clearing radio question - NDIS funded: ${isNdisFunded}, NDIS answer: ${isNdisAnswer(question.answer)}`);
                            //         pageModified = true;
                            //         return { ...question, answer: null };
                            //     }
                            // } else if (question.type === 'radio-ndis') {
                            //     // For radio-ndis questions: clear if not NDIS funded
                            //     if (!isNdisFunded) {
                            //         // console.log('Clearing radio-ndis question answer (not NDIS funded)');
                            //         pageModified = true;
                            //         return { ...question, answer: null };
                            //     }
                            // }
                        }
                        return question;
                    })
                }))
            };

            // FIXED: Only return modified page if something actually changed
            if (pageModified) {
                console.log(`Package questions cleared on page: ${page.title}`);
                return updatedPage;
            } else {
                return page; // Return original page if no changes needed
            }
        };

        // Handle both single page and array of pages
        if (Array.isArray(pageOrPages)) {
            return pageOrPages.map(page => clearPageAnswers(page));
        } else {
            return clearPageAnswers(pageOrPages);
        }
    };

    const handleFieldValidationErrorMessage = (sections, action) => {
        const updatedSections = sections?.map(section => {
            const updatedQuestions = section.Questions.map(question => {
                let currentQuestion = { ...question };

                switch (action) {
                    case 'UPDATE_DATA':
                        if (currentQuestion.hidden === false && currentQuestion.required === true && (currentQuestion.hasOwnProperty('dirty') && currentQuestion.dirty)) {
                            // ENHANCED: Always preserve existing errors for validation fields
                            if (currentQuestion.error && (
                                currentQuestion.type === 'date' ||
                                currentQuestion.type === 'date-range' ||
                                currentQuestion.type === 'phone-number' ||
                                currentQuestion.type === 'email' ||
                                currentQuestion.type === 'goal-table' ||
                                currentQuestion.type === 'care-table'
                            )) {
                                // Keep existing validation error - don't override
                                console.log(`Preserving validation error for ${currentQuestion.type}: ${currentQuestion.error}`);
                            }
                            else if ((currentQuestion.type == 'checkbox' || currentQuestion.type == 'checkbox-button' || currentQuestion.type == 'multi-select') && !currentQuestion.answer || (currentQuestion.answer && currentQuestion.answer.length == 0)) {
                                currentQuestion.error = 'This is a required field.'
                            }
                            else if (currentQuestion.answer === null || currentQuestion.answer === undefined || currentQuestion.answer === '') {
                                currentQuestion.error = 'This is a required field.'
                            }
                            else {
                                // Only clear error if there's a valid answer and no existing validation error
                                if (!currentQuestion.error || currentQuestion.error === 'This is a required field.') {
                                    currentQuestion.error = null;
                                }
                            }
                        }
                        break;

                    case 'VALIDATE_DATA':
                        if (currentQuestion.hidden === false && currentQuestion.required === true) {
                            // ENHANCED: Preserve existing validation errors during validation
                            if (currentQuestion.error && (
                                currentQuestion.type === 'date' ||
                                currentQuestion.type === 'date-range' ||
                                currentQuestion.type === 'phone-number' || // ADDED: Preserve phone errors
                                currentQuestion.type === 'email' || // ADDED: Preserve email errors
                                currentQuestion.type === 'goal-table' ||
                                currentQuestion.type === 'care-table'
                            )) {
                                // Keep existing field-specific validation error
                                console.log(`Preserving validation error during validation for ${currentQuestion.type}: ${currentQuestion.error}`);
                            }
                            else if ((currentQuestion.type == 'checkbox' || currentQuestion.type == 'checkbox-button') && !currentQuestion.answer || (currentQuestion.answer && currentQuestion.answer.length == 0)) {
                                currentQuestion.error = 'This is a required field.'
                            }
                            else if (currentQuestion.answer === null || currentQuestion.answer === undefined || currentQuestion.answer === '') {
                                currentQuestion.error = 'This is a required field.'
                            } else {
                                // Only clear error if there's a valid answer and no existing validation error
                                if (!currentQuestion.error || currentQuestion.error === 'This is a required field.') {
                                    currentQuestion.error = null;
                                }
                            }
                        }
                        break;
                    default:
                        break;
                }
                return currentQuestion;
            });
            return { ...section, Questions: updatedQuestions };
        });

        return updatedSections;
    }

    const updatePageData = (updates, pageId, action = 'UPDATE_DATA', submit = false, hasError) => {
        if (prevBookingId) {
            markPageAsVisited(pageId);
            if (!hasError) {
                markPageWithSavedData(pageId);
            }
        }

        const validatedSections = handleFieldValidationErrorMessage(updates, action);
        const pageIndex = stableProcessedFormData.findIndex(p => p.id === pageId);
        
        if (pageIndex === -1) {
            console.warn(`⚠️ Page with ID ${pageId} not found in processed data`);
            return stableProcessedFormData;
        }
        
        const pages = structuredClone(stableProcessedFormData);
        pages[pageIndex].Sections = validatedSections;
        pages[pageIndex].dirty = !hasError;

        // Handle NDIS funding changes
        const fundingStatusResult = checkAndUpdateNdisFundingStatus(pages, isNdisFunded, dispatch, bookingRequestFormActions);
        
        let updatedPages = pages;
        
        if (fundingStatusResult.hasChanged) {
            console.log('🔄 Funding status changed, clearing package question answers...');
            updatedPages = clearPackageQuestionAnswers(updatedPages, fundingStatusResult.newStatus);
        }
        
        // ✅ CRITICAL FIX: Use completion lock for returning guests
        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
            console.log('🔒 Using completion lock for returning guest - only helper determines completion');
            
            if (submit) {
                // For submit, use batch helper update
                updatedPages = batchUpdateReturningGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                });
            } else {
                // For regular updates, refresh dependencies first
                console.log('🔄 Refreshing dependencies for returning guest...');
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = clearHiddenQuestionAnswers(updatedPages);
                
                // ✅ ADD: Second pass specifically for NDIS page to ensure moved questions have dependencies applied
                if (pageId === 'ndis_packages_page') {
                    console.log('🔄 Second dependency refresh for NDIS page...');
                    updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                }
                
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);

                // Then use batch helper update for completion
                updatedPages = batchUpdateReturningGuestCompletions(updatedPages, {
                    visitedPages,
                    pagesWithSavedData,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                });
            }
        } else {
            // Original logic for first-time guests
            if (submit) {
                updatedPages = updatePageCompletionStatus(updatedPages, 'submit');
            } else {
                console.log('🔄 Refreshing dependencies...');
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = clearHiddenQuestionAnswers(updatedPages);
                updatedPages = forceRefreshAllDependencies(updatedPages, bookingFormRoomSelected);
                updatedPages = updatePageCompletionStatus(updatedPages, 'after_dependencies');
            }
        }

        setProcessedFormData(updatedPages);

        if (!isProcessingNdis || pageId === 'ndis_packages_page') {
            safeDispatchData(updatedPages, `updatePageData: ${action}`);
        }

        return updatedPages;
    };

    const updateAndDispatchPageDataImmediate = (updates, pageId) => {
        const updatedPages = updatePageData(updates, pageId);
        return updatedPages;
    };

    const updateAndDispatchPageDataDebounced = useDebouncedCallback((updates, pageId) => {
        const updatedPages = updatePageData(updates, pageId);
        return updatedPages;
    }, 100);

    const getUpdateHandler = (pageId) => {
        if (pageId === 'ndis_packages_page') {
            return updateAndDispatchPageDataImmediate;
        }
        
        // For other pages, check if they have questions that other pages depend on
        const currentPageData = stableProcessedFormData.find(p => p.id === pageId);
        const hasQuestionsThatAffectOthers = currentPageData?.Sections?.some(section =>
            section.Questions?.some(question => {
                // Check if any other page has questions depending on this question
                return stableProcessedFormData.some(otherPage => 
                    otherPage.id !== pageId &&
                    otherPage.Sections?.some(otherSection =>
                        otherSection.Questions?.some(otherQuestion =>
                            otherQuestion.QuestionDependencies?.some(dep =>
                                dep.dependence_id === question.question_id ||
                                dep.dependence_id === question.id ||
                                dep.dependence_id === question.question_key
                            )
                        )
                    )
                );
            })
        );
        
        if (hasQuestionsThatAffectOthers) {
            return updateAndDispatchPageDataImmediate;
        }
        
        // Use debounced updates for pages without cross-page dependencies
        return updateAndDispatchPageDataDebounced;
    };

    const updateAndDispatchEquipmentData = useCallback((updates) => {
        dispatch(bookingRequestFormActions.updateEquipmentChanges(updates));
    }, [dispatch]);

    const validate = (pages, courseOffers = []) => {
        let errorMessage = new Set();

        pages.map(page => {
            console.log(`📋 Validating page: "${page.title}"`);

            if (page.title === 'Equipment') {
                return; // Skip equipment page
            }

            page?.Sections?.map(section => {
                if (section.hidden) {
                    return;
                }

                section?.Questions?.length > 0 && section.Questions.filter(q => q.hidden === false).map(question => {
                    if (question.ndis_only && question.type !== 'simple-checkbox' && isNdisFunded && page.id !== 'ndis_packages_page') {
                        return;
                    }

                    // IMPORTANT: Define answer OUTSIDE the if block so it's available for all validations
                    const required = question.required ? question.required : false;
                    const answer = question.answer ? question.answer : question.answer === 0 ? '0' : null;

                    if (question.type !== 'url') {
                        // ENHANCED: Check for ANY existing errors on the question first
                        if (question.error && typeof question.error === 'string' && question.error.trim() !== '') {
                            console.log(`❌ Found existing error on question "${question.question}": ${question.error}`);
                            errorMessage.add({
                                pageId: page.id,
                                pageTitle: page.title,
                                message: question.error,
                                question: question.question,
                                type: question.type
                            });
                        }
                        else if (question.type === "email" && answer) {
                            if (answer && !validateEmail(answer)) {
                                console.log(`❌ Email validation failed for: "${answer}"`);
                                errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please input a valid email.', question: question.question, type: question.type });
                            }
                        }
                        else if (question.type === "phone-number" && answer) {
                            if (answer && !validatePhoneNumber(answer)) {
                                console.log(`❌ Phone validation failed for: "${answer}"`);
                                errorMessage.add({
                                    pageId: page.id,
                                    pageTitle: page.title,
                                    message: 'Please input a valid phone number.',
                                    question: question.question,
                                    type: question.type
                                });
                            }
                        }
                        else if (question.type === "rooms" && question.required) {
                            let roomsData = null;
                            try {
                                roomsData = question.answer ? JSON.parse(question.answer) : null;
                            } catch (e) {
                                roomsData = question.answer;
                            }

                            const hasValidSelection = roomsData && roomsData.length > 0 && roomsData[0] && roomsData[0].name;

                            if (!hasValidSelection) {
                                console.log(`❌ Room validation failed - no room selected`);
                                errorMessage.add({
                                    pageId: page.id,
                                    pageTitle: page.title,
                                    message: 'Please select at least one room.',
                                    question: question.question,
                                    type: question.type
                                });
                            }
                        }
                        else if (question.type === 'radio-ndis' && question.answer?.includes('Wellness')) {
                            console.log(`❌ NDIS package validation failed - Wellness package selected`);
                            errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Missing NDIS Package Type', question: question.question, type: question.type });
                        }
                        else if (required && !answer) {
                            console.log(`❌ Required field validation failed for: "${question.question}" (answer: ${answer})`);
                            errorMessage.add({
                                pageId: page.id,
                                pageTitle: page.title,
                                message: 'Please input/select an answer.',
                                question: question.question,
                                type: question.type
                            });
                        }
                    }

                    // Checkbox validation
                    if ((question.type == 'checkbox' || question.type == 'checkbox-button') && question.answer && question.answer.length === 0) {
                        console.log(`❌ Checkbox validation failed for: "${question.question}"`);
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please select at least one option.', question: question.question, type: question.type });
                    }

                    // Goal table validation
                    if (question.type == 'goal-table' && question.error) {
                        console.log(`❌ Goal table validation failed for: "${question.question}"`);
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please select at least one option.', question: question.question, type: question.type });
                    }

                    // Care table validation
                    if (question.type == 'care-table' && question.error) {
                        console.log(`❌ Care table validation failed for: "${question.question}"`);
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please fill in all table columns and rows.', question: question.question, type: question.type });
                    }

                    // Service cards validation
                    if ((question.type === 'service-cards' || question.type === 'service-cards-multi') && question.required) {
                        console.log(`🎴 Validating service-cards question:`, {
                            question: question.question,
                            answer: answer,
                            answerType: typeof answer
                        });
                        
                        let validAnswer = true;
                        
                        // Get the available services from question options
                        const services = typeof question.options === 'string' 
                            ? JSON.parse(question.options) 
                            : question.options;
                        
                        // First check if answer is null, undefined, or empty
                        if (!answer || answer === '' || answer === null || answer === undefined) {
                            console.log(`❌ Service cards has no answer at all`);
                            validAnswer = false;
                        } else {
                            // Parse the answer if it's a string
                            let parsedAnswer = answer;
                            if (typeof answer === 'string') {
                                try {
                                    parsedAnswer = JSON.parse(answer);
                                } catch (e) {
                                    console.error(`❌ Failed to parse service cards answer:`, e);
                                    validAnswer = false;
                                    parsedAnswer = null;
                                }
                            }
                            
                            // Check if parsedAnswer exists and is an object
                            if (parsedAnswer && typeof parsedAnswer === 'object') {
                                const answerKeys = Object.keys(parsedAnswer);
                                
                                // Check if the answer object is empty
                                if (answerKeys.length === 0) {
                                    console.log(`❌ Service cards answer is empty object`);
                                    validAnswer = false;
                                } else {
                                    // ✅ CRITICAL FIX: ALWAYS check that ALL services have been answered
                                    // This must happen regardless of whether some are "Yes" or "No"
                                    const allOptionsAnswered = services && services.every(option => {
                                        const serviceAnswer = parsedAnswer[option.value];
                                        const isAnswered = serviceAnswer && typeof serviceAnswer.selected === 'boolean';
                                        if (!isAnswered) {
                                            console.log(`❌ Service "${option.label || option.value}" has not been answered`);
                                        }
                                        return isAnswered;
                                    });
                                    
                                    if (!allOptionsAnswered) {
                                        console.log(`❌ Not all services have been answered`);
                                        validAnswer = false;
                                    }
                                    
                                    // If all services are answered, check for required sub-options on "Yes" services
                                    if (validAnswer) {
                                        for (const serviceValue in parsedAnswer) {
                                            const serviceAnswer = parsedAnswer[serviceValue];
                                            if (serviceAnswer && serviceAnswer.selected === true) {
                                                const serviceDef = services.find(s => s.value === serviceValue);
                                                
                                                if (serviceDef && serviceDef.subOptions && serviceDef.subOptions.length > 0) {
                                                    if (serviceDef.subOptionsRequired) {
                                                        if (!serviceAnswer.subOptions || serviceAnswer.subOptions.length === 0) {
                                                            console.log(`❌ Service "${serviceDef.label}" requires sub-option selection`);
                                                            errorMessage.add({
                                                                pageId: page.id,
                                                                pageTitle: page.title,
                                                                message: `Please select at least one option for "${serviceDef.label}".`,
                                                                question: question.question,
                                                                type: question.type
                                                            });
                                                            validAnswer = false;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            } else {
                                console.log(`❌ Service cards answer is not a valid object:`, parsedAnswer);
                                validAnswer = false;
                            }
                        }
                        
                        // Show error if validation failed
                        if (!validAnswer) {
                            console.log(`❌ Service cards validation failed - not all services answered`);
                            errorMessage.add({
                                pageId: page.id,
                                pageTitle: page.title,
                                message: 'Please answer all service options (Yes or No).',
                                question: question.question,
                                type: question.type
                            });
                        }
                    }

                    if (questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION)) {
                        console.log(`🎓 Validating course offer question: "${question.question}" with answer: "${question.answer}"`);
                        
                        if (question.answer?.toLowerCase() === 'yes') {
                            console.log(`🎓 Course answer is YES, checking course offers...`);
                            
                            const activeOffers = courseOffers.filter(offer => 
                                ['offered', 'accepted'].includes(offer.offerStatus)
                            );
                            
                            if (activeOffers.length === 0) {
                                console.log(`❌ No active course offers found`);
                                errorMessage.add({
                                    pageId: page.id,
                                    pageTitle: page.title,
                                    message: 'You do not have any course offers available.',
                                    question: question.question,
                                    type: question.type
                                });
                            } else {
                                const validOffers = activeOffers.filter(offer => offer.dateValid !== false);
                                
                                if (validOffers.length === 0) {
                                    console.log(`⚠️ No date-compatible course offers, but allowing selection (user may extend stay)`);
                                    // console.log(`❌ No valid course offers for selected dates`);
                                    // errorMessage.add({
                                    //     pageId: page.id,
                                    //     pageTitle: page.title,
                                    //     message: 'None of your course offers are compatible with your selected stay dates. Please review your dates or change your course selection to "No".',
                                    //     question: question.question,
                                    //     type: question.type
                                    // });
                                } else {
                                    console.log(`✅ Found ${validOffers.length} valid course offers`);
                                }
                            }
                        }
                    }

                    if (questionHasKey(question, QUESTION_KEYS.WHICH_COURSE)) {
                        console.log(`🎓 Validating which course question: "${question.question}" with answer: "${question.answer}"`);
                        
                        // Check if course offer question was answered "Yes" OR if there's a prefilled course answer
                        const courseOfferQuestion = pages.find(p => 
                            p.Sections?.some(s => 
                                s.Questions?.some(q => 
                                    questionHasKey(q, QUESTION_KEYS.COURSE_OFFER_QUESTION) && 
                                    q.answer?.toLowerCase() === 'yes'
                                )
                            )
                        );
                        
                        const hasPrefilled = question.temporaryFromPreviousBooking || question.prefill;
                        
                        // Validate if course offer is "Yes" OR if there's a prefilled answer (for returning guests)
                        if ((courseOfferQuestion || hasPrefilled) && question.answer) {
                            const selectedOffer = courseOffers.find(offer => 
                                ['offered', 'accepted'].includes(offer.offerStatus) &&
                                (offer.courseId?.toString() === question.answer.toString() || 
                                offer.id?.toString() === question.answer.toString())
                            );
                            
                            if (selectedOffer) {
                                if (selectedOffer.dateValid === false) {
                                    console.log(`⚠️ Course "${selectedOffer.courseName}" is outside minimum stay period - allowing selection (user acknowledged warning)`);
                                    // console.log(`❌ Course "${selectedOffer.courseName}" is incompatible with stay dates`);
                                    // errorMessage.add({
                                    //     pageId: page.id,
                                    //     pageTitle: page.title,
                                    //     message: selectedOffer.dateValidationMessage || 'Selected course is not compatible with your stay dates. Please update your dates or remove this course selection.',
                                    //     question: question.question,
                                    //     type: question.type
                                    // });
                                } else {
                                    console.log(`✅ Course "${selectedOffer.courseName}" is compatible with stay dates`);
                                }
                            } else {
                                console.log(`❌ Selected course not found in current offers`);
                                errorMessage.add({
                                    pageId: page.id,
                                    pageTitle: page.title,
                                    message: 'Selected course is no longer available. Please choose a different course.',
                                    question: question.question,
                                    type: question.type
                                });
                            }
                        }
                        
                        // ADDITIONAL: If there's an answer but no valid course offer question, that's also an error
                        else if (question.answer && !courseOfferQuestion && !hasPrefilled) {
                            console.log(`❌ Course selected but no course offer question answered`);
                            errorMessage.add({
                                pageId: page.id,
                                pageTitle: page.title,
                                message: 'Please answer the course offer question first.',
                                question: question.question,
                                type: question.type
                            });
                        }
                    }
                });
            });
        });

        const errors = Array.from(errorMessage);
        console.log(`📊 Validation complete. Total errors found: ${errors.length}`, errors);

        return errors;
    };

    const validateAllPages = () => {
        const validatingPages = stableProcessedFormData.filter(page => !page.title.includes('Equipment'));
        
        const allErrors = validate(validatingPages, courseOffers);
        
        console.log(`Total validation errors found across all pages: ${allErrors.length}`, allErrors);
        
        if (allErrors.length > 0) {
            // Group errors by page
            const errorsByPage = {};
            const pagesWithErrors = [];

            allErrors.forEach(error => {
                if (!errorsByPage[error.pageId]) {
                    errorsByPage[error.pageId] = [];
                }
                errorsByPage[error.pageId].push(error);

                if (!pagesWithErrors.includes(error.pageTitle)) {
                    pagesWithErrors.push(error.pageTitle);
                }
            });

            console.log('Validation errors by page:', errorsByPage);

            let firstErrorPage = null;

            const updatedPages = stableProcessedFormData.map(page => {
                let p = {...page};

                if (errorsByPage[page.id]) {
                    p.completed = false;
                    p.validationAttempted = true;
                    
                    p.Sections = p.Sections.map(section => ({
                        ...section,
                        Questions: section.Questions.map(question => {
                            const questionError = errorsByPage[page.id].find(error => 
                                error.question === question.question
                            );
                            if (questionError) {
                                return { ...question, error: questionError.message };
                            }
                            return question;
                        })
                    }));

                    if (!firstErrorPage) {
                        firstErrorPage = page;
                    }
                } else {
                    p.validationAttempted = false;
                }

                return p;
            });

            setProcessedFormData(updatedPages);
            safeDispatchData(updatedPages, 'Validation errors applied');

            // Navigate to first page with errors
            if (firstErrorPage) {
                const pageIndex = stableProcessedFormData.findIndex(p => p.id === firstErrorPage.id);
                setActiveAccordionIndex(pageIndex);
                dispatch(bookingRequestFormActions.setCurrentPage(firstErrorPage));
            }

            // Create user-friendly error message
            const createErrorMessage = () => {
                if (allErrors.length === 1) {
                    return `Please complete the required field: "${allErrors[0].question}"`;
                } else if (allErrors.length <= 3) {
                    const questions = allErrors.map(error => `"${error.question}"`).join(', ');
                    return `Please complete these required fields: ${questions}`;
                } else {
                    const errorCount = allErrors.length;
                    const pageNames = pagesWithErrors.join(', ');
                    return `Please complete ${errorCount} required fields on the following pages: ${pageNames}`;
                }
            };

            toast.error(createErrorMessage());
            return true; // Validation failed
        }

        return false; // Validation passed
    };

    const showWarningReturningBookingNotSave = (bookingType, bookingStatus, cPage, submit = false) => {
        if (validateAllPages()) {
            dispatch(globalActions.setLoading(false));
            return false;
        }

        // Pass courseOffers to the validate function
        const errorMsg = validate([cPage], courseOffers);
        const pages = updatePageData(cPage?.Sections, cPage?.id, 'VALIDATE_DATA', errorMsg.length > 0);

        if (errorMsg.length > 0) {
            console.log(errorMsg)
            dispatch(globalActions.setLoading(false));
            
            // IMPROVED: Create specific error message for current page
            const createPageErrorMessage = () => {
                if (errorMsg.length === 1) {
                    return `Please complete the required field: "${errorMsg[0].question}"`;
                } else if (errorMsg.length <= 3) {
                    const questions = errorMsg.map(error => `"${error.question}"`).join(', ');
                    return `Please complete these required fields: ${questions}`;
                } else {
                    return `Please complete ${errorMsg.length} required fields on this page.`;
                }
            };
            
            toast.error(createPageErrorMessage());
        } else {
            setSubmitting(submit);
            const dirtyQuestionsList = stableProcessedFormData.filter(page => {
                const dirtylist = page.Sections.filter(s => s.Questions.some(q => q.answer != q.oldAnswer));
                if (dirtylist.length > 0) {
                    return dirtylist;
                }
            });
            
            if (bookingStatus?.name != 'booking_confirmed') {
                // On the last page before showing summary, we always save but don't submit
                if (cPage?.lastPage && submit === true) {
                    // if (funder?.toLowerCase() === 'icare') {
                    //     submitBooking();
                    // } else {
                    //     // Save the current page without submitting
                    //     saveCurrentPage(cPage, false).then(() => {
                    //         // Show the summary component
                    //         setBookingSubmittedState(true);
                    //     });
                    // }
                    if (isNdisFunded) {
                        // Save the current page without submitting
                        saveCurrentPage(cPage, false).then(() => {
                            // Show the summary component
                            setBookingSubmittedState(true);
                        });
                    } else {
                        submitBooking();
                    }
                } else {
                    handleSaveExit(currentPage, false);
                }
            } else {
                if (dirtyQuestionsList.length > 0) {
                    setShowWarningDialog(true);
                } else {
                    // if no changes then just exit
                    handleExit();
                }
            }
        }
    }

    const handleExit = () => {
        dispatch(bookingRequestFormActions.setData([]));
        dispatch(bookingRequestFormActions.setQuestionDependencies([]));
        window.open('/bookings', '_self');
    }

    const handleSaveExit = async (cPage, submit) => {
        dispatch(globalActions.setLoading(true));

        if (submit && validateAllPages()) {
            dispatch(globalActions.setLoading(false));
            return false;
        } else {
            // Pass courseOffers to the validate function
            const errorMsg = validate([cPage], courseOffers);
            if (errorMsg.length > 0 && submit) {
                dispatch(globalActions.setLoading(false));
                
                // IMPROVED: Create specific error message for save/exit
                const createSaveErrorMessage = () => {
                    if (errorMsg.length === 1) {
                        return `Cannot submit: Please complete the required field "${errorMsg[0].question}".`;
                    } else if (errorMsg.length <= 3) {
                        const questions = errorMsg.map(error => `"${error.question}"`).join(', ');
                        return `Cannot submit: Please complete these required fields: ${questions}`;
                    } else {
                        return `Cannot submit: Please complete ${errorMsg.length} required fields.`;
                    }
                };
                
                toast.error(createSaveErrorMessage());
            } else {
                const response = await saveCurrentPage(cPage, submit);
                if (submit) {
                    dispatch(globalActions.setLoading(false));
                    if (funder?.toLowerCase() === 'icare') {
                        if (origin && origin == 'admin') {
                            window.opener.location.reload(true);
                            setTimeout(() => {
                                window.close();
                            }, 2000);
                        } else {
                            setTimeout(() => {
                                getRequestFormTemplate();
                                window.open('https://sargoodoncollaroy.com.au/thanks/', '_self');
                            }, 500);
                        }
                    } else {
                        // Update URL to include submission status
                        setBookingSubmittedState(true);
                    }
                } else {
                    dispatch(bookingRequestFormActions.setData([]));
                    dispatch(bookingRequestFormActions.setQuestionDependencies([]));
                    window.open('/bookings', '_self');
                }
            }
        }
    }

    const setBookingSubmittedState = (submit) => {
        if (submit) {
          const paths = router.asPath.split('&&');
          const baseUrl = paths[0];
          let pageIdPart = '';

          for (let i = 1; i < paths.length; i++) {
            if (paths[i].startsWith('page_id=')) {
              pageIdPart = paths[i];
              break;
            }
          }

          let newUrl = baseUrl;

          if (pageIdPart) {
            newUrl += '&&' + pageIdPart;
          }

          newUrl += '&submit=true';

          router.push(newUrl, undefined, { shallow: true });
        }

        dispatch(bookingRequestFormActions.setBookingSubmitted(submit));
    }

    const submitBooking = async () => {
        dispatch(globalActions.setLoading(true));

        const lastPageIndex = stableProcessedFormData.length - 1;
        const lastPage = stableProcessedFormData[lastPageIndex];
        if (lastPage) {
            const response = await saveCurrentPage(lastPage, true);
            if (response) {
                dispatch(globalActions.setLoading(false));
                toast.success('Booking submitted successfully.');
                if (origin && origin == 'admin') {
                    window.opener.location.reload(true);
                    setTimeout(() => {
                        window.close();
                    }, 2000);
                } else {
                    setTimeout(() => {
                        window.open('https://sargoodoncollaroy.com.au/thanks/', '_self');
                    }, 500);
                }
            } else {
                dispatch(globalActions.setLoading(false));
                toast.error('Failed to submit booking. Please try again.');
            }
        } else {
            dispatch(globalActions.setLoading(false));
            toast.error('Unable to find booking data to submit. Please try again.');
        }
    }

    const saveCurrentPage = async (cPage, submit) => {
        let qa_pairs = [];

        let summaryOfStay = { ...summaryData };

        const pages = [cPage];
        pages.map(brf => {
            brf?.Sections?.map(section => {
                let s = structuredClone(section);
                let questions = [...s.Questions];
                questions = questions.sort((a, b) => a.order - b.order);
                let qaPairs = s.QaPairs ? [...s.QaPairs] : [];
                qaPairs = qaPairs.sort((a, b) => a.order - b.order);

                // UPDATED: Use question key to check for funding question
                const fundedQuestion = questions.find(q => questionHasKey(q, QUESTION_KEYS.FUNDING_SOURCE));
                if (fundedQuestion && fundedQuestion.answer) {
                    if (fundedQuestion.answer?.toLowerCase().includes('ndis') || fundedQuestion.answer?.toLowerCase().includes('ndia')) {
                        dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                    } else {
                        dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                    }
                    dispatch(bookingRequestFormActions.setFunder(fundedQuestion.answer));
                }

                const sectionLabel = section.label;
                
                // FIXED: Handle deletion of hidden questions with existing QaPair records
                questions.filter(q => {
                    // Hidden questions with existing QaPair records should be deleted
                    if (q.hidden === true && q.fromQa === true) {
                        return true;
                    }
                    
                    // Original condition - hidden, dirty, and answer cleared
                    if (q.hidden === true && q.dirty === true && 
                        (q.answer == null || q.answer == undefined || q.answer == '')) {
                        return true;
                    }
                    
                    return false;
                }).map(q => {
                    qa_pairs.push({
                        ...q,
                        section_id: section.id,
                        delete: true,
                        guestId: guest?.id
                    });
                });
                
                questions = questions.filter(q => !q.excludeFromSave);

                // UPDATED: Use question key to filter package questions
                const updatedQuestions = questions.filter(q => {
                    // Skip hidden questions unless they're package questions
                    if (q.hidden && !questionHasKey(q, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) {
                        return false;
                    }
                    
                    return true;
                });

                if (updatedQuestions.length == qaPairs.length) {
                    updatedQuestions.map((question, questionIndex) => {
                        let qaPairDirty = false;
                        const qaPairPrev = currentPage?.Sections?.find(s => s.id === section.id)?.QaPairs?.find(qp => qp.id === question.id);

                        if (qaPairPrev) {
                            if (question.type == 'checkbox' || question.type == 'checkbox-button') {
                                question.answer && question.answer.forEach(option => {
                                    if (!qaPairPrev?.answer || !qaPairPrev?.answer?.includes(option)) {
                                        qaPairDirty = true;
                                    }
                                })
                            } else if (question.type == 'equipment') {
                                if ((qaPairPrev.answer == 1) != question.answer) {
                                    qaPairDirty = true;
                                }
                            } else if (qaPairPrev.answer !== question.answer) {
                                qaPairDirty = true;
                            }
                        }

                        // ADDED: If question has profileOverrideBooking flag, mark as dirty
                        if (question.profileOverrideBooking) {
                            qaPairDirty = true;
                        }

                        const answer = (typeof question.answer != 'string' && (
                            question.type === 'multi-select' || 
                            question.type === 'checkbox' || 
                            question.type === 'checkbox-button' || 
                            question.type === 'health-info' || 
                            question.type === 'goal-table' || 
                            question.type === 'care-table' ||
                            question.type === 'service-cards' ||
                            question.type === 'service-cards-multi'
                        )) ? JSON.stringify(question.answer) : question.answer;
                        
                        if (answer != undefined) {
                            let qap = {
                                ...qaPairs[questionIndex],
                                question: question.question,
                                answer: answer,
                                question_type: question.type,
                                section_id: section.id,
                                submit: submit,
                                updatedAt: new Date(),
                                dirty: qaPairDirty || question.dirty, // Include question.dirty flag
                                sectionLabel: sectionLabel,
                                oldAnswer: question.oldAnswer,
                                question_key: question.question_key,
                                fromProfile: question.fromProfile // Track if this came from profile
                            };

                            // Only set question_id for NEW qa_pairs (when fromQa is false)
                            if (!question.fromQa) {
                                qap.question_id = question.id;
                            }

                            qa_pairs.push(qap);

                            summaryOfStay.data = generateSummaryData(summaryOfStay.data, question.question, answer, question.type, qa_pairs, question.question_key);
                        } else {
                            if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL))  {
                                let qap = {
                                    ...qaPairs[questionIndex],
                                    question: question.question,
                                    answer: answer,
                                    question_type: question.type,
                                    section_id: section.id,
                                    submit: submit,
                                    updatedAt: new Date(),
                                    dirty: qaPairDirty || question.dirty,
                                    sectionLabel: sectionLabel,
                                    oldAnswer: question.oldAnswer,
                                    question_key: question.question_key
                                };

                                if (!question.fromQa) {
                                    qap.question_id = question.id;
                                }

                                qa_pairs.push(qap);
                            }
                        }
                    });
                } else {
                    updatedQuestions.map((question, questionIndex) => {
                        const answer = (typeof question.answer != 'string' && (
                            question.type === 'multi-select' || 
                            question.type === 'checkbox' || 
                            question.type === 'checkbox-button' || 
                            question.type === 'health-info' || 
                            question.type === 'goal-table' || 
                            question.type === 'care-table' ||
                            question.type === 'service-cards' || 
                            question.type === 'service-cards-multi' 
                        )) ? JSON.stringify(question.answer) : question.answer;
                        
                        if (answer != undefined) {
                            let qap = {
                                label: '',
                                question: question.question,
                                answer: answer,
                                question_type: question.type,
                                question_id: question.fromQa ? question.question_id : question.id,
                                section_id: section.id,
                                submit: submit,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                question_key: question.question_key,
                                oldAnswer: question.oldAnswer,
                                dirty: question.dirty || question.profileOverrideBooking, // Include dirty flags
                                fromProfile: question.fromProfile
                            };

                            if (question.fromQa) {
                                qap = { ...qap, id: question.id };
                            }

                            qa_pairs.push(qap);
                            summaryOfStay.data = generateSummaryData(summaryOfStay.data, question.question, answer, question.type, qa_pairs, question.question_key);
                        }
                    });
                }
            });
        });

        // Handle equipment changes
        if (equipmentChangesState && equipmentChangesState?.length > 0) {
            console.log('📝 Processing equipment changes for QA pair updates...', equipmentChangesState);
            
            equipmentChangesState.forEach(equipmentChange => {
                if (equipmentChange.category === 'infant_care' && equipmentChange.equipments) {
                    console.log('🍼 Processing infant care equipment changes:', equipmentChange.equipments);
                    
                    equipmentChange.equipments.forEach(equipment => {
                        const questionMapping = getInfantCareQuestionMapping(equipment.name);
                        
                        if (questionMapping && equipment.meta_data?.quantity !== undefined) {
                            let sectionId = null;
                            let existingQaPairId = null;
                            let oldAnswer = null;
                            let questionId = null;
                            let questionType = null;
                            
                            stableProcessedFormData?.forEach(page => {
                                page.Sections?.forEach(section => {
                                    section.Questions?.forEach(question => {
                                        if (question.question_key === questionMapping.questionKey) {
                                            sectionId = section.id;
                                            oldAnswer = question.answer;
                                            questionId = question.fromQa ? question.question_id : question.id;
                                            questionType = question.type;
                                        }
                                    });
                                    
                                    section.QaPairs?.forEach(qaPair => {
                                        if (qaPair.Question?.question_key === questionMapping.questionKey) {
                                            sectionId = section.id;
                                            existingQaPairId = qaPair.id;
                                            oldAnswer = qaPair.answer;
                                            questionId = qaPair.question_id || qaPair.Question?.id;
                                            questionType = qaPair.question_type || qaPair.Question?.type;
                                        }
                                    });
                                });
                            });
                            
                            if (sectionId && questionId) {
                                const newAnswer = equipment.meta_data.quantity.toString();
                                const isDirty = oldAnswer !== newAnswer;
                                
                                if (isDirty || submit) {
                                    const equipmentQaPair = {
                                        question: questionMapping.questionText,
                                        question_key: questionMapping.questionKey,
                                        question_type: questionType || 'integer',
                                        question_id: questionId,
                                        section_id: sectionId,
                                        answer: newAnswer,
                                        updatedAt: new Date(),
                                        dirty: isDirty,
                                        oldAnswer: oldAnswer,
                                        equipment_related: true,
                                        equipment_name: equipment.name,
                                        equipment_category: 'infant_care',
                                        submit: submit
                                    };
                                    
                                    if (existingQaPairId) {
                                        equipmentQaPair.id = existingQaPairId;
                                    } else {
                                        equipmentQaPair.createdAt = new Date();
                                    }
                                    
                                    qa_pairs.push(equipmentQaPair);
                                }
                            }
                        }
                    });
                }
            });
        }

        setSummaryData(summaryOfStay);

        let data = {};
        const qaPairDirty = qa_pairs.some(qp => qp.dirty);
        
        if (qaPairDirty || qa_pairs.length > 0 || currentPage.Sections.every(s => s.QaPairs && s.QaPairs.length == 0)) {
            // Handle NDIS package filtering (unchanged)
            if (summaryOfStay.data.funder && (summaryOfStay.data.funder?.toLowerCase().includes('ndis') || summaryOfStay.data.funder?.toLowerCase().includes('ndia'))) {
                const packageQuestions = qa_pairs.filter(qp => questionMatches({ question: qp.question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL));

                const regularRadioPackageQuestion = packageQuestions.find(qp => qp.question_type === 'radio');
                if (regularRadioPackageQuestion) {
                    qa_pairs = qa_pairs.map(qp => {
                        let temp_qp = { ...qp };
                        if (qp.id === regularRadioPackageQuestion.id) {
                            temp_qp.delete = true;
                            temp_qp.dirty = true;
                        }
                        return temp_qp;
                    });
                }
            } else {
                const packageQuestions = qa_pairs.filter(qp => questionMatches({ question: qp.question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL));

                const ndisPackageQuestions = packageQuestions.filter(qp =>
                    qp.question_type === 'radio-ndis' || qp.question_type === 'package-selection'
                );

                ndisPackageQuestions.forEach(ndisQuestion => {
                    qa_pairs = qa_pairs.map(qp => {
                        let temp_qp = { ...qp };
                        if (qp.id === ndisQuestion.id) {
                            temp_qp.delete = true;
                            temp_qp.dirty = true;
                        }
                        return temp_qp;
                    });
                });
            }

            let dataForm = { qa_pairs: qa_pairs, flags: { origin: origin, bookingUuid: uuid, pageId: cPage.id, templateId: cPage.template_id }};
            if (equipmentChangesState.length > 0) {
                dataForm.equipmentChanges = [...equipmentChangesState];
            }

            const response = await fetch('/api/booking-request-form/save-qa-pair', {
                method: 'POST',
                body: JSON.stringify(dataForm),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                dispatch(bookingRequestFormActions.clearEquipmentChanges());
                const result = await response.json();
                if (result.success && result.bookingAmended && bookingAmended == false) {
                    setBookingAmended(true);
                }

                // Handle completion updates (unchanged)
                if (prevBookingId && cPage?.id) {
                    console.log(`💾 Page "${cPage.title}" saved successfully - updating completion`);
                    
                    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
                        const newSavedPages = new Set([...pagesWithSavedData, cPage.id]);
                        setPagesWithSavedData(newSavedPages);
                        
                        setTimeout(() => {
                            forcePageCompletionUpdate(cPage.id, visitedPages, newSavedPages);
                        }, 0);
                    } else {
                        const newSavedPages = new Set([...pagesWithSavedData, cPage.id]);
                        setPagesWithSavedData(newSavedPages);
                        
                        setTimeout(() => {
                            forcePageCompletionUpdate(cPage.id, visitedPages, newSavedPages);
                        }, 0);
                    }
                }
            }

            // =====================================================
            // CRITICAL: PROFILE SYNC LOGIC - UPDATED
            // =====================================================
            const guestId = getGuestId();
            if (guestId) {
                // Get all profile-mapped fields that should be saved
                const profileFieldsToSave = qa_pairs.filter(qp => {
                    const hasMapping = hasProfileMapping(qp.question_key);
                    if (!hasMapping) return false;
                    
                    // Don't save deleted items
                    if (qp.delete) return false;
                    
                    // Check if there's a value to save
                    const hasValue = qp.answer !== null && qp.answer !== undefined && qp.answer !== '';
                    if (!hasValue) return false;
                    
                    // UPDATED LOGIC: Save to profile if:
                    // 1. The field is dirty (user changed it or profile differs from booking)
                    // 2. OR this is a submit action (to ensure profile stays in sync)
                    // 3. OR the field came from profile and we want to ensure consistency
                    const shouldSave = qp.dirty || submit || qp.fromProfile;
                    
                    return shouldSave;
                });

                console.log(`📤 Profile fields to save: ${profileFieldsToSave.length}`, 
                    profileFieldsToSave.map(f => ({ key: f.question_key, answer: f.answer, dirty: f.dirty }))
                );

                // Batch all profile changes into a single operation
                if (profileFieldsToSave.length > 0) {
                    const batchUpdate = {};

                    for (const field of profileFieldsToSave) {
                        const profileUpdate = mapQuestionKeyToProfileData(field.question_key, field.answer);
                        if (profileUpdate) {
                            Object.assign(batchUpdate, profileUpdate);
                        }
                    }

                    // Make a single API call for all profile updates
                    if (Object.keys(batchUpdate).length > 0) {
                        try {
                            console.log('📤 Saving to profile:', Object.keys(batchUpdate));
                            const profileResponse = await fetch('/api/my-profile/save-update', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    guest_id: guestId,
                                    ...batchUpdate
                                }),
                            });

                            if (profileResponse.ok) {
                                const profileResult = await profileResponse.json();
                                console.log('✅ Profile update successful:', profileResult.message);
                            } else {
                                const errorResult = await profileResponse.json();
                                console.error('❌ Profile update failed:', errorResult.message);
                            }
                        } catch (error) {
                            console.error('❌ Error in profile update:', error);
                        }
                    }
                }
            }
        }

        // Update page with saved QaPairs (unchanged)
        const updatedPage = structuredClone(cPage);
        if (data.hasOwnProperty('data')) {
            data.data.map(mainQuestion => {
                for (let sectionIndex = 0; sectionIndex < updatedPage.Sections.length; sectionIndex++) {
                    const currentSection = updatedPage.Sections[sectionIndex];

                    for (let questionIndex = 0; questionIndex < currentSection.Questions.length; questionIndex++) {
                        const currentQuestion = _.cloneDeep(currentSection.Questions[questionIndex]);
                        if (currentQuestion.question == mainQuestion.question) {
                            let qaPair = { ...mainQuestion, question_id: currentQuestion.id, section_id: currentSection.id, fromQa: true };
                            if (!updatedPage.Sections[sectionIndex].QaPairs) updatedPage.Sections[sectionIndex].QaPairs = [];
                            const existingQaPairIdx = currentSection?.QaPairs?.findIndex(qp => qp.id === qaPair.id);
                            if (existingQaPairIdx > -1) {
                                updatedPage.Sections[sectionIndex].QaPairs[existingQaPairIdx] = qaPair;
                            } else {
                                updatedPage.Sections[sectionIndex].QaPairs.push(qaPair);
                            }
                            updatedPage.Sections[sectionIndex].QaPairs = _.uniqWith(updatedPage.Sections[sectionIndex].QaPairs, _.isEqual);
                        }
                    }
                }
            });
        }

        data.updatedPage = updatedPage;

        return data;
    }

    const applyQuestionDependencies = (pages) => {
        const multipleAnswersQuestion = [
            'checkbox',
            'checkbox-button',
            'multi-select',
            'health-info',
            'card-selection-multi',
            'horizontal-card-multi'
        ];

        const currentFunder = getCurrentFunder(pages);
        let currentIsNdisFunded = false;
        let currentIsIcareFunded = false;
        if (currentFunder && (currentFunder.toLowerCase().includes('ndis') || currentFunder.toLowerCase().includes('ndia'))) {
            currentIsNdisFunded = true;
        } else if (currentFunder && currentFunder.toLowerCase().includes('icare')) {
            currentIsIcareFunded = true;
        }


        let hiddenQuestions = [];
        const list = pages.map((page) => {
            let temp = structuredClone(page);
            let noItems = 0;
            temp.Sections = temp.Sections.map(section => {
                let s = structuredClone(section);

                if (s.Questions.length === 1) {
                    if (s.Questions[0].second_booking_only || s.Questions[0].ndis_only || s.Questions[0].question_key === 'i-acknowledge-additional-costs-icare') {
                        return s;
                    }
                }

                s.Questions = section.Questions.map(question => {
                    let q = structuredClone(question);
                    let answer = question.answer;

                    if (q.type === 'goal-table' && q.answer) {
                        q.answer = Array.isArray(q.answer) ? q.answer.map(item => ({
                            ...item,
                            id: item.id,
                            goal: item.goal,
                            specificGoal: item.specificGoal
                        })) : q.answer;
                    }

                    const questionDependencies = [];
                    questionDependenciesData.map(qd => {
                        questionDependencies.push.apply(questionDependencies, qd.QuestionDependencies.filter(d => d.dependence_id === question.question_id || d.dependence_id === question.id));
                    });
                    
                    if (questionDependencies && questionDependencies.length > 0) {
                        questionDependencies.map(qd => {
                            if (qd.answer !== null) {
                                if (multipleAnswersQuestion.includes(question.type)) {
                                    if (typeof answer === 'string') {
                                        if (answer.startsWith('[') || answer.startsWith('{')) {
                                            try {
                                                answer = JSON.parse(answer);
                                            } catch (e) {
                                                console.warn('Failed to parse answer as JSON, keeping as string:', answer);
                                                // Keep answer as-is if parsing fails
                                                answer = Array.isArray(answer) ? answer : [];
                                            }
                                        } else {
                                            // Plain string answer from old template - convert to empty array for checkbox/multi-select
                                            // console.log(`Converting non-JSON string answer to array for ${question.type}: "${answer}"`);
                                            answer = [];
                                        }
                                    }

                                    if (answer && answer.length > 0 && answer.find(a => a === qd.answer)) {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: false });
                                    } else {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: true });
                                    }
                                } else {
                                    let qdAnswer = qd.answer;
                                    if (typeof answer === 'number') {
                                        qdAnswer = typeof qdAnswer === 'string' ? parseInt(qdAnswer) : qdAnswer;
                                    }
                                    if (qdAnswer === answer) {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: false });
                                    } else {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: true });
                                    }
                                }
                            } else {
                                if (multipleAnswersQuestion.includes(question.type)) {
                                    if (typeof answer === 'string') {
                                        if (answer.startsWith('[') || answer.startsWith('{')) {
                                            try {
                                                answer = JSON.parse(answer);
                                            } catch (e) {
                                                console.warn('Failed to parse answer as JSON, keeping as string:', answer);
                                                // Keep answer as-is if parsing fails
                                                answer = Array.isArray(answer) ? answer : [];
                                            }
                                        } else {
                                            // Plain string answer from old template - convert to empty array for checkbox/multi-select
                                            // console.log(`Converting non-JSON string answer to array for ${question.type}: "${answer}"`);
                                            answer = [];
                                        }
                                    }

                                    if (answer && answer.length > 0) {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: false });
                                    } else {
                                        hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: true });
                                    }
                                } else if (question.hidden) {
                                    hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: true });
                                } else {
                                    hiddenQuestions.push({ id: qd.id, qId: qd.question_id, dId: qd.dependence_id, hidden: false });
                                }
                            }
                        });
                    } else {
                        // Questions with dependencies should start hidden until dependencies are satisfied
                        const hasDependencies = question.QuestionDependencies && question.QuestionDependencies.length > 0;
                        q.hidden = hasDependencies;
                        if (!hasDependencies) {
                            s.hidden = false;
                        }
                    }

                    return q;
                });

                noItems += s.Questions.filter(q => q.hidden === false).length;

                return s;
            });

            temp.noItems = noItems;
            return temp;
        }).map(page => {
            let p = structuredClone(page);
            p.Sections = page.Sections.map(section => {
                let s = structuredClone(section);

                if (s.Questions.length === 1) {
                    if (s.Questions[0].second_booking_only || s.Questions[0].ndis_only || s.Questions[0].question_key === 'i-acknowledge-additional-costs-icare') {
                        return s;
                    }
                }

                s.Questions = section.Questions.map(question => {
                    let q = { ...question };
                    let hqs;
                    if (question.fromQa) {
                        hqs = hiddenQuestions.filter(hq => hq.qId === question.question_id);
                    } else {
                        hqs = hiddenQuestions.filter(hq => hq.qId === question.id);
                    }
                    
                    if (hqs.length > 0) {
                        const show = hqs.find(h => h.hidden === false);

                        if (show) {
                            q.hidden = false;
                            s.hidden = false;
                        } else {
                            q.hidden = true;
                        }
                    } else {
                        // FIXED: Check if question has dependencies defined
                        // If it has dependencies but no matching hidden questions found,
                        // it should remain hidden until dependencies are satisfied
                        const hasDependencies = question.QuestionDependencies && question.QuestionDependencies.length > 0;
                        
                        if (hasDependencies) {
                            // Question has dependencies but no dependency results found
                            // This means the dependencies haven't been processed yet or dependency questions haven't been answered
                            // Default to hidden until dependencies are satisfied
                            q.hidden = true;
                        } else {
                            // Questions with dependencies should remain hidden until explicitly shown
                            const hasDependencies = question.QuestionDependencies && question.QuestionDependencies.length > 0;
                            q.hidden = hasDependencies;
                            if (!hasDependencies) {
                                s.hidden = false;
                            }
                        }
                    }

                    return q;
                });

                return s;
            }).map(section => {
                let s = structuredClone(section);
                const hiddenQuestions = s.Questions.filter(q => q.hidden);
                s.hidden = hiddenQuestions.length === s.Questions.length;

                return s;
            });

            return p;
        }).map(page => {
            let p = structuredClone(page);
            const pageIsDirty = p?.dirty;

            p.Sections = page.Sections.map(section => {
                let s = structuredClone(section);

                if (s.Questions.length === 1) {
                    if (s.Questions[0].second_booking_only && booking?.type == BOOKING_TYPES.RETURNING_GUEST) {
                        s.Questions[0].hidden = true;
                        s.hidden = true;
                        if (pageIsDirty || s.Questions[0]?.dirty) {
                            s.Questions[0].hidden = false;
                            s.hidden = false;
                        }
                        return s;
                    }

                    // UPDATED: Use question key for acknowledgement charges check
                    if (s.Questions[0].ndis_only && s.Questions[0].question_key === 'i-acknowledge-additional-charges') {
                        s.Questions[0].hidden = true;
                        s.hidden = true;

                        if (currentIsNdisFunded && bookingFormRoomSelected.length > 0) {
                            if (bookingFormRoomSelected[0]?.type != 'studio' || bookingFormRoomSelected.length > 1) {
                                s.Questions[0].hidden = false;
                                s.hidden = false;
                            }
                        }

                        return s;
                    }

                    if (s.Questions[0].question_key === 'i-acknowledge-additional-costs-icare') {
                        s.Questions[0].hidden = true;
                        s.hidden = true;
                        const isPaidRoom = (bookingFormRoomSelected.length > 0 && bookingFormRoomSelected[0]?.type != 'studio') || bookingFormRoomSelected.length > 1;
                        if (isPaidRoom) {
                            s.Questions[0].hidden = false;
                            s.hidden = false;
                        }

                        return s;
                    }

                    // UPDATED: Use question key for package questions
                    if (currentIsNdisFunded && questionHasKey(s.Questions[0], QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) && s.Questions[0].type === 'radio') {
                        s.Questions[0].hidden = true;
                        s.hidden = true;

                        return s;
                    }

                    // ADDED: Handle general NDIS-only questions - hide them when NDIS is not funded
                    if (s.Questions[0].ndis_only && !currentIsNdisFunded) {
                        s.Questions[0].hidden = true;
                        s.hidden = true;
                        return s;
                    }
                }

                const qStatus = [];

                s.Questions = section.Questions.map(question => {
                    let q = { ...question };

                    // ADDED: Explicitly hide NDIS-only questions when NDIS is not funded
                    if (q.ndis_only && !currentIsNdisFunded) {
                        q.hidden = true;
                        return q;
                    }

                    if (q.QuestionDependencies.length > 0) {
                        const main = new Set();
                        q.QuestionDependencies.map(qd => {
                            page.Sections.map(section => {
                                let temp = section.Questions.find(qt => qt.question_id === qd.dependence_id);
                                if (temp && (temp.answer == qd.answer)) {
                                    temp.showDependence = true;
                                    main.add(temp);
                                }
                            });
                        });

                        Array.from(main).map(m => {
                            if (m.hidden) {
                                q.hidden = true;
                            }
                        });

                        if (Array.from(main).length > 0) {
                            const notHidden = Array.from(main).filter(m => m.showDependence == true);
                            if (notHidden.length == 0) {
                                q.hidden = true;
                            } else {
                                q.hidden = false;
                            }
                        } else {
                            // FIXED: If no dependency matches found, question should remain hidden
                            q.hidden = true;
                        }
                    }

                    if (q.hidden) {
                        // Don't clear existing user answers - preserve them
                        // Only set to null if there was no previous answer
                        if (!q.answer && q.answer !== 0 && q.answer !== false) {
                            q.answer = null;
                        }
                    }

                    if (!q.hidden && q.answer == null && bookingData && bookingData.hasOwnProperty('newBooking')) {
                        const questionInPrevBookingExists = bookingData.booking.Sections.find(s => s.orig_section_id === section.orig_section_id);
                        if (questionInPrevBookingExists) {
                            const questionInPrevBooking = questionInPrevBookingExists.QaPairs.find(qa => qa.question === q.question);
                            if (questionInPrevBooking && questionInPrevBooking.Question.prefill) q.answer = questionInPrevBooking.answer;
                        }
                    }

                    qStatus.push(q.hidden);

                    return q;
                });

                s.hidden = true;

                qStatus.map(hidden => {
                    if (!hidden) {
                        s.hidden = false;
                    }
                });

                return s;
            });

            return p;
        });

        const finalPages = list.map(page => {
            // ✅ CRITICAL FIX: Don't calculate completion here for returning guests
            if (isReturningGuestWithHelper) {
                // console.log(`🔄 Skipping completion calculation for returning guest on page: ${page.id} "${page.title}"`);
                return page; // Keep existing completion, helper will handle it
            }
            
            // ✅ CRITICAL FIX: Preserve Equipment page completion from API flag
            // Equipment completion is determined by API (completedEquipments) not by form validation
            if (page.title === 'Equipment') {
                const equipmentCompleted = completedEquipments || equipmentPageCompleted || page.completed;
                // console.log(`🔧 Preserving Equipment page completion: ${equipmentCompleted}`);
                return {
                    ...page,
                    completed: equipmentCompleted
                };
            }
            
            // Original completion logic for first-time guests
            return {
                ...page,
                completed: calculatePageCompletion(page)
            };
        });
        
        return finalPages;
    }

    const isReturningGuestWithHelper = useMemo(() => {
        return currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId;
    }, [currentBookingType, prevBookingId]);

    const getRequestFormTemplate = async () => {
        let url = '/api/booking-request-form';

        if (uuid || prevBookingId) {
            url = url + '?' + new URLSearchParams({ bookingId: uuid, prevBookingId: prevBookingId });
        }

        dispatch(globalActions.setLoading(true));
        const res = await fetch(url);
        const data = await res.json();

        setBookingData(data);

        if (res.ok) {
            if (!data.template) {
                dispatch(globalActions.setLoading(false));
                toast.error('There are no booking template detected. Please create one under settings.');
                return;
            }

            if (data.completedEquipments !== undefined) {
                setCompletedEquipments(data.completedEquipments);
                // console.log('🔧 Equipment completion flag from API:', data.completedEquipments);
            }

            let summaryOfStay = { ...summaryData };
            setEquipmentPageCompleted(data.completedEquipments);

            let bookingType = BOOKING_TYPES.FIRST_TIME_GUEST;
            
            // DETECT NDIS FUNDING EARLY TO PREVENT DUPLICATE QUESTIONS
            // Uses enhanced detection that checks BOTH QaPairs (saved) AND Questions (prefilled)
            let isNdisFunded = false;

            // Check current booking sections
            if (data.booking?.Sections) {
                isNdisFunded = detectNdisFundingFromSections(data.booking.Sections);
            }

            // Also check newBooking for returning guests (may have different data structure)
            if (!isNdisFunded && data.newBooking?.Sections) {
                isNdisFunded = detectNdisFundingFromSections(data.newBooking.Sections);
            }

            // ADDITIONAL: Check template pages directly (for cases where data is in a different structure)
            if (!isNdisFunded && data.template?.Pages) {
                for (const page of data.template.Pages) {
                    if (isNdisFunded) break;
                    for (const section of page.Sections || []) {
                        if (isNdisFunded) break;
                        // Check Questions
                        for (const question of section.Questions || []) {
                            if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                                isNdisFunded = question.answer?.toLowerCase().includes('ndis') || 
                                            question.answer?.toLowerCase().includes('ndia');
                                if (isNdisFunded) {
                                    console.log('✅ NDIS detected from template.Pages:', question.answer);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            console.log('🔍 Early NDIS detection during template load:', isNdisFunded);

            if (isNdisFunded) {
                dispatch(bookingRequestFormActions.setIsNdisFunded(true));
            }
            
            if (data.booking) {
                const guestData = data.booking.Guest;
                setGuest(guestData);
                if (guestData) {
                    summaryOfStay.uuid = uuid;
                    summaryOfStay.guestName = guestData.first_name + ' ' + guestData.last_name;
                    summaryOfStay.guestEmail = guestData.email;
                }

                if (data.booking?.Rooms) {
                    const selectedRooms = data.booking.Rooms.map((room, index) => {
                        return { 
                            room: room.label, 
                            name: room.label,
                            type: index == 0 ? room.RoomType.type : 'upgrade', 
                            price: room.RoomType.price_per_night,
                            price_per_night: room.RoomType.price_per_night,
                            peak_rate: room.RoomType.peak_rate,
                            hsp_pricing: room.RoomType.hsp_pricing || 0
                        };
                    });
                    summaryOfStay.rooms = selectedRooms;
                }

                summaryOfStay.signature = data.booking.signature;
                summaryOfStay.agreement_tc = data.booking.agreement_tc;
                summaryOfStay.verbal_consent = data.booking.verbal_consent;

                let bookingData = { ...data.booking };
                bookingType = data.booking.type;
                delete bookingData.Guest;
                setBooking(bookingData);
                setCurrentBookingStatus(JSON.parse(bookingData.status));
            }

            let newSections;

            if (data.newBooking) {
                newSections = data.newBooking.Sections;
                bookingType = data.newBooking.type;
                setCurrentBookingType(bookingType);
                setBooking({ ...data.newBooking })
                setCurrentBookingStatus(JSON.parse(data.newBooking.status));
                summaryOfStay.signature = null;
                summaryOfStay.agreement_tc = null;
                summaryOfStay.verbal_consent = null;
            }

            dispatch(bookingRequestFormActions.setBookingType(bookingType));

            let questionDependencies = [];

            const currentPath = router.asPath.split('&&');
            
            // PROCESS PAGES USING EXISTING LOGIC - NO CHANGES TO THIS PART
            const pagesArr = data.template.Pages.map((page, index) => {
                let temp = structuredClone(page);
                temp.url = "&&page_id=" + temp.id;
                temp.active = "&" + currentPath[1] === temp.url ? true : false;
                temp.hasNext = data.template.Pages.length - 1 === index ? false : true;
                temp.hasBack = index === 0 ? false : true;
                temp.lastPage = index === data.template.Pages.length - 1 ? true : false;
                temp.pageQuestionDependencies = [];
                
                // ✅ CRITICAL FIX: For returning guests, ALWAYS start with false
                // Let the helper handle ALL completion logic
                if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                    temp.completed = false;
                } else {
                    temp.completed = false; // Will be calculated later for first-time guests
                }

                let numberItems = 0;
                let returnee = false;
                const sections = page.Sections.sort((a,b) => a.order - b.order).map(sec => {
                    let s = structuredClone(sec);
                    s.hidden = false;

                    // Process existing booking data
                    if (data.booking && !data.newBooking) {
                        const bookingSection = data.booking.Sections && data.booking.Sections.find(o => o.orig_section_id === sec.id);
                        if (bookingSection) {
                            s = structuredClone(bookingSection);

                            if (s.QaPairs.length > 0) {
                                const qa_pairs = s.QaPairs ? convertQAtoQuestionWithNdisFilter(s.QaPairs, s.id, returnee, temp.title, isNdisFunded) : [];
                                s.Questions = qa_pairs.questionList;

                                if (s.QaPairs.length !== sec.Questions.length) {
                                    const removedQuestions = sec.Questions.filter(templateQuestion => {
                                        // ✅ ENHANCED: Check if this template question already has a saved QaPair
                                        const hasQaPair = s.QaPairs.some(qaPair => {
                                            // Match by question_id (most reliable for saved data)
                                            if (qaPair.question_id === templateQuestion.id) {
                                                return true;
                                            }
                                            
                                            // Match by question_key (for NDIS questions)
                                            if (qaPair.Question?.question_key && templateQuestion.question_key) {
                                                return qaPair.Question.question_key === templateQuestion.question_key;
                                            }
                                            
                                            return false;
                                        });
                                        
                                        if (hasQaPair) {
                                            // console.log(`⚠️ Template question already has QaPair, skipping: "${templateQuestion.question}" (ID: ${templateQuestion.id})`);
                                            return false;
                                        }
                                        
                                        // Also check if already in converted questionList
                                        const alreadyInQuestionList = qa_pairs.questionList.some(qaPairQuestion => {
                                            // Match by question_key
                                            if (templateQuestion.question_key && qaPairQuestion.question_key) {
                                                return templateQuestion.question_key === qaPairQuestion.question_key;
                                            }
                                            
                                            // Match by question_id
                                            if (templateQuestion.id && qaPairQuestion.question_id) {
                                                return templateQuestion.id === qaPairQuestion.question_id;
                                            }
                                            
                                            return false;
                                        });
                                        
                                        if (alreadyInQuestionList) {
                                            // console.log(`⚠️ Template question already in converted list, skipping: "${templateQuestion.question}" (ID: ${templateQuestion.id})`);
                                            return false;
                                        }
                                        
                                        return true;
                                    }).map(q => { 
                                        return { ...q, question: q.question, type: q.type, answer: null } 
                                    });
                                    
                                    // console.log(`📋 Adding ${removedQuestions.length} unanswered template questions`);
                                    s.Questions.push(...removedQuestions);
                                }

                                const hasAnsweredQuestions = qa_pairs.answered;

                                // ✅ CRITICAL FIX: NEVER set completion during template load for returning guests
                                if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                                    // Do nothing - completion will be handled by the helper
                                    // console.log(`📋 Template load: Skipping completion for returning guest page "${temp.title}"`);
                                    
                                    // Only track real saved data
                                    const hasRealSavedData = s.QaPairs.some(qaPair => 
                                        qaPair.createdAt || qaPair.updatedAt || qaPair.dirty ||
                                        (!qaPair.temporaryFromPreviousBooking && !qaPair.prefill)
                                    );
                                    
                                    if (hasRealSavedData) {
                                        setTimeout(() => {
                                            setPagesWithSavedData(prev => new Set([...prev, temp.id]));
                                        }, 100);
                                    }
                                } else {
                                    // For first-time guests, use original logic
                                    temp.completed = hasAnsweredQuestions;
                                }
                            } else {
                                s.Questions = sec.Questions;
                            }

                            // ✅ CRITICAL FIX: Equipment page completion guard
                            if (temp.title == 'Equipment' && data?.completedEquipments) {
                                if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                                    // Let the helper handle equipment completion too
                                    // console.log(`📋 Template load: Equipment completion will be handled by helper for returning guest`);
                                } else {
                                    temp.completed = true;
                                }
                            }
                        }
                    }

                    let questionArr = s.Questions ? s.Questions : [];
                    
                    // EXISTING LOGIC FOR SUCCEEDING BOOKING - UNCHANGED
                    if (data.newBooking) {
                        const bookingSection = data.newBooking.Sections && data.newBooking.Sections.find(o => o.orig_section_id === sec.id);
                        if (bookingSection) {
                            s = structuredClone(bookingSection);
                            if (newSections) {
                                const nSec = newSections.find(ns => ns.orig_section_id === s.orig_section_id);
                                if (nSec) {
                                    s.id = nSec.id;
                                    s.model_id = nSec.model_id;
                                    if (nSec.QaPairs.length > 0) {
                                        s.QaPairs = structuredClone(nSec.QaPairs);
                                    }
                                    returnee = true;
                                }
                            }

                            if (s.QaPairs.length > 0) {
                                const qa_pairs = s.QaPairs ? convertQAtoQuestionWithNdisFilter(s.QaPairs, s.id, returnee, temp.title, isNdisFunded) : [];
                                s.Questions = qa_pairs.questionList;

                                if (s.QaPairs.length !== sec.Questions.length) {
                                    const removedQuestions = sec.Questions.filter(templateQuestion => {
                                        // ✅ SAME ENHANCED LOGIC
                                        const hasQaPair = s.QaPairs.some(qaPair => {
                                            if (qaPair.question_id === templateQuestion.id) {
                                                return true;
                                            }
                                            if (qaPair.Question?.question_key && templateQuestion.question_key) {
                                                return qaPair.Question.question_key === templateQuestion.question_key;
                                            }
                                            return false;
                                        });
                                        
                                        if (hasQaPair) {
                                            // console.log(`⚠️ [newBooking] Template question already has QaPair, skipping: "${templateQuestion.question}" (ID: ${templateQuestion.id})`);
                                            return false;
                                        }
                                        
                                        const alreadyInQuestionList = qa_pairs.questionList.some(qaPairQuestion => {
                                            if (templateQuestion.question_key && qaPairQuestion.question_key) {
                                                return templateQuestion.question_key === qaPairQuestion.question_key;
                                            }
                                            if (templateQuestion.id && qaPairQuestion.question_id) {
                                                return templateQuestion.id === qaPairQuestion.question_id;
                                            }
                                            return false;
                                        });
                                        
                                        if (alreadyInQuestionList) {
                                            // console.log(`⚠️ [newBooking] Template question already in converted list, skipping: "${templateQuestion.question}" (ID: ${templateQuestion.id})`);
                                            return false;
                                        }
                                        
                                        return true;
                                    }).map(q => { 
                                        return { ...q, question: q.question, type: q.type, answer: null } 
                                    });
                                    
                                    s.Questions.push(...removedQuestions);
                                }

                                const hasAnsweredQuestions = qa_pairs.answered;

                                // ✅ CRITICAL FIX: Same guard for new booking processing
                                if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                                    // Do nothing - completion will be handled by the helper
                                    // console.log(`📋 Template load: Skipping new booking completion for returning guest page "${temp.title}"`);
                                    
                                    if (newSections) {
                                        const nSec = newSections.find(ns => ns.orig_section_id === s.orig_section_id);
                                        if (nSec && nSec.QaPairs && nSec.QaPairs.length > 0) {
                                            const hasRealSavedData = nSec.QaPairs.some(qaPair => 
                                                qaPair.createdAt || qaPair.updatedAt || qaPair.dirty ||
                                                (!qaPair.temporaryFromPreviousBooking && !qaPair.prefill)
                                            );
                                            
                                            if (hasRealSavedData) {
                                                setTimeout(() => {
                                                    setPagesWithSavedData(prev => new Set([...prev, temp.id]));
                                                }, 100);
                                            }
                                        }
                                    }
                                } else {
                                    // For first-time guests, use original logic  
                                    temp.completed = hasAnsweredQuestions;
                                }
                            } else {
                                s.Questions = sec.Questions;
                            }

                            // ✅ CRITICAL FIX: Equipment page guard for new booking too
                            if (temp.title == 'Equipment' && data?.completedEquipments) {
                                if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                                    // Let the helper handle it
                                    // console.log(`📋 Template load: Equipment completion (new booking) will be handled by helper`);
                                } else {
                                    temp.completed = true;
                                }
                            }
                        }

                        questionArr = s.Questions ? s.Questions : [];
                        const prevSection = data.booking.Sections && data.booking.Sections.find(item => item.orig_section_id === s.id);
                        const newSection = data.newBooking.Sections && data.newBooking.Sections.find(item => item.orig_section_id === s.id);
                        s.QaPairs = newSection ? newSection.QaPairs : [];
                        
                        // ALL EXISTING LOGIC FOR HANDLING PREVIOUS SECTIONS - UNCHANGED
                        prevSection && prevSection.QaPairs.map(qa => {
                            s.Questions.map((question, questionIndex) => {
                                const tempQuestion = omitAttribute(question, ['id']);
                                const tempQa = omitAttribute(qa, ['id']);
                                let tempAnswer = null;
                                const existingQaPair = s.QaPairs.find(qaPair => qaPair.question === question.question);

                                if (existingQaPair) {
                                    tempAnswer = existingQaPair.answer;
                                } else {
                                    tempAnswer = (question.type === 'multi-select' || question.type === 'checkbox' || question.type === 'checkbox-button' || question.type === 'health-info') ? question.answer : question.answer;
                                }
                                if (question.question === qa.question) {
                                    questionArr[questionIndex] = {
                                        ...tempQuestion,
                                        ...tempQa,
                                        question: question.question,
                                        answer: tempAnswer,
                                        question_type: question.type,
                                        question_id: question.fromQa ? question.question_id : question.id,
                                        section_id: newSection.id,
                                        updatedAt: new Date().toISOString()
                                    };
                                } else {
                                    questionArr[questionIndex] = {
                                        ...tempQuestion,
                                        label: '',
                                        question: question.question,
                                        answer: tempAnswer,
                                        question_type: question.type,
                                        question_id: question.fromQa ? question.question_id : question.id,
                                        section_id: newSection.id,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString()
                                    };
                                }
                            });
                        });
                    }

                    // ALL EXISTING QUESTION PROCESSING LOGIC - UNCHANGED
                    questionArr = questionArr.filter(question => !(question.question == '' && question.type == 'string')).sort((a, b) => { return a.order - b.order; });
                    questionArr = questionArr.map(question => {
                        let q = { ...question }
                        if (!q.answer && bookingType === BOOKING_TYPES.FIRST_TIME_GUEST) {
                            if (questionHasKey(q, QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
                                const prefered_arival_date = data.booking.preferred_arrival_date ? moment(data.booking.preferred_arrival_date).format('YYYY-MM-DD') : '';
                                const preferred_departure_date = data.booking.preferred_departure_date ? moment(data.booking.preferred_departure_date).format('YYYY-MM-DD') : '';
                                if (prefered_arival_date != '' || preferred_departure_date != '') {
                                    q.answer = prefered_arival_date + ' - ' + preferred_departure_date;
                                } else {
                                    q.answer = null;
                                }
                            }

                            if (q.question === "Emergency Contact Name") {
                                q.answer = data.booking.alternate_contact_name;
                            }

                            if (q.question === "Emergency Contact Phone") {
                                q.answer = data.booking.alternate_contact_number;
                            }
                        }

                        if ((!q.answer || q.answer == null) && bookingType == BOOKING_TYPES.RETURNING_GUEST && q.prefill) {
                            let questionMatch;
                            data.booking.Sections.map(section => section.QaPairs.map(qaPair => {
                                if (qaPair.question == q.question) {
                                    questionMatch = qaPair
                                }
                            }));

                            if (questionMatch) {
                                // Mark this as temporary - profile data will override this later
                                q.answer = questionMatch.answer;
                                q.dirty = true;
                                q.temporaryFromPreviousBooking = true;
                                // console.log(`⏳ Temporary prefill from previous booking: "${q.question}" = "${questionMatch.answer}" (will be overridden by profile data)`);
                            }
                        }

                        q.hidden = q.QuestionDependencies && q.QuestionDependencies.length > 0;

                        if ((!returnee && q.second_booking_only) || q.ndis_only) {
                            s.hidden = true;
                            q.hidden = true;
                        }

                        questionDependencies.push.apply(questionDependencies, s.Questions.filter(qp => qp.QuestionDependencies.length > 0));

                        summaryOfStay.data = generateSummaryData(summaryOfStay.data, q.question, q.answer, q.type, questionArr, q.question_key);

                        if (questionHasKey(q, QUESTION_KEYS.FUNDING_SOURCE) && q.answer) {
                            if (q.answer?.toLowerCase().includes('ndis') || q.answer?.toLowerCase().includes('ndia')) {
                                summaryOfStay.data.isNDISFunder = true;
                                dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                            } else {
                                summaryOfStay.data.isNDISFunder = false;
                                dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                            }

                            dispatch(bookingRequestFormActions.setFunder(q.answer));
                        }

                        return q;
                    });

                    s.Questions = questionArr;
                    numberItems += s.Questions ? s.Questions.filter(q => q.hidden === false).length : 0;

                    return s;
                });

                temp.Sections = sections;
                temp.noItems = numberItems;

                return temp;
            });

            setSummaryData(summaryOfStay);

            let questionDependenciesUnique = new Set();
            questionDependencies.map(qd => {
                questionDependenciesUnique.add(qd);
            });

            questionDependencies = Array.from(questionDependenciesUnique);
            dispatch(bookingRequestFormActions.setQuestionDependencies(questionDependencies));

            if (pagesArr.length === 0) {
                dispatch(globalActions.setLoading(false));
                toast.error('There are no booking template detected. Please create one under settings.');
                setTimeout(() => {
                    window.close();
                }, 5000);
                return;
            }

            // APPLY EXISTING DEPENDENCIES
            const pagesWithDependencies = applyQuestionDependencies(pagesArr);
            
            const finalPages = isNdisFunded ? 
                postProcessPagesForNdis(pagesWithDependencies, isNdisFunded, 
                    // Pass a guarded completion function
                    (page) => {
                        if (bookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                            // console.log(`🔄 Skipping completion calculation for returning guest on page: ${page.id} "${page.title}"`);
                            return false; // Let the helper handle it later
                        }
                        return calculatePageCompletion(page);
                    }
                ) : 
                pagesWithDependencies;

            // Store the form data
            safeDispatchData(finalPages, 'template load with completion guard');

            setTimeout(async () => {
                await loadAndApplyProfileData(finalPages);
                dispatch(globalActions.setLoading(false));
            }, 100);
        }
    };

    /**
     * Handle NDIS page creation when funding changes to NDIS after template load
     * This covers the case where:
     * 1. Returning guest loads form with prefilled non-NDIS funding
     * 2. User changes funding to NDIS
     * 3. NDIS page needs to be created dynamically
     */
    useEffect(() => {
        // Only proceed if NDIS is funded and we have form data
        if (!isNdisFunded || !stableProcessedFormData || stableProcessedFormData.length === 0) {
            return;
        }
        
        // Check if NDIS page already exists
        const hasNdisPage = stableProcessedFormData.some(p => p.id === 'ndis_packages_page');
        
        if (hasNdisPage) {
            // NDIS page already exists, no action needed
            return;
        }
        
        // Check if there are NDIS-only questions that need to be moved
        const hasNdisQuestions = stableProcessedFormData.some(page =>
            page.Sections?.some(section =>
                section.Questions?.some(q => 
                    q.ndis_only === true && shouldMoveQuestionToNdisPage(q, true)
                )
            )
        );
        
        if (!hasNdisQuestions) {
            console.log('ℹ️ No NDIS-only questions found to move');
            return;
        }
        
        console.log('🔄 Creating NDIS page after funding change to NDIS...');
        
        try {
            // Process the form data to create NDIS page
            const processedPages = postProcessPagesForNdis(
                stableProcessedFormData,
                true, // isNdisFunded
                (page) => {
                    // Guard completion calculation for returning guests
                    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                        return false; // Let the helper handle it later
                    }
                    return calculatePageCompletion(page);
                }
            );
            
            // Verify NDIS page was created
            const ndisPageCreated = processedPages.some(p => p.id === 'ndis_packages_page');
            
            if (ndisPageCreated) {
                console.log('✅ NDIS page created successfully after funding change');
                
                // Apply dependencies to all pages
                const pagesWithDependencies = processedPages.map(page => 
                    applyQuestionDependenciesAcrossPages(page, processedPages, bookingFormRoomSelected)
                );
                
                setProcessedFormData(pagesWithDependencies);
                safeDispatchData(pagesWithDependencies, 'NDIS page created after funding change');
            } else {
                console.warn('⚠️ NDIS page creation failed - no NDIS questions were moved');
            }
        } catch (error) {
            console.error('❌ Error creating NDIS page after funding change:', error);
        }
    }, [isNdisFunded, stableProcessedFormData?.length]); // Minimal dependencies to prevent loops

    useEffect(() => {
        // Only run debounced sync for returning guests
        if (isReturningGuestWithHelper && 
            stableProcessedFormData && stableProcessedFormData.length > 0) {
            
            // Debounce to prevent rapid updates
            const timeoutId = setTimeout(() => {
                const updatedPages = batchUpdateReturningGuestCompletions(stableProcessedFormData, {
                    visitedPages,
                    pagesWithSavedData,
                    equipmentPageCompleted,
                    equipmentChangesState,
                    prevBookingId,
                    currentBookingType
                });
                
                // Only update if there are actual changes
                const currentCompletions = stableProcessedFormData.map(p => p.completed);
                const newCompletions = updatedPages.map(p => p.completed);
                
                if (JSON.stringify(currentCompletions) !== JSON.stringify(newCompletions)) {
                    // console.log('📊 Debounced completion sync applied for returning guest');
                    setProcessedFormData(updatedPages);
                    safeDispatchData(updatedPages, 'debounced state sync');
                }
            }, 500); // 500ms debounce

            return () => clearTimeout(timeoutId);
        }
    }, [
        visitedPages.size, 
        pagesWithSavedData.size, 
        isReturningGuestWithHelper,
        equipmentPageCompleted,
        equipmentChangesState
    ]);

    useEffect(() => {
        if (isUpdating) {
            return;
        }

        if (stableBookingRequestFormData && stableBookingRequestFormData.length > 0) {
            // Use helper function to analyze processing needs
            const analysis = analyzeNdisProcessingNeeds(stableBookingRequestFormData, isNdisFunded);

            // If template was already loaded with NDIS awareness, apply dependencies but lock completion
            if (analysis.templateAlreadyNdisAware) {
                const updatedData = forceRefreshAllDependencies(stableBookingRequestFormData, bookingFormRoomSelected);
                
                // ✅ CRITICAL FIX: Apply locked completion for returning guests
                const withLockedCompletion = updatedData.map(page => {
                    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                        return { ...page, completed: calculateReturningGuestPageCompletion(page, {
                            visitedPages,
                            pagesWithSavedData,
                            equipmentPageCompleted,
                            equipmentChangesState,
                            prevBookingId,
                            currentBookingType
                        })};
                    } else {
                        return { ...page, completed: calculateFirstTimeGuestPageCompletion(page, {
                            visitedPages,
                            pagesWithSavedData,
                            completedEquipments,
                            currentBookingType
                        })};
                    }
                });
                
                if (JSON.stringify(stableProcessedFormData) !== JSON.stringify(withLockedCompletion)) {
                    setProcessedFormData(withLockedCompletion);
                }
                return;
            }
            
            // Create a comprehensive key for change detection
            const createFormDataKey = (formData, isNdisFunded) => {
                return {
                    pages: formData.map(page => ({
                        id: page.id,
                        completed: page.completed,
                        sections: page.Sections?.map(section => ({
                            id: section.id,
                            questions: section.Questions?.map(q => ({
                                id: q.id || q.question_id,
                                question_key: q.question_key,
                                answer: q.answer,
                                ndis_only: q.ndis_only,
                                type: q.type,
                                hidden: q.hidden
                            })),
                            qaPairs: section.QaPairs?.map(qa => ({
                                id: qa.id,
                                question_id: qa.question_id,
                                answer: qa.answer,
                                question_key: qa.Question?.question_key,
                                ndis_only: qa.Question?.ndis_only
                            }))
                        }))
                    })),
                    isNdisFunded: isNdisFunded
                };
            };

            const currentFormDataKey = createFormDataKey(stableBookingRequestFormData, isNdisFunded);
            const currentFormDataStr = JSON.stringify(currentFormDataKey);

            const now = Date.now();
            const timeSinceLastUpdate = now - (lastProcessingTimeRef.current || 0);
            const PROCESSING_COOLDOWN = 500;

            const dataChanged = prevFormDataRef.current !== currentFormDataStr;
            const fundingChanged = prevIsNdisFundedRef.current !== isNdisFunded;
            const canProcess = timeSinceLastUpdate > PROCESSING_COOLDOWN;

            if ((dataChanged || fundingChanged) && canProcess) {
                // console.log('📊 Form data or NDIS funding status changed, processing with completion lock...', {
                //     dataChanged,
                //     fundingChanged,
                //     newFundingStatus: isNdisFunded,
                //     analysis,
                //     timeSinceLastUpdate
                // });

                setIsUpdating(true);
                lastProcessingTimeRef.current = now;
                prevFormDataRef.current = currentFormDataStr;
                prevIsNdisFundedRef.current = isNdisFunded;

                if (analysis.needsProcessing || fundingChanged) {
                    // console.log('🔄 Using debounced NDIS processing with completion lock...');
                    processNdisWithDebounce(stableBookingRequestFormData, isNdisFunded);
                } else {
                    const updatedData = forceRefreshAllDependencies(stableBookingRequestFormData, bookingFormRoomSelected);
                    const withLockedCompletion = updatedData.map(page => {
                        if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                            return { ...page, completed: calculateReturningGuestPageCompletion(page, {
                                visitedPages,
                                pagesWithSavedData,
                                equipmentPageCompleted,
                                equipmentChangesState,
                                prevBookingId,
                                currentBookingType
                            })};
                        } else {
                            if (page.id === 'ndis_packages_page') {
                                return { ...page, completed: calculateNdisPageCompletion(page) };
                            }
                            return page;
                        }
                    });
                    setProcessedFormData(withLockedCompletion);
                    safeDispatchData(withLockedCompletion, 'Dependency refresh with completion lock');
                    setIsUpdating(false);
                }
            }
        }
    }, [
        stableBookingRequestFormData, 
        isNdisFunded, 
        isUpdating, 
        bookingFormRoomSelected,
        processNdisWithDebounce,
        currentBookingType,
        prevBookingId,
        visitedPages,
        pagesWithSavedData,
        equipmentPageCompleted,
        equipmentChangesState,
        completedEquipments
    ]);

    // Also add cleanup in useEffect cleanup
    useEffect(() => {
        return () => {
            // Cleanup timeout on unmount
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (stableBookingRequestFormData && stableBookingRequestFormData.length > 0 && !lastDispatchedDataRef.current) {
            lastDispatchedDataRef.current = JSON.stringify(stableBookingRequestFormData);
        }
    }, [stableBookingRequestFormData]);

    useEffect(() => {
        let mounted = true;
        if (mounted) {
            dispatch(bookingRequestFormActions.setData([]));
            dispatch(bookingRequestFormActions.clearEquipmentChanges());
            dispatch(bookingRequestFormActions.setRooms([]));

             // ADD: Clear guest and booking state
            setGuest(null);
            setBooking(null);
            setBookingData(null);
            
            // ADD: Reset all refs to prevent stale data
            profilePreloadInProgressRef.current = false;
            profileSaveInProgressRef.current = false;
            lastDispatchedDataRef.current = null;
            prevFormDataRef.current = null;
            prevIsNdisFundedRef.current = null;
            lastFetchParamsRef.current = null;
            lastAutoUpdateCheckRef.current = null;
            lastCareQuestionUpdateRef.current = 0;
            lastProcessingTimeRef.current = 0;
            
            // ADD: Clear processed form data
            setProcessedFormData([]);

            const isSubmitted = router.asPath.includes('&submit=true');
            dispatch(bookingRequestFormActions.setBookingSubmitted(isSubmitted));

            dispatch(bookingRequestFormActions.setIsNdisFunded(false));
            dispatch(bookingRequestFormActions.setCheckinDate(null));
            dispatch(bookingRequestFormActions.setCheckoutDate(null));

            const urlParams = new URLSearchParams(router.asPath.split('?')[1]);
            const courseOfferIdParam = urlParams.get('courseOfferId');
            if (courseOfferIdParam) {
                setSelectedCourseOfferId(courseOfferIdParam);
                console.log('🎓 Course offer ID detected from URL:', courseOfferIdParam);
            }

            // Reset loading states
            setProfileDataLoaded(false);
        }

        mounted && uuid && getRequestFormTemplate().then(() => {
            // Force a small re-render delay to ensure pre-populated values show
            setTimeout(() => {
                setProfileDataLoaded(prev => prev); // Trigger re-render
            }, 100);
        });

        return (() => {
            mounted = false;
        });
    }, [uuid, prevBookingId]);

    // Full cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('🧹 BookingRequestForm unmounting - full cleanup');
            
            // Clear Redux state
            dispatch(bookingRequestFormActions.setData([]));
            dispatch(bookingRequestFormActions.clearEquipmentChanges());
            dispatch(bookingRequestFormActions.setRooms([]));
            dispatch(bookingRequestFormActions.setIsNdisFunded(false));
            dispatch(bookingRequestFormActions.setFunder(null));
            dispatch(bookingRequestFormActions.setCheckinDate(null));
            dispatch(bookingRequestFormActions.setCheckoutDate(null));
            dispatch(bookingRequestFormActions.setBookingSubmitted(false));
            
            // Reset all refs
            profilePreloadInProgressRef.current = false;
            profileSaveInProgressRef.current = false;
            lastDispatchedDataRef.current = null;
            
            // Clear timeouts
            if (processingTimeoutRef.current) clearTimeout(processingTimeoutRef.current);
            if (autoUpdateTimeoutRef.current) clearTimeout(autoUpdateTimeoutRef.current);
            if (careQuestionUpdateRef.current) clearTimeout(careQuestionUpdateRef.current);
        };
    }, [dispatch]);

    useEffect(() => {
        if (stableProcessedFormData && 
            stableProcessedFormData.length > 0 && 
            !initialDatesExtractedRef.current) {
            
            const extractedDates = getStayDatesFromForm(stableProcessedFormData);
            
            // Only set if we found dates and haven't set them yet
            if (extractedDates.checkInDate || extractedDates.checkOutDate) {
                console.log('📅 Initial stay dates extraction:', extractedDates);
                setStayDates(extractedDates);
                
                if (extractedDates.checkInDate) {
                    dispatch(bookingRequestFormActions.setCheckinDate(extractedDates.checkInDate));
                }
                if (extractedDates.checkOutDate) {
                    dispatch(bookingRequestFormActions.setCheckoutDate(extractedDates.checkOutDate));
                }
                
                initialDatesExtractedRef.current = true;
            }
        }
    }, [stableProcessedFormData, dispatch]);

    useEffect(() => {
        initialDatesExtractedRef.current = false;
    }, [uuid, prevBookingId]);

    useEffect(() => {
        if (equipmentPageCompleted && stableProcessedFormData && stableProcessedFormData.length > 0) {
            const equipmentPage = stableProcessedFormData.find(page => page.title === 'Equipment');
            
            if (equipmentPage && !equipmentPage.completed) {
                // console.log('✅ Equipment page completion update');
                
                // FOR RETURNING GUESTS: Use the helper
                if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST && prevBookingId) {
                    const updatedPages = forceUpdateReturningGuestPageCompletion(
                        stableProcessedFormData,
                        equipmentPage.id,
                        {
                            visitedPages,
                            pagesWithSavedData,
                            equipmentPageCompleted,
                            equipmentChangesState,
                            prevBookingId,
                            currentBookingType
                        }
                    );
                    
                    if (updatedPages !== stableProcessedFormData) {
                        setProcessedFormData(updatedPages);
                        safeDispatchData(updatedPages, 'Equipment page completion update');
                    }
                } else {
                    // FOR FIRST-TIME GUESTS: Original logic
                    const updatedPages = stableProcessedFormData.map(page => {
                        if (page.title === 'Equipment') {
                            return { ...page, completed: calculatePageCompletion(page) };
                        }
                        return page;
                    });

                    setProcessedFormData(updatedPages);
                    safeDispatchData(updatedPages, 'Equipment page completion update');
                }
            }
        }
    }, [
        equipmentPageCompleted, 
        calculatePageCompletion,
        currentBookingType,
        prevBookingId,
        visitedPages,
        pagesWithSavedData,
        equipmentChangesState
    ]);

    useEffect(() => {
        if (!origin || origin !== 'admin') {
            const handleBeforeUnload = () => {
                fetch('/api/booking-request-form/log-exit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        bookingId: uuid,
                        timestamp: new Date().toISOString(),
                        action: 'page_exit',
                        exitType: 'browser_close'
                    }),
                    keepalive: true
                }).catch(err => {
                    console.error('Error logging exit:', err);
                });
            };

            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [uuid, origin]);

    useEffect(() => {
        if (stableProcessedFormData && stableProcessedFormData.length > 0) {
            // Debounce filter calculation to avoid excessive updates
            const timeoutId = setTimeout(() => {
                const newFilters = calculateNdisFilters(stableProcessedFormData);
                if (JSON.stringify(newFilters) !== JSON.stringify(ndisFormFilters)) {
                    console.log('Form data changed, updating filters:', newFilters);
                    setNdisFormFilters(newFilters);
                }
            }, 300);

            return () => clearTimeout(timeoutId);
        }
    }, [stableProcessedFormData, calculateNdisFilters]);

    useEffect(() => {
        if (currentPage && stableProcessedFormData.length > 0) {
            // Small delay to allow page to settle after navigation
            const refreshTimer = setTimeout(() => {
                // Apply comprehensive dependency refresh
                const refreshedData = forceRefreshAllDependencies(stableProcessedFormData, bookingFormRoomSelected);
                
                // Only update if there are actual changes to avoid unnecessary re-renders
                if (JSON.stringify(refreshedData) !== JSON.stringify(stableProcessedFormData)) {
                    setProcessedFormData(refreshedData);
                    safeDispatchData(refreshedData, 'page change dependency refresh');
                }
            }, 100);

            return () => clearTimeout(refreshTimer);
        }
    }, [currentPage?.id]);

    useEffect(() => {
        // If booking type changes and we have form data, force profile reload
        if (stableBookingRequestFormData?.length > 0 && currentBookingType) {
            // console.log(`📋 Booking type detected: ${currentBookingType} - ensuring profile data takes precedence`);
            
            // Reset profile loaded flag to force reload
            if (profileDataLoaded) {
                setProfileDataLoaded(false);
                // console.log('🔄 Resetting profile data flag to ensure it loads for this booking type');
            }
        }
    }, [currentBookingType, stableBookingRequestFormData?.length]);

    useEffect(() => {
        // Determine which data source to use
        let dataToAnalyze = null;
        let dataSource = 'none';
        
        // First preference: fully processed form data
        if (stableProcessedFormData && stableProcessedFormData.length > 0) {
            dataToAnalyze = stableProcessedFormData;
            dataSource = 'processed';
            // console.log('🎓 Using stableProcessedFormData for course analysis');
        }
        // Fallback: use raw booking request form data if processed data isn't ready yet
        else if (stableBookingRequestFormData && stableBookingRequestFormData.length > 0) {
            dataToAnalyze = stableBookingRequestFormData;
            dataSource = 'raw';
            // console.log('🎓 Fallback: Using stableBookingRequestFormData for course analysis');
        }
        // No data available yet
        else {
            console.log('⏸️ No form data available yet for course analysis');
            setCourseAnalysisData({
                hasCourse: false,
                courseId: null,
                courseName: null,
                courseOffered: false,
                analysis: 'Waiting for form data to load...',
                dataSource: 'none'
            });
            return;
        }

        // Extract QA pairs from the available data
        const allQAPairs = extractAllQAPairsFromForm(dataToAnalyze);
        
        // console.log('🎓 Running course analysis with data:', {
        //     totalQAPairs: allQAPairs.length,
        //     formDataPages: dataToAnalyze?.length || 0,
        //     dataSource: dataSource
        // });

        if (allQAPairs.length === 0) {
            console.warn('⚠️ No QA pairs found in form data');
            setCourseAnalysisData({
                hasCourse: false,
                courseId: null,
                courseName: null,
                courseOffered: false,
                analysis: 'No answered questions found',
                dataSource: dataSource
            });
            return;
        }

        try {
            const analysis = analyzeCourseFromBookingData({
                allQAPairs: allQAPairs,
                allBookingData: {
                    sections: dataToAnalyze?.map(page => page.Sections || []).flat()
                },
                formData: {
                    funder,
                    isNdisFunded,
                    sections: dataToAnalyze
                }
            });
            
            const finalAnalysis = {
                ...analysis,
                dataSource: dataSource
            };
            
            console.log('🎓 Course Analysis Complete:', finalAnalysis);
            setCourseAnalysisData(finalAnalysis);
            
        } catch (error) {
            console.error('❌ Error in course analysis:', error);
            setCourseAnalysisData({
                hasCourse: false,
                courseId: null,
                courseName: null,
                courseOffered: false,
                analysis: 'Error analyzing course data',
                error: error.message,
                dataSource: dataSource
            });
        }
    }, [
        stableProcessedFormData, 
        stableBookingRequestFormData, 
        funder, 
        isNdisFunded, 
        extractAllQAPairsFromForm
    ]);

    useEffect(() => {
        // Watch for direct changes to isNdisFunded Redux state
        if (prevIsNdisFundedRef.current !== null && prevIsNdisFundedRef.current !== isNdisFunded) {
            // ADD: Check if this change makes sense based on current form data
            const currentFundingAnswer = extractCurrentFundingAnswer(stableProcessedFormData);
            const shouldBeNdis = currentFundingAnswer?.toLowerCase().includes('ndis') || 
                                currentFundingAnswer?.toLowerCase().includes('ndia');
            
            // DEFENSIVE: If the change doesn't match the actual funding answer, revert it
            if (currentFundingAnswer && shouldBeNdis !== isNdisFunded) {
                // console.log('🛡️ DEFENSIVE: Reverting incorrect funding status change', {
                //     currentAnswer: currentFundingAnswer,
                //     shouldBeNdis: shouldBeNdis,
                //     actualStatus: isNdisFunded,
                //     revertingTo: shouldBeNdis
                // });
                
                // Revert to the correct status
                dispatch(bookingRequestFormActions.setIsNdisFunded(shouldBeNdis));
                prevIsNdisFundedRef.current = shouldBeNdis;
                return; // Exit early to prevent the rest of the logic
            }
            
            console.log('🔄 NDIS funding status changed in Redux, clearing package answers...', {
                from: prevIsNdisFundedRef.current ? 'NDIS' : 'Non-NDIS',
                to: isNdisFunded ? 'NDIS' : 'Non-NDIS'
            });
            
            if (stableProcessedFormData && stableProcessedFormData.length > 0) {
                // Clear package answers from all pages
                const updatedPages = clearPackageQuestionAnswers(stableProcessedFormData, isNdisFunded);
                
                // ✅ FIXED: Recalculate page completion with correct functions
                const pagesWithCorrectCompletion = updatedPages.map(page => {
                    const wasCompleted = page.completed;
                    let newCompleted;
                    
                    if (page.id === 'ndis_packages_page') {
                        newCompleted = calculateNdisPageCompletion(page);
                    } else {
                        newCompleted = calculatePageCompletion(page);
                    }
                    
                    if (wasCompleted !== newCompleted) {
                        console.log(`📊 Page "${page.title}" completion status changed after package clearing: ${wasCompleted} → ${newCompleted}`);
                    }
                    
                    return { ...page, completed: newCompleted };
                });
                
                // Refresh dependencies and update form data
                const finalPages = forceRefreshAllDependencies(pagesWithCorrectCompletion, bookingFormRoomSelected);
                setProcessedFormData(finalPages);
                safeDispatchData(finalPages, 'Package answers cleared due to funding change');
            }
        }
        
        prevIsNdisFundedRef.current = isNdisFunded;
    }, [isNdisFunded, stableProcessedFormData, bookingFormRoomSelected, clearPackageQuestionAnswers, calculatePageCompletion, calculateNdisPageCompletion, forceRefreshAllDependencies, safeDispatchData]);

    useEffect(() => {
        // Clear any existing timeout
        if (autoUpdateTimeoutRef.current) {
            clearTimeout(autoUpdateTimeoutRef.current);
        }

        // Only run if we have the required data
        if (!stableProcessedFormData || stableProcessedFormData.length === 0 || 
            !careAnalysisData || !courseAnalysisData) {
            return;
        }

        // Debounce the auto-update with a longer delay
        autoUpdateTimeoutRef.current = setTimeout(() => {
            autoUpdatePackageSelection();
        }, 2000); // 2 second debounce

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (autoUpdateTimeoutRef.current) {
                clearTimeout(autoUpdateTimeoutRef.current);
            }
        };
    }, [
        // ONLY include primitive values and stable references
        careAnalysisData?.totalHoursPerDay,
        careAnalysisData?.carePattern,
        courseAnalysisData?.hasCourse,
        courseAnalysisData?.courseOffered,
        isNdisFunded,
        ndisFormFilters?.ndisPackageType,
        stableProcessedFormData?.length, // Only length to detect major changes
        autoUpdatePackageSelection // This is now stable due to useCallback
    ]);

    useEffect(() => {
        return () => {
            // Cleanup refs and timeouts on unmount
            lastAutoUpdateCheckRef.current = null;
            if (autoUpdateTimeoutRef.current) {
                clearTimeout(autoUpdateTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (careQuestionUpdateRef.current) {
                clearTimeout(careQuestionUpdateRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!futureCourseOffersChecked && (guest || booking || currentUser)) {
            console.log('🔍 Checking for future course offers...');
            fetchAllFutureCourseOffers();
        }
    }, [guest, booking, currentUser, futureCourseOffersChecked, fetchAllFutureCourseOffers]);

    useEffect(() => {
        if (futureCourseOffersChecked && hasFutureCourseOffers === false) {
            if (stableProcessedFormData && stableProcessedFormData.length > 0) {
                // console.log('🔍 Evaluating course page filtering...', {
                //     totalPages: stableProcessedFormData.length,
                //     hasFutureOffers: hasFutureCourseOffers,
                //     futureCourseOffersChecked
                // });
                
                // Check for existing course selection BEFORE filtering
                const hasExisting = hasExistingCourseSelection(stableProcessedFormData);
                // console.log('🔍 Existing course selection check:', hasExisting);
                
                // Filter the processed form data
                const filteredPages = filterCoursesPageIfNoOffers(stableProcessedFormData, hasFutureCourseOffers);
                
                // console.log('🔍 Filtering result:', {
                //     originalPageCount: stableProcessedFormData.length,
                //     filteredPageCount: filteredPages.length,
                //     pagesRemoved: stableProcessedFormData.length - filteredPages.length,
                //     hasExistingSelection: hasExisting,
                //     originalPages: stableProcessedFormData.map(p => p.title),
                //     filteredPages: filteredPages.map(p => p.title)
                // });
                
                // Only update if the filtering actually removed pages
                if (filteredPages.length !== stableProcessedFormData.length) {
                    // console.log('📝 Applying filtered pages (courses page removed)');
                    setProcessedFormData(filteredPages);
                    safeDispatchData(filteredPages, 'Courses page filtered (no future offers)');
                } else if (hasExisting) {
                    console.log('✅ Keeping all pages (existing course selection found)');
                    // No need to update - pages are already correct
                } else {
                    console.log('⚠️ No pages were filtered but should have been?');
                }
            }
        }
    }, [
        futureCourseOffersChecked, 
        hasFutureCourseOffers, 
        stableProcessedFormData, 
        filterCoursesPageIfNoOffers,
        hasExistingCourseSelection,
        safeDispatchData
    ]);

    useEffect(() => {
        // Reset validation flags when UUID changes (new booking loaded)
        return () => {
            courseValidationRef.current = false;
            console.log('🔄 Reset course validation flags for new booking');
        };
    }, [uuid, prevBookingId]);

    useEffect(() => {
        return () => {
            // Cancel any pending profile operations
            profilePreloadInProgressRef.current = false;
            profileSaveInProgressRef.current = false;
            
            // Clear pending saves
            setPendingProfileSaves(new Map());
            
            // Cancel the debounced function
            debouncedBatchSaveProfileData.cancel();
        };
    }, [debouncedBatchSaveProfileData]);

    useEffect(() => {
        // Re-fetch course offers when stay dates change (for validation)
        if (guest || booking || currentUser) {
            // Clear the cache to force re-fetch with new dates
            lastFetchParamsRef.current = null;
            fetchCourseOffers();
        }
    }, [stayDates?.checkInDate, stayDates?.checkOutDate, guest, booking, currentUser, fetchCourseOffers]);

    // Mark current page as visited on load (only when prevBookingId exists)
    useEffect(() => {
        if (prevBookingId && currentPage && currentPage.id) {
            markPageAsVisited(currentPage.id);
        }
    }, [currentPage?.id, markPageAsVisited, prevBookingId]);

    // Reset visited pages based on prevBookingId presence
    useEffect(() => {
        if (prevBookingId) {
            setVisitedPages(new Set());
            setPagesWithSavedData(new Set());
            console.log('📋 New booking with prevBookingId loaded, resetting page tracking');
        } else {
            setVisitedPages(new Set());
            setPagesWithSavedData(new Set());
            console.log('📋 Booking without prevBookingId loaded, no page tracking needed');
        }
    }, [uuid, prevBookingId]);

    useEffect(() => {
        // Debug completion for first-time guests when needed
        if (currentBookingType !== BOOKING_TYPES.RETURNING_GUEST && 
            stableProcessedFormData?.length > 0 && 
            process.env.NODE_ENV === 'development') {
            
            // debugFirstTimeGuestCompletion(stableProcessedFormData, {
            //     visitedPages,
            //     pagesWithSavedData,
            //     completedEquipments,
            //     currentBookingType
            // });
            
            const validation = validateFirstTimeGuestCompletionConsistency(stableProcessedFormData, {
                visitedPages,
                pagesWithSavedData,
                completedEquipments,
                currentBookingType
            });
            
            if (!validation.isValid) {
                console.warn('⚠️ First-time guest completion consistency issues found:', validation.issues);
            }
        }
    }, [
        stableProcessedFormData,
        visitedPages,
        pagesWithSavedData,
        completedEquipments,
        currentBookingType
    ]);

    useEffect(() => {
        // Only run for returning guests when course offers are loaded
        if (courseOffersLoaded && currentBookingType === BOOKING_TYPES.RETURNING_GUEST && 
            courseOffers.length > 0 && stableProcessedFormData?.length > 0) {
            
            console.log('🔍 Validating prefilled course answers for returning guest...');
            
            let hasInvalidPrefill = false;
            const updatedPages = stableProcessedFormData.map(page => {
                const updatedSections = page.Sections.map(section => {
                    const updatedQuestions = section.Questions.map(question => {
                        // Check if this is a prefilled "which course" question
                        if (questionHasKey(question, QUESTION_KEYS.WHICH_COURSE) && 
                            question.answer && 
                            (question.temporaryFromPreviousBooking || question.prefill)) {
                            
                            console.log('🎓 Checking prefilled course answer:', question.answer);
                            
                            // Find the corresponding course offer
                            const selectedOffer = courseOffers.find(offer => 
                                ['offered', 'accepted'].includes(offer.offerStatus) &&
                                (offer.courseId?.toString() === question.answer.toString() || 
                                offer.id?.toString() === question.answer.toString())
                            );
                            
                            if (selectedOffer && selectedOffer.dateValid === false) {
                                console.log('❌ Clearing incompatible prefilled course answer:', {
                                    course: selectedOffer.courseName,
                                    reason: selectedOffer.dateValidationMessage
                                });
                                
                                hasInvalidPrefill = true;
                                return {
                                    ...question,
                                    answer: null, // Clear the incompatible prefilled answer
                                    error: null, // Clear any existing error
                                    dirty: true,
                                    temporaryFromPreviousBooking: false,
                                    prefill: false
                                };
                            } else if (!selectedOffer) {
                                console.log('❌ Clearing prefilled answer - course not found in current offers');
                                hasInvalidPrefill = true;
                                return {
                                    ...question,
                                    answer: null,
                                    error: null,
                                    dirty: true,
                                    temporaryFromPreviousBooking: false,
                                    prefill: false
                                };
                            }
                        }
                        return question;
                    });
                    return { ...section, Questions: updatedQuestions };
                });
                return { ...page, Sections: updatedSections };
            });
            
            if (hasInvalidPrefill) {
                console.log('🧹 Cleared invalid prefilled course answers');
                setProcessedFormData(updatedPages);
                safeDispatchData(updatedPages, 'Cleared invalid prefilled course answers');
            }
        }
    }, [courseOffersLoaded, courseOffers, currentBookingType, stableProcessedFormData]);

    useEffect(() => {
        // Early guards
        if (!courseOffersLoaded || !stableProcessedFormData || stableProcessedFormData.length === 0) {
            return;
        }

        // Prevent re-running - check ref FIRST before any processing
        if (deletedCourseHandledRef.current) {
            return;
        }

        // Also check if courseOffers is empty (still loading)
        if (!courseOffers || courseOffers.length === 0) {
            return;  // ⬅️ ADD THIS - Don't check for deleted courses if no offers loaded yet
        }

        console.log('🔍 Checking for deleted/unavailable courses in booking form...');
        
        let hasDeletedCourse = false;
        let deletedCourseInfo = null;

        const updatedPages = stableProcessedFormData.map(page => {
            const updatedSections = page.Sections.map(section => {
                const updatedQuestions = section.Questions.map(question => {
                    // Check if this is the "which-course" question
                    if (question.question_key === QUESTION_KEYS.WHICH_COURSE && 
                        question.type === 'horizontal-card' && 
                        question.option_type === 'course' &&
                        question.answer) {
                        
                        const selectedCourseId = parseInt(question.answer);
                        
                        // Check if the selected course exists in available course offers
                        const courseStillExists = courseOffers.some(offer => 
                            offer.courseId === selectedCourseId || 
                            offer.courseId?.toString() === selectedCourseId.toString() ||
                            offer.id === selectedCourseId
                        );

                        if (!courseStillExists) {
                            console.log('❌ Selected course not found - course may have been deleted:', {
                                courseId: selectedCourseId,
                                questionKey: question.question_key
                            });

                            hasDeletedCourse = true;
                            deletedCourseInfo = {
                                pageId: page.id,
                                pageTitle: page.title,
                                questionId: question.id,
                                question: question.question,
                                courseId: selectedCourseId
                            };

                            // Clear the answer and mark as requiring attention
                            return {
                                ...question,
                                answer: null,
                                error: 'The course you selected is no longer available. Please choose another course.',
                                dirty: true,
                                prefill: false,
                                temporaryFromPreviousBooking: false
                            };
                        }
                    }
                    return question;
                });

                return { ...section, Questions: updatedQuestions };
            });

            // If this page contains the deleted course question, mark it as incomplete
            if (hasDeletedCourse && deletedCourseInfo && deletedCourseInfo.pageId === page.id) {
                return { 
                    ...page, 
                    Sections: updatedSections,
                    complete: false // ✅ Mark page as incomplete
                };
            }

            return { ...page, Sections: updatedSections };
        });

        if (hasDeletedCourse) {
            deletedCourseHandledRef.current = true;

            console.log('🔄 Clearing deleted course selection and marking page as incomplete');
            setProcessedFormData(updatedPages);
            safeDispatchData(updatedPages, 'Cleared deleted course selection');

            // Show user-friendly notification (with toastId to prevent duplicates)
            toast.warning(
                `The course you previously selected is no longer available. Please select a different course to continue with your booking.`,
                { 
                    toastId: 'deleted-course-warning',  // ⬅️ ADD THIS LINE
                    autoClose: 8000, 
                    position: 'top-center'
                }
            );

            // Navigate to the page that needs attention
            if (deletedCourseInfo) {
                const pageIndex = updatedPages.findIndex(p => p.id === deletedCourseInfo.pageId);
                if (pageIndex >= 0) {
                    setActiveAccordionIndex(pageIndex);
                    dispatch(bookingRequestFormActions.setCurrentPage(updatedPages[pageIndex]));
                }
            }
        }

    }, [courseOffersLoaded, courseOffers, stableProcessedFormData]);

    useEffect(() => {
        deletedCourseHandledRef.current = false;
    }, [uuid, prevBookingId]);

    useEffect(() => {
        if (activeAccordionIndex >= 0 && stableProcessedFormData?.length > 0) {
            // Coordinate timing with accordion state transition
            const scrollTimeout = setTimeout(() => {
                scrollToAccordionItemInLayout(activeAccordionIndex);
            }, 150); // Balanced timing - not too fast, not too slow

            return () => clearTimeout(scrollTimeout);
        }
    }, [activeAccordionIndex, stableProcessedFormData?.length, scrollToAccordionItemInLayout]);

    return (<>
        {stableProcessedFormData && (
            <BookingFormLayout 
                    ref={layoutRef} 
                    setBookingSubmittedState={setBookingSubmittedState} 
                    prevBookingId={prevBookingId}
                    bookingFormData={stableProcessedFormData}
                >
                {!bookingSubmitted && !router.asPath.includes('&submit=true') && (
                    <BookingProgressHeader
                        bookingRequestFormData={stableProcessedFormData}
                        origin={origin}
                        onSaveExit={() => {
                            dispatch(bookingRequestFormActions.setData([]));
                            dispatch(bookingRequestFormActions.setQuestionDependencies([]));
                            window.open('/bookings', '_self');
                        }}
                        onCancel={() => {
                            dispatch(bookingRequestFormActions.setData([]));
                            dispatch(bookingRequestFormActions.setQuestionDependencies([]));
                            window.open('/bookings', '_self');
                        }}
                    />
                )}

                {bookingSubmitted || router.asPath.includes('&submit=true') ? (
                    <SummaryOfStay
                        bookingData={summaryData}
                        bookingId={uuid}
                        origin={origin}
                        getRequestFormTemplate={getRequestFormTemplate}
                        bookingAmended={bookingAmended}
                        submitBooking={submitBooking}
                        careAnalysisData={careAnalysisData}
                        courseAnalysisData={courseAnalysisData}
                        ndisFormFilters={ndisFormFilters}
                    />
                ) : (
                    <div className="flex flex-col">
                        <Accordion
                            items={accordionItems}
                            defaultOpenIndex={activeAccordionIndex}
                            allowMultiple={false}
                            onNavigate={handleAccordionNavigation}
                            onHeaderClick={(index) => handleAccordionNavigation(index, 'header-click')}
                            origin={origin}
                        />
                    </div>
                )}
            </BookingFormLayout>
        )}

        {showWarningDialog && (
            <Modal
                title="Approval Required"
                icon={
                    <span className="flex items-center justify-center align-middle mb-2">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                            <g clipPath="url(#clip0_1153_27687)">
                                <path d="M22.4033 12.0013C22.4003 9.24461 21.304 6.60163 19.3549 4.65215C17.4058 2.70266 14.763 1.60585 12.0063 1.60234C9.24899 1.60498 6.60536 2.70143 4.65553 4.65101C2.7057 6.6006 1.60895 9.24403 1.60597 12.0013C1.6093 14.7584 2.7062 17.4016 4.65599 19.3508C6.60579 21.3001 9.24922 22.3964 12.0063 22.399C14.7628 22.3955 17.4054 21.2989 19.3544 19.3497C21.3035 17.4005 22.4 14.7578 22.4033 12.0013ZM6.1971 12.811C6.21597 12.6147 6.29571 12.4292 6.42520 12.2805C6.59087 12.0917 6.82441 11.9759 7.075 11.9584C7.32559 11.9409 7.57296 12.0231 7.76329 12.187L10.4388 14.5045L15.445 8.03883C15.5215 7.94010 15.6167 7.85745 15.7253 7.79576C15.8339 7.73408 15.9536 7.69458 16.0776 7.67945C16.2006 7.66340 16.3256 7.67191 16.4453 7.70446C16.5651 7.73701 16.6772 7.79296 16.7751 7.8691C16.902 7.96704 17.0019 8.09546 17.0657 8.24248C17.1295 8.38950 17.155 8.55030 17.1398 8.70984C17.1216 8.88859 17.0525 9.05842 16.9409 9.19921L11.322 16.4612C11.2428 16.5622 11.144 16.6461 11.0315 16.708C10.9191 16.7699 10.7953 16.8084 10.6676 16.8213C10.6047 16.828 10.5414 16.828 10.4786 16.8213C10.2828 16.8013 10.0978 16.7222 9.94811 16.5945L6.51405 13.6226C6.39988 13.5227 6.31114 13.397 6.25522 13.256C6.19929 13.115 6.17777 12.9626 6.19245 12.8116M23.9987 12.002C23.9952 15.1828 22.7301 18.2323 20.4810 20.4815C18.2319 22.7307 15.1824 23.9960 12.0017 23.9997C8.82023 23.9967 5.76990 22.7318 3.51991 20.4826C1.26993 18.2333 0.00403751 15.1834 0 12.002C0.00298453 8.81986 1.26840 5.76898 3.51850 3.51888C5.76860 1.26878 8.81954 0.00332785 12.0017 0.000343323C15.1833 0.00367945 18.2335 1.26923 20.4830 3.51921C22.7325 5.76918 23.9974 8.81974 24 12.0013L23.9987 12.002Z" fill="#61BCB8" />
                            </g>
                            <defs><clipPath id="clip0_1153_27687"><rect width="24" height="24" fill="white" /></clipPath></defs>
                        </svg>
                    </span>
                }
                description={`${currentBookingStatus?.name == 'booking_confirmed' ? 'The requested changes to your booking have been received. We will contact you to confirm soon.' : 'Thank you for submitting your booking enquiry. We will be in touch with you shortly regarding your stay.'}`}
                confirmLabel={`I understand`}
                onClose={() => {
                    setShowWarningDialog(false)
                }}
                onConfirm={(e) => {
                    handleSaveExit(currentPage, submitting)
                    setShowWarningDialog(false)
                }}
            />
        )}
    </>)
}

export default BookingRequestForm;
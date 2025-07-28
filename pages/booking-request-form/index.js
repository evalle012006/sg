import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import { globalActions } from "../../store/globalSlice";
import { toast } from "react-toastify";
import moment from 'moment';
import { useDebouncedCallback } from "use-debounce";
import _, { get, update } from "lodash";
import { getCheckInOutAnswer, getFunder, omitAttribute, validateEmail, validatePhoneNumber } from "../../utilities/common";

import { 
    QUESTION_KEYS,
    questionHasKey,
    questionMatches,
} from "../../services/booking/question-helper";

import dynamic from 'next/dynamic';
import Modal from "../../components/ui/modal";
import SummaryOfStay from "../../components/booking-request-form/summary";
import { tryParseJSON } from "../../services/booking/create-summary-data";
import { useAutofillDetection } from "../../hooks/useAutofillDetection";
import { BOOKING_TYPES } from "../../components/constants";

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
    const [wasBookingFormDirty, setWasBookingFormDirty] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [bookingData, setBookingData] = useState();
    const [summaryData, setSummaryData] = useState({ uuid: null, guestName: null, rooms: [], data: [], agreement_tc: null, signature: null });

    const [bookingAmended, setBookingAmended] = useState(false);
    const [activeAccordionIndex, setActiveAccordionIndex] = useState(0);
    const [profileDataLoaded, setProfileDataLoaded] = useState(false);
    const [pendingProfileSaves, setPendingProfileSaves] = useState(new Map());
    
    const [processedFormData, setProcessedFormData] = useState([]);
    const [isProcessingNdis, setIsProcessingNdis] = useState(false);
    
    // OPTIMIZATION: Add guards to prevent infinite re-renders
    const [isUpdating, setIsUpdating] = useState(false);
    const lastDispatchedDataRef = useRef(null);
    
    const prevFormDataRef = useRef(null);
    const prevIsNdisFundedRef = useRef(null);
    const prevCurrentPageIdRef = useRef(null);

    const layoutRef = useRef(null);

    const [ndisFormFilters, setNdisFormFilters] = useState({
        funderType: 'NDIS',
        ndisPackageType: 'sta',
        additionalFilters: {
            region: 'NSW',
            priceRange: { min: 100, max: 500 }
        }
    });

    // OPTIMIZATION: Create a helper function to safely update Redux only when data actually changes
    const safeDispatchData = useCallback((newData, source = 'unknown') => {
        const newDataStr = JSON.stringify(newData);
        const lastDataStr = lastDispatchedDataRef.current;
        
        if (newDataStr !== lastDataStr) {
            console.log(`📤 Dispatching data update from: ${source}`);
            lastDispatchedDataRef.current = newDataStr;
            dispatch(bookingRequestFormActions.setData(newData));
        } else {
            console.log(`⏭️  Skipping identical data dispatch from: ${source}`);
        }
    }, [dispatch]);

    // OPTIMIZATION: Stabilize bookingRequestFormData to prevent unnecessary re-renders
    const stableBookingRequestFormData = useMemo(() => {
        return bookingRequestFormData;
    }, [JSON.stringify(bookingRequestFormData)]);

    // OPTIMIZATION: Stabilize processedFormData
    const stableProcessedFormData = useMemo(() => {
        return processedFormData;
    }, [JSON.stringify(processedFormData)]);

    // ADDED: Function to immediately check and update NDIS funding status when questions are answered
    const checkAndUpdateNdisFundingStatus = useCallback((updatedPages) => {
        console.log('🔍 Checking for NDIS funding status changes...');
        
        let fundingDetected = false;
        
        // Check all pages for funding question answers
        for (const page of updatedPages) {
            for (const section of page.Sections || []) {
                for (const question of section.Questions || []) {
                    if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                        const isNdisAnswer = question.answer?.toLowerCase().includes('ndis') || 
                                           question.answer?.toLowerCase().includes('ndia');
                        
                        if (isNdisAnswer && !isNdisFunded) {
                            console.log('✅ NDIS funding detected, updating state immediately');
                            dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                            fundingDetected = true;
                        } else if (!isNdisAnswer && isNdisFunded) {
                            console.log('❌ Non-NDIS funding detected, clearing NDIS state');
                            dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                            fundingDetected = true;
                        }
                        break;
                    }
                }
                if (fundingDetected) break;
            }
            if (fundingDetected) break;
        }
        
        return fundingDetected;
    }, [isNdisFunded, dispatch]);

    const calculateNdisFilters = useCallback((formData) => {
        console.log('Calculating NDIS filters from form data...');
        
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
                        } else {
                            funderType = 'Non-NDIS';
                        }
                    }
                    
                    // Only process NDIS package type logic if NDIS funded
                    if (funderType === 'NDIS') {
                        // Questions that lead to holiday packages
                        if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_ALONE) && 
                            question.answer === 'Yes') {
                            ndisPackageType = 'holiday';
                        }
                        
                        if (questionHasKey(question, QUESTION_KEYS.DO_YOU_LIVE_IN_SIL) && 
                            question.answer === 'Yes') {
                            ndisPackageType = 'holiday';
                        }
                        
                        if (questionHasKey(question, QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS) && 
                            question.answer === 'Yes') {
                            ndisPackageType = 'holiday';
                        }
                        
                        // Question that leads to STA packages (takes precedence)
                        if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT) && 
                            question.answer === 'Yes') {
                            ndisPackageType = 'sta';
                        }
                    }
                }
            }
        }
        
        // Default NDIS package type if none determined
        if (funderType === 'NDIS' && !ndisPackageType) {
            ndisPackageType = 'sta'; // Default to STA
        }
        
        const newFilters = {
            funderType: funderType,
            ndisPackageType: ndisPackageType,
            additionalFilters: {
                // Keep existing additional filters
                ...ndisFormFilters.additionalFilters
            }
        };
        
        console.log('Calculated NDIS filters:', newFilters);
        return newFilters;
    }, [ndisFormFilters.additionalFilters]);

    const fetchProfileData = async (guestId) => {
        try {
            const response = await fetch(`/api/my-profile/${guestId}`);
            if (response.ok) {
                const profileData = await response.json();
                return profileData;
            }
            return null;
        } catch (error) {
            console.error('Error fetching profile data:', error);
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

    const mapProfileDataToQuestions = (profileData, pages) => {
        if (!profileData || !pages || pages.length === 0) return pages;

        console.log('Mapping profile data to questions...');

        const updatedPages = pages.map(page => {
            const updatedSections = page.Sections.map(section => {
                const updatedQuestions = section.Questions.map(question => {
                    let updatedQuestion = { ...question };
                    const questionKey = question.question_key || '';
                    const questionText = question.question || '';
                    
                    // Try question_key first, then fallback to question text matching
                    let mapped = false;
                    
                    // Primary mapping using question_key
                    switch (questionKey) {
                        case 'first-name':
                            if (profileData.first_name) {
                                updatedQuestion.answer = profileData.first_name;
                                updatedQuestion.oldAnswer = profileData.first_name; 
                                mapped = true;
                            }
                            break;
                        case 'last-name':
                            if (profileData.last_name) {
                                updatedQuestion.answer = profileData.last_name;
                                updatedQuestion.oldAnswer = profileData.last_name; 
                                mapped = true;
                            }
                            break;
                        case 'email':
                            if (profileData.email) {
                                updatedQuestion.answer = profileData.email;
                                updatedQuestion.oldAnswer = profileData.email; 
                                mapped = true;
                            }
                            break;
                        case 'phone-number':
                        case 'mobile-no':
                            if (profileData.phone_number) {
                                updatedQuestion.answer = profileData.phone_number;
                                updatedQuestion.oldAnswer = profileData.phone_number; 
                                mapped = true;
                            }
                            break;
                        case 'gender-person-with-sci':
                            if (profileData.gender) {
                                updatedQuestion.answer = profileData.gender;
                                updatedQuestion.oldAnswer = profileData.gender; 
                                mapped = true;
                            }
                            break;
                        case 'date-of-birth-person-with-sci':
                            if (profileData.dob) {
                                // Format date properly if needed
                                const dobDate = new Date(profileData.dob);
                                const formattedDob = dobDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                                updatedQuestion.answer = formattedDob;
                                updatedQuestion.oldAnswer = formattedDob; 
                                mapped = true;
                            }
                            break;
                        // Address fields
                        case 'street-address':
                        case 'street-address-line-1':
                            if (profileData.address_street1) {
                                updatedQuestion.answer = profileData.address_street1;
                                updatedQuestion.oldAnswer = profileData.address_street1; 
                                mapped = true;
                            }
                            break;
                        case 'street-address-line-2-optional':
                        case 'street-address-line-2':
                            if (profileData.address_street2) {
                                updatedQuestion.answer = profileData.address_street2;
                                updatedQuestion.oldAnswer = profileData.address_street2; 
                                mapped = true;
                            }
                            break;
                        case 'city':
                            if (profileData.address_city) {
                                updatedQuestion.answer = profileData.address_city;
                                updatedQuestion.oldAnswer = profileData.address_city; 
                                mapped = true;
                            }
                            break;
                        case 'state-province':
                            if (profileData.address_state_province) {
                                updatedQuestion.answer = profileData.address_state_province;
                                updatedQuestion.oldAnswer = profileData.address_state_province; 
                                mapped = true;
                            }
                            break;
                        case 'post-code':
                            if (profileData.address_postal) {
                                updatedQuestion.answer = profileData.address_postal;
                                updatedQuestion.oldAnswer = profileData.address_postal; 
                                mapped = true;
                            }
                            break;
                        case 'country':
                            if (profileData.address_country) {
                                updatedQuestion.answer = profileData.address_country;
                                updatedQuestion.oldAnswer = profileData.address_country; 
                                mapped = true;
                            }
                            break;
                        // Emergency contact
                        case 'emergency-contact-name':
                            if (profileData.HealthInfo?.emergency_name) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_name;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.emergency_name; 
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-phone':
                            if (profileData.HealthInfo?.emergency_mobile_number) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_mobile_number;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.emergency_mobile_number; 
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-email':
                            if (profileData.HealthInfo?.emergency_email) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_email;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.emergency_email; 
                                mapped = true;
                            }
                            break;
                        case 'emergency-contact-relationship-to-you':
                            if (profileData.HealthInfo?.emergency_relationship) {
                                updatedQuestion.answer = profileData.HealthInfo.emergency_relationship;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.emergency_relationship; 
                                mapped = true;
                            }
                            break;
                        // GP/Specialist information - CORRECT question keys from form data
                        case 'gp-or-specialist-name':
                            if (profileData.HealthInfo?.specialist_name) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_name;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.specialist_name; 
                                mapped = true;
                                console.log(`✓ Mapped specialist_name: ${profileData.HealthInfo.specialist_name}`);
                            }
                            break;
                        case 'gp-or-specialist-phone':
                            if (profileData.HealthInfo?.specialist_mobile_number) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_mobile_number;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.specialist_mobile_number; 
                                mapped = true;
                            }
                            break;
                        case 'gp-or-specialist-practice-name':
                            if (profileData.HealthInfo?.specialist_practice_name) {
                                updatedQuestion.answer = profileData.HealthInfo.specialist_practice_name;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.specialist_practice_name; 
                                mapped = true;
                                console.log(`✓ Mapped specialist_practice_name: ${profileData.HealthInfo.specialist_practice_name}`);
                            }
                            break;
                        // Health info
                        case 'do-you-identify-as-aboriginal-or-torres-strait-islander-person-with-sci':
                            if (profileData.HealthInfo?.identify_aboriginal_torres !== null) {
                                const answer = profileData.HealthInfo.identify_aboriginal_torres ? 'Yes' : 'No';
                                updatedQuestion.answer = answer;
                                updatedQuestion.oldAnswer = answer; 
                                mapped = true;
                            }
                            break;
                        case 'do-you-speak-a-language-other-than-english-at-home-person-with-sci':
                            if (profileData.HealthInfo?.language) {
                                const answer = profileData.HealthInfo.language ? 'Yes' : 'No';
                                updatedQuestion.answer = answer;
                                updatedQuestion.oldAnswer = answer; 
                                mapped = true;
                            }
                            break;
                        case 'language-spoken-at-home':
                            if (profileData.HealthInfo?.language) {
                                updatedQuestion.answer = profileData.HealthInfo.language;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.language; 
                                mapped = true;
                            }
                            break;
                        // FIX 1: require_interpreter mapping - CORRECT question key from form data
                        case 'do-you-require-an-interpreter':
                            if (profileData.HealthInfo?.require_interpreter !== null && profileData.HealthInfo?.require_interpreter !== undefined) {
                                const answer = profileData.HealthInfo.require_interpreter ? 'Yes' : 'No';
                                updatedQuestion.answer = answer;
                                updatedQuestion.oldAnswer = answer; 
                                mapped = true;
                                console.log(`✓ Mapped require_interpreter: ${profileData.HealthInfo.require_interpreter} -> ${answer}`);
                            }
                            break;
                        case 'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of':
                            if (profileData.HealthInfo?.cultural_beliefs !== null) {
                                const answer = profileData.HealthInfo.cultural_beliefs ? 'Yes' : 'No';
                                updatedQuestion.answer = answer;
                                updatedQuestion.oldAnswer = answer; 
                                mapped = true;
                            }
                            break;
                        // FIX 2: cultural_beliefs text field mapping - CORRECT question key from form data
                        case 'please-give-details-on-cultural-beliefs-or-values-you-would-like-our-staff-to-be-aware-of':
                            if (profileData.HealthInfo?.cultural_beliefs) {
                                updatedQuestion.answer = profileData.HealthInfo.cultural_beliefs;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.cultural_beliefs; 
                                mapped = true;
                                console.log(`✓ Mapped cultural_beliefs: ${profileData.HealthInfo.cultural_beliefs}`);
                            }
                            break;
                        // Other SCI info
                        case 'what-year-did-you-begin-living-with-your-spinal-cord-injury':
                            if (profileData.HealthInfo?.sci_year) {
                                updatedQuestion.answer = profileData.HealthInfo.sci_year;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.sci_year; 
                                mapped = true;
                            }
                            break;
                        // FIX 3: sci_injury_type mapping with proper value conversion
                        case 'leveltype-of-spinal-cord-injury':
                            if (profileData.HealthInfo?.sci_injury_type) {
                                // Map database values to form display values
                                const injuryTypeMap = {
                                    'cervical': '(C) Cervical',
                                    'thoracic': '(T) Thoracic', 
                                    'lumbar': '(L) Lumbar',
                                    'sacral': '(S) Sacral',
                                    'spina_bifida': 'Spina Bifida',
                                    'cauda_equina': 'Cauda Equina',
                                    'other': 'Other'
                                };
                                
                                const mappedValue = injuryTypeMap[profileData.HealthInfo.sci_injury_type];
                                if (mappedValue) {
                                    updatedQuestion.answer = mappedValue;
                                    updatedQuestion.oldAnswer = mappedValue; 
                                    mapped = true;
                                    console.log(`Mapped sci_injury_type: ${profileData.HealthInfo.sci_injury_type} -> ${mappedValue}`);
                                }
                            }
                            break;
                        // UPDATED: SCI Level handling - now array-first approach
                        case 'c-cervical-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_injury_type === 'cervical') {
                                const levelData = processSciTypeLevelData(profileData.HealthInfo?.sci_type_level);
                                updatedQuestion.answer = levelData;
                                updatedQuestion.oldAnswer = [...levelData];
                                mapped = true;
                                console.log(`✓ Mapped cervical levels:`, levelData);
                            }
                            break;
                        case 't-thoracic-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_injury_type === 'thoracic') {
                                const levelData = processSciTypeLevelData(profileData.HealthInfo?.sci_type_level);
                                updatedQuestion.answer = levelData;
                                updatedQuestion.oldAnswer = [...levelData];
                                mapped = true;
                                console.log(`✓ Mapped thoracic levels:`, levelData);
                            }
                            break;
                        case 'l-lumbar-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_injury_type === 'lumbar') {
                                const levelData = processSciTypeLevelData(profileData.HealthInfo?.sci_type_level);
                                updatedQuestion.answer = levelData;
                                updatedQuestion.oldAnswer = [...levelData];
                                mapped = true;
                                console.log(`✓ Mapped lumbar levels:`, levelData);
                            }
                            break;
                        case 's-sacral-level-select-all-that-apply':
                            if (profileData.HealthInfo?.sci_injury_type === 'sacral') {
                                const levelData = processSciTypeLevelData(profileData.HealthInfo?.sci_type_level);
                                updatedQuestion.answer = levelData;
                                updatedQuestion.oldAnswer = [...levelData];
                                mapped = true;
                                console.log(`✓ Mapped sacral levels:`, levelData);
                            }
                            break;
                        case 'level-of-function-or-asia-scale-score-movementsensation':
                            if (profileData.HealthInfo?.sci_type && question.options) {
                                const sciType = profileData.HealthInfo.sci_type.toUpperCase();
                                
                                // Find the matching option based on the letter
                                const matchingOption = question.options.find(option => 
                                    option.label && option.label.startsWith(sciType + ' -')
                                );
                                
                                if (matchingOption) {
                                    // For radio buttons, set the answer to the label
                                    if (question.type === 'radio' || question.type === 'select') {
                                        updatedQuestion.answer = matchingOption.label;
                                        updatedQuestion.oldAnswer = matchingOption.label; 
                                        mapped = true;
                                    }
                                    // For checkbox/multi-select, update the options
                                    else if (question.type === 'checkbox' || question.type === 'multi-select') {
                                        updatedQuestion.options = question.options.map(opt => ({
                                            ...opt,
                                            checked: opt.label === matchingOption.label,
                                            value: opt.label === matchingOption.label
                                        }));
                                        updatedQuestion.answer = [matchingOption.label];
                                        updatedQuestion.oldAnswer = [matchingOption.label]; 
                                        mapped = true;
                                    }
                                }
                            }
                            break;
                        case 'where-did-you-complete-your-initial-spinal-cord-injury-rehabilitation':
                            if (profileData.HealthInfo?.sci_intial_spinal_rehab) {
                                updatedQuestion.answer = profileData.HealthInfo.sci_intial_spinal_rehab;
                                updatedQuestion.oldAnswer = profileData.HealthInfo.sci_intial_spinal_rehab; 
                                mapped = true;
                            }
                            break;
                        case 'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility':
                            if (profileData.HealthInfo?.sci_inpatient !== null) {
                                const answer = profileData.HealthInfo.sci_inpatient ? 'Yes' : 'No';
                                updatedQuestion.answer = answer;
                                updatedQuestion.oldAnswer = answer; 
                                mapped = true;
                            }
                            break;
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

    // Special handler for language-related questions that affect multiple fields
    const handleLanguageQuestionSave = async (questionKey, value, guestId) => {
        if (!guestId) return;

        try {
            let profileUpdate = {};
            
            if (questionKey === 'do-you-speak-a-language-other-than-english-at-home-person-with-sci') {
                if (value === 'No') {
                    profileUpdate = {
                        language: '',
                        require_interpreter: false
                    };
                } else if (value === 'Rather not to say') {
                    profileUpdate = {
                        language: 'rather_not_say',
                        require_interpreter: false
                    };
                } else {
                    // For "Yes", don't clear anything, let user fill language field
                    return;
                }
            } else if (questionKey === 'do-you-have-any-cultural-beliefs-or-values-that-you-would-like-our-staff-to-be-aware-of') {
                if (value === 'No') {
                    profileUpdate = {
                        cultural_beliefs: ''
                    };
                } else {
                    // For "Yes", don't clear anything, let user fill details field
                    return;
                }
            }
            
            if (Object.keys(profileUpdate).length > 0) {
                const response = await fetch('/api/my-profile/save-update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        guest_id: guestId,
                        ...profileUpdate
                    }),
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Special profile data saved successfully:', result.message);
                } else {
                    const errorResult = await response.json();
                    console.error('Failed to save special profile data:', errorResult.message);
                }
            }
        } catch (error) {
            console.error('Error saving special profile data:', error);
        }
    };

    // Debounced function to save profile data (to avoid too many API calls)
    const debouncedBatchSaveProfileData = useDebouncedCallback(async (guestId) => {
        if (pendingProfileSaves.size === 0) return;
        
        try {
            console.log('Batch saving profile data:', Array.from(pendingProfileSaves.entries()));
            
            // Combine all pending saves into a single request
            const combinedUpdate = {};
            pendingProfileSaves.forEach((value, questionKey) => {
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
                    console.log('Batch profile data saved successfully:', result.message);
                    // Clear pending saves after successful save
                    setPendingProfileSaves(new Map());
                } else {
                    const errorResult = await response.json();
                    console.error('Failed to batch save profile data:', errorResult.message);
                }
            }
        } catch (error) {
            console.error('Error batch saving profile data:', error);
        }
    }, 1000);

    const queueProfileSave = (questionKey, value, guestId) => {
        if (!guestId || !questionKey) return;
        
        // Add to pending saves
        setPendingProfileSaves(prevSaves => {
            const newSaves = new Map(prevSaves);
            newSaves.set(questionKey, value);
            return newSaves;
        });
        
        // Trigger debounced batch save
        debouncedBatchSaveProfileData(guestId);
    };

    const getGuestId = () => {
        // Priority: booking.Guest.id > booking.guest_id > currentUser.id
        if (booking?.Guest?.id) {
            return booking.Guest.id;
        }
        if (booking?.guest_id) {
            return booking.guest_id;
        }
        if (currentUser?.id) {
            return currentUser.id;
        }
        return null;
    };

    // Function to preload profile data for all guests if available
    const preloadProfileData = async () => {
        const guestId = getGuestId();
        
        if (!guestId || profileDataLoaded) {
            console.log('Skipping profile preload:', { guestId, profileDataLoaded });
            return;
        }
        
        if (stableBookingRequestFormData.length === 0) {
            console.log('No form data available yet for profile preload');
            return;
        }
        
        console.log('Starting profile preload for guest:', guestId);
        
        try {
            const profileData = await fetchProfileData(guestId);
            if (profileData) {
                console.log('Profile data fetched successfully:', profileData);
                
                const updatedPages = mapProfileDataToQuestions(profileData, stableBookingRequestFormData);
                
                // Important: Don't apply question dependencies immediately as it might clear preloaded data
                // Just dispatch the updated pages directly
                safeDispatchData(updatedPages, 'profile preload');
                setProfileDataLoaded(true);
                
                console.log('Profile data preloaded and form updated');
                
                // Apply dependencies after a short delay to ensure the form updates first
                setTimeout(() => {
                    const finalPages = applyQuestionDependencies(updatedPages);
                    safeDispatchData(finalPages, 'dependencies after profile preload');
                    console.log('Dependencies applied after profile preload');
                }, 100);
                
            } else {
                console.log('No profile data found for guest:', guestId);
            }
        } catch (error) {
            console.error('Error preloading profile data:', error);
        }
    };

    useAutofillDetection();

    const calculatePageCompletion = (page) => {
        if (!page || !page.Sections) {
            console.log(`❌ Page completion check failed: no page or sections for "${page?.title}"`);
            return false;
        }
        
        console.log(`🔍 Calculating completion for page: "${page.title}"`);
        
        let totalRequiredQuestions = 0;
        let answeredRequiredQuestions = 0;
        
        for (const section of page.Sections) {
            if (section.hidden) {
                console.log(`⏭️ Skipping hidden section: ${section.id}`);
                continue;
            }
            
            for (const question of section.Questions || []) {
                if (question.hidden) {
                    console.log(`⏭️ Skipping hidden question: "${question.question}"`);
                    continue;
                }
                
                if (question.required) {
                    totalRequiredQuestions++;
                    
                    // Check if question is answered based on type
                    let isAnswered = false;
                    
                    if (question.type === 'checkbox' || question.type === 'checkbox-button') {
                        isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                    } else if (question.type === 'multi-select') {
                        isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                    } else if (question.type === 'simple-checkbox') {
                        isAnswered = question.answer === true;
                    } else if (question.type === 'radio' || question.type === 'radio-ndis') {
                        isAnswered = question.answer !== null && 
                                question.answer !== undefined && 
                                question.answer !== '';
                    } else {
                        isAnswered = question.answer !== null && 
                                question.answer !== undefined && 
                                question.answer !== '';
                    }
                    
                    if (isAnswered) {
                        answeredRequiredQuestions++;
                        console.log(`✅ Required question answered: "${question.question}" = "${question.answer}" (type: ${question.type})`);
                    } else {
                        console.log(`❌ Required question NOT answered: "${question.question}" (type: ${question.type}, answer: ${question.answer})`);
                    }
                } else {
                    console.log(`ℹ️ Optional question: "${question.question}" (answer: ${question.answer})`);
                }
            }
        }
        
        // Page is complete if all required questions are answered
        const isComplete = totalRequiredQuestions > 0 && answeredRequiredQuestions === totalRequiredQuestions;
        
        console.log(`📊 Page "${page.title}" completion: ${answeredRequiredQuestions}/${totalRequiredQuestions} required questions answered. Complete: ${isComplete}`);
        
        return isComplete;
    };


    const applyQuestionDependenciesAcrossPages = (targetPage, allPages) => {
        if (!targetPage || !targetPage.Sections || !allPages) return targetPage;

        const updatedPage = { ...targetPage };
        updatedPage.Sections = targetPage.Sections.map(section => {
            const updatedSection = { ...section };
            
            updatedSection.Questions = section.Questions.map(question => {
                let q = { ...question };
                
                // Process question dependencies if they exist
                if (q.QuestionDependencies && q.QuestionDependencies.length > 0) {
                    let shouldShow = false;
                    
                    // Check each dependency
                    q.QuestionDependencies.forEach(dependency => {
                        // Look for the dependent question across ALL pages
                        allPages.forEach(page => {
                            if (page.Sections) {
                                page.Sections.forEach(searchSection => {
                                    if (searchSection.Questions) {
                                        searchSection.Questions.forEach(searchQuestion => {
                                            // Match by question_id or id
                                            if ((searchQuestion.question_id === dependency.dependence_id) || 
                                                (searchQuestion.id === dependency.dependence_id)) {
                                                
                                                // Check if the dependent question's answer matches the dependency condition
                                                if (searchQuestion.answer === dependency.answer) {
                                                    shouldShow = true;
                                                }
                                                
                                                // Handle array answers for multi-select questions
                                                if (Array.isArray(searchQuestion.answer) && 
                                                    searchQuestion.answer.includes(dependency.answer)) {
                                                    shouldShow = true;
                                                }
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    });
                    
                    // Set question visibility based on dependencies
                    q.hidden = !shouldShow;
                } else {
                    // If no dependencies, show the question (unless explicitly hidden)
                    if (q.hidden === undefined) {
                        q.hidden = false;
                    }
                }
                
                return q;
            });
            
            // Hide section if all questions are hidden
            const visibleQuestions = updatedSection.Questions.filter(q => !q.hidden);
            updatedSection.hidden = visibleQuestions.length === 0;
            
            return updatedSection;
        });
        
        return updatedPage;
    };

    const processFormDataForNdisPackages = useCallback((formData) => {
        console.log('Processing form data for NDIS packages...', { isNdisFunded, dataLength: formData.length });
        
        // Calculate and update filters based on current form data
        const newFilters = calculateNdisFilters(formData);
        if (JSON.stringify(newFilters) !== JSON.stringify(ndisFormFilters)) {
            console.log('Updating NDIS filters:', newFilters);
            setNdisFormFilters(newFilters);
        }
        
        // Find the funding page index
        let fundingPageIndex = -1;
        let fundingQuestionFound = false;
        
        for (let i = 0; i < formData.length; i++) {
            const page = formData[i];
            for (const section of page.Sections || []) {
                for (const question of section.Questions || []) {
                    if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)) {
                        fundingPageIndex = i;
                        fundingQuestionFound = true;
                        break;
                    }
                }
                if (fundingQuestionFound) break;
            }
            if (fundingQuestionFound) break;
        }
        
        console.log('Funding page found at index:', fundingPageIndex);
        
        if (fundingPageIndex === -1) {
            console.log('No funding page found, returning original data');
            return formData;
        }
        
        // Check if NDIS packages page already exists
        const ndisPageExists = formData.some(page => page.id === 'ndis_packages_page');
        
        if (ndisPageExists && !isNdisFunded) {
            // Remove NDIS page if funding is not NDIS
            console.log('Removing NDIS packages page - funding not NDIS');
            return formData.filter(page => page.id !== 'ndis_packages_page');
        } else if (ndisPageExists && isNdisFunded) {
            // NDIS page already exists and funding is NDIS, keep it but apply dependencies
            console.log('NDIS packages page already exists, applying dependencies and recalculating completion');
            const updatedFormData = formData.map(page => {
                if (page.id === 'ndis_packages_page') {
                    // Apply dependencies to existing NDIS page
                    const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, formData);
                    
                    // ENHANCED: Calculate completion status for existing NDIS page with detailed logging
                    const calculateExistingNdisPageCompletion = (ndisPage) => {
                        console.log('🔍 Recalculating existing NDIS page completion status...');
                        
                        let totalRequiredQuestions = 0;
                        let answeredRequiredQuestions = 0;
                        
                        for (const section of ndisPage.Sections || []) {
                            if (section.hidden) continue;
                            
                            for (const question of section.Questions || []) {
                                if (question.hidden) continue;
                                
                                if (question.required) {
                                    totalRequiredQuestions++;
                                    
                                    // Check if question is answered based on type
                                    let isAnswered = false;
                                    
                                    if (question.type === 'checkbox' || question.type === 'checkbox-button') {
                                        isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                                    } else if (question.type === 'multi-select') {
                                        isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                                    } else if (question.type === 'simple-checkbox') {
                                        isAnswered = question.answer === true;
                                    } else {
                                        isAnswered = question.answer !== null && 
                                                question.answer !== undefined && 
                                                question.answer !== '';
                                    }
                                    
                                    if (isAnswered) {
                                        answeredRequiredQuestions++;
                                        console.log(`✓ Existing NDIS question answered: "${question.question}" = "${question.answer}"`);
                                    } else {
                                        console.log(`✗ Existing NDIS question not answered: "${question.question}"`);
                                    }
                                }
                            }
                        }
                        
                        const isComplete = totalRequiredQuestions > 0 && answeredRequiredQuestions === totalRequiredQuestions;
                        console.log(`Existing NDIS page completion: ${answeredRequiredQuestions}/${totalRequiredQuestions} required questions answered. Complete: ${isComplete}`);
                        
                        return isComplete;
                    };
                    
                    pageWithDependencies.completed = calculateExistingNdisPageCompletion(pageWithDependencies);
                    console.log(`Existing NDIS page completion status: ${pageWithDependencies.completed}`);
                    return pageWithDependencies;
                }
                return page;
            });
            return updatedFormData;
        }
        
        // Only create NDIS page if NDIS is funded
        if (!isNdisFunded) {
            console.log('Not NDIS funded, returning original data without modifications');
            return formData;
        }
        
        // Collect all NDIS-only questions from all pages
        const ndisQuestions = [];
        const updatedPages = [];
        
        formData.forEach((page, pageIndex) => {
            const updatedSections = [];

            page.Sections.forEach(section => {
                const remainingQuestions = [];
                
                section.Questions.forEach(question => {
                    // Check if this is an NDIS-only question that should be moved
                    if (question.ndis_only === true && question.type !== 'simple-checkbox') {
                        console.log('Moving NDIS-only question to NDIS page:', {
                            question: question.question,
                            answer: question.answer,
                            required: question.required,
                            hasAnswer: question.answer !== null && question.answer !== undefined && question.answer !== ''
                        });
                        
                        // Create a new section for this question on the NDIS page
                        const ndisSection = {
                            ...section,
                            id: `ndis_${section.id}_${question.id}`,
                            orig_section_id: section.id,
                            Questions: [{ 
                                ...question,
                                answer: question.answer,
                                oldAnswer: question.oldAnswer || question.answer,
                                orig_section_id: section.id
                            }]
                        };
                        
                        ndisQuestions.push(ndisSection);
                    } else {
                        // Keep non-NDIS questions in original page
                        remainingQuestions.push(question);
                    }
                });
                
                // Only add section to updated page if it has remaining questions
                if (remainingQuestions.length > 0) {
                    updatedSections.push({
                        ...section,
                        Questions: remainingQuestions
                    });
                }
            });
            
            // Add page to updated pages
            updatedPages.push({
                ...page,
                Sections: updatedSections
            });
        });
        
        // Create NDIS Packages page if we have NDIS questions
        if (ndisQuestions.length > 0) {
            const ndisPage = {
                id: 'ndis_packages_page',
                title: 'NDIS Requirements',
                description: 'Please complete the NDIS-specific requirements below.',
                Sections: ndisQuestions,
                url: "&&page_id=ndis_packages_page",
                active: false,
                hasNext: true,
                hasBack: true,
                lastPage: false,
                pageQuestionDependencies: [],
                completed: false, // Will be calculated after dependencies
                noItems: ndisQuestions.reduce((total, section) => total + section.Questions.length, 0),
                dirty: false,
                hidden: false,
                template_id: formData[0]?.template_id || null
            };
            
            console.log('Created NDIS page with', ndisPage.noItems, 'questions');
            
            // Insert NDIS page after funding page
            const newFormData = [...updatedPages];
            newFormData.splice(fundingPageIndex + 1, 0, ndisPage);
            
            // Apply dependencies to NDIS page
            const ndisPageWithDependencies = applyQuestionDependenciesAcrossPages(ndisPage, newFormData);
            
            // ENHANCED: Calculate completion status for NDIS page based on existing answers
            const calculateNdisPageCompletion = (ndisPage) => {
                console.log('🔍 Calculating NDIS page completion status...');
                
                let totalRequiredQuestions = 0;
                let answeredRequiredQuestions = 0;
                
                for (const section of ndisPage.Sections || []) {
                    if (section.hidden) continue;
                    
                    for (const question of section.Questions || []) {
                        if (question.hidden) continue;
                        
                        if (question.required) {
                            totalRequiredQuestions++;
                            
                            // Check if question is answered based on type
                            let isAnswered = false;
                            
                            if (question.type === 'checkbox' || question.type === 'checkbox-button') {
                                isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                            } else if (question.type === 'multi-select') {
                                isAnswered = Array.isArray(question.answer) && question.answer.length > 0;
                            } else if (question.type === 'simple-checkbox') {
                                isAnswered = question.answer === true;
                            } else {
                                isAnswered = question.answer !== null && 
                                        question.answer !== undefined && 
                                        question.answer !== '';
                            }
                            
                            if (isAnswered) {
                                answeredRequiredQuestions++;
                                console.log(`✓ NDIS question answered: "${question.question}" = "${question.answer}"`);
                            } else {
                                console.log(`✗ NDIS question not answered: "${question.question}"`);
                            }
                        }
                    }
                }
                
                const isComplete = totalRequiredQuestions > 0 && answeredRequiredQuestions === totalRequiredQuestions;
                console.log(`NDIS page completion: ${answeredRequiredQuestions}/${totalRequiredQuestions} required questions answered. Complete: ${isComplete}`);
                
                return isComplete;
            };
            
            // Calculate completion status for the newly created NDIS page
            ndisPageWithDependencies.completed = calculateNdisPageCompletion(ndisPageWithDependencies);
            console.log(`NDIS page completion status: ${ndisPageWithDependencies.completed}`);
            
            newFormData[fundingPageIndex + 1] = ndisPageWithDependencies;
            
            // Update hasNext/hasBack and lastPage properties
            newFormData.forEach((page, index) => {
                page.hasNext = index < newFormData.length - 1;
                page.hasBack = index > 0;
                page.lastPage = index === newFormData.length - 1;
            });
            
            return newFormData;
        }
        
        return updatedPages;
    }, [isNdisFunded, calculateNdisFilters, ndisFormFilters]);

    // Get the status of a page for accordion display
    const getPageStatus = (page) => {
        if (!page) return null;
        
        // Check if page has validation errors
        const hasErrors = page.Sections?.some(section => 
            section.Questions?.some(question => 
                question.error && question.error.trim() !== ''
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
        
        return stableProcessedFormData.map((page, index) => ({
            title: page.title,
            description: page.description || 'Lorem ipsum dummy text for this section',
            status: getPageStatus(page),
            customContent: (
                <QuestionPage 
                    currentPage={page} 
                    updatePageData={(data) => updateAndDispatchPageData(data, page.id)} 
                    guest={guest} 
                    updateEquipmentData={(data) => updateAndDispatchEquipmentData(data)} 
                    equipmentChanges={equipmentChangesState} 
                    funderType={ndisFormFilters.funderType}
                    ndisPackageType={ndisFormFilters.ndisPackageType}
                    additionalFilters={ndisFormFilters.additionalFilters}
                />
            )
        }));
    }, [stableProcessedFormData, guest, equipmentChangesState, ndisFormFilters]);

    const handleAccordionNavigation = async (targetIndex, action) => {
        const targetPage = stableProcessedFormData[targetIndex];
        
        if (!targetPage) return;

        if (action === 'submit') {
            // Handle final submission
            if (validateAllPages()) {
                return false;
            }
            showWarningReturningBookingNotSave(currentBookingType, currentBookingStatus, targetPage, true);
            return;
        }

        // FIXED: Validate current page from processedFormData, not from Redux state
        if (currentPage) {
            // Find the current page in processedFormData to get the updated version
            const currentPageInProcessed = stableProcessedFormData.find(p => p.id === currentPage.id);
            const pageToValidate = currentPageInProcessed || currentPage;
            
            const updatedPage = clearPackageQuestionAnswers(pageToValidate, isNdisFunded);
            const errorMsg = validate([updatedPage]);
            
            if (errorMsg.length > 0) {
                console.log('Validation errors:', errorMsg);
                
                // Show specific error messages for date validation
                const dateErrors = errorMsg.filter(error => error.type === 'date' || error.type === 'date-range');
                if (dateErrors.length > 0) {
                    toast.error(dateErrors[0].message);
                } else {
                    toast.error('There are some REQUIRED questions not answered or contain errors. Please correct them before proceeding.');
                }
                
                // Update the page data with validation errors using processedFormData
                const pages = updatePageData(updatedPage?.Sections, updatedPage.id, 'VALIDATE_DATA', true);
                return;
            }

            const currentPageIndex = stableProcessedFormData.findIndex(p => p.id === currentPage.id);
            if (currentPageIndex !== -1) {
                let updatedProcessedData = structuredClone(stableProcessedFormData);
                updatedProcessedData[currentPageIndex].completed = true;
                console.log(`Marking page "${currentPage.title}" as completed before navigation`);
                setProcessedFormData(updatedProcessedData);
            }

            // Save current page before navigation
            try {
                await saveCurrentPage(pageToValidate, false);
            } catch (error) {
                console.error('Error saving page:', error);
                toast.error('Error saving your progress. Please try again.');
                return;
            }
        }

        // Update current page and URL
        dispatch(bookingRequestFormActions.setCurrentPage(targetPage));
        setActiveAccordionIndex(targetIndex);
        
        // Update URL to reflect the selected page
        const paths = router.asPath.split('&&');
        const baseUrl = paths[0];
        const newUrl = `${baseUrl}&&page_id=${targetPage.id}`;
        
        router.push(newUrl, undefined, { shallow: true });

        // NEW: Scroll to top after navigation
        if (layoutRef.current && layoutRef.current.scrollToTop) {
            // Small delay to ensure the content has updated
            setTimeout(() => {
                layoutRef.current.scrollToTop();
            }, 100);
        }
    };

    useEffect(() => {
        if (currentPage && stableProcessedFormData && stableProcessedFormData.length > 0) {
            const pageIndex = stableProcessedFormData.findIndex(p => p.id === currentPage.id);
            if (pageIndex !== -1) {
                setActiveAccordionIndex(pageIndex);
                
                // FIXED: Only update if the page has actually changed
                const processedCurrentPage = stableProcessedFormData[pageIndex];
                if (processedCurrentPage && currentPage.id === processedCurrentPage.id) {
                    // Check if we need to update the current page reference without causing loops
                    const currentPageStr = JSON.stringify(currentPage);
                    const processedPageStr = JSON.stringify(processedCurrentPage);
                    
                    if (currentPageStr !== processedPageStr && prevCurrentPageIdRef.current !== processedCurrentPage.id) {
                        console.log('Syncing current page with processed data');
                        dispatch(bookingRequestFormActions.setCurrentPage(processedCurrentPage));
                        prevCurrentPageIdRef.current = processedCurrentPage.id;
                    }
                }
            }
        }
    }, [currentPage?.id, stableProcessedFormData?.length]); // Only depend on ID and length

    const clearPackageQuestionAnswers = (pageOrPages, isNdisFunded) => {
        // Helper function to check if an answer is NDIS-related
        const isNdisAnswer = (answer) => {
            if (!answer) return false;
            return answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia');
        };
        
        // Helper function to clear answers in a single page
        const clearPageAnswers = (page) => {
            // UPDATED: Use question key to check for package questions
            const pageHasPackageQuestion = page.Sections?.some(section => 
                section.Questions?.some(question => 
                    questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)
                )
            );

            if (!pageHasPackageQuestion) {
                return page; // Return unchanged if no package questions
            }

            return {
                ...page,
                Sections: page.Sections.map(section => ({
                    ...section,
                    Questions: section.Questions.map(question => {
                        // UPDATED: Use question key instead of text matching
                        if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) {
                            
                            if (question.type === 'radio') {
                                // For radio questions: clear if NDIS funded OR if answer is NDIS-related but not NDIS funded
                                if (isNdisFunded || (!isNdisFunded && isNdisAnswer(question.answer))) {
                                    console.log(`Clearing radio question - NDIS funded: ${isNdisFunded}, NDIS answer: ${isNdisAnswer(question.answer)}`);
                                    return { ...question, answer: null };
                                }
                            } else if (question.type === 'radio-ndis') {
                                // For radio-ndis questions: clear if not NDIS funded
                                if (!isNdisFunded) {
                                    console.log('Clearing radio-ndis question answer (not NDIS funded)');
                                    return { ...question, answer: null };
                                }
                            }
                        }
                        return question;
                    })
                }))
            };
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
                            // FIXED: Always preserve existing errors for date fields and other validation errors
                            if (currentQuestion.error && (
                                currentQuestion.type === 'date' || 
                                currentQuestion.type === 'date-range' ||
                                currentQuestion.type === 'goal-table' ||
                                currentQuestion.type === 'care-table'
                            )) {
                                // Keep existing validation error - don't override
                                // This preserves "Past dates are not allowed!" and other field-specific errors
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
                            // FIXED: Preserve existing validation errors during validation
                            if (currentQuestion.error && (
                                currentQuestion.type === 'date' || 
                                currentQuestion.type === 'date-range' ||
                                currentQuestion.type === 'goal-table' ||
                                currentQuestion.type === 'care-table'
                            )) {
                                // Keep existing field-specific validation error
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

    // UPDATED: Modified updatePageData function with immediate NDIS funding detection
    const updatePageData = (updates, pageId, action = 'UPDATE_DATA', submit = false, hasError) => {
        const validatedSections = handleFieldValidationErrorMessage(updates, action)
        const pageIndex = stableProcessedFormData.findIndex(p => p.id === pageId);
        const pages = structuredClone(stableProcessedFormData);

        pages.map((temp, index) => {
            if (index === pageIndex) {
                pages[index].Sections = validatedSections;
                pages[index].dirty = !hasError;
                
                // ADDED: Calculate completion status for the updated page
                pages[index].completed = calculatePageCompletion(pages[index]);
                
                console.log(`Updated page "${pages[index].title}" completion status: ${pages[index].completed}`);
            }
        });

        // ADDED: Check for NDIS funding status changes immediately
        const fundingStatusChanged = checkAndUpdateNdisFundingStatus(pages);

        const updatedPages = submit ? pages : applyQuestionDependencies(applyQuestionDependencies(pages));
        
        // ADDED: Recalculate completion for all pages after dependencies are applied
        updatedPages.forEach(page => {
            const wasCompleted = page.completed;
            page.completed = calculatePageCompletion(page);
            
            if (wasCompleted !== page.completed) {
                console.log(`Page "${page.title}" completion status changed: ${wasCompleted} → ${page.completed}`);
            }
        });
        
        // Update the processed form data
        setProcessedFormData(updatedPages);
        
        // FIXED: Only update Redux state if not currently processing NDIS to prevent loops
        if (!isProcessingNdis) {
            safeDispatchData(updatedPages, 'updatePageData');
        }
        
        // ADDED: If funding status changed, trigger NDIS processing after a small delay
        if (fundingStatusChanged && !isProcessingNdis) {
            console.log('🔄 Funding status changed, triggering NDIS processing...');
            setTimeout(() => {
                // Force a re-process by updating a tracking state
                setIsProcessingNdis(true);
                const processedData = processFormDataForNdisPackages(updatedPages);
                setProcessedFormData(processedData);
                safeDispatchData(processedData, 'funding status change');
                setIsProcessingNdis(false);
            }, 100);
        }
        
        return updatedPages;
    }

    const updateAndDispatchPageData = useDebouncedCallback((updates, pageId) => {
        const updatedPages = updatePageData(updates, pageId);
        // No additional dispatch needed since updatePageData handles it
    }, 100);

    const updateAndDispatchEquipmentData = useDebouncedCallback((updates) => {
        dispatch(bookingRequestFormActions.updateEquipmentChanges(updates));
    }, 100);

    const validate = (pages) => {
        let errorMessage = new Set();
        pages.map(page => {
            page?.Sections?.map(section => {
                section?.Questions?.length > 0 && section.Questions.filter(q => q.hidden === false).map(question => {
                    // ADDED: Skip validation for NDIS-only questions that should have been moved to NDIS page
                    if (question.ndis_only && question.type !== 'simple-checkbox' && isNdisFunded) {
                        // These questions should be on the NDIS page, not the current page
                        return;
                    }
                    
                    if (question.type !== 'url') {
                        const required = question.required ? question.required : false;
                        const answer = question.answer ? question.answer : question.answer === 0 ? '0' : null;

                        if (question.type === 'horizontal-card') {
                            console.log(question)
                        }
                        
                        // ENHANCED: Check for ANY existing errors on the question first (including date validation errors)
                        if (question.error && typeof question.error === 'string' && question.error.trim() !== '') {
                            console.log(`Found existing error on question: ${question.error}`);
                            errorMessage.add({ 
                                pageId: page.id, 
                                pageTitle: page.title, 
                                message: question.error, 
                                question: question.question, 
                                type: question.type 
                            });
                        }
                        // Email validation
                        else if (question.type === "email" && answer) {
                            if (answer && !validateEmail(answer)) {
                                errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please input a valid email.', question: question.question, type: question.type });
                            }
                        }
                        // Phone number validation
                        else if (question.type === "phone-number" && answer) {
                            if (answer && !validatePhoneNumber(answer)) {
                                errorMessage.add({ 
                                    pageId: page.id, 
                                    pageTitle: page.title, 
                                    message: 'Please input a valid phone number.', 
                                    question: question.question, 
                                    type: question.type 
                                });
                            }
                        }
                        // Room selection validation
                        else if (question.type === "rooms" && question.required) {
                            let roomsData = null;
                            try {
                                roomsData = question.answer ? JSON.parse(question.answer) : null;
                            } catch (e) {
                                roomsData = question.answer;
                            }
                            
                            // Check if no rooms are selected or if the first room is empty
                            const hasValidSelection = roomsData && roomsData.length > 0 && roomsData[0] && roomsData[0].name;
                            
                            if (!hasValidSelection) {
                                console.log('Room validation failed - no room selected');
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
                            // If the answer is 'Wellness', we need to clear the package question answers
                            const updatedPage = clearPackageQuestionAnswers(page, isNdisFunded);
                            const updatedPages = updatePageData(updatedPage?.Sections, page.id, 'UPDATE_DATA', false);
                            errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Missing NDIS Package Type', question: question.question, type: question.type });
                        }
                        // Required field validation (only if no existing error)
                        else if (required && !answer) {
                            errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please input/select an answer.', question: question.question, type: question.type });
                        }
                    }

                    // Checkbox validation
                    if ((question.type == 'checkbox' || question.type == 'checkbox-button') && question.answer && question.answer.length === 0) {
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please select at least one option.', question: question.question, type: question.type });
                    }

                    // Goal table validation
                    if (question.type == 'goal-table' && question.error) {
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please select at least one option.', question: question.question, type: question.type });
                    }

                    // Care table validation
                    if (question.type == 'care-table' && question.error) {
                        errorMessage.add({ pageId: page.id, pageTitle: page.title, message: 'Please fill in all table columns and rows.', question: question.question, type: question.type });
                    }
                });
            });
        });

        const errors = Array.from(errorMessage);
        console.log(`Total validation errors found: ${errors.length}`, errors);
        return errors;
    }

    const validateAllPages = () => {
        console.log('Validating all pages for validation errors...');
        const validatingPages = stableProcessedFormData.filter(page => !page.title.includes('Equipment'));
        // Get all validation errors using the existing validate method
        const allErrors = validate(validatingPages);
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
                
                // Add page title to list if not already added
                if (!pagesWithErrors.includes(error.pageTitle)) {
                    pagesWithErrors.push(error.pageTitle);
                }
            });
            
            console.log('Validation errors by page:', errorsByPage);
            
            // Mark pages with errors as incomplete and navigate to first error page
            let firstErrorPage = null;
            
            const updatedPages = stableProcessedFormData.map(page => {
                let p = {...page};
                
                // Check if this page has errors
                if (errorsByPage[page.id]) {
                    p.completed = false;
                    
                    // Set the first error page for navigation
                    if (!firstErrorPage) {
                        firstErrorPage = page;
                    }
                }
                
                return p;
            });

            setProcessedFormData(updatedPages);

            // Navigate to the first page with errors
            if (firstErrorPage) {
                const pageIndex = stableProcessedFormData.findIndex(p => p.id === firstErrorPage.id);
                setActiveAccordionIndex(pageIndex);
                dispatch(bookingRequestFormActions.setCurrentPage(firstErrorPage));
            }
            
            // Show error message with page names that have errors
            toast.error(`The following pages have validation errors: ${pagesWithErrors.join(', ')}`);
            return true;
        }

        return false;
    }

    const showWarningReturningBookingNotSave = (bookingType, bookingStatus, cPage, submit = false) => {
        if (validateAllPages()) {
          dispatch(globalActions.setLoading(false));
          return false;
        }

        const errorMsg = validate([cPage]);
        const pages = updatePageData(cPage?.Sections, cPage?.id, 'VALIDATE_DATA', errorMsg.length > 0);
    
        if (errorMsg.length > 0) {
            console.log(errorMsg)
            dispatch(globalActions.setLoading(false));
            toast.error('There are some REQUIRED questions not answered. Please input/select an answer.');
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
                    if (funder?.toLowerCase() === 'icare') {
                        submitBooking();
                    } else {
                        // Save the current page without submitting
                        saveCurrentPage(cPage, false).then(() => {
                            // Show the summary component
                            setBookingSubmittedState(true);
                        });
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
          const errorMsg = validate([cPage]);
          if (errorMsg.length > 0 && submit) {
            dispatch(globalActions.setLoading(false));
            toast.error('There are some REQUIRED questions not answered. Please input/select an answer.');
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
                        let thanksUrl = 'https://sargoodoncollaroy.com.au/thanks/';
                        
                        if (window.location.search) {
                            thanksUrl += window.location.search;
                            
                            if (!window.location.search.includes('&submit=true')) {
                                thanksUrl += '&submit=true';
                            }
                        }
                        
                        window.open(thanksUrl, '_self');
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
                if (fundedQuestion && fundedQuestion.answer && (fundedQuestion.answer?.toLowerCase().includes('ndis') || fundedQuestion.answer?.toLowerCase().includes('ndia'))) {
                    dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                }

                const sectionLabel = section.label;
                questions.filter(q => 
                    q.hidden === true && q.dirty === true && (q.answer == null || q.answer == undefined || q.answer == '')).map(q => {
                        qa_pairs.push({
                            ...q,
                            section_id: section.id,
                            delete: true,
                            guestId: guest?.id
                        });
                    })
                
                // UPDATED: Use question key to filter package questions
                const updatedQuestions = questions.filter(q => 
                    !q.hidden || 
                    questionHasKey(q, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)
                );
                
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

                        const answer = (typeof question.answer != 'string' && (question.type === 'multi-select' || question.type === 'checkbox' || question.type === 'checkbox-button' || question.type === 'health-info' || question.type === 'goal-table' || question.type === 'care-table')) ? JSON.stringify(question.answer) : question.answer;
                        if (answer != undefined) {
                            let qap = {
                                ...qaPairs[questionIndex],
                                question: question.question,
                                answer: answer,
                                question_type: question.type,
                                question_id: question.fromQa ? question.question_id : question.id,
                                section_id: question.orig_section_id || section.orig_section_id || section.id,
                                submit: submit,
                                updatedAt: new Date(),
                                dirty: qaPairDirty,
                                sectionLabel: sectionLabel,
                                oldAnswer: question.oldAnswer,
                                // ADD: Include question_key for profile mapping
                                question_key: question.question_key
                            };

                            qa_pairs.push(qap);

                            summaryOfStay.data = generateSummaryData(summaryOfStay.data, question.question, answer, question.type, qa_pairs);
                        } else {
                            // UPDATED: Use question key to check for package question
                            if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL))  {
                                let qap = {
                                    ...qaPairs[questionIndex],
                                    question: question.question,
                                    answer: answer,
                                    question_type: question.type,
                                    question_id: question.fromQa ? question.question_id : question.id,
                                    section_id: question.orig_section_id || section.orig_section_id || section.id,
                                    submit: submit,
                                    updatedAt: new Date(),
                                    dirty: qaPairDirty,
                                    sectionLabel: sectionLabel,
                                    oldAnswer: question.oldAnswer,
                                    // ADD: Include question_key for profile mapping
                                    question_key: question.question_key
                                };

                                qa_pairs.push(qap);
                            }
                        }
                    });
                } else {
                    updatedQuestions.map((question, questionIndex) => {
                        const answer = (typeof question.answer != 'string' && (question.type === 'multi-select' || question.type === 'checkbox' || question.type === 'checkbox-button' || question.type === 'health-info' || question.type === 'goal-table' || question.type === 'care-table')) ? JSON.stringify(question.answer) : question.answer;
                        if (answer != undefined) {
                            let qap = {
                                label: '',
                                question: question.question,
                                answer: answer,
                                question_type: question.type,
                                question_id: question.fromQa ? question.question_id : question.id,
                                section_id: question.orig_section_id || section.orig_section_id || section.id,
                                submit: submit,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                question_key: question.question_key,
                                oldAnswer: question.oldAnswer
                            };

                            if (question.fromQa) {
                                qap = { ...qap, id: question.id };
                            }

                            qa_pairs.push(qap);
                            summaryOfStay.data = generateSummaryData(summaryOfStay.data, question.question, answer, question.type, qa_pairs);
                        }
                    });
                }
            });
        });

        setSummaryData(summaryOfStay);

        let data = {};
        const qaPairDirty = qa_pairs.some(qp => qp.dirty);
        if (qaPairDirty || qa_pairs.length > 0 || currentPage.Sections.every(s => s.QaPairs && s.QaPairs.length == 0)) {
            if (summaryOfStay.data.funder && (summaryOfStay.data.funder?.toLowerCase().includes('ndis') || summaryOfStay.data.funder?.toLowerCase().includes('ndia'))) {
            const packageQuestions = qa_pairs.filter(qp => questionMatches({ question: qp.question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL));
            
            // Find regular radio type package questions to delete (but keep package-selection and radio-ndis)
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
            
            // Find NDIS-specific package questions to delete
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

            let dataForm = { qa_pairs: qa_pairs, flags: { origin: origin, pageId: cPage.id, templateId: cPage.template_id }};
            if (equipmentChangesState.length > 0) {
                dataForm.equipmentChanges = [...equipmentChangesState];
            }
            setWasBookingFormDirty(true);
            
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
            }

            const guestId = getGuestId();
            if (guestId) {
                const changedProfileFields = qa_pairs.filter(qp => {
                    const hasMapping = hasProfileMapping(qp.question_key);
                    const hasChanged = (() => {
                        // Handle null/undefined cases
                        if (qp.answer === qp.oldAnswer) return false;
                        if (qp.answer == null || qp.oldAnswer == null) return qp.answer !== qp.oldAnswer;
                        
                        if (typeof qp.answer === 'object' || typeof qp.oldAnswer === 'object') {
                            return JSON.stringify(qp.answer) !== JSON.stringify(qp.oldAnswer);
                        }
                        
                        return qp.answer !== qp.oldAnswer;
                    })();
                    
                    const isNotDeleted = !qp.delete;
                    
                    return hasMapping && hasChanged && isNotDeleted;
                });

                console.log('Changed profile fields:', changedProfileFields.map(f => ({ 
                    key: f.question_key, 
                    answer: f.answer, 
                    oldAnswer: f.oldAnswer 
                })));

                // Queue all changed fields for batch saving
                for (const field of changedProfileFields) {
                    queueProfileSave(field.question_key, field.answer, guestId);
                }

                // Handle special multi-field logic (language questions, etc.)
                for (const field of changedProfileFields) {
                    try {
                        await handleLanguageQuestionSave(field.question_key, field.answer, guestId);
                    } catch (error) {
                        console.error(`Failed to save special profile logic for ${field.question_key}:`, error);
                    }
                }
            }
        }

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
                            // this is to avoid adding existing qa pair to the object
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

    // REFACTORED: generateSummaryData method with question keys
    const generateSummaryData = (stayData, question, answer, questionType, qaPairs) => {
        let summaryOfStayData = { ...stayData };
        if (answer) {
            // UPDATED: Use question key mappings for all question checks
            if (questionMatches({ question }, 'How will your stay be funded', QUESTION_KEYS.FUNDING_SOURCE)) {
                summaryOfStayData.funder = answer;
                if (answer.toLowerCase().includes('ndis') || answer.toLowerCase().includes('ndia')) {
                    summaryOfStayData.isNDISFunder = true;
                } else {
                    summaryOfStayData.isNDISFunder = false;
                    summaryOfStayData.ndisQuestions = [];
                    summaryOfStayData.ndisPackage = '';
                }
                dispatch(bookingRequestFormActions.setFunder(answer));
            } else if (questionMatches({ question }, 'NDIS Participant Number', QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) || 
                      questionMatches({ question }, 'icare Participant Number', QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER)) {
                summaryOfStayData.participantNumber = answer;
            } else if (questionMatches({ question }, 'Check In Date and Check Out Date', QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
                const dates = answer.split(' - ');
                const checkIn = moment(dates[0]);
                const checkOut = moment(dates[1]);
                dispatch(bookingRequestFormActions.setCheckinDate(checkIn.format('DD/MM/YYYY')));
                dispatch(bookingRequestFormActions.setCheckoutDate(checkOut.format('DD/MM/YYYY')));
                summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
                if (checkIn.isValid() && checkOut.isValid()) {
                    summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
                }
            } else if (questionMatches({ question }, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
                const checkIn = moment(answer);
                dispatch(bookingRequestFormActions.setCheckinDate(checkIn.format('DD/MM/YYYY')));
            } else if (questionMatches({ question }, 'Check Out Date', QUESTION_KEYS.CHECK_OUT_DATE)) {
                const checkOut = moment(answer, 'YYYY-MM-DD');

                dispatch(bookingRequestFormActions.setCheckoutDate(checkOut.format('DD/MM/YYYY')));
                const checkInAnswer = getCheckInOutAnswer(qaPairs)[0];

                if (checkInAnswer && checkOut.isValid()) {
                    const checkIn = moment(checkInAnswer, 'YYYY-MM-DD');
                    if (checkIn.isValid() && checkOut.isValid()) {
                        summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
                        summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
                    }
                }
            } else if (questionType !== 'package-selection' && (questionMatches({ question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                      questionMatches({ question }, 'Accommodation package options for Sargood Courses', QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES)) && answer?.includes('Wellness')) {
                    summaryOfStayData.packageType = serializePackage(answer);
                    summaryOfStayData.packageTypeAnswer = answer;
                    if (answer.includes('Wellness & Support Package')) {
                        summaryOfStayData.packageCost = 985;
                    } else if (answer.includes('Wellness & High Support Package')) {
                        summaryOfStayData.packageCost = 1365;
                    } else if (answer.includes('Wellness & Very High Support Package')) {
                        summaryOfStayData.packageCost = 1740;
                    }
            } else if (questionType !== 'package-selection' && questionMatches({ question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)
                && (answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia'))) {
                    summaryOfStayData.ndisPackage = answer;
            } else if (questionType === 'package-selection' && questionMatches({ question }, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) {
                // For package-selection, answer is the package ID
                // Store the package ID for later processing in the summary component
                summaryOfStayData.selectedPackageId = answer;
                summaryOfStayData.packageSelectionType = 'package-selection';
                
                // Set a placeholder that will be resolved in the summary component
                summaryOfStayData.packageType = 'PACKAGE_SELECTION';
                summaryOfStayData.packageTypeAnswer = `Package ID: ${answer}`;
            } else if (question.includes('Is Short-Term Accommodation including Respite a stated support in your plan?')
                || question.includes('What is the purpose of this stay and how does it align with your plan goals? ')
                || question.includes('How is this service value for money?') 
                || question == 'Please specify.'
                || question.includes('Are you having a break from your informal support?')
                || question.includes('Do you live alone?')
                || question.includes('Are you travelling with any informal supports?')
                || question.includes('Do you live in supported independent living (SIL)?')
                || question.includes('Why do you require 1:1 support?'))
            {
                const ndisQuestions = summaryOfStayData?.ndisQuestions ? summaryOfStayData.ndisQuestions : [];
                const newQuestion = { question: question, answer: tryParseJSON(answer) };
                summaryOfStayData.ndisQuestions = [
                    ...ndisQuestions.filter(q => q.question !== question),
                    newQuestion
                ];
            }
        }

        return summaryOfStayData;
    }

    const serializePackage = (packageType) => {
        if (packageType.includes("Wellness & Very High Support Package")) {
          return "WVHS";
        } else if (packageType.includes("Wellness & High Support Package")) {
          return "WHS";
        } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
          return "WS";
        } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
          return "SP"
        } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
          return "CSP"
        } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
          return "HCSP"
        } else {
          return '';
        }
    }

    const applyQuestionDependencies = (pages) => {
        // UPDATED: Use question key to check for funding status

        const multipleAnswersQuestion = [
            'checkbox',
            'checkbox-button',
            'multi-select',
            'health-info',
            'card-selection-multi',
            'horizontal-card-multi'
        ];

        const calculateNdisFundingStatus = (pages) => {
            for (const page of pages) {
                for (const section of page.Sections || []) {
                    for (const question of section.Questions || []) {
                        if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && 
                            question.answer && 
                            (question.answer?.toLowerCase().includes('ndis') || question.answer?.toLowerCase().includes('ndia'))) {
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        const currentIsNdisFunded = calculateNdisFundingStatus(pages);
        
        let hiddenQuestions = [];
        const list = pages.map((page) => {
            let temp = structuredClone(page);
            let noItems = 0;
            temp.Sections = temp.Sections.map(section => {
                let s = structuredClone(section);

                if (s.Questions.length === 1) {
                    if (s.Questions[0].second_booking_only || s.Questions[0].ndis_only) {
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
                                    answer = (typeof answer === 'string') ? JSON.parse(answer) : answer;
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
                                    answer = typeof answer === 'string' ? JSON.parse(answer) : answer;
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
                        q.hidden = false;
                        s.hidden = false;
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
                    if (s.Questions[0].second_booking_only || s.Questions[0].ndis_only) {
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
                        q.hidden = false;
                        s.hidden = false;
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
                    if (s.Questions[0].second_booking_only && booking?.type == 'Returning Guest') {
                        s.Questions[0].hidden = true;
                        s.hidden = true;
                        if (pageIsDirty || s.Questions[0]?.dirty) {
                            s.Questions[0].hidden = false;
                            s.hidden = false;
                        }
                        return s;
                    }

                    // UPDATED: Use question key for acknowledgement charges check
                    if (s.Questions[0].ndis_only && questionMatches(s.Questions[0], 'I acknowledge additional charges')) {
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
                        }
                    }

                    if (q.hidden) {
                        q.answer = null;
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

        return list;
    }

    const convertQAtoQuestion = (qa_pairs, sectionId, returnee, pageTitle) => {
        let questionList = [];
        let answered = false;

        qa_pairs.map(async qa => {
            const question = qa.Question;
            let options = question.options;
            let answer = qa.answer;
            let url = '';

            if (qa.question_type === 'select') {
                let tempOptions = typeof options === 'string' ? JSON.parse(options) : options;
                options = options && tempOptions.map(o => {
                    let temp = { ...o };
                    answer = answer;
                    temp.checked = answer && temp.label === answer;
                    return temp;
                });
            } else if (qa.question_type === 'multi-select') {
                answer = answer ? JSON.parse(answer) : [];
                options = options && options.map(o => {
                    let temp = { ...o };
                    temp.checked = answer && answer.find(a => a === o.label);
                    temp.value = answer && answer.find(a => a === o.label);
                    return temp;
                });
            } else if (qa.question_type === 'radio' || qa.question_type === 'radio-ndis') {
                let tempOptions = typeof options === 'string' ? JSON.parse(options) : options;
                options = options && tempOptions.map(o => {
                    let temp = { ...o };
                    temp.checked = temp.label === answer ? true : false;
                    return temp;
                });
            } else if (qa.question_type === 'checkbox' || qa.question_type === "checkbox-button") {
                if (options.length > 0) {
                    answer = answer ? JSON.parse(answer) : [];
                    let tempOptions = typeof options === 'string' ? JSON.parse(options) : options;
                    options = options && tempOptions.map(o => {
                        let temp = { ...o };
                        temp.checked = answer && answer.find(a => a === o.label);
                        temp.notAvailableFlag = o?.notAvailableFlag ? o.notAvailableFlag : false;
                        return temp;
                    });
                } else {
                    answer = answer ? answer : false;
                }
            } else if (qa.question_type === 'health-info') {
                answer = answer ? JSON.parse(answer) : [];
                options = options && options.map(o => {
                    let temp = { ...o };
                    temp.value = answer && answer.find(a => a === o.label);
                    return temp;
                });
            } else if (qa.question_type === 'date-range') {
                const dateRange = answer && answer.split(' - ');
                if (dateRange && dateRange.length > 1) {
                    answer = answer;
                } else {
                    answer = null;
                }
            } else if (qa.question_type === 'goal-table') {
                try {
                    answer = typeof answer === 'string' ? JSON.parse(answer) : answer;
                
                    if (Array.isArray(answer)) {
                        answer = answer.map(item => ({
                            ...item,
                            id: item.id,
                            goal: item.goal,
                            specificGoal: item.specificGoal
                        }));
                    }
                } catch (e) {
                    console.error('Error parsing goal-table answer:', e);
                    answer = [];
                }

                options = null;
            } else if (qa.question_type === 'care-table') {
                answer = typeof answer === 'string' ? JSON.parse(answer) : answer;
                options = null;
            } else if (qa.question_type === 'card-selection' || qa.question_type === 'horizontal-card') {
                options = options && options.map(o => {
                    let temp = { ...o };
                    temp.checked = answer && answer.value === o.value;
                    return temp;
                });
            } else if (qa.question_type === 'card-selection-multi' || qa.question_type === 'horizontal-card-multi') {
                answer = answer ? JSON.parse(answer) : [];
                options = options && options.map(o => {
                    let temp = { ...o };
                    temp.checked = answer && answer.find(a => a === o.value);
                    return temp;
                });
            } else {
                options = null;
            }

            if ((answer || (!answer && !question.required)) && !answered && sectionId === qa.section_id) {
                answered = true;
            }

            let temp = {
                section_id: sectionId,
                label: question.label,
                type: qa.question_type,
                required: question.required,
                question: qa.question,
                options: options,
                details: question.details,
                order: question.order,
                answer: answer,
                oldAnswer: answer,
                question_id: qa.question_id,
                QuestionDependencies: question.QuestionDependencies,
                has_not_available_option: question.has_not_available_option,
                url: url,
                fromQa: true,
                id: qa.id,
                question_key: question.question_key || null,
                option_type: question.option_type || null,
            };

            if (returnee) {
                // for Returning Guest
                if (!question.prefill && !answer) {
                    temp.answer = null;
                }
            }

            questionList.push(temp);
        });

        return { questionList: questionList, answered: answered };
    }

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
            }

            let summaryOfStay = { ...summaryData };

            setEquipmentPageCompleted(data.completedEquipments);

            let bookingType = BOOKING_TYPES.FIRST_TIME_GUEST;
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
                        return { room: room.label, type: index == 0 ? room.RoomType.type : 'upgrade', price: room.RoomType.price_per_night, peak_rate: room.RoomType.peak_rate };
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
            const pagesArr = data.template.Pages.map((page, index) => {
                let temp = structuredClone(page);
                temp.url = "&&page_id=" + temp.id;
                temp.active = "&" + currentPath[1] === temp.url ? true : false;
                temp.hasNext = data.template.Pages.length - 1 === index ? false : true;
                temp.hasBack = index === 0 ? false : true;
                temp.lastPage = index === data.template.Pages.length - 1 ? true : false;
                temp.pageQuestionDependencies = [];
                temp.completed = false;

                let numberItems = 0;
                let returnee = false;
                const sections = page.Sections.sort((a,b) => a.order - b.order).map(sec => {
                    let s = structuredClone(sec);
                    s.hidden = false;

                    // for first time or completed booking
                    if (data.booking && !data.newBooking) {
                        const bookingSection = data.booking.Sections && data.booking.Sections.find(o => o.orig_section_id === sec.id);
                        if (bookingSection) {
                            s = structuredClone(bookingSection);

                            if (s.QaPairs.length > 0) {
                                const qa_pairs = s.QaPairs ? convertQAtoQuestion(s.QaPairs, s.id, returnee) : [];
                                s.Questions = qa_pairs.questionList;

                                // this will fixed the issue of not showing the questions that are not answered
                                if (s.QaPairs.length !== sec.Questions.length) {
                                    const removedQuestions = sec.Questions.filter(q => !qa_pairs.questionList.some(qp => qp.question === q.question))
                                                                          .map(q => { return { ...q, question: q.question, type: q.type, answer: null } });
                                    s.Questions.push(...removedQuestions);
                                }

                                if (qa_pairs.answered) {
                                    temp.completed = true;
                                } else {
                                    temp.completed = false;
                                }
                            } else {
                                s.Questions = sec.Questions;
                            }

                            if (temp.title == 'Equipment' && data?.completedEquipments) {
                                temp.completed = true;
                            }
                        }
                    }

                    let questionArr = s.Questions ? s.Questions : [];
                    // for succeeding booking
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
                                const qa_pairs = s.QaPairs ? convertQAtoQuestion(s.QaPairs, s.id, returnee, temp.title) : [];
                                s.Questions = qa_pairs.questionList;

                                // this will fixed the issue of not showing the questions that are not answered
                                if (s.QaPairs.length !== sec.Questions.length) {
                                    const removedQuestions = sec.Questions.filter(q => !qa_pairs.questionList.some(qp => qp.question === q.question))
                                                                          .map(q => { return { ...q, question: q.question, type: q.type, answer: null } });
                                    s.Questions.push(...removedQuestions);
                                }

                                if (qa_pairs.answered) {
                                    temp.completed = true;
                                } else {
                                    temp.completed = false;
                                }
                            } else {
                                s.Questions = sec.Questions;
                            }

                            if (temp.title == 'Equipment' && data?.completedEquipments) {
                                temp.completed = true;
                            }
                        }

                        questionArr = s.Questions ? s.Questions : [];
                        const prevSection = data.booking.Sections && data.booking.Sections.find(item => item.orig_section_id === s.id);
                        const newSection = data.newBooking.Sections && data.newBooking.Sections.find(item => item.orig_section_id === s.id);
                        s.QaPairs = newSection ? newSection.QaPairs : [];
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
                                        label: '', // put in questions
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

                    questionArr = questionArr.filter(question => !(question.question == '' && question.type == 'string')).sort((a, b) => { return a.order - b.order; });
                    questionArr = questionArr.map(question => {
                        let q = { ...question }
                        if (!q.answer && bookingType === BOOKING_TYPES.FIRST_TIME_GUEST) {
                            // UPDATED: Use question key for check-in/out date
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

                        if ((!q.answer || q.answer == null) && bookingType == 'Returning Guest' && q.prefill) {
                            let questionMatch;
                            data.booking.Sections.map(section => section.QaPairs.map(qaPair => {
                                if (qaPair.question == q.question) { 
                                    questionMatch = qaPair
                                }
                            }));

                            if (questionMatch) {
                                q.answer = questionMatch.answer;
                                q.dirty = true;
                            }
                        }

                        q.hidden = q.QuestionDependencies.length > 0 ? true : false;

                        if ((!returnee && q.second_booking_only) || q.ndis_only) {
                            s.hidden = true;
                            q.hidden = true;
                        }

                        questionDependencies.push.apply(questionDependencies, s.Questions.filter(qp => qp.QuestionDependencies.length > 0));

                        summaryOfStay.data = generateSummaryData(summaryOfStay.data, q.question, q.answer, q.type, questionArr);

                        // UPDATED: Use question key for funding check
                        if (questionHasKey(q, QUESTION_KEYS.FUNDING_SOURCE) && q.answer && (q.answer?.toLowerCase().includes('ndis') || q.answer?.toLowerCase().includes('ndia'))) {
                            summaryOfStay.data.isNDISFunder = true;
                            dispatch(bookingRequestFormActions.setIsNdisFunded(true));
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
                toast.error('No template pages detected.');
                setTimeout(() => {
                    window.close();
                }, 5000);
            }

            // ADDED: Debug logging before processing dependencies
            console.log('🔍 Initial template loaded, debugging page questions...');
            pagesArr.forEach((page, pageIndex) => {
                console.log(`📋 Page ${pageIndex}: "${page.title}"`);
                page.Sections?.forEach((section, sectionIndex) => {
                    section.Questions?.forEach((question, questionIndex) => {
                        if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)) {
                            console.log(`💰 FUNDING QUESTION FOUND: "${question.question}"`);
                            console.log(`📝 Answer: "${question.answer}"`);
                            console.log(`✅ Required: ${question.required}`);
                            console.log(`👁️ Hidden: ${question.hidden}`);
                        }
                        if (question.ndis_only === true) {
                            console.log(`🏥 NDIS-ONLY QUESTION: "${question.question}"`);
                            console.log(`📝 Answer: "${question.answer}"`);
                            console.log(`✅ Required: ${question.required}`);
                        }
                        if (question.answer && question.answer !== '') {
                            console.log(`📝 Question with answer: "${question.question}" = "${question.answer}"`);
                        }
                    });
                });
            });

            const pagesWithDependencies = applyQuestionDependencies(pagesArr);
            
            // ADDED: Check for pre-existing NDIS funding and process conditional pages
            const preloadNdisFundingCheck = (pages) => {
                console.log('🔍 Checking for pre-existing NDIS funding on template load...');
                
                let foundNdisFunding = false;
                
                // Check all pages for existing NDIS funding answers
                for (const page of pages) {
                    for (const section of page.Sections || []) {
                        for (const question of section.Questions || []) {
                            if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                                const isNdisAnswer = question.answer?.toLowerCase().includes('ndis') || 
                                                   question.answer?.toLowerCase().includes('ndia');
                                
                                if (isNdisAnswer) {
                                    console.log('✅ Pre-existing NDIS funding detected:', question.answer);
                                    foundNdisFunding = true;
                                    // Set NDIS funded state immediately
                                    dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                                    break;
                                }
                            }
                        }
                        if (foundNdisFunding) break;
                    }
                    if (foundNdisFunding) break;
                }
                
                // If NDIS funding was found, process the pages to create conditional NDIS page
                if (foundNdisFunding) {
                    console.log('🔄 Processing NDIS conditional pages for pre-existing funding...');
                    const processedPages = processFormDataForNdisPackages(pages);
                    return processedPages;
                }
                
                return pages;
            };
            
            // Check for pre-existing funding and process conditional pages
            const finalProcessedPages = preloadNdisFundingCheck(pagesWithDependencies);
            
            await Promise.all([
                new Promise(resolve => setTimeout(resolve, 100))
            ]);
            
            // Store the initial form data in Redux (with conditional pages if needed)
            safeDispatchData(finalProcessedPages, 'initial template load with preload check');

            setTimeout(() => {
                dispatch(globalActions.setLoading(false));
            }, 500);
        }
    }

    // CRITICAL: Optimized effect to process form data when NDIS funding status changes
    useEffect(() => {
        // EMERGENCY FIX: Prevent infinite re-renders by checking the isUpdating flag
        if (isUpdating || isProcessingNdis) return;

        if (stableBookingRequestFormData.length > 0) {
            console.log('Processing form data for NDIS packages...', { isNdisFunded, dataLength: stableBookingRequestFormData.length });
            
            // Create a stable comparison key to avoid infinite loops
            const currentFormDataKey = stableBookingRequestFormData.map(page => ({
                id: page.id,
                completed: page.completed,
                sections: page.Sections?.map(section => ({
                    id: section.id,
                    questions: section.Questions?.map(q => ({ id: q.id, answer: q.answer }))
                }))
            }));
            
            const currentFormDataStr = JSON.stringify(currentFormDataKey);
            const currentIsNdisFundedVal = isNdisFunded;
            
            // Only process if key data actually changed
            if (prevFormDataRef.current !== currentFormDataStr || 
                prevIsNdisFundedRef.current !== currentIsNdisFundedVal) {
                
                setIsUpdating(true); // Set flag to prevent recursive updates
                
                prevFormDataRef.current = currentFormDataStr;
                prevIsNdisFundedRef.current = currentIsNdisFundedVal;
                
                // Check if this is initial load (no funding selected yet)
                const hasFundingAnswer = stableBookingRequestFormData.some(page => 
                    page.Sections?.some(section => 
                        section.Questions?.some(question => 
                            questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && 
                            question.answer && 
                            question.answer.trim() !== ''
                        )
                    )
                );
                
                // ADDED: Check if NDIS page already exists (from preload processing)
                const ndisPageExists = stableBookingRequestFormData.some(page => page.id === 'ndis_packages_page');
                
                if (hasFundingAnswer) {
                    // UPDATED: Only process if changes are needed
                    const shouldHaveNdisPage = isNdisFunded;
                    const needsProcessing = (shouldHaveNdisPage && !ndisPageExists) || (!shouldHaveNdisPage && ndisPageExists);
                    
                    if (needsProcessing) {
                        console.log('📊 NDIS processing needed:', { shouldHaveNdisPage, ndisPageExists, needsProcessing });
                        setIsProcessingNdis(true);
                        
                        try {
                            const processed = processFormDataForNdisPackages(stableBookingRequestFormData);
                            
                            // Only update if the processed data is actually different
                            const processedKey = processed.map(page => ({
                                id: page.id,
                                completed: page.completed,
                                sections: page.Sections?.map(section => ({
                                    id: section.id,
                                    questions: section.Questions?.map(q => ({ id: q.id, answer: q.answer }))
                                }))
                            }));
                            
                            const processedStr = JSON.stringify(processedKey);
                            
                            if (processedStr !== currentFormDataStr) {
                                console.log('📊 NDIS processing resulted in changes, updating data');
                                setProcessedFormData(processed);
                                safeDispatchData(processed, 'NDIS processing');
                                
                                // Update current page only if it exists and is different
                                if (currentPage) {
                                    const updatedCurrentPage = processed.find(p => p.id === currentPage.id);
                                    if (updatedCurrentPage && JSON.stringify(updatedCurrentPage) !== JSON.stringify(currentPage)) {
                                        dispatch(bookingRequestFormActions.setCurrentPage(updatedCurrentPage));
                                    }
                                }
                            } else {
                                console.log('📊 NDIS processing resulted in no changes');
                                setProcessedFormData(stableBookingRequestFormData);
                            }
                        } catch (error) {
                            console.error('Error in NDIS processing:', error);
                        } finally {
                            setIsProcessingNdis(false);
                        }
                    } else {
                        console.log('📊 NDIS page already in correct state, skipping processing');
                        if (JSON.stringify(stableProcessedFormData) !== currentFormDataStr) {
                            setProcessedFormData(stableBookingRequestFormData);
                        }
                    }
                } else {
                    console.log('Initial load - no funding answer yet');
                    if (JSON.stringify(stableProcessedFormData) !== currentFormDataStr) {
                        setProcessedFormData(stableBookingRequestFormData);
                    }
                }
                
                // Reset update flag after a delay
                setTimeout(() => setIsUpdating(false), 100);
            }
        }
    }, [stableBookingRequestFormData, isNdisFunded]); // Use stable references

    // OPTIMIZATION: Initialize lastDispatchedDataRef on component mount
    useEffect(() => {
        if (stableBookingRequestFormData.length > 0 && !lastDispatchedDataRef.current) {
            lastDispatchedDataRef.current = JSON.stringify(stableBookingRequestFormData);
        }
    }, [stableBookingRequestFormData.length]);

    useEffect(() => {
        let mounted = true;
        if (mounted) {
          dispatch(bookingRequestFormActions.setData([]));
          dispatch(bookingRequestFormActions.clearEquipmentChanges());
          dispatch(bookingRequestFormActions.setRooms([]));
          
          const isSubmitted = router.asPath.includes('&submit=true');
          dispatch(bookingRequestFormActions.setBookingSubmitted(isSubmitted));
          
          dispatch(bookingRequestFormActions.setIsNdisFunded(false));
          dispatch(bookingRequestFormActions.setCheckinDate(null));
          dispatch(bookingRequestFormActions.setCheckoutDate(null));
        }
        
        mounted && uuid && getRequestFormTemplate();
      
        return (() => {
          mounted = false;
        });
    }, [uuid, prevBookingId, router.asPath]);

    useEffect(() => {
        // Only try to preload after form data is loaded and we have a current page
        if (stableBookingRequestFormData.length > 0 && currentPage && !profileDataLoaded) {
            const guestId = getGuestId();
            
            if (guestId) {
                console.log('Form ready for profile preload');
                // Use a longer timeout to ensure everything is properly initialized
                setTimeout(() => {
                    preloadProfileData();
                }, 1000);
            }
        }
    }, [stableBookingRequestFormData, currentPage, profileDataLoaded]);

    useEffect(() => {
        if (equipmentPageCompleted) {
            const updatedPages = stableProcessedFormData.map(page => {
                let p = { ...page };
                if (p.title == 'Equipment') {
                    p.completed = true;
                }

                return p;
            });

            setProcessedFormData(updatedPages);
        }
    }, [equipmentPageCompleted, stableProcessedFormData]);

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
        if (stableProcessedFormData.length > 0) {
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

    // OPTIMIZATION: Add debugging to track when renders happen
    useEffect(() => {
        console.log('🔄 BookingRequestForm re-rendered', {
            dataLength: stableBookingRequestFormData.length,
            processedLength: stableProcessedFormData.length,
            isProcessing: isProcessingNdis,
            isUpdating: isUpdating,
            currentPageId: currentPage?.id
        });
    });

    return (<>
        {stableProcessedFormData && (
            <BookingFormLayout ref={layoutRef} setBookingSubmittedState={setBookingSubmittedState}>
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
                    />
                ) : (
                    <div className="flex flex-col">
                        <Accordion 
                            items={accordionItems}
                            defaultOpenIndex={activeAccordionIndex}
                            allowMultiple={false}
                            onNavigate={handleAccordionNavigation}
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
                                <path d="M22.4033 12.0013C22.4003 9.24461 21.304 6.60163 19.3549 4.65215C17.4058 2.70266 14.763 1.60585 12.0063 1.60234C9.24899 1.60498 6.60536 2.70143 4.65553 4.65101C2.7057 6.6006 1.60895 9.24403 1.60597 12.0013C1.6093 14.7584 2.7062 17.4016 4.65599 19.3508C6.60579 21.3001 9.24922 22.3964 12.0063 22.399C14.7628 22.3955 17.4054 21.2989 19.3544 19.3497C21.3035 17.4005 22.4 14.7578 22.4033 12.0013ZM6.1971 12.811C6.21597 12.6147 6.29571 12.4292 6.4252 12.2805C6.59087 12.0917 6.82441 11.9759 7.075 11.9584C7.32559 11.9409 7.57296 12.0231 7.76329 12.187L10.4388 14.5045L15.445 8.03883C15.5215 7.9401 15.6167 7.85745 15.7253 7.79576C15.8339 7.73408 15.9536 7.69458 16.0776 7.67945C16.2006 7.6634 16.3256 7.67191 16.4453 7.70446C16.5651 7.73701 16.6772 7.79296 16.7751 7.8691C16.902 7.96704 17.0019 8.09546 17.0657 8.24248C17.1295 8.3895 17.155 8.5503 17.1398 8.70984C17.1216 8.88859 17.0525 9.05842 16.9409 9.19921L11.322 16.4612C11.2428 16.5622 11.144 16.6461 11.0315 16.708C10.9191 16.7699 10.7953 16.8084 10.6676 16.8213C10.6047 16.828 10.5414 16.828 10.4786 16.8213C10.2828 16.8013 10.0978 16.7222 9.94811 16.5945L6.51405 13.6226C6.39988 13.5227 6.31114 13.397 6.25522 13.256C6.19929 13.115 6.17777 12.9626 6.19245 12.8116M23.9987 12.002C23.9952 15.1828 22.7301 18.2323 20.481 20.4815C18.2319 22.7307 15.1824 23.996 12.0017 23.9997C8.82023 23.9967 5.7699 22.7318 3.51991 20.4826C1.26993 18.2333 0.00403751 15.1834 0 12.002C0.00298453 8.81986 1.2684 5.76898 3.5185 3.51888C5.7686 1.26878 8.81954 0.00332785 12.0017 0.000343323C15.1833 0.00367945 18.2335 1.26923 20.483 3.51921C22.7325 5.76918 23.9974 8.81974 24 12.0013L23.9987 12.002Z" fill="#61BCB8" />
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
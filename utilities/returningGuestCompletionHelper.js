/**
 * SINGLE SOURCE OF TRUTH for Returning Guest Page Completion
 * Updated with special Packages page validation
 */

import { QUESTION_KEYS, questionHasKey } from '../services/booking/question-helper';
import { BOOKING_TYPES } from '../components/constants';

/**
 * Core completion calculator for returning guests
 * This is the ONLY function that should determine completion for returning guests
 */
export const calculateReturningGuestPageCompletion = (
    page, 
    context = {}
) => {
    const {
        visitedPages = new Set(),
        pagesWithSavedData = new Set(),
        equipmentPageCompleted = false,
        equipmentChangesState = [],
        prevBookingId = null,
        currentBookingType = null
    } = context;

    // Only apply this logic for returning guests
    if (currentBookingType !== BOOKING_TYPES.RETURNING_GUEST || !prevBookingId) {
        return false;
    }

    if (!page || !page.Sections) {
        return false;
    }

    // SPECIAL CASE 1: Equipment Page
    if (page.title === 'Equipment') {
        return calculateEquipmentPageCompletion(page, {
            equipmentPageCompleted,
            equipmentChangesState,
            visitedPages,
            pagesWithSavedData
        });
    }

    // SPECIAL CASE 2: NDIS Requirements Page
    if (page.id === 'ndis_packages_page') {
        return calculateNdisPageCompletionForReturningGuest(page, {
            visitedPages,
            pagesWithSavedData
        });
    }

    // SPECIAL CASE 3: Packages Page (with auto-select functionality)
    if (isPackagesPage(page)) {
        return calculatePackagesPageCompletion(page, {
            visitedPages,
            pagesWithSavedData
        });
    }

    // STANDARD CASE: Regular Pages
    return calculateStandardPageCompletionForReturningGuest(page, {
        visitedPages,
        pagesWithSavedData
    });
};

/**
 * Check if this is a packages page that has auto-select functionality
 */
const isPackagesPage = (page) => {
    // Check if page contains package selection questions
    return page.Sections?.some(section =>
        section.Questions?.some(question =>
            questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
            question.type === 'package-selection' ||
            question.type === 'radio-ndis'
        )
    );
};

/**
 * Packages page completion for returning guests
 * Requires that user has visited the page to review auto-selected packages
 */
const calculatePackagesPageCompletion = (page, context) => {
    const { visitedPages, pagesWithSavedData } = context;

    // CRITICAL: User must have visited the page at least once
    // This ensures they've seen and can review the auto-selected package
    const hasBeenVisited = visitedPages.has(page.id);
    
    if (!hasBeenVisited) {
        console.log(`📦 Packages page not complete - user hasn't visited yet:`, {
            pageId: page.id,
            pageTitle: page.title
        });
        return false;
    }

    // Check if page has real interaction indicators
    const hasSavedData = pagesWithSavedData.has(page.id);
    const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
    
    // Since auto-select may have created QaPairs, we need to be more flexible
    // User visited + (has saved data OR has QaPairs) = complete
    if (hasSavedData || hasRealQaPairs) {
        console.log(`📦 Packages page complete - user visited and has data:`, {
            pageId: page.id,
            pageTitle: page.title,
            hasSavedData,
            hasRealQaPairs
        });
        return true;
    }

    // If user visited but no data, check if all required questions are answered
    // This handles cases where auto-select populated answers but didn't trigger save flags
    const allRequiredAnswered = checkAllRequiredQuestionsAnswered(page);
    
    console.log(`📦 Packages page completion check:`, {
        pageId: page.id,
        pageTitle: page.title,
        hasBeenVisited,
        hasSavedData,
        hasRealQaPairs,
        allRequiredAnswered,
        isComplete: allRequiredAnswered
    });
    
    return allRequiredAnswered;
};

/**
 * Equipment page completion for returning guests
 * Updated to handle the verification question for returning guests
 */
const calculateEquipmentPageCompletion = (page, context) => {
    const { 
        equipmentPageCompleted, 
        equipmentChangesState, 
        visitedPages, 
        pagesWithSavedData 
    } = context;

    // Check if page has been visited and has saved data
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    
    // If no interaction at all, definitely not complete
    if (!hasBeenVisited && !hasSavedData && (!equipmentChangesState || equipmentChangesState.length === 0)) {
        return false;
    }

    // Check for the verification question that's added for returning guests
    const hasVerificationQuestion = page.Sections?.some(section => 
        section.Questions?.some(question => 
            question.question_key === 'i-verify-all-the-information-above-is-true-and-updated' &&
            question.type === 'simple-checkbox'
        )
    );

    if (hasVerificationQuestion) {
        // For returning guests with verification question, we need to check:
        // 1. Equipment was completed from previous booking OR user made changes
        // 2. Verification question is answered
        
        const equipmentBaseCompleted = equipmentPageCompleted || 
            (equipmentChangesState && equipmentChangesState.length > 0);
        
        // Find and check the verification question
        let verificationAnswered = false;
        
        for (const section of page.Sections) {
            for (const question of section.Questions || []) {
                if (question.question_key === 'i-verify-all-the-information-above-is-true-and-updated' &&
                    question.type === 'simple-checkbox') {
                    
                    // Check if verification question is answered
                    verificationAnswered = question.answer === true || question.answer === "1" || question.answer === 1;
                    break;
                }
            }
            if (verificationAnswered) break;
        }

        // Both conditions must be met
        const isComplete = equipmentBaseCompleted && verificationAnswered;
        
        console.log(`🔧 Equipment completion for returning guest:`, {
            equipmentBaseCompleted,
            verificationAnswered,
            isComplete,
            pageId: page.id
        });
        
        return isComplete;
    } else {
        // No verification question - use original logic
        
        // If equipment was already completed in previous booking, consider it complete
        if (equipmentPageCompleted) {
            return true;
        }

        // Check if user has made equipment changes in current session
        if (equipmentChangesState && equipmentChangesState.length > 0) {
            return true;
        }

        // If no verification question and no base completion, check if all questions answered
        return checkAllRequiredQuestionsAnswered(page);
    }
};

/**
 * NDIS page completion specifically for returning guests
 */
const calculateNdisPageCompletionForReturningGuest = (page, context) => {
    const { visitedPages, pagesWithSavedData } = context;
    
    // Check real interaction indicators
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
    
    // Must have some form of real interaction
    if (!hasBeenVisited && !hasSavedData && !hasRealQaPairs) {
        return false;
    }

    // Check if all required questions are answered with corresponding QaPairs
    return checkAllRequiredQuestionsAnsweredWithQaPairs(page);
};

/**
 * Standard page completion for returning guests
 */
const calculateStandardPageCompletionForReturningGuest = (page, context) => {
    const { visitedPages, pagesWithSavedData } = context;
    
    // Check interaction indicators
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
    
    // RELAXED: Allow completion with ANY form of interaction
    if (!hasBeenVisited && !hasSavedData && !hasRealQaPairs) {
        return false;
    }

    // If page has saved data, check if questions are answered (with or without QaPairs)
    if (hasSavedData) {
        return checkAllRequiredQuestionsAnswered(page);
    }

    // If page was visited or has real QaPairs, require QaPairs backing
    return checkAllRequiredQuestionsAnsweredWithQaPairs(page);
};

/**
 * Check if page has real user interaction QaPairs (not just prefilled data)
 */
const hasRealUserInteractionQaPairs = (page) => {
    return page.Sections?.some(section => 
        section.QaPairs && section.QaPairs.length > 0 && 
        section.QaPairs.some(qaPair => 
            // Real interaction indicators
            qaPair.createdAt || 
            qaPair.updatedAt || 
            qaPair.dirty || 
            // NOT temporary prefill data
            (!qaPair.temporaryFromPreviousBooking && !qaPair.prefill)
        )
    ) || false;
};

/**
 * Check if all required questions are answered (basic check)
 */
const checkAllRequiredQuestionsAnswered = (page) => {
    let totalRequired = 0;
    let answeredRequired = 0;

    for (const section of page.Sections) {
        if (section.hidden) continue;

        for (const question of section.Questions || []) {
            if (question.hidden || !question.required) continue;

            totalRequired++;

            if (isQuestionAnswered(question)) {
                answeredRequired++;
            }
        }
    }

    return totalRequired > 0 && answeredRequired === totalRequired;
};

/**
 * Check if all required questions are answered AND have corresponding QaPairs
 */
const checkAllRequiredQuestionsAnsweredWithQaPairs = (page) => {
    let totalRequired = 0;
    let answeredWithQaPairs = 0;

    for (const section of page.Sections) {
        if (section.hidden) continue;

        for (const question of section.Questions || []) {
            if (question.hidden || !question.required) continue;

            totalRequired++;

            const isAnswered = isQuestionAnswered(question);
            const hasQaPair = questionHasSavedQaPairs(question, section);

            // For returning guests, both answer AND QaPair are required
            if (isAnswered && hasQaPair) {
                answeredWithQaPairs++;
            }
        }
    }

    return totalRequired > 0 && answeredWithQaPairs === totalRequired;
};

/**
 * Check if a question is properly answered based on its type
 */
const isQuestionAnswered = (question) => {
    if (question.type === 'checkbox' || question.type === 'checkbox-button') {
        let answerArray = question.answer;
        if (typeof answerArray === 'string' && answerArray.startsWith('[')) {
            try {
                answerArray = JSON.parse(answerArray);
            } catch (e) {
                answerArray = [];
            }
        }
        return Array.isArray(answerArray) && answerArray.length > 0;
    } 
    
    if (question.type === 'multi-select') {
        return Array.isArray(question.answer) && question.answer.length > 0;
    }
    
    if (question.type === 'simple-checkbox') {
        return question.answer === true || question.answer === "1" || question.answer === 1;
    }
    
    if (question.type === 'equipment') {
        return question.answer !== null && question.answer !== undefined && question.answer !== '';
    }
    
    // Standard answer check
    return question.answer !== null && 
           question.answer !== undefined && 
           question.answer !== '';
};

/**
 * Check if question has corresponding saved QaPairs
 */
const questionHasSavedQaPairs = (question, section) => {
    if (!section.QaPairs || section.QaPairs.length === 0) {
        return false;
    }
    
    return section.QaPairs.some(qaPair => {
        // Match by question text, question_id, or question_key
        return qaPair.question === question.question ||
               qaPair.question_id === question.id ||
               qaPair.question_id === question.question_id ||
               qaPair.Question?.question_key === question.question_key;
    });
};

/**
 * Batch update page completions for returning guests
 * Use this instead of individual calculations to ensure consistency
 */
export const batchUpdateReturningGuestCompletions = (pages, context) => {
    if (context.currentBookingType !== BOOKING_TYPES.RETURNING_GUEST || !context.prevBookingId) {
        return pages; // No changes for non-returning guests
    }

    return pages.map(page => {
        const wasCompleted = page.completed;
        const newCompleted = calculateReturningGuestPageCompletion(page, context);
        
        // if (wasCompleted !== newCompleted) {
        //     console.log(`📊 RETURNING GUEST: Page "${page.title}" completion: ${wasCompleted} → ${newCompleted}`);
        // }
        
        return { ...page, completed: newCompleted };
    });
};

/**
 * Force update a specific page completion for returning guests
 */
export const forceUpdateReturningGuestPageCompletion = (pages, pageId, context) => {
    if (context.currentBookingType !== BOOKING_TYPES.RETURNING_GUEST || !context.prevBookingId) {
        return pages;
    }

    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) {
        return pages;
    }

    const updatedPages = [...pages];
    const page = updatedPages[pageIndex];
    const wasCompleted = page.completed;
    const newCompleted = calculateReturningGuestPageCompletion(page, context);
    
    if (wasCompleted !== newCompleted) {
        console.log(`🎯 FORCE UPDATE: Page "${page.title}" completion: ${wasCompleted} → ${newCompleted}`);
        updatedPages[pageIndex] = { ...page, completed: newCompleted };
        return updatedPages;
    }
    
    return pages;
};

/**
 * Debug helper to analyze completion state for returning guests
 */
export const debugReturningGuestCompletion = (pages, context) => {
    if (context.currentBookingType !== BOOKING_TYPES.RETURNING_GUEST) {
        console.log('🚫 Not a returning guest - debug skipped');
        return;
    }

    console.log('🔍 RETURNING GUEST COMPLETION DEBUG');
    console.log('Context:', {
        visitedPages: Array.from(context.visitedPages || []),
        pagesWithSavedData: Array.from(context.pagesWithSavedData || []),
        equipmentPageCompleted: context.equipmentPageCompleted,
        prevBookingId: context.prevBookingId
    });

    pages.forEach(page => {
        const completion = calculateReturningGuestPageCompletion(page, context);
        const hasVisited = context.visitedPages?.has(page.id);
        const hasSaved = context.pagesWithSavedData?.has(page.id);
        const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
        const isPackages = isPackagesPage(page);
        
        console.log(`📄 Page: ${page.title}`, {
            id: page.id,
            completed: completion,
            visited: hasVisited,
            savedData: hasSaved,
            realQaPairs: hasRealQaPairs,
            isPackagesPage: isPackages,
            currentCompleted: page.completed
        });
    });
};

/**
 * Validation helper to ensure completion consistency
 */
export const validateReturningGuestCompletionConsistency = (pages, context) => {
    const issues = [];
    
    if (context.currentBookingType !== BOOKING_TYPES.RETURNING_GUEST) {
        return { isValid: true, issues: [] };
    }

    pages.forEach(page => {
        const expectedCompletion = calculateReturningGuestPageCompletion(page, context);
        const actualCompletion = page.completed;
        
        if (expectedCompletion !== actualCompletion) {
            issues.push({
                pageId: page.id,
                pageTitle: page.title,
                expected: expectedCompletion,
                actual: actualCompletion,
                message: `Page completion mismatch: expected ${expectedCompletion}, got ${actualCompletion}`
            });
        }
    });

    return {
        isValid: issues.length === 0,
        issues
    };
};
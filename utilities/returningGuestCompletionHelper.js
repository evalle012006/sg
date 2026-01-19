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

    // ✅ CRITICAL: Check for validation errors FIRST - this takes precedence over everything
    const hasValidationErrors = page.Sections?.some(section =>
        section.Questions?.some(question =>
            !question.hidden && // Only check visible questions
            question.error && 
            question.error !== ''
        )
    );
    
    if (hasValidationErrors) {
        console.log(`❌ [Returning Guest] Page "${page.title}" has validation errors - marking as incomplete`);
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

    // Check if page has real interaction indicators
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
    
    // ✅ NEW: Check if Packages page has questions with saved answers (fromQa: true)
    // This indicates a package was previously selected and saved
    const hasSavedPackageSelection = page.Sections?.some(section =>
        section.Questions?.some(question =>
            (question.type === 'package-selection' || question.type === 'package-selection-multi') &&
            question.fromQa === true && 
            question.answer !== null && 
            question.answer !== undefined && 
            question.answer !== ''
        )
    );
    
    // ✅ NEW: Also check QaPairs directly for saved package selections
    const hasQaPairWithPackageSelection = page.Sections?.some(section =>
        section.QaPairs?.some(qaPair =>
            (qaPair.question_type === 'package-selection' || 
             qaPair.question_type === 'package-selection-multi' ||
             qaPair.Question?.type === 'package-selection' ||
             qaPair.Question?.type === 'package-selection-multi') &&
            qaPair.answer !== null && 
            qaPair.answer !== undefined && 
            qaPair.answer !== '' &&
            (qaPair.createdAt || qaPair.updatedAt) // Has been saved to DB
        )
    );

    console.log(`📦 Packages page completion check:`, {
        pageId: page.id,
        pageTitle: page.title,
        hasBeenVisited,
        hasSavedData,
        hasRealQaPairs,
        hasSavedPackageSelection,
        hasQaPairWithPackageSelection
    });

    // ✅ UPDATED: If there's a saved package selection (from previous booking),
    // mark as complete without requiring a visit
    if (hasSavedPackageSelection || hasQaPairWithPackageSelection) {
        // Verify the package selection answer is still valid
        const allRequiredAnswered = checkAllRequiredQuestionsAnswered(page);
        
        if (allRequiredAnswered) {
            console.log(`📦 Packages page complete - has saved package selection:`, {
                pageId: page.id,
                hasSavedPackageSelection,
                hasQaPairWithPackageSelection
            });
            return true;
        }
    }

    // Original logic: User must have visited the page at least once
    // This ensures they've seen and can review the auto-selected package
    if (!hasBeenVisited) {
        console.log(`📦 Packages page not complete - user hasn't visited yet and no saved selection:`, {
            pageId: page.id,
            pageTitle: page.title
        });
        return false;
    }

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
    
    console.log(`📦 Packages page final completion check:`, {
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
 * For returning guests: If acknowledgement equipments are saved in database,
 * the page should be marked as complete regardless of page visits or changes
 */
const calculateEquipmentPageCompletion = (page, context) => {
    const { 
        equipmentPageCompleted, 
        equipmentChangesState, 
        visitedPages, 
        pagesWithSavedData 
    } = context;

    // CRITICAL: For returning guests, if the API says equipment acknowledgements
    // are saved in the database (equipmentPageCompleted = true), 
    // then the page is complete - this persists across refreshes
    if (equipmentPageCompleted === true) {
        return true;
    }

    // Check if page has been visited and has saved data
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    
    // If no interaction at all and no saved acknowledgements, definitely not complete
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
        // For returning guests with verification question:
        // Check if user made changes OR if verification question is answered
        
        const hasEquipmentChanges = equipmentChangesState && equipmentChangesState.length > 0;
        
        // Find and check the verification question
        let verificationAnswered = false;
        
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                if (question.question_key === 'i-verify-all-the-information-above-is-true-and-updated' &&
                    question.type === 'simple-checkbox') {
                    verificationAnswered = question.answer === true || 
                                          question.answer === "1" || 
                                          question.answer === 1;
                    break;
                }
            }
            if (verificationAnswered) break;
        }

        // Complete if verification answered OR if equipment changes were made and saved
        const isComplete = verificationAnswered || (hasEquipmentChanges && hasSavedData);
        
        console.log(`🔧 Equipment completion for returning guest:`, {
            equipmentPageCompleted,
            hasEquipmentChanges,
            verificationAnswered,
            hasSavedData,
            isComplete,
            pageId: page.id
        });
        
        return isComplete;
    } else {
        // No verification question - check if user has made and saved equipment changes
        if (equipmentChangesState && equipmentChangesState.length > 0 && hasSavedData) {
            return true;
        }

        // Fallback: check if all required questions answered
        return checkAllRequiredQuestionsAnswered(page);
    }
};

/**
 * NDIS page completion specifically for returning guests
 * UPDATED: Recognizes questions moved from saved QaPairs even on initial load
 */
const calculateNdisPageCompletionForReturningGuest = (page, context) => {
    const { visitedPages, pagesWithSavedData } = context;
    
    // ✅ ADD: Extra safety check for NDIS page existence
    if (!page || !page.Sections || page.Sections.length === 0) {
        console.log('⚠️ NDIS page not fully initialized yet, returning false');
        return false;
    }
    
    // Check real interaction indicators
    const hasBeenVisited = visitedPages.has(page.id);
    const hasSavedData = pagesWithSavedData.has(page.id);
    const hasRealQaPairs = hasRealUserInteractionQaPairs(page);
    
    // ✅ NEW: Check if NDIS page has questions that were moved from saved QaPairs
    // These questions have fromQa: true and have answers, indicating they came from
    // saved data in the original booking
    const hasMovedQuestionsWithSavedAnswers = page.Sections?.some(section =>
        section.Questions?.some(question =>
            question.fromQa === true && 
            question.answer !== null && 
            question.answer !== undefined && 
            question.answer !== ''
        )
    );
    
    // ✅ UPDATED: Include hasMovedQuestionsWithSavedAnswers as a valid interaction indicator
    // This allows NDIS page to be complete on initial load if questions were moved
    // from saved QaPairs
    if (!hasBeenVisited && !hasSavedData && !hasRealQaPairs && !hasMovedQuestionsWithSavedAnswers) {
        console.log('❌ NDIS page has no interaction indicators');
        return false;
    }

    // ✅ NEW: If we have moved questions with saved answers, use simpler check
    // that doesn't require QaPairs (since moved questions won't have QaPairs on NDIS page)
    if (hasMovedQuestionsWithSavedAnswers && !hasBeenVisited) {
        // For initial load with moved questions, just check if all visible required questions are answered
        const allRequiredAnswered = checkAllRequiredQuestionsAnswered(page);
        console.log(`✅ NDIS page completion (moved questions check): ${allRequiredAnswered}`);
        return allRequiredAnswered;
    }

    // Check if all required questions are answered with corresponding QaPairs
    const result = checkAllRequiredQuestionsAnsweredWithQaPairs(page);
    console.log(`✅ NDIS page completion result: ${result}`);
    return result;
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
        const allRequiredAnswered = checkAllRequiredQuestionsAnswered(page);
        return allRequiredAnswered;
    }

    const allRequiredAnsweredWithQaPairs = checkAllRequiredQuestionsAnsweredWithQaPairs(page);
    // If page was visited or has real QaPairs, require QaPairs backing
    return allRequiredAnsweredWithQaPairs;
};

/**
 * Check if page has real user interaction QaPairs (not just prefilled data)
 */
const hasRealUserInteractionQaPairs = (page) => {
    return page.Sections?.some(section => {
        // Check 1: Traditional QaPairs array
        const hasQaPairsWithData = section.QaPairs && section.QaPairs.length > 0 && 
            section.QaPairs.some(qaPair => 
                qaPair.createdAt || 
                qaPair.updatedAt || 
                qaPair.dirty || 
                (!qaPair.temporaryFromPreviousBooking && !qaPair.prefill)
            );
        
        if (hasQaPairsWithData) return true;
        
        // Check 2: Questions with fromQa flag (answers loaded from saved QaPairs)
        const hasQuestionsFromQa = section.Questions?.some(question =>
            question.fromQa === true && 
            question.answer !== null && 
            question.answer !== undefined && 
            question.answer !== '' &&
            !question.temporaryFromPreviousBooking &&
            !question.prefill
        );
        
        if (hasQuestionsFromQa) return true;
        
        // ✅ Check 3: NEW - Recently answered questions (dirty but not yet saved as QaPairs)
        // This is critical for NDIS page and other dynamic pages where users answer
        // questions that haven't been saved to QaPairs yet
        const hasDirtyAnsweredQuestions = section.Questions?.some(question =>
            question.dirty === true && 
            question.answer !== null && 
            question.answer !== undefined && 
            question.answer !== '' &&
            !question.temporaryFromPreviousBooking &&
            !question.prefill
        );
        
        if (hasDirtyAnsweredQuestions) {
            return true;
        }
        
        return false;
    }) || false;
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
 * RELAXED for NDIS page: Accept dirty answered questions even without QaPairs
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
            
            // ✅ NEW: For NDIS page specifically, also accept dirty answered questions
            // This allows completion before save, since NDIS questions are moved dynamically
            const isDirtyAnswered = page.id === 'ndis_packages_page' && 
                                   question.dirty === true && 
                                   isAnswered;

            // For returning guests, require QaPair OR (for NDIS page) dirty answered
            if (isAnswered && (hasQaPair || isDirtyAnswered)) {
                answeredWithQaPairs++;
            }
        }
    }

    const result = totalRequired > 0 && answeredWithQaPairs === totalRequired;
    
    if (page.id === 'ndis_packages_page') {
        console.log('📋 NDIS page detailed check:', {
            totalRequired,
            answeredWithQaPairs,
            result,
            sections: page.Sections?.map(s => ({
                sectionId: s.id,
                hidden: s.hidden,
                questions: s.Questions?.map(q => ({
                    question: q.question?.substring(0, 50),
                    required: q.required,
                    hidden: q.hidden,
                    answered: isQuestionAnswered(q),
                    hasQaPair: questionHasSavedQaPairs(q, s),
                    dirty: q.dirty
                }))
            }))
        });
    }
    
    return result;
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
    // Check 1: Question itself has fromQa flag (loaded from QaPair during template load)
    if (question.fromQa === true && 
        question.answer !== null && 
        question.answer !== undefined && 
        question.answer !== '') {
        return true;
    }
    
    // Check 2: Traditional QaPairs array lookup
    if (!section.QaPairs || section.QaPairs.length === 0) {
        return false;
    }
    
    return section.QaPairs.some(qaPair => {
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
        
        if (wasCompleted !== newCompleted) {
            console.log(`📊 RETURNING GUEST: Page "${page.title}" completion: ${wasCompleted} → ${newCompleted}`);
        }
        
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
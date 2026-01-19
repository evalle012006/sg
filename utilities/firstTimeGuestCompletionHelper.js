/**
 * SINGLE SOURCE OF TRUTH for First Time Guest Page Completion
 * Similar to returningGuestCompletionHelper.js but for new bookings
 */

import { QUESTION_KEYS, questionHasKey } from '../services/booking/question-helper';
import { BOOKING_TYPES } from '../components/constants';

/**
 * Core completion calculator for first-time guests
 * This is the ONLY function that should determine completion for first-time guests
 */
export const calculateFirstTimeGuestPageCompletion = (
    page, 
    context = {}
) => {
    const {
        visitedPages = new Set(),
        pagesWithSavedData = new Set(),
        completedEquipments = false, // API flag for equipment completion
        currentBookingType = null
    } = context;

    // Only apply this logic for first-time guests
    if (currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
        return false; // Should not be used for returning guests
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
        console.log(`❌ Page "${page.title}" has validation errors - marking as incomplete`);
        return false;
    }

    // SPECIAL CASE 1: Equipment Page - use API flag
    if (page.title === 'Equipment') {
        return calculateEquipmentPageCompletionForFirstTime(page, {
            completedEquipments,
            visitedPages,
            pagesWithSavedData
        });
    }

    // SPECIAL CASE 2: NDIS Requirements Page
    if (page.id === 'ndis_packages_page') {
        return calculateNdisPageCompletionForFirstTime(page, {
            visitedPages,
            pagesWithSavedData
        });
    }

    // SPECIAL CASE 3: Packages Page
    if (isPackagesPage(page)) {
        return calculatePackagesPageCompletionForFirstTime(page, {
            visitedPages,
            pagesWithSavedData
        });
    }

    // STANDARD CASE: Regular Pages - based on required and not hidden questions
    return calculateStandardPageCompletionForFirstTime(page, {
        visitedPages,
        pagesWithSavedData
    });
};

/**
 * Equipment page completion for first-time guests
 * Uses the completedEquipments API flag as the source of truth
 */
const calculateEquipmentPageCompletionForFirstTime = (page, context) => {
    const { completedEquipments, visitedPages, pagesWithSavedData } = context;

    // For first-time guests, rely on the API flag completedEquipments
    return completedEquipments === true;
};

/**
 * NDIS page completion specifically for first-time guests
 * Based on required and not hidden questions
 */
const calculateNdisPageCompletionForFirstTime = (page, context) => {
    // For first-time guests, check if all required questions are answered
    return checkAllRequiredQuestionsAnswered(page);
};

/**
 * Check if this is a packages page
 */
const isPackagesPage = (page) => {
    return page.Sections?.some(section =>
        section.Questions?.some(question =>
            questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
            question.type === 'package-selection' ||
            question.type === 'radio-ndis'
        )
    );
};

/**
 * Packages page completion for first-time guests
 * Based on required and not hidden questions
 */
const calculatePackagesPageCompletionForFirstTime = (page, context) => {
    // For first-time guests, check if all required questions are answered
    return checkAllRequiredQuestionsAnswered(page);
};

/**
 * Standard page completion for first-time guests
 * Based on required and not hidden questions only
 */
const calculateStandardPageCompletionForFirstTime = (page, context) => {
    // For first-time guests, simply check if all required questions are answered
    return checkAllRequiredQuestionsAnswered(page);
};

/**
 * Check if all required and not hidden questions are answered
 * This is the core logic for first-time guest completion
 */
const checkAllRequiredQuestionsAnswered = (page) => {
    let totalRequired = 0;
    let answeredRequired = 0;

    for (const section of page.Sections) {
        if (section.hidden) continue;

        for (const question of section.Questions || []) {
            // Skip hidden questions and non-required questions
            if (question.hidden || !question.required) continue;

            totalRequired++;

            if (isQuestionAnswered(question)) {
                answeredRequired++;
            }
        }
    }

    const isComplete = totalRequired > 0 && answeredRequired === totalRequired;
    
    return isComplete;
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
 * Batch update page completions for first-time guests
 * Use this instead of individual calculations to ensure consistency
 */
export const batchUpdateFirstTimeGuestCompletions = (pages, context) => {
    if (context.currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
        return pages; // No changes for returning guests
    }

    return pages.map(page => {
        const wasCompleted = page.completed;
        const newCompleted = calculateFirstTimeGuestPageCompletion(page, context);
        
        // if (wasCompleted !== newCompleted) {
        //     console.log(`📊 FIRST-TIME GUEST: Page "${page.title}" completion: ${wasCompleted} → ${newCompleted}`);
        // }
        
        return { ...page, completed: newCompleted };
    });
};

/**
 * Force update a specific page completion for first-time guests
 */
export const forceUpdateFirstTimeGuestPageCompletion = (pages, pageId, context) => {
    if (context.currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
        return pages; // Should not be used for returning guests
    }

    const pageIndex = pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) {
        return pages;
    }

    const updatedPages = [...pages];
    const page = updatedPages[pageIndex];
    const wasCompleted = page.completed;
    const newCompleted = calculateFirstTimeGuestPageCompletion(page, context);
    
    if (wasCompleted !== newCompleted) {
        // console.log(`🎯 FORCE UPDATE: Page "${page.title}" completion: ${wasCompleted} → ${newCompleted}`);
        updatedPages[pageIndex] = { ...page, completed: newCompleted };
        return updatedPages;
    }
    
    return pages;
};

/**
 * Debug helper to analyze completion state for first-time guests
 */
export const debugFirstTimeGuestCompletion = (pages, context) => {
    if (context.currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
        return;
    }

    console.log('🔍 FIRST-TIME GUEST COMPLETION DEBUG');
    console.log('Context:', {
        visitedPages: Array.from(context.visitedPages || []),
        pagesWithSavedData: Array.from(context.pagesWithSavedData || []),
        completedEquipments: context.completedEquipments,
        currentBookingType: context.currentBookingType
    });

    pages.forEach(page => {
        const completion = calculateFirstTimeGuestPageCompletion(page, context);
        const hasVisited = context.visitedPages?.has(page.id);
        const hasSaved = context.pagesWithSavedData?.has(page.id);
        const isPackages = isPackagesPage(page);
        
        console.log(`📄 Page: ${page.title}`, {
            id: page.id,
            completed: completion,
            visited: hasVisited,
            savedData: hasSaved,
            isPackagesPage: isPackages,
            currentCompleted: page.completed
        });
    });
};

/**
 * Validation helper to ensure completion consistency for first-time guests
 */
export const validateFirstTimeGuestCompletionConsistency = (pages, context) => {
    const issues = [];
    
    if (context.currentBookingType === BOOKING_TYPES.RETURNING_GUEST) {
        return { isValid: true, issues: [] };
    }

    pages.forEach(page => {
        const expectedCompletion = calculateFirstTimeGuestPageCompletion(page, context);
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
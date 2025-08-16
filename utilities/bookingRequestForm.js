import { QUESTION_KEYS, questionHasKey, questionMatches } from '../services/booking/question-helper';

/**
 * Helper function to detect NDIS funding from QaPairs during template load
 * @param {Array} sections - Array of sections with QaPairs
 * @returns {boolean} - True if NDIS funding detected
 */
export const detectNdisFundingFromQaPairs = (sections) => {
    for (const section of sections) {
        for (const qaPair of section.QaPairs || []) {
            if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                return qaPair.answer?.toLowerCase().includes('ndis') || qaPair.answer?.toLowerCase().includes('ndia');
            }
        }
    }
    return false;
};

/**
 * Check if a specific question's dependencies are working correctly
 * @param {Object} question - The question to check
 * @param {Array} allPages - All form pages
 * @returns {Object} - Dependency analysis result
 */
export const checkQuestionDependencyStatus = (question, allPages) => {
    const result = {
        questionTitle: question.question,
        questionKey: question.question_key,
        hasDependencies: question.QuestionDependencies && question.QuestionDependencies.length > 0,
        dependencyResults: [],
        shouldShow: false,
        currentVisibility: !question.hidden
    };
    
    if (!result.hasDependencies) {
        result.shouldShow = true;
        return result;
    }
    
    question.QuestionDependencies.forEach(dependency => {
        const depResult = {
            dependence_id: dependency.dependence_id,
            expected_answer: dependency.answer,
            found: false,
            foundQuestion: null,
            foundAnswer: null,
            foundLocation: null,
            matches: false
        };
        
        // Search for the dependency across all pages
        allPages.forEach(page => {
            page.Sections?.forEach(section => {
                // Check Questions array
                section.Questions?.forEach(searchQuestion => {
                    const questionMatches = 
                        (searchQuestion.question_id === dependency.dependence_id) ||
                        (searchQuestion.id === dependency.dependence_id) ||
                        (searchQuestion.question_key && searchQuestion.question_key === dependency.dependence_id);
                        
                    if (questionMatches) {
                        depResult.found = true;
                        depResult.foundQuestion = searchQuestion.question;
                        depResult.foundAnswer = searchQuestion.answer;
                        depResult.foundLocation = `${page.title} > ${section.label}`;
                        depResult.matches = searchQuestion.answer === dependency.answer ||
                            (Array.isArray(searchQuestion.answer) && searchQuestion.answer.includes(dependency.answer));
                    }
                });
                
                // Check QaPairs array
                section.QaPairs?.forEach(qaPair => {
                    const searchQuestion = qaPair.Question;
                    const questionMatches = 
                        (qaPair.question_id === dependency.dependence_id) ||
                        (searchQuestion?.question_key && searchQuestion.question_key === dependency.dependence_id);
                        
                    if (questionMatches && !depResult.found) {
                        depResult.found = true;
                        depResult.foundQuestion = searchQuestion?.question || qaPair.question;
                        depResult.foundAnswer = qaPair.answer;
                        depResult.foundLocation = `${page.title} > ${section.label} (QaPair)`;
                        depResult.matches = qaPair.answer === dependency.answer ||
                            (Array.isArray(qaPair.answer) && qaPair.answer.includes(dependency.answer));
                    }
                });
            });
        });
        
        result.dependencyResults.push(depResult);
        
        // If any dependency matches, the question should show
        if (depResult.matches) {
            result.shouldShow = true;
        }
    });
    
    return result;
};

/**
 * Helper function to check if question should be moved to NDIS page
 * @param {Object} question - Question object
 * @param {boolean} isNdisFunded - Whether NDIS funding is detected
 * @returns {boolean} - True if question should be moved
 */
export const shouldMoveQuestionToNdisPage = (question, isNdisFunded) => {
    if (!isNdisFunded || !question.ndis_only) return false;
    
    // Don't move simple-checkbox questions
    if (question.type === 'simple-checkbox') return false;
    
    // Don't move specific questions that should stay on original pages
    const keepOnOriginalPage = ['i-acknowledge-additional-charges'];
    if (question.question_key && keepOnOriginalPage.includes(question.question_key)) {
        return false;
    }
    
    return true;
};

/**
 * Post-process pages to create NDIS page and filter original pages
 * @param {Array} pages - Array of pages
 * @param {boolean} isNdisFunded - Whether NDIS funding is detected
 * @param {Function} calculatePageCompletion - Function to calculate page completion
 * @returns {Array} - Processed pages with NDIS page if needed
 */
export const postProcessPagesForNdis = (pages, isNdisFunded, calculatePageCompletion) => {
    if (!isNdisFunded) return pages;
    
    const ndisQuestions = [];
    const filteredPages = [];
    let movedQuestionsCount = 0;
    
    // Find funding page index
    let fundingPageIndex = -1;
    for (let i = 0; i < pages.length; i++) {
        const hasFundingQuestion = pages[i].Sections?.some(section =>
            section.Questions?.some(question =>
                questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)
            )
        );
        if (hasFundingQuestion) {
            fundingPageIndex = i;
            break;
        }
    }
    
    // Process each page
    pages.forEach((page, pageIndex) => {
        const filteredSections = [];
        
        page.Sections.forEach(section => {
            const remainingQuestions = [];
            const remainingQaPairs = [];
            
            // Filter Questions array
            section.Questions?.forEach(question => {
                if (shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    movedQuestionsCount++;
                    
                    // Create section for NDIS page
                    const ndisSection = {
                        id: section.id,
                        orig_section_id: section.orig_section_id,
                        label: section.label || 'NDIS Requirements',
                        Questions: [{ ...question, hidden: false }],
                        QaPairs: []
                    };
                    ndisQuestions.push(ndisSection);
                } else {
                    remainingQuestions.push(question);
                }
            });
            
            // Filter QaPairs array
            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                if (question && shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    movedQuestionsCount++;
                    
                    // Find or create section for NDIS page
                    let ndisSection = ndisQuestions.find(ns => ns.id === section.id);
                    if (!ndisSection) {
                        ndisSection = {
                            id: section.id,
                            orig_section_id: section.orig_section_id,
                            label: section.label || 'NDIS Requirements',
                            Questions: [],
                            QaPairs: []
                        };
                        ndisQuestions.push(ndisSection);
                    }
                    
                    // Add to NDIS page
                    ndisSection.Questions.push({
                        ...question,
                        answer: qaPair.answer,
                        oldAnswer: qaPair.answer,
                        fromQa: true,
                        id: qaPair.id,
                        hidden: false
                    });
                    ndisSection.QaPairs.push(qaPair);
                } else {
                    remainingQaPairs.push(qaPair);
                }
            });
            
            // Only add section if it has remaining content
            if (remainingQuestions.length > 0 || remainingQaPairs.length > 0) {
                filteredSections.push({
                    ...section,
                    Questions: remainingQuestions,
                    QaPairs: remainingQaPairs
                });
            }
        });
        
        // Recalculate page completion after filtering
        const filteredPage = {
            ...page,
            Sections: filteredSections
        };
        
        // IMPORTANT: Preserve completion status if page was already completed
        if (page.completed) {
            filteredPage.completed = true;
        } else {
            filteredPage.completed = calculatePageCompletion(filteredPage);
        }
        
        filteredPages.push(filteredPage);
    });
    
    // Create NDIS page if we have NDIS questions
    if (ndisQuestions.length > 0 && fundingPageIndex !== -1) {
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
            completed: false, // Will be calculated
            noItems: ndisQuestions.reduce((total, section) => total + section.Questions.length, 0),
            dirty: false,
            hidden: false,
            template_id: pages[0]?.template_id || null
        };
        
        // Calculate completion for NDIS page
        ndisPage.completed = calculatePageCompletion(ndisPage);
        
        // Insert NDIS page after funding page
        filteredPages.splice(fundingPageIndex + 1, 0, ndisPage);
        
        // Update navigation properties
        filteredPages.forEach((page, index) => {
            page.hasNext = index < filteredPages.length - 1;
            page.hasBack = index > 0;
            page.lastPage = index === filteredPages.length - 1;
        });
    }
    
    return filteredPages;
};

/**
 * Check if NDIS processing is needed based on current form state
 * @param {Array} formData - Current form data
 * @param {boolean} isNdisFunded - Current NDIS funded state
 * @returns {Object} - Analysis of whether processing is needed
 */
export const analyzeNdisProcessingNeeds = (formData, isNdisFunded) => {
    // Check if NDIS page already exists
    const ndisPageExists = formData.some(page => page.id === 'ndis_packages_page');
    
    // Check if funding answer exists
    const hasFundingAnswer = formData.some(page =>
        page.Sections?.some(section =>
            section.Questions?.some(question =>
                questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) &&
                question.answer &&
                question.answer.trim() !== ''
            )
        )
    );
    
    return {
        ndisPageExists,
        hasFundingAnswer,
        shouldHaveNdisPage: isNdisFunded && hasFundingAnswer,
        needsProcessing: (isNdisFunded && hasFundingAnswer && !ndisPageExists) || 
                        (!isNdisFunded && ndisPageExists),
        templateAlreadyNdisAware: ndisPageExists && isNdisFunded
    };
};

/**
 * Enhanced function to process form data for NDIS packages with duplicate prevention
 * @param {Array} formData - Form data to process
 * @param {boolean} isNdisFunded - Whether NDIS funding is detected
 * @param {Function} calculatePageCompletion - Function to calculate page completion
 * @param {Function} applyQuestionDependenciesAcrossPages - Function to apply dependencies
 * @returns {Array} - Processed form data
 */
export const processFormDataForNdisPackages = (formData, isNdisFunded, calculatePageCompletion, applyQuestionDependenciesAcrossPages) => {
    // Find the funding page index
    let fundingPageIndex = -1;
    let fundingQuestionFound = false;
    let currentFundingAnswer = null;

    for (let i = 0; i < formData.length; i++) {
        const page = formData[i];
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)) {
                    fundingPageIndex = i;
                    fundingQuestionFound = true;
                    currentFundingAnswer = question.answer;
                    break;
                }
            }
            if (fundingQuestionFound) break;
        }
        if (fundingQuestionFound) break;
    }

    if (fundingPageIndex === -1) {
        return formData;
    }

    // Check if NDIS packages page already exists
    const ndisPageExists = formData.some(page => page.id === 'ndis_packages_page');
    const existingNdisPageIndex = formData.findIndex(page => page.id === 'ndis_packages_page');

    if (ndisPageExists && !isNdisFunded) {
        // Remove NDIS page if funding is not NDIS
        return formData.filter(page => page.id !== 'ndis_packages_page');
    } else if (ndisPageExists && isNdisFunded) {
        // NDIS page already exists and funding is NDIS, preserve it but apply dependencies
        const updatedFormData = formData.map(page => {
            if (page.id === 'ndis_packages_page') {
                // Apply dependencies to existing NDIS page
                const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, formData);
                pageWithDependencies.completed = calculatePageCompletion(pageWithDependencies);
                
                return pageWithDependencies;
            }
            return page;
        });
        return updatedFormData;
    }

    // Only create NDIS page if NDIS is funded
    if (!isNdisFunded) {
        return formData;
    }

    // ENHANCED: Collect all NDIS-only questions from all pages with improved deduplication
    const ndisQuestions = [];
    const updatedPages = [];
    let movedQuestionsCount = 0;
    const processedQuestionKeys = new Set(); // Track processed questions to avoid duplicates

    formData.forEach((page, pageIndex) => {
        const updatedSections = [];

        page.Sections.forEach(section => {
            const remainingQuestions = [];
            const remainingQaPairs = [];

            // STEP 1: Build a comprehensive map of all NDIS questions in this section
            const allNdisQuestions = new Map(); // key -> { question, source: 'QaPairs'|'Questions', data }

            // First, identify NDIS questions from QaPairs (answered questions)
            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                if (question && shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    const questionKey = question.question_key || question.question || question.id;
                    allNdisQuestions.set(questionKey, {
                        question,
                        source: 'QaPairs',
                        data: qaPair,
                        hasAnswer: true,
                        answer: qaPair.answer
                    });
                }
            });

            // Then, identify NDIS questions from Questions array (unanswered questions)
            section.Questions?.forEach(question => {
                if (shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    const questionKey = question.question_key || question.question || question.id;
                    
                    // Only add if not already found in QaPairs (prioritize answered questions)
                    if (!allNdisQuestions.has(questionKey)) {
                        allNdisQuestions.set(questionKey, {
                            question,
                            source: 'Questions',
                            data: question,
                            hasAnswer: false,
                            answer: question.answer
                        });
                    }
                }
            });

            // STEP 2: Move NDIS questions to NDIS page (deduplicated)
            allNdisQuestions.forEach((ndisQuestionInfo, questionKey) => {
                // Skip if already processed globally (avoid cross-section duplicates)
                if (processedQuestionKeys.has(questionKey)) {
                    return;
                }

                processedQuestionKeys.add(questionKey);
                movedQuestionsCount++;

                // Create question object for NDIS page
                const ndisQuestion = {
                    ...ndisQuestionInfo.question,
                    answer: ndisQuestionInfo.answer,
                    oldAnswer: ndisQuestionInfo.answer,
                    orig_section_id: section.orig_section_id,
                    section_id: section.id,
                    question_key: ndisQuestionInfo.question.question_key,
                    options: ndisQuestionInfo.question.options,
                    required: ndisQuestionInfo.question.required,
                    type: ndisQuestionInfo.question.type,
                    QuestionDependencies: ndisQuestionInfo.question.QuestionDependencies || [], // IMPORTANT: Preserve dependencies
                    hidden: false,
                    fromQa: ndisQuestionInfo.source === 'QaPairs',
                    question_id: ndisQuestionInfo.source === 'QaPairs' ? 
                        ndisQuestionInfo.data.question_id : 
                        (ndisQuestionInfo.question.id || ndisQuestionInfo.question.question_id),
                    id: ndisQuestionInfo.source === 'QaPairs' ? 
                        ndisQuestionInfo.data.id : 
                        ndisQuestionInfo.question.id
                };

                // Create or find section for NDIS page
                let existingNdisSection = ndisQuestions.find(ns => ns.id === section.id);
                if (!existingNdisSection) {
                    existingNdisSection = {
                        id: section.id,
                        orig_section_id: section.orig_section_id,
                        label: section.label || 'NDIS Requirements',
                        Questions: [],
                        QaPairs: []
                    };
                    ndisQuestions.push(existingNdisSection);
                }

                // Add question to NDIS section
                existingNdisSection.Questions.push(ndisQuestion);

                // Also preserve QaPair if it exists
                if (ndisQuestionInfo.source === 'QaPairs') {
                    existingNdisSection.QaPairs.push({
                        ...ndisQuestionInfo.data,
                        section_id: section.id
                    });
                }
            });

            // STEP 3: Filter original section to remove moved questions
            section.Questions?.forEach(question => {
                const questionKey = question.question_key || question.question || question.id;
                if (!allNdisQuestions.has(questionKey)) {
                    remainingQuestions.push(question);
                }
            });

            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                const questionKey = question ? (question.question_key || question.question || question.id) : null;
                if (!questionKey || !allNdisQuestions.has(questionKey)) {
                    remainingQaPairs.push(qaPair);
                }
            });

            // Only add section to updated page if it has remaining questions or QaPairs
            if (remainingQuestions.length > 0 || remainingQaPairs.length > 0) {
                updatedSections.push({
                    ...section,
                    Questions: remainingQuestions,
                    QaPairs: remainingQaPairs
                });
            }
        });

        // Add page to updated pages (even if all sections were removed)
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
            completed: false,
            noItems: ndisQuestions.reduce((total, section) => total + section.Questions.length, 0),
            dirty: false,
            hidden: false,
            template_id: formData[0]?.template_id || null
        };

        // Insert NDIS page after funding page
        const newFormData = [...updatedPages];
        newFormData.splice(fundingPageIndex + 1, 0, ndisPage);

        // ENHANCED: Apply dependencies to ALL pages including NDIS page
        const finalFormData = newFormData.map(page => {
            const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, newFormData);
            
            // Calculate completion status for each page
            pageWithDependencies.completed = calculatePageCompletion(pageWithDependencies);
            
            return pageWithDependencies;
        });

        // Update hasNext/hasBack and lastPage properties
        finalFormData.forEach((page, index) => {
            page.hasNext = index < finalFormData.length - 1;
            page.hasBack = index > 0;
            page.lastPage = index === finalFormData.length - 1;
        });

        return finalFormData;
    } else {
        return updatedPages;
    }
};

/**
 * Enhanced function to force dependency re-evaluation when NDIS questions change
 * @param {Array} allPages - All form pages  
 * @param {string} changedPageId - ID of the page that had changes
 * @param {Array} changedQuestions - Questions that were changed
 * @returns {Array} - Updated pages with dependencies applied
 */
export const forceRefreshDependencies = (allPages, changedPageId, changedQuestions = []) => {
    // Create a fresh copy of all pages and apply dependencies
    const updatedPages = allPages.map(page => {
        const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, allPages);
        
        return pageWithDependencies;
    });
    
    return updatedPages;
};

/**
 * Enhanced function to apply question dependencies across pages with better support for moved questions
 * @param {Object} targetPage - Page to apply dependencies to
 * @param {Array} allPages - All pages to search for dependencies
 * @returns {Object} - Updated page with dependencies applied
 */
export const applyQuestionDependenciesAcrossPages = (targetPage, allPages) => {
    if (!targetPage || !targetPage.Sections || !allPages) return targetPage;

    // Helper function to check if answers match
    const checkAnswerMatch = (actualAnswer, expectedAnswer) => {
        // Direct match
        if (actualAnswer === expectedAnswer) {
            return true;
        }

        // Handle array answers for multi-select questions
        if (Array.isArray(actualAnswer) && actualAnswer.includes(expectedAnswer)) {
            return true;
        }

        // Handle string array answers (JSON parsed)
        if (typeof actualAnswer === 'string') {
            try {
                const parsedAnswer = JSON.parse(actualAnswer);
                if (Array.isArray(parsedAnswer) && parsedAnswer.includes(expectedAnswer)) {
                    return true;
                }
            } catch (e) {
                // Not JSON, continue with other checks
            }
        }

        return false;
    };

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
                    let dependencyMet = false;
                    
                    // Look for the dependent question across ALL pages (including NDIS page)
                    allPages.forEach(searchPage => {
                        if (searchPage.Sections && !dependencyMet) {
                            searchPage.Sections.forEach(searchSection => {
                                // ENHANCED: Check Questions array with comprehensive matching
                                if (searchSection.Questions && !dependencyMet) {
                                    searchSection.Questions.forEach(searchQuestion => {
                                        if (dependencyMet) return; // Skip if already found
                                        
                                        // Enhanced matching: try ALL possible strategies
                                        const questionMatches = 
                                            // Strategy 1: Direct ID matches
                                            (searchQuestion.question_id === dependency.dependence_id) ||
                                            (searchQuestion.id === dependency.dependence_id) ||
                                            // Strategy 2: Question key matches
                                            (searchQuestion.question_key && searchQuestion.question_key === dependency.dependence_id) ||
                                            // Strategy 3: Cross-reference matching for moved questions
                                            (searchQuestion.question_key && 
                                             q.QuestionDependencies.some(dep => 
                                                dep.dependence_id === searchQuestion.question_id || 
                                                dep.dependence_id === searchQuestion.id ||
                                                dep.dependence_id === searchQuestion.question_key
                                             )) ||
                                            // Strategy 4: Fallback - exact question text match  
                                            (searchQuestion.question && searchQuestion.question === dependency.dependence_id);

                                        if (questionMatches) {
                                            const answerMatches = checkAnswerMatch(searchQuestion.answer, dependency.answer);

                                            if (answerMatches) {
                                                shouldShow = true;
                                                dependencyMet = true;
                                            }
                                        }
                                    });
                                }

                                // ENHANCED: Also check QaPairs for answered questions
                                if (searchSection.QaPairs && !dependencyMet) {
                                    searchSection.QaPairs.forEach(qaPair => {
                                        if (dependencyMet) return; // Skip if already found
                                        
                                        const searchQuestion = qaPair.Question || qaPair;
                                        
                                        // Enhanced matching for QaPairs  
                                        const questionMatches = 
                                            // Direct matches
                                            (qaPair.question_id === dependency.dependence_id) ||
                                            (qaPair.id === dependency.dependence_id) ||
                                            // Question object matches
                                            (searchQuestion.question_key && searchQuestion.question_key === dependency.dependence_id) ||
                                            (searchQuestion.question_id === dependency.dependence_id) ||
                                            (searchQuestion.id === dependency.dependence_id) ||
                                            // Text matches
                                            (searchQuestion.question === dependency.dependence_id) ||
                                            (qaPair.question === dependency.dependence_id);

                                        if (questionMatches) {
                                            const answerMatches = checkAnswerMatch(qaPair.answer, dependency.answer);

                                            if (answerMatches) {
                                                shouldShow = true;
                                                dependencyMet = true;
                                            }
                                        }
                                    });
                                }
                            });
                        }
                    });
                });

                // Set question visibility based on dependencies
                const wasHidden = q.hidden;
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

/**
 * Debug helper to analyze question dependencies for moved questions
 * @param {Array} allPages - All form pages
 * @param {boolean} isNdisFunded - NDIS funding status
 */
export const debugQuestionDependencies = (allPages, isNdisFunded) => {
    const dependencyMap = new Map();
    const questionMap = new Map();
    
    // First pass: catalog all questions
    allPages.forEach((page, pageIndex) => {
        page.Sections?.forEach((section, sectionIndex) => {
            section.Questions?.forEach((question, questionIndex) => {
                const questionKey = question.question_key || question.question || question.id;
                questionMap.set(question.id || question.question_id, {
                    question: question.question,
                    questionKey: question.question_key,
                    page: page.title,
                    pageId: page.id,
                    section: section.label,
                    answer: question.answer,
                    ndis_only: question.ndis_only,
                    dependencies: question.QuestionDependencies || []
                });
            });
            
            // Also check QaPairs
            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                if (question) {
                    questionMap.set(qaPair.question_id, {
                        question: question.question,
                        questionKey: question.question_key,
                        page: page.title,
                        pageId: page.id,
                        section: section.label,
                        answer: qaPair.answer,
                        ndis_only: question.ndis_only,
                        dependencies: question.QuestionDependencies || [],
                        isQaPair: true
                    });
                }
            });
        });
    });
};

/**
 * Validate processed data for duplicates and consistency
 * @param {Array} processedData - Processed form data to validate
 * @param {boolean} isNdisFunded - Whether NDIS funding is detected
 * @returns {Object} - Validation result with issues
 */
export const validateProcessedData = (processedData, isNdisFunded) => {
    const issues = [];
    const seenQuestions = new Set();
    
    processedData.forEach((page, pageIndex) => {
        page.Sections?.forEach((section, sectionIndex) => {
            section.Questions?.forEach((question, questionIndex) => {
                const questionKey = question.question_key || question.question || question.id;
                
                if (seenQuestions.has(questionKey)) {
                    issues.push({
                        type: 'duplicate_question',
                        message: `Duplicate question found: "${question.question}"`,
                        location: `Page ${pageIndex} (${page.title}), Section ${sectionIndex}, Question ${questionIndex}`,
                        questionKey
                    });
                } else {
                    seenQuestions.add(questionKey);
                }
                
                // Check for NDIS questions in wrong pages
                if (question.ndis_only && page.id !== 'ndis_packages_page') {
                    if (shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                        issues.push({
                            type: 'misplaced_ndis_question',
                            message: `NDIS-only question found outside NDIS page: "${question.question}"`,
                            location: `Page ${pageIndex} (${page.title}), Section ${sectionIndex}, Question ${questionIndex}`,
                            questionKey
                        });
                    }
                }
            });
        });
    });
    
    return {
        isValid: issues.length === 0,
        issues
    };
};

/**
 * Enhanced debug function for NDIS state
 * @param {Array} stableBookingRequestFormData - Current form data
 * @param {Array} stableProcessedFormData - Processed form data
 * @param {boolean} isNdisFunded - NDIS funding status
 * @param {boolean} isProcessingNdis - Processing status
 * @param {boolean} isUpdating - Update status
 */
export const debugNdisProcessingState = (stableBookingRequestFormData, stableProcessedFormData, isNdisFunded, isProcessingNdis, isUpdating) => {
    // Debug function can be implemented when needed for troubleshooting
};

/**
 * Better question deduplication during template loading
 * @param {Array} questions - Questions array
 * @param {Array} qaPairs - QaPairs array
 * @returns {Array} - Deduplicated questions
 */
export const deduplicateQuestions = (questions, qaPairs) => {
    const questionMap = new Map();
    const duplicateKeys = new Set();
    
    // First pass: identify all questions and mark duplicates
    questions.forEach(q => {
        const key = q.question_key || q.question || q.id;
        if (questionMap.has(key)) {
            duplicateKeys.add(key);
        }
        questionMap.set(key, { ...q, source: 'questions' });
    });
    
    qaPairs.forEach(qa => {
        const question = qa.Question;
        const key = question?.question_key || question?.question || qa.question_id;
        if (questionMap.has(key)) {
            duplicateKeys.add(key);
        }
        questionMap.set(key, { 
            ...question, 
            answer: qa.answer,
            oldAnswer: qa.answer,
            fromQa: true,
            id: qa.id,
            source: 'qaPairs' 
        });
    });
    
    // Second pass: resolve duplicates (prioritize answered questions)
    const resolvedQuestions = [];
    questionMap.forEach((question, key) => {
        if (duplicateKeys.has(key)) {
            // If duplicate, prioritize QaPairs (answered questions)
            if (question.source === 'qaPairs') {
                resolvedQuestions.push(question);
            }
        } else {
            resolvedQuestions.push(question);
        }
    });
    
    return resolvedQuestions;
};

/**
 * Check for NDIS funding status changes and return detailed change information
 * @param {Array} updatedPages - Updated pages to check
 * @param {boolean} isNdisFunded - Current NDIS funding status
 * @param {Function} dispatch - Redux dispatch function
 * @param {Object} bookingRequestFormActions - Redux actions
 * @returns {Object} - Detailed information about funding status changes
 */
export const checkAndUpdateNdisFundingStatus = (updatedPages, isNdisFunded, dispatch, bookingRequestFormActions) => {
    let fundingDetected = false;
    let newFundingStatus = isNdisFunded;
    let previousStatus = isNdisFunded;
    let fundingAnswer = null;

    // Check all pages for funding question answers
    for (const page of updatedPages) {
        for (const section of page.Sections || []) {
            // Check Questions array
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                    fundingAnswer = question.answer;
                    const isNdisAnswer = question.answer?.toLowerCase().includes('ndis') ||
                                       question.answer?.toLowerCase().includes('ndia');

                    if (isNdisAnswer && !isNdisFunded) {
                        dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                        newFundingStatus = true;
                        fundingDetected = true;
                    } else if (!isNdisAnswer && isNdisFunded) {
                        dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                        newFundingStatus = false;
                        fundingDetected = true;
                    }
                    break;
                }
            }
            
            // Also check QaPairs array
            if (!fundingDetected) {
                for (const qaPair of section.QaPairs || []) {
                    const question = qaPair.Question;
                    if (question && questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                        fundingAnswer = qaPair.answer;
                        const isNdisAnswer = qaPair.answer?.toLowerCase().includes('ndis') ||
                                           qaPair.answer?.toLowerCase().includes('ndia');

                        if (isNdisAnswer && !isNdisFunded) {
                            dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                            newFundingStatus = true;
                            fundingDetected = true;
                        } else if (!isNdisAnswer && isNdisFunded) {
                            dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                            newFundingStatus = false;
                            fundingDetected = true;
                        }
                        break;
                    }
                }
            }
            
            if (fundingDetected) break;
        }
        if (fundingDetected) break;
    }

    return {
        hasChanged: fundingDetected,
        previousStatus: previousStatus,
        newStatus: newFundingStatus,
        fundingAnswer: fundingAnswer,
        changedFromNdisToNonNdis: previousStatus === true && newFundingStatus === false,
        changedFromNonNdisToNdis: previousStatus === false && newFundingStatus === true
    };
};

/**
 * NDIS-aware version of convertQAtoQuestion that filters out NDIS questions that should be moved
 * @param {Array} qa_pairs - Array of QA pairs
 * @param {string} sectionId - Section ID
 * @param {boolean} returnee - Is returning guest
 * @param {string} pageTitle - Page title
 * @param {boolean} isNdisFunded - Whether NDIS funding is detected
 * @returns {Object} - Converted questions with NDIS filtering
 */
export const convertQAtoQuestionWithNdisFilter = (qa_pairs, sectionId, returnee, pageTitle, isNdisFunded = false) => {
    let questionList = [];
    let answered = false;

    qa_pairs.forEach(qa => {
        const question = qa.Question;
        
        // FILTER: Skip NDIS-only questions if NDIS is funded and they should be moved
        if (isNdisFunded && question.ndis_only === true && shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
            return; // Skip this question
        }

        let options = question.options;
        let answer = qa.answer;
        let url = '';

        // Rest of the conversion logic remains the same as original convertQAtoQuestion...
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
            ndis_only: question.ndis_only || false, // IMPORTANT: Preserve ndis_only flag
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
};

/**
 * Enhanced function to force refresh all dependencies with cascade support
 * @param {Array} allPages - All form pages
 * @returns {Array} - Updated pages with refreshed dependencies
 */
export const forceRefreshAllDependencies = (allPages) => {
    // console.log('🔄 Starting comprehensive dependency refresh with cascade support...');
    
    // Create a working copy of all pages
    let workingPages = structuredClone(allPages);
    
    // Build the initial answer map from current question states
    const buildAnswerMap = (pages) => {
        const answerMap = new Map();
        
        pages.forEach((page, pageIndex) => {
            page.Sections?.forEach((section, sectionIndex) => {
                // Process Questions array
                section.Questions?.forEach((question, questionIndex) => {
                    // Skip hidden questions - they shouldn't contribute to dependencies
                    if (question.hidden) {
                        return;
                    }
                    
                    const questionId = question.question_id || question.id;
                    const questionKey = question.question_key;
                    
                    // For moved questions (fromQa = true), get the original question ID
                    let originalQuestionId = questionId;
                    if (question.fromQa && section.QaPairs) {
                        const correspondingQaPair = section.QaPairs.find(qa => qa.id === question.id);
                        if (correspondingQaPair && correspondingQaPair.question_id) {
                            originalQuestionId = correspondingQaPair.question_id;
                        }
                    }
                    
                    const currentAnswer = question.answer;
                    
                    const answerData = {
                        answer: currentAnswer,
                        question: question.question,
                        questionKey: questionKey,
                        page: page.title,
                        section: section.label,
                        questionId: originalQuestionId,
                        originalQuestionId: originalQuestionId,
                        source: 'Questions',
                        hidden: question.hidden,
                        pageIndex,
                        sectionIndex,
                        questionIndex
                    };
                    
                    // Store by original question ID
                    if (originalQuestionId) {
                        answerMap.set(originalQuestionId, answerData);
                        answerMap.set(String(originalQuestionId), answerData);
                    }
                    
                    // Also store by question key
                    if (questionKey) {
                        answerMap.set(questionKey, answerData);
                    }
                });
                
                // Process QaPairs but only if we don't already have data from Questions
                section.QaPairs?.forEach(qaPair => {
                    const questionId = qaPair.question_id;
                    const question = qaPair.Question;
                    const questionKey = question?.question_key;
                    
                    // ENHANCED: Check if the corresponding question is hidden
                    const correspondingQuestion = section.Questions?.find(q => {
                        if (q.fromQa && q.id === qaPair.id) return true;
                        return q.question_id === questionId || q.id === questionId;
                    });
                    
                    // Skip QaPairs for hidden questions OR if we already have data from Questions
                    if (questionId && !answerMap.has(questionId) && (!correspondingQuestion || !correspondingQuestion.hidden)) {
                        const answerData = {
                            answer: qaPair.answer,
                            question: question?.question || qaPair.question,
                            questionKey: questionKey,
                            page: page.title,
                            section: section.label,
                            questionId: questionId,
                            originalQuestionId: questionId,
                            source: 'QaPairs',
                            hidden: false // QaPairs are considered available only if corresponding question isn't hidden
                        };
                        
                        answerMap.set(questionId, answerData);
                        answerMap.set(String(questionId), answerData);
                        
                        if (questionKey) {
                            answerMap.set(questionKey, answerData);
                        }
                        
                    } 
                    // else if (correspondingQuestion?.hidden) {
                    //     console.log(`⏭️ Skipping QaPair for hidden question ID ${questionId}: "${question?.question || qaPair.question}"`);
                    // }
                });
            });
        });
        
        return answerMap;
    };
    
    // Process dependencies in multiple passes to handle cascading
    let hasChanges = true;
    let passCount = 0;
    const maxPasses = 5; // Prevent infinite loops
    
    while (hasChanges && passCount < maxPasses) {
        hasChanges = false;
        passCount++;
        
        // console.log(`🔄 Dependency pass ${passCount}`);
        
        // Build answer map for this pass (only including visible questions)
        const answerMap = buildAnswerMap(workingPages);
        
        // Apply dependencies
        workingPages = workingPages.map(page => {
            const updatedPage = { ...page };
            
            updatedPage.Sections = page.Sections.map(section => {
                const updatedSection = { ...section };
                
                updatedSection.Questions = section.Questions.map(question => {
                    let q = { ...question };
                    
                    // Store previous hidden state to detect changes
                    const wasHidden = q.hidden;
                    
                    // Process dependencies if they exist
                    if (q.QuestionDependencies && q.QuestionDependencies.length > 0) {
                        let shouldShow = false;
                        
                        q.QuestionDependencies.forEach(dependency => {
                            // Check multiple possible matches
                            const possibleMatches = [
                                dependency.dependence_id,
                                String(dependency.dependence_id)
                            ];
                            
                            for (const matchId of possibleMatches) {
                                const dependentAnswer = answerMap.get(matchId);
                                if (dependentAnswer && !dependentAnswer.hidden) { // CRITICAL: Only consider non-hidden questions
                                    const answerMatches = checkAnswerMatch(dependentAnswer.answer, dependency.answer);
                                    
                                    if (answerMatches) {
                                        shouldShow = true;
                                        break;
                                    }
                                    break; // Found the dependency, don't check other match patterns
                                }
                            }
                        });
                        
                        q.hidden = !shouldShow;
                    } else {
                        // No dependencies, show the question unless explicitly hidden
                        if (q.hidden === undefined) {
                            q.hidden = false;
                        }
                    }
                    
                    // Check if visibility changed
                    if (wasHidden !== q.hidden) {
                        hasChanges = true;
                        // console.log(`  📋 Pass ${passCount}: Question "${q.question}" visibility changed: ${wasHidden ? 'hidden' : 'visible'} → ${q.hidden ? 'hidden' : 'visible'}`);
                    }
                    
                    return q;
                });
                
                // Hide section if all questions are hidden
                const visibleQuestions = updatedSection.Questions.filter(q => !q.hidden);
                updatedSection.hidden = visibleQuestions.length === 0;
                
                return updatedSection;
            });
            
            return updatedPage;
        });
    }
    
    // console.log(`✅ Dependency refresh completed after ${passCount} passes`);
    return workingPages;
};

/**
 * Enhanced answer matching function for dependencies
 * @param {any} actualAnswer - The actual answer from the question
 * @param {any} expectedAnswer - The expected answer from the dependency
 * @returns {boolean} - True if answers match
 */
export const checkAnswerMatch = (actualAnswer, expectedAnswer) => {
    // Direct match
    if (actualAnswer === expectedAnswer) {
        return true;
    }

    // Handle null/undefined cases
    if (actualAnswer == null && expectedAnswer == null) {
        return true;
    }
    
    if (actualAnswer == null || expectedAnswer == null) {
        return false;
    }

    // Handle array answers for multi-select questions
    if (Array.isArray(actualAnswer)) {
        if (Array.isArray(expectedAnswer)) {
            // Both arrays - check if they have common elements
            return expectedAnswer.some(expected => actualAnswer.includes(expected));
        } else {
            // Actual is array, expected is single value
            return actualAnswer.includes(expectedAnswer);
        }
    }

    // Handle string array answers (JSON parsed)
    if (typeof actualAnswer === 'string') {
        try {
            const parsedAnswer = JSON.parse(actualAnswer);
            if (Array.isArray(parsedAnswer)) {
                if (Array.isArray(expectedAnswer)) {
                    return expectedAnswer.some(expected => parsedAnswer.includes(expected));
                } else {
                    return parsedAnswer.includes(expectedAnswer);
                }
            }
        } catch (e) {
            // Not JSON, continue with other checks
        }
    }

    // Handle boolean conversions
    if (typeof actualAnswer === 'boolean' && typeof expectedAnswer === 'string') {
        return (actualAnswer === true && expectedAnswer.toLowerCase() === 'yes') ||
               (actualAnswer === false && expectedAnswer.toLowerCase() === 'no');
    }
    
    if (typeof expectedAnswer === 'boolean' && typeof actualAnswer === 'string') {
        return (expectedAnswer === true && actualAnswer.toLowerCase() === 'yes') ||
               (expectedAnswer === false && actualAnswer.toLowerCase() === 'no');
    }

    // Handle string comparisons (case insensitive)
    if (typeof actualAnswer === 'string' && typeof expectedAnswer === 'string') {
        return actualAnswer.toLowerCase().trim() === expectedAnswer.toLowerCase().trim();
    }

    // Handle number comparisons
    if (typeof actualAnswer === 'number' || typeof expectedAnswer === 'number') {
        return Number(actualAnswer) === Number(expectedAnswer);
    }

    return false;
};

/**
 * Clear answers from questions that are now hidden to prevent them from affecting dependencies
 * @param {Array} pages - All form pages
 * @returns {Array} - Updated pages with cleared answers for hidden questions
 */
export const clearHiddenQuestionAnswers = (pages) => {
    return pages.map(page => {
        const updatedPage = { ...page };
        
        updatedPage.Sections = page.Sections.map(section => {
            const updatedSection = { ...section };
            
            // STEP 1: Clear answers from hidden Questions
            updatedSection.Questions = section.Questions.map(question => {
                let q = { ...question };
                
                // Clear answer if question is hidden to prevent it from affecting other dependencies
                if (q.hidden && q.answer !== null && q.answer !== undefined && q.answer !== '') {
                    // console.log(`🧹 Clearing answer from hidden question: "${q.question}"`);
                    q.answer = null;
                    q.dirty = true; // Mark as dirty so it gets saved
                }
                
                return q;
            });
            
            // STEP 2: Also clear answers from QaPairs for hidden questions
            updatedSection.QaPairs = section.QaPairs?.map(qaPair => {
                // Find the corresponding question to check if it's hidden
                const correspondingQuestion = updatedSection.Questions.find(q => {
                    // For moved questions, match by QaPair ID
                    if (q.fromQa && q.id === qaPair.id) {
                        return true;
                    }
                    // For regular questions, match by question_id
                    return q.question_id === qaPair.question_id || q.id === qaPair.question_id;
                });
                
                if (correspondingQuestion && correspondingQuestion.hidden) {
                    // console.log(`🧹 Clearing QaPair answer for hidden question: "${qaPair.question}"`);
                    return {
                        ...qaPair,
                        answer: null,
                        dirty: true
                    };
                }
                
                return qaPair;
            }) || [];
            
            return updatedSection;
        });
        
        return updatedPage;
    });
};

/**
 * Function to validate that NDIS dependencies are working correctly
 * @param {Array} allPages - All form pages
 * @param {boolean} isNdisFunded - NDIS funding status
 */
export const validateNdisDependencies = (allPages, isNdisFunded) => {
    const issues = [];
    let totalQuestions = 0;
    let questionsWithDependencies = 0;
    let dependenciesWorking = 0;
    
    allPages.forEach(page => {
        page.Sections?.forEach(section => {
            section.Questions?.forEach(question => {
                totalQuestions++;
                
                if (question.QuestionDependencies && question.QuestionDependencies.length > 0) {
                    questionsWithDependencies++;
                    
                    let allDependenciesMet = true;
                    let anyDependencyMet = false;
                    
                    question.QuestionDependencies.forEach(dependency => {
                        let dependencyFound = false;
                        let dependencyMet = false;
                        
                        // Search for dependency across all pages
                        allPages.forEach(searchPage => {
                            searchPage.Sections?.forEach(searchSection => {
                                searchSection.Questions?.forEach(searchQuestion => {
                                    const matches = 
                                        (searchQuestion.question_id === dependency.dependence_id) ||
                                        (searchQuestion.id === dependency.dependence_id) ||
                                        (searchQuestion.question_key === dependency.dependence_id);
                                    
                                    if (matches) {
                                        dependencyFound = true;
                                        const answerMatches = checkAnswerMatch(searchQuestion.answer, dependency.answer);
                                        if (answerMatches) {
                                            dependencyMet = true;
                                            anyDependencyMet = true;
                                        }
                                    }
                                });
                                
                                searchSection.QaPairs?.forEach(qaPair => {
                                    const searchQuestion = qaPair.Question;
                                    const matches = 
                                        (qaPair.question_id === dependency.dependence_id) ||
                                        (searchQuestion?.question_key === dependency.dependence_id);
                                    
                                    if (matches) {
                                        dependencyFound = true;
                                        const answerMatches = checkAnswerMatch(qaPair.answer, dependency.answer);
                                        if (answerMatches) {
                                            dependencyMet = true;
                                            anyDependencyMet = true;
                                        }
                                    }
                                });
                            });
                        });
                        
                        if (!dependencyFound) {
                            issues.push({
                                type: 'missing_dependency',
                                question: question.question,
                                page: page.title,
                                dependence_id: dependency.dependence_id,
                                expected_answer: dependency.answer
                            });
                        }
                        
                        if (!dependencyMet) {
                            allDependenciesMet = false;
                        }
                    });
                    
                    // Check if visibility matches dependency status
                    const shouldBeVisible = anyDependencyMet;
                    const isVisible = !question.hidden;
                    
                    if (shouldBeVisible === isVisible) {
                        dependenciesWorking++;
                    } else {
                        issues.push({
                            type: 'incorrect_visibility',
                            question: question.question,
                            page: page.title,
                            shouldBeVisible,
                            isVisible,
                            dependencies: question.QuestionDependencies
                        });
                    }
                }
            });
        });
    });
    
    return {
        totalQuestions,
        questionsWithDependencies,
        dependenciesWorking,
        issues
    };
};

/**
 * Check if guest answered "Yes" to course offer question
 */
export const hasCourseOfferAnsweredYes = (pages) => {
    for (const page of pages) {
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION)) {
                    return question.answer?.toLowerCase() === 'yes';
                }
            }
        }
    }
    return false;
};

/**
 * Get check-in and check-out dates from form data
 */
export const getStayDatesFromForm = (pages) => {
    let checkInDate = null;
    let checkOutDate = null;

    for (const page of pages) {
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_OUT_DATE) && question.answer) {
                    const dates = question.answer.split(' - ');
                    if (dates.length >= 2) {
                        checkInDate = dates[0].trim();
                        checkOutDate = dates[1].trim();
                    }
                }
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_DATE) && question.answer) {
                    checkInDate = question.answer;
                }
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_OUT_DATE) && question.answer) {
                    checkOutDate = question.answer;
                }
            }
        }
    }

    return { checkInDate, checkOutDate };
};

/**
 * Validate course dates against stay dates
 */
export const validateCourseStayDates = (pages, courseOffers) => {
    const { checkInDate, checkOutDate } = getStayDatesFromForm(pages);
    
    if (!checkInDate || !checkOutDate) {
        return {
            isValid: false,
            message: 'Check-in and check-out dates are required for course bookings'
        };
    }

    if (courseOffers.length === 0) {
        return {
            isValid: false,
            message: 'No valid course offers found'
        };
    }

    // Check if dates align with any course offers
    for (const courseOffer of courseOffers) {
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const minStartDate = new Date(courseOffer.minStartDate);
        const minEndDate = new Date(courseOffer.minEndDate);

        [checkIn, checkOut, minStartDate, minEndDate].forEach(date => {
            date.setHours(0, 0, 0, 0);
        });

        if (checkIn <= minStartDate && checkOut >= minEndDate) {
            return { isValid: true, message: '' };
        }
    }

    return {
        isValid: false,
        message: 'Please review your stay dates to match the min dates of stay for your course offer'
    };
};
import { QUESTION_KEYS, questionHasKey, questionMatches } from '../services/booking/question-helper';

/**
 * ENHANCED: Detect NDIS funding from BOTH QaPairs (saved) AND Questions (prefilled/current)
 * This handles returning guests where answers may be prefilled but not yet saved
 * @param {Array} sections - Array of sections with QaPairs and/or Questions
 * @returns {boolean} - True if NDIS funding detected
 */
export const detectNdisFundingFromSections = (sections) => {
    for (const section of sections || []) {
        // CHECK 1: QaPairs (saved answers from current booking)
        for (const qaPair of section.QaPairs || []) {
            const question = qaPair.Question;
            
            // Strategy 1: By question_key
            if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                const isNdis = qaPair.answer?.toLowerCase().includes('ndis') || 
                               qaPair.answer?.toLowerCase().includes('ndia');
                if (isNdis) {
                    console.log('✅ NDIS detected from QaPairs:', qaPair.answer);
                    return true;
                }
                return false; // Found funding question but answer is not NDIS
            }
            
            // Strategy 2: By question text (fallback)
            const questionText = question?.question || qaPair.question || '';
            if (questionText.toLowerCase().includes('how will your stay be funded') && qaPair.answer) {
                const isNdis = qaPair.answer?.toLowerCase().includes('ndis') || 
                               qaPair.answer?.toLowerCase().includes('ndia');
                if (isNdis) {
                    console.log('✅ NDIS detected from QaPairs (text match):', qaPair.answer);
                    return true;
                }
                return false;
            }
        }
        
        // CHECK 2: Questions array (prefilled or current unsaved answers)
        for (const question of section.Questions || []) {
            // Strategy 1: By question_key
            if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                const isNdis = question.answer?.toLowerCase().includes('ndis') || 
                               question.answer?.toLowerCase().includes('ndia');
                if (isNdis) {
                    console.log('✅ NDIS detected from Questions:', question.answer);
                    return true;
                }
                return false; // Found funding question but answer is not NDIS
            }
            
            // Strategy 2: By question text (fallback)
            const questionText = question.question || '';
            if (questionText.toLowerCase().includes('how will your stay be funded') && question.answer) {
                const isNdis = question.answer?.toLowerCase().includes('ndis') || 
                               question.answer?.toLowerCase().includes('ndia');
                if (isNdis) {
                    console.log('✅ NDIS detected from Questions (text match):', question.answer);
                    return true;
                }
                return false;
            }
        }
    }
    
    console.log('⚠️ No funding source found in sections');
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

export const postProcessPagesForNdis = (pages, isNdisFunded, calculatePageCompletion) => {
    console.log('🔄 postProcessPagesForNdis called:', { 
        isNdisFunded, 
        pageCount: pages?.length,
        pageIds: pages?.map(p => p.id || p.title).join(', ')
    });
    
    if (!isNdisFunded) {
        console.log('⏩ NDIS not funded, returning pages unchanged');
        return pages;
    }
    
    if (!pages || pages.length === 0) {
        console.warn('⚠️ No pages provided to postProcessPagesForNdis');
        return pages;
    }
    
    const ndisQuestions = [];
    const filteredPages = [];
    let movedQuestionsCount = 0;
    
    // Find funding page index - check BOTH Questions AND QaPairs
    let fundingPageIndex = -1;
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        let found = false;
        
        for (const section of page.Sections || []) {
            // Check Questions array
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)) {
                    found = true;
                    break;
                }
                // Fallback: check by question text
                if (question.question?.toLowerCase().includes('how will your stay be funded')) {
                    found = true;
                    break;
                }
            }
            
            if (found) break;
            
            // Check QaPairs array
            for (const qaPair of section.QaPairs || []) {
                if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE)) {
                    found = true;
                    break;
                }
            }
            
            if (found) break;
        }
        
        if (found) {
            fundingPageIndex = i;
            console.log(`✅ Found funding page at index ${i}: "${page.title}"`);
            break;
        }
    }
    
    if (fundingPageIndex === -1) {
        console.warn('⚠️ Funding page not found! Cannot create NDIS page.');
        console.log('📋 Available pages:', pages.map(p => p.title).join(', '));
        return pages;
    }
    
    // Process each page to collect NDIS questions
    console.log(`📋 Processing ${pages.length} pages for NDIS questions...`);
    
    pages.forEach((page, pageIndex) => {
        const filteredSections = [];
        
        page.Sections?.forEach(section => {
            const remainingQuestions = [];
            const remainingQaPairs = [];
            
            // Filter Questions array
            section.Questions?.forEach(question => {
                if (shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    movedQuestionsCount++;
                    console.log(`📦 Moving question to NDIS page: "${question.question?.substring(0, 60)}..." (ID: ${question.id}, key: ${question.question_key})`);
                    
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
                    console.log(`📦 Moving QaPair to NDIS page: "${question.question?.substring(0, 60)}..."`);
                    
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
        
        const filteredPage = {
            ...page,
            Sections: filteredSections
        };
        
        // Preserve completion status
        if (page.completed && !page.title.includes('NDIS')) {
            filteredPage.completed = true;
        } else {
            filteredPage.completed = false;
        }
        
        filteredPages.push(filteredPage);
    });
    
    console.log(`📊 NDIS processing summary: ${movedQuestionsCount} questions moved, ${ndisQuestions.length} sections collected`);
    
    // Create NDIS page if we have NDIS questions
    if (ndisQuestions.length > 0 && fundingPageIndex !== -1) {
        // Sort questions by order
        const sortedNdisQuestions = ndisQuestions.map(section => {
            const sortedQuestions = [...section.Questions].sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 999;
                const orderB = b.order !== undefined ? b.order : 999;
                return orderA - orderB;
            });
            
            const sortedQaPairs = section.QaPairs ? [...section.QaPairs].sort((a, b) => {
                const orderA = a.Question?.order !== undefined ? a.Question.order : 999;
                const orderB = b.Question?.order !== undefined ? b.Question.order : 999;
                return orderA - orderB;
            }) : [];
            
            return {
                ...section,
                Questions: sortedQuestions,
                QaPairs: sortedQaPairs
            };
        });
        
        const ndisPage = {
            id: 'ndis_packages_page',
            title: 'NDIS Requirements',
            description: '',
            Sections: sortedNdisQuestions,
            url: "&&page_id=ndis_packages_page",
            active: false,
            hasNext: true,
            hasBack: true,
            lastPage: false,
            pageQuestionDependencies: [],
            completed: false,
            noItems: sortedNdisQuestions.reduce((total, section) => total + section.Questions.length, 0),
            dirty: false,
            hidden: false,
            template_id: pages[0]?.template_id || null
        };
        
        // Insert NDIS page after funding page
        filteredPages.splice(fundingPageIndex + 1, 0, ndisPage);
        
        console.log(`✅ Created NDIS page with ${ndisPage.noItems} questions, inserted at index ${fundingPageIndex + 1}`);
        
        // Update navigation properties
        filteredPages.forEach((page, index) => {
            page.hasNext = index < filteredPages.length - 1;
            page.hasBack = index > 0;
            page.lastPage = index === filteredPages.length - 1;
        });
    } else {
        console.warn(`⚠️ NDIS page NOT created: ndisQuestions.length=${ndisQuestions.length}, fundingPageIndex=${fundingPageIndex}`);
    }
    
    console.log(`📋 Final page count: ${filteredPages.length}, Pages: ${filteredPages.map(p => p.title || p.id).join(', ')}`);
    
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
export const processFormDataForNdisPackages = (formData, isNdisFunded, calculatePageCompletion, applyQuestionDependenciesAcrossPages, bookingFormRoomSelected) => {
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
                // Apply dependencies to existing NDIS page but DON'T calculate completion yet
                const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, formData, bookingFormRoomSelected);
                // ✅ FIXED: Don't calculate completion here - will be done later
                return { ...pageWithDependencies, completed: false }; // Will be calculated properly later
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
    const processedQuestionIds = new Set(); 

    formData.forEach((page, pageIndex) => {
        const updatedSections = [];

        page.Sections.forEach(section => {
            const remainingQuestions = [];
            const remainingQaPairs = [];

            // STEP 1: Build comprehensive map with ID tracking
            const allNdisQuestions = new Map();

            // Process QaPairs first (answered questions - higher priority)
            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                if (question && shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    const questionKey = question.question_key || question.question || question.id;
                    const questionId = qaPair.question_id || question.id;
                    
                    // ✅ NEW: Create composite key with section info
                    const compositeKey = `${questionKey}_${questionId}`;
                    
                    // Only add if not already processed globally
                    if (!processedQuestionKeys.has(compositeKey) && !processedQuestionIds.has(questionId)) {
                        allNdisQuestions.set(compositeKey, {
                            question,
                            source: 'QaPairs',
                            data: qaPair,
                            hasAnswer: true,
                            answer: qaPair.answer,
                            questionId: questionId
                        });
                    }
                }
            });

            // Then process Questions array (unanswered questions)
            section.Questions?.forEach(question => {
                if (shouldMoveQuestionToNdisPage(question, isNdisFunded)) {
                    const questionKey = question.question_key || question.question || question.id;
                    const questionId = question.question_id || question.id;
                    const compositeKey = `${questionKey}_${questionId}`;
                    
                    // Only add if not in QaPairs and not processed globally
                    if (!allNdisQuestions.has(compositeKey) && 
                        !processedQuestionKeys.has(compositeKey) &&
                        !processedQuestionIds.has(questionId)) {
                        allNdisQuestions.set(compositeKey, {
                            question,
                            source: 'Questions',
                            data: question,
                            hasAnswer: false,
                            answer: question.answer,
                            questionId: questionId
                        });
                    }
                }
            });

            // STEP 2: Move unique NDIS questions to NDIS page
            allNdisQuestions.forEach((ndisQuestionInfo, compositeKey) => {
                // ✅ CRITICAL: Mark as processed globally
                processedQuestionKeys.add(compositeKey);
                processedQuestionIds.add(ndisQuestionInfo.questionId);
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
                    QuestionDependencies: ndisQuestionInfo.question.QuestionDependencies || [],
                    hidden: false,
                    fromQa: ndisQuestionInfo.source === 'QaPairs',
                    question_id: ndisQuestionInfo.source === 'QaPairs' ? 
                        ndisQuestionInfo.data.question_id : 
                        (ndisQuestionInfo.question.id || ndisQuestionInfo.question.question_id),
                    id: ndisQuestionInfo.source === 'QaPairs' ? 
                        ndisQuestionInfo.data.id : 
                        ndisQuestionInfo.question.id
                };

                // Find or create section for NDIS page
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

                // ✅ NEW: Check if question already exists in this section before adding
                const alreadyExists = existingNdisSection.Questions.some(q => {
                    const qKey = q.question_key || q.question;
                    const qId = q.question_id || q.id;
                    return qKey === ndisQuestion.question_key || qId === ndisQuestion.question_id;
                });

                if (!alreadyExists) {
                    existingNdisSection.Questions.push(ndisQuestion);
                    
                    // Also preserve QaPair if it exists
                    if (ndisQuestionInfo.source === 'QaPairs') {
                        existingNdisSection.QaPairs.push({
                            ...ndisQuestionInfo.data,
                            section_id: section.id
                        });
                    }
                } else {
                    // console.log(`⚠️ Skipping duplicate in NDIS section: "${ndisQuestion.question}"`);
                }
            });

            // STEP 3: Filter original sections
            section.Questions?.forEach(question => {
                const questionKey = question.question_key || question.question || question.id;
                const questionId = question.question_id || question.id;
                const compositeKey = `${questionKey}_${questionId}`;
                
                if (!allNdisQuestions.has(compositeKey)) {
                    remainingQuestions.push(question);
                }
            });

            section.QaPairs?.forEach(qaPair => {
                const question = qaPair.Question;
                const questionKey = question ? (question.question_key || question.question || question.id) : null;
                const questionId = qaPair.question_id || question?.id;
                const compositeKey = questionKey ? `${questionKey}_${questionId}` : null;
                
                if (!compositeKey || !allNdisQuestions.has(compositeKey)) {
                    remainingQaPairs.push(qaPair);
                }
            });

            // Only add section if it has remaining content
            if (remainingQuestions.length > 0 || remainingQaPairs.length > 0) {
                updatedSections.push({
                    ...section,
                    Questions: remainingQuestions,
                    QaPairs: remainingQaPairs
                });
            }
        });

        updatedPages.push({
            ...page,
            Sections: updatedSections
        });
    });

    // Create NDIS Packages page if we have NDIS questions
    if (ndisQuestions.length > 0) {
        // ✅ NEW: Sort questions within each section by their order property
        const sortedNdisQuestions = ndisQuestions.map(section => {
            const sortedQuestions = [...section.Questions].sort((a, b) => {
                // Sort by order property
                const orderA = a.order !== undefined ? a.order : 999;
                const orderB = b.order !== undefined ? b.order : 999;
                return orderA - orderB;
            });
            
            const sortedQaPairs = section.QaPairs ? [...section.QaPairs].sort((a, b) => {
                // Sort QaPairs by their Question's order
                const orderA = a.Question?.order !== undefined ? a.Question.order : 999;
                const orderB = b.Question?.order !== undefined ? b.Question.order : 999;
                return orderA - orderB;
            }) : [];
            
            console.log(`📋 Sorted NDIS section "${section.label}":`, 
                sortedQuestions.map(q => `${q.question} (order: ${q.order})`).join(', ')
            );
            
            return {
                ...section,
                Questions: sortedQuestions,
                QaPairs: sortedQaPairs
            };
        });

        const ndisPage = {
            id: 'ndis_packages_page',
            title: 'NDIS Requirements',
            description: '',
            Sections: sortedNdisQuestions,
            url: "&&page_id=ndis_packages_page",
            active: false,
            hasNext: true,
            hasBack: true,
            lastPage: false,
            pageQuestionDependencies: [],
            completed: false, // ✅ FIXED: Don't calculate completion here - will be done later
            noItems: sortedNdisQuestions.reduce((total, section) => total + section.Questions.length, 0),
            dirty: false,
            hidden: false,
            template_id: formData[0]?.template_id || null
        };

        // Insert NDIS page after funding page
        const newFormData = [...updatedPages];
        newFormData.splice(fundingPageIndex + 1, 0, ndisPage);

        // ✅ FIXED: Apply dependencies to ALL pages but DON'T calculate completion yet
        const finalFormData = newFormData.map(page => {
            const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, newFormData, bookingFormRoomSelected);
            // ✅ Don't calculate completion here - it will be done later after all processing
            return { ...pageWithDependencies, completed: false };
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
 * @param {Array} bookingFormRoomSelected - Selected rooms for booking (optional)
 * @returns {Object} - Updated page with dependencies applied
 */
export const applyQuestionDependenciesAcrossPages = (targetPage, allPages, bookingFormRoomSelected = []) => {
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

    const getCurrentFunder = (pages) => {
        for (const page of pages) {
            for (const section of page.Sections || []) {
                for (const question of section.Questions || []) {
                    if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) &&
                        question.answer) {
                        return question.answer;
                    }
                }
                // Also check QaPairs
                for (const qaPair of section.QaPairs || []) {
                    if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                        return qaPair.answer;
                    }
                }
            }
        }
        return null;
    };

    const currentFunder = getCurrentFunder(allPages);
    let currentIsNdisFunded = false;
    let currentIsIcareFunded = false;
    if (currentFunder && (currentFunder.toLowerCase().includes('ndis') || currentFunder.toLowerCase().includes('ndia'))) {
        currentIsNdisFunded = true;
    } else if (currentFunder && currentFunder.toLowerCase().includes('icare')) {
        currentIsIcareFunded = true;
    }

    let updatedPage = { ...targetPage };
    updatedPage.Sections = targetPage.Sections.map(section => {
        let updatedSection = { ...section };

        // ADDED: Handle special case for "I acknowledge additional charges" question
        if (updatedSection.Questions.length === 1) {
            let question = {...updatedSection.Questions[0]};
            
            // Check for "I acknowledge additional charges" question
            if (question.ndis_only && question.question_key === 'i-acknowledge-additional-charges') {
                const wasHidden = question.hidden;
                
                // Default to hidden
                question.hidden = true;
                updatedSection.hidden = true;

                // Show if NDIS funded (simplified logic without room checking for consistency)
                if (currentIsNdisFunded && bookingFormRoomSelected.length > 0 && (bookingFormRoomSelected[0]?.type != 'studio' || bookingFormRoomSelected.length > 1)) {
                    question.hidden = false;
                    updatedSection.hidden = false;
                }

                // Only update if visibility actually changed to avoid infinite renders
                if (wasHidden !== question.hidden) {
                    updatedSection.Questions = [{ ...question }];
                }

                return updatedSection;
            }

            if (question.question_key === 'i-acknowledge-additional-costs-icare') {
                const wasHidden = question.hidden;
                
                // Default to hidden
                question.hidden = true;
                updatedSection.hidden = true;
                // Show if NDIS funded (simplified logic without room checking for consistency)
                const isPaidRoom = (bookingFormRoomSelected.length > 0 && bookingFormRoomSelected[0]?.type != 'studio') || bookingFormRoomSelected.length > 1;
                if (isPaidRoom) {
                    question.hidden = false;
                    updatedSection.hidden = false;
                }

                // Only update if visibility actually changed to avoid infinite renders
                if (wasHidden !== question.hidden) {
                    updatedSection.Questions = [{ ...question }];
                }

                return updatedSection;
            }
        }

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
        } else if (qa.question_type === 'card-selection' || qa.question_type === 'horizontal-card' || qa.question_type === 'service-cards') {
            options = options && options.map(o => {
                let temp = { ...o };
                temp.checked = answer && answer.value === o.value;
                return temp;
            });
        } else if (qa.question_type === 'card-selection-multi' || qa.question_type === 'horizontal-card-multi' || qa.question_type === 'service-cards-multi') {
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
 * @param {Array} bookingFormRoomSelected - Selected rooms for booking (optional)
 * @returns {Array} - Updated pages with refreshed dependencies
 */
export const forceRefreshAllDependencies = (allPages, bookingFormRoomSelected = []) => {
    // Create a working copy of all pages
    let workingPages = structuredClone(allPages);
    
    const currentFunder = getCurrentFunder(workingPages);
    let currentIsNdisFunded = false;
    let currentIsIcareFunded = false;
    if (currentFunder && (currentFunder.toLowerCase().includes('ndis') || currentFunder.toLowerCase().includes('ndia'))) {
        currentIsNdisFunded = true;
    } else if (currentFunder && currentFunder.toLowerCase().includes('icare')) {
        currentIsIcareFunded = true;
    }
    
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
                
                // ADDED: Handle special case for "I acknowledge additional charges" question
                if (updatedSection.Questions.length === 1) {
                    const question = updatedSection.Questions[0];
                    
                    // Check for "I acknowledge additional charges" question
                    if (question.ndis_only && question.question_key === 'i-acknowledge-additional-charges') {
                        const wasHidden = question.hidden;
                        const wasSectionHidden = updatedSection.hidden;
                        
                        // Default to hidden
                        question.hidden = true;
                        updatedSection.hidden = true;

                        // Show if NDIS funded AND rooms selected AND (first room not studio OR multiple rooms)
                        if (currentIsNdisFunded && bookingFormRoomSelected.length > 0) {
                            if (bookingFormRoomSelected[0]?.type != 'studio' || bookingFormRoomSelected.length > 1) {
                                question.hidden = false;
                                updatedSection.hidden = false;
                            }
                        }

                        // Check if visibility actually changed to track changes
                        if (wasHidden !== question.hidden || wasSectionHidden !== updatedSection.hidden) {
                            hasChanges = true;
                        }

                        updatedSection.Questions = [{ ...question }];
                        return updatedSection;
                    }

                    if (question.question_key === 'i-acknowledge-additional-costs-icare') {
                        const wasHidden = question.hidden;
                        const wasSectionHidden = updatedSection.hidden;
                        
                        // Default to hidden
                        question.hidden = true;
                        updatedSection.hidden = true;
                        // Show if ICare funded AND ocean_view room selected
                        const isPaidRoom = (bookingFormRoomSelected.length > 0 && bookingFormRoomSelected[0]?.type != 'studio') || bookingFormRoomSelected.length > 1;
                        if (isPaidRoom) {
                            question.hidden = false;
                            updatedSection.hidden = false;
                        }

                        // Check if visibility actually changed to track changes
                        if (wasHidden !== question.hidden || wasSectionHidden !== updatedSection.hidden) {
                            hasChanges = true;
                        }

                        updatedSection.Questions = [{ ...question }];
                        return updatedSection;
                    }
                }
                
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

    // Handle service-cards format
    // Service-cards stores answers as objects like:
    // { "service-value": { selected: true, subOptions: ["sub1", "sub2"] } }
    if (typeof actualAnswer === 'object' && !Array.isArray(actualAnswer)) {
        // Parse actualAnswer if it's a string
        let serviceData = actualAnswer;
        if (typeof actualAnswer === 'string') {
            try {
                serviceData = JSON.parse(actualAnswer);
            } catch (e) {
                // Not JSON, fall through to other checks
                serviceData = null;
            }
        }

        // Check if this looks like service-cards data
        if (serviceData && typeof serviceData === 'object' && !Array.isArray(serviceData)) {
            // Check if expected answer contains colon (could be yes/no or sub-option format)
            if (typeof expectedAnswer === 'string' && expectedAnswer.includes(':')) {
                const parts = expectedAnswer.split(':');
                const serviceValue = parts[0];
                const optionValue = parts[1];
                
                // Check for Yes/No conditions
                if (optionValue === 'yes') {
                    // Format: "service-value:yes" - Check if service is selected
                    const service = serviceData[serviceValue];
                    return service && service.selected === true;
                } else if (optionValue === 'no') {
                    // Format: "service-value:no" - Check if service is NOT selected
                    const service = serviceData[serviceValue];
                    // Service explicitly not selected (selected: false) OR not in the data at all
                    return !service || service.selected === false;
                } else {
                    // Format: "service-value:sub-option-value" - Check sub-option
                    // When checking sub-option, we automatically imply the service must be selected (Yes)
                    const service = serviceData[serviceValue];
                    if (service && service.selected === true && service.subOptions) {
                        return service.subOptions.includes(optionValue);
                    }
                    return false;
                }
            } else if (typeof expectedAnswer === 'string') {
                // Legacy format: "service-value" (for backward compatibility)
                // This checks if service is selected (same as :yes)
                const service = serviceData[expectedAnswer];
                if (service !== undefined) {
                    // This is service-cards data, check if selected
                    return service.selected === true;
                }
                // Not service-cards format, continue to other checks
            }
        }
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
            // If parsed but not array, it might be service-cards
            if (typeof parsedAnswer === 'object' && parsedAnswer !== null) {
                // Recursively call with parsed data
                return checkAnswerMatch(parsedAnswer, expectedAnswer);
            }
        } catch (e) {
            // Not JSON, continue with other checks
        }
        
        // String comparison as last resort
        return String(actualAnswer).toLowerCase() === String(expectedAnswer).toLowerCase();
    }

    // Type conversion and comparison
    return String(actualAnswer) === String(expectedAnswer);
};


/**
 * Mark hidden questions for exclusion during save, but preserve their answers in memory
 * This allows answers to be restored if questions become visible again
 * @param {Array} pages - All form pages
 * @returns {Array} - Updated pages with hidden questions marked for exclusion
 */
export const clearHiddenQuestionAnswers = (pages) => {
    return pages.map(page => {
        const updatedPage = { ...page };
        
        updatedPage.Sections = page.Sections.map(section => {
            const updatedSection = { ...section };
            
            // STEP 1: Mark hidden Questions for exclusion but PRESERVE their answers
            updatedSection.Questions = section.Questions.map(question => {
                let q = { ...question };
                
                // Mark hidden questions for exclusion during save, but keep the answer in memory
                if (q.hidden && q.answer !== null && q.answer !== undefined && q.answer !== '') {
                    q.excludeFromSave = true; // Mark for exclusion during save
                    // DON'T clear the answer - preserve it in case question becomes visible again
                    // The answer will be ignored by dependency logic because the question is hidden
                }
                
                // If question becomes visible again, remove the exclusion flag
                if (!q.hidden && q.excludeFromSave) {
                    q.excludeFromSave = false;
                    // Answer is already there, no need to restore it
                }
                
                return q;
            });
            
            // STEP 2: Mark QaPairs for exclusion but PRESERVE their answers
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
                    return {
                        ...qaPair,
                        excludeFromSave: true // Mark for exclusion during save
                        // Keep the answer intact
                    };
                }
                
                // If question is visible again, remove exclusion flag
                if (correspondingQuestion && !correspondingQuestion.hidden && qaPair.excludeFromSave) {
                    return {
                        ...qaPair,
                        excludeFromSave: false
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
 * Enhanced function to get stay dates from form with better error handling
 */
export const getStayDatesFromForm = (pages) => {
    // console.log('📅 Extracting stay dates from form pages...');
    
    let checkInDate = null;
    let checkOutDate = null;

    for (const page of pages) {
        // console.log(`📅 Checking page: ${page.title}`);
        
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                // Check for combined check-in/check-out date question
                if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_OUT_DATE) && question.answer) {
                    // console.log(`📅 Found combined date question with answer: ${question.answer}`);
                    const dates = question.answer.split(' - ');
                    if (dates.length >= 2) {
                        checkInDate = dates[0].trim();
                        checkOutDate = dates[1].trim();
                        // console.log(`📅 Extracted from combined: checkIn=${checkInDate}, checkOut=${checkOutDate}`);
                    }
                }
                // Check for separate check-in date question
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_DATE) && question.answer) {
                    checkInDate = question.answer.trim();
                    // console.log(`📅 Found separate check-in date: ${checkInDate}`);
                }
                // Check for separate check-out date question
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_OUT_DATE) && question.answer) {
                    checkOutDate = question.answer.trim();
                    // console.log(`📅 Found separate check-out date: ${checkOutDate}`);
                }
            }
            
            // Also check QaPairs for previously answered questions
            for (const qaPair of section.QaPairs || []) {
                const question = qaPair.Question;
                if (!question || !qaPair.answer) continue;
                
                if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
                    // console.log(`📅 Found combined date in QaPair: ${qaPair.answer}`);
                    const dates = qaPair.answer.split(' - ');
                    if (dates.length >= 2) {
                        checkInDate = dates[0].trim();
                        checkOutDate = dates[1].trim();
                        // console.log(`📅 Extracted from QaPair combined: checkIn=${checkInDate}, checkOut=${checkOutDate}`);
                    }
                }
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_DATE)) {
                    checkInDate = qaPair.answer.trim();
                    // console.log(`📅 Found check-in date in QaPair: ${checkInDate}`);
                }
                else if (questionHasKey(question, QUESTION_KEYS.CHECK_OUT_DATE)) {
                    checkOutDate = qaPair.answer.trim();
                    // console.log(`📅 Found check-out date in QaPair: ${checkOutDate}`);
                }
            }
        }
    }

    // console.log(`📅 Final extracted dates: checkIn=${checkInDate}, checkOut=${checkOutDate}`);
    return { checkInDate, checkOutDate };
};


export const extractCurrentFundingAnswer = (formData) => {
    for (const page of formData || []) {
        for (const section of page.Sections || []) {
            // Check Questions
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                    return question.answer;
                }
            }
            // Check QaPairs
            for (const qaPair of section.QaPairs || []) {
                if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                    return qaPair.answer;
                }
            }
        }
    }
    return null;
};

// 🆕 NEW: Dynamic helper functions for infant care equipment
export const generateInfantCareQuestionKey = (equipmentName) => {
    // Convert equipment name to question key format
    const normalizedName = equipmentName.toLowerCase().replace(/\s+/g, '-');
    return `do-you-need-a-${normalizedName}-if-so-how-many`;
};

export const generateInfantCareQuestionText = (equipmentName) => {
    // Convert equipment name to question text format
    const lowerName = equipmentName.toLowerCase();
    return `Do you need a ${lowerName}? If so, how many?`;
};

// 🆕 NEW: Alternative approach - use a mapping function for custom question keys
export const getInfantCareQuestionMapping = (equipmentName) => {
    // Define mappings for equipment names that don't follow the standard pattern
    const customMappings = {
        'High Chair': {
            questionKey: 'do-you-need-a-high-chair-if-so-how-many',
            questionText: 'Do you need a high chair? If so, how many?'
        },
        'Portable Cot': {
            questionKey: 'do-you-need-a-cot-if-so-how-many',
            questionText: 'Do you need a cot? If so, how many?'
        }
    };
    
    // Check if there's a custom mapping first
    if (customMappings[equipmentName]) {
        return customMappings[equipmentName];
    }
    
    // Otherwise, generate dynamically
    return {
        questionKey: generateInfantCareQuestionKey(equipmentName),
        questionText: generateInfantCareQuestionText(equipmentName)
    };
};

export const getCurrentFunder = (pages) => {
    for (const page of pages) {
        for (const section of page.Sections || []) {
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) &&
                    question.answer) {
                    return question.answer;
                }
            }
            // Also check QaPairs
            for (const qaPair of section.QaPairs || []) {
                if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                    return qaPair.answer;
                }
            }
        }
    }
    return null;
};
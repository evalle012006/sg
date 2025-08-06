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
    
    console.log('🔄 Post-processing pages for NDIS...');
    
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
                    console.log(`📦 Moving NDIS question to NDIS page: "${question.question}"`);
                    
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
                    console.log(`📦 Moving NDIS QaPair to NDIS page: "${question.question}"`);
                    
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
            console.log(`✅ Preserving completion status for page: "${page.title}"`);
        } else {
            filteredPage.completed = calculatePageCompletion(filteredPage);
            console.log(`📊 Calculated completion for page "${page.title}": ${filteredPage.completed}`);
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
        console.log(`📊 NDIS page completion: ${ndisPage.completed}`);
        
        // Insert NDIS page after funding page
        filteredPages.splice(fundingPageIndex + 1, 0, ndisPage);
        
        // Update navigation properties
        filteredPages.forEach((page, index) => {
            page.hasNext = index < filteredPages.length - 1;
            page.hasBack = index > 0;
            page.lastPage = index === filteredPages.length - 1;
        });
        
        console.log(`✅ Created NDIS page with ${movedQuestionsCount} questions`);
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
    console.log('🔍 Processing form data for NDIS packages...', { 
        isNdisFunded, 
        dataLength: formData.length,
        formDataPages: formData.map(p => p.title)
    });

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
                    console.log('📍 Found funding question:', {
                        page: page.title,
                        question: question.question,
                        answer: question.answer,
                        pageIndex: i
                    });
                    break;
                }
            }
            if (fundingQuestionFound) break;
        }
        if (fundingQuestionFound) break;
    }

    console.log('📍 Funding page analysis:', { 
        fundingPageIndex, 
        fundingQuestionFound, 
        currentFundingAnswer,
        isNdisFunded 
    });

    if (fundingPageIndex === -1) {
        console.log('❌ No funding page found, returning original data');
        return formData;
    }

    // Check if NDIS packages page already exists
    const ndisPageExists = formData.some(page => page.id === 'ndis_packages_page');
    const existingNdisPageIndex = formData.findIndex(page => page.id === 'ndis_packages_page');

    console.log('📊 NDIS page status:', { 
        ndisPageExists, 
        existingNdisPageIndex,
        isNdisFunded,
        shouldHaveNdisPage: isNdisFunded
    });

    if (ndisPageExists && !isNdisFunded) {
        // Remove NDIS page if funding is not NDIS
        console.log('🗑️ Removing NDIS packages page - funding not NDIS');
        return formData.filter(page => page.id !== 'ndis_packages_page');
    } else if (ndisPageExists && isNdisFunded) {
        // NDIS page already exists and funding is NDIS, preserve it but apply dependencies
        console.log('✅ NDIS packages page already exists, preserving with dependencies');
        
        const updatedFormData = formData.map(page => {
            if (page.id === 'ndis_packages_page') {
                // Apply dependencies to existing NDIS page
                const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, formData);
                pageWithDependencies.completed = calculatePageCompletion(pageWithDependencies);
                console.log(`✅ Existing NDIS page completion status: ${pageWithDependencies.completed}`);
                
                return pageWithDependencies;
            }
            return page;
        });
        return updatedFormData;
    }

    // Only create NDIS page if NDIS is funded
    if (!isNdisFunded) {
        console.log('❌ Not NDIS funded, returning original data without modifications');
        return formData;
    }

    console.log('🔄 Creating new NDIS page...');

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

            console.log(`🔍 Section "${section.label}" NDIS questions found:`, allNdisQuestions.size);

            // STEP 2: Move NDIS questions to NDIS page (deduplicated)
            allNdisQuestions.forEach((ndisQuestionInfo, questionKey) => {
                // Skip if already processed globally (avoid cross-section duplicates)
                if (processedQuestionKeys.has(questionKey)) {
                    console.log(`⏭️ Skipping already processed question: "${ndisQuestionInfo.question.question}"`);
                    return;
                }

                processedQuestionKeys.add(questionKey);
                movedQuestionsCount++;

                console.log(`📦 Moving NDIS question to NDIS page:`, {
                    fromPage: page.title,
                    fromSection: section.label || section.id,
                    question: ndisQuestionInfo.question.question,
                    type: ndisQuestionInfo.question.type,
                    source: ndisQuestionInfo.source,
                    hasAnswer: ndisQuestionInfo.hasAnswer,
                    answer: ndisQuestionInfo.answer,
                    questionKey: ndisQuestionInfo.question.question_key
                });

                // Create question object for NDIS page
                const ndisQuestion = {
                    ...ndisQuestionInfo.question,
                    answer: ndisQuestionInfo.answer,
                    oldAnswer: ndisQuestionInfo.answer,
                    orig_section_id: section.orig_section_id,
                    section_id: section.id, // IMPORTANT: Preserve section_id for dependencies
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

    console.log(`📊 NDIS questions processing summary:`, {
        movedQuestionsCount,
        ndisQuestionsLength: ndisQuestions.length,
        shouldCreateNdisPage: ndisQuestions.length > 0
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

        console.log(`✅ Created NDIS page with ${ndisPage.noItems} questions:`, {
            title: ndisPage.title,
            sectionsCount: ndisPage.Sections.length,
            questions: ndisPage.Sections.map(s => s.Questions.map(q => ({
                question: q.question,
                type: q.type,
                answer: q.answer,
                fromQa: q.fromQa,
                hasDependencies: q.QuestionDependencies?.length > 0
            }))).flat()
        });

        // Insert NDIS page after funding page
        const newFormData = [...updatedPages];
        newFormData.splice(fundingPageIndex + 1, 0, ndisPage);

        // ENHANCED: Apply dependencies to ALL pages including NDIS page
        console.log('🔗 Applying dependencies to all pages including NDIS page...');
        const finalFormData = newFormData.map(page => {
            const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, newFormData);
            
            // Calculate completion status for each page
            pageWithDependencies.completed = calculatePageCompletion(pageWithDependencies);
            console.log(`📊 Page "${page.title}" completion status: ${pageWithDependencies.completed}`);
            
            return pageWithDependencies;
        });

        // Update hasNext/hasBack and lastPage properties
        finalFormData.forEach((page, index) => {
            page.hasNext = index < finalFormData.length - 1;
            page.hasBack = index > 0;
            page.lastPage = index === finalFormData.length - 1;
        });

        console.log(`✅ Final form structure:`, {
            totalPages: finalFormData.length,
            pageOrder: finalFormData.map((p, i) => `${i}: ${p.title} (${p.id})`),
            ndisPagePosition: fundingPageIndex + 1
        });

        return finalFormData;
    } else {
        console.log('⚠️ No NDIS questions found to move, returning updated pages without NDIS page');
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
    console.log(`🔄 Force refreshing dependencies due to changes on page: ${changedPageId}`);
    
    if (changedQuestions.length > 0) {
        console.log('🔍 Changed questions:', changedQuestions.map(q => ({
            question: q.question,
            questionKey: q.question_key,
            newAnswer: q.answer,
            ndisOnly: q.ndis_only
        })));
    }
    
    // Create a fresh copy of all pages and apply dependencies
    const updatedPages = allPages.map(page => {
        const pageWithDependencies = applyQuestionDependenciesAcrossPages(page, allPages);
        
        // Log dependency changes for debugging
        if (page.id !== changedPageId) {
            const changesDetected = page.Sections?.some(section =>
                section.Questions?.some((originalQuestion, qIndex) => {
                    const updatedQuestion = pageWithDependencies.Sections
                        ?.find(s => s.id === section.id)
                        ?.Questions?.[qIndex];
                    
                    if (updatedQuestion && originalQuestion.hidden !== updatedQuestion.hidden) {
                        console.log(`🔄 Dependency change detected on "${page.title}":`, {
                            question: originalQuestion.question,
                            wasHidden: originalQuestion.hidden,
                            nowHidden: updatedQuestion.hidden,
                            changedBy: changedPageId
                        });
                        return true;
                    }
                    return false;
                })
            );
            
            if (changesDetected) {
                console.log(`✅ Dependencies updated for page: "${page.title}"`);
            }
        }
        
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

    console.log(`🔗 Applying dependencies for page: "${targetPage.title}"`);

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

                console.log(`🔍 Processing dependencies for question: "${q.question}" (${q.question_key})`, {
                    onPage: targetPage.title,
                    dependencies: q.QuestionDependencies.map(dep => ({
                        dependence_id: dep.dependence_id,
                        answer: dep.answer
                    }))
                });

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
                                            
                                            console.log(`🎯 Found dependency match in Questions:`, {
                                                dependentQuestion: q.question,
                                                dependentQuestionKey: q.question_key,
                                                foundQuestion: searchQuestion.question,
                                                foundQuestionKey: searchQuestion.question_key,
                                                foundQuestionId: searchQuestion.question_id || searchQuestion.id,
                                                foundAnswer: searchQuestion.answer,
                                                expectedAnswer: dependency.answer,
                                                foundOnPage: searchPage.title,
                                                foundInSection: searchSection.label,
                                                matches: answerMatches
                                            });

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
                                            
                                            console.log(`🎯 Found dependency match in QaPairs:`, {
                                                dependentQuestion: q.question,
                                                dependentQuestionKey: q.question_key,
                                                foundQuestion: searchQuestion.question || qaPair.question,
                                                foundQuestionKey: searchQuestion.question_key,
                                                foundQuestionId: qaPair.question_id,
                                                foundAnswer: qaPair.answer,
                                                expectedAnswer: dependency.answer,
                                                foundOnPage: searchPage.title,
                                                foundInSection: searchSection.label,
                                                matches: answerMatches
                                            });

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

                    // Log if dependency was not found
                    if (!dependencyMet && dependency.answer) {
                        console.log(`⚠️ Dependency not met for question "${q.question}":`, {
                            dependence_id: dependency.dependence_id,
                            expected_answer: dependency.answer,
                            searching_across_pages: allPages.map(p => p.title),
                            dependency_found: false
                        });
                    }
                });

                // Set question visibility based on dependencies
                const wasHidden = q.hidden;
                q.hidden = !shouldShow;
                
                if (wasHidden !== q.hidden) {
                    console.log(`📊 Dependency visibility changed for "${q.question}": ${wasHidden ? 'HIDDEN' : 'VISIBLE'} → ${q.hidden ? 'HIDDEN' : 'VISIBLE'}`);
                }
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

        if (updatedSection.hidden) {
            console.log(`🙈 Hiding section "${section.label}" - all questions are hidden`);
        }

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
    console.log('🔍 DEBUG: Analyzing question dependencies for all pages');
    
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
    
    // Second pass: analyze dependencies
    console.log('📊 Question inventory:');
    questionMap.forEach((questionInfo, questionId) => {
        console.log(`  ${questionId}: "${questionInfo.question}" (${questionInfo.questionKey}) on ${questionInfo.page} - Answer: ${questionInfo.answer}`);
        
        if (questionInfo.dependencies.length > 0) {
            console.log(`    Dependencies:`);
            questionInfo.dependencies.forEach(dep => {
                const dependentQuestion = questionMap.get(dep.dependence_id);
                if (dependentQuestion) {
                    console.log(`      ✅ Depends on: "${dependentQuestion.question}" (${dep.dependence_id}) = "${dep.answer}" | Current: "${dependentQuestion.answer}"`);
                } else {
                    console.log(`      ❌ Missing dependency: ${dep.dependence_id} = "${dep.answer}"`);
                }
            });
        }
    });
    
    // Third pass: check for moved NDIS questions
    console.log('🏥 NDIS Questions Analysis:');
    questionMap.forEach((questionInfo, questionId) => {
        if (questionInfo.ndis_only) {
            const shouldBeMoved = shouldMoveQuestionToNdisPage({ 
                ndis_only: true, 
                type: 'text', // placeholder
                question_key: questionInfo.questionKey 
            }, isNdisFunded);
            
            console.log(`  "${questionInfo.question}" on ${questionInfo.page}:`);
            console.log(`    Should be moved: ${shouldBeMoved}`);
            console.log(`    Current page is NDIS page: ${questionInfo.pageId === 'ndis_packages_page'}`);
            console.log(`    Has dependencies: ${questionInfo.dependencies.length > 0}`);
            
            if (questionInfo.dependencies.length > 0) {
                questionInfo.dependencies.forEach(dep => {
                    const dependentQuestion = questionMap.get(dep.dependence_id);
                    if (dependentQuestion) {
                        console.log(`      Dependency "${dependentQuestion.question}" is on: ${dependentQuestion.page}`);
                    }
                });
            }
        }
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
    console.log('🔍 DEBUG: Complete NDIS processing state');
    console.log('📊 State values:', {
        isNdisFunded,
        stableBookingRequestFormDataLength: stableBookingRequestFormData?.length,
        stableProcessedFormDataLength: stableProcessedFormData?.length,
        isProcessingNdis,
        isUpdating
    });

    if (stableBookingRequestFormData?.length > 0) {
        let ndisQuestionCount = 0;
        let regularQuestionCount = 0;
        
        stableBookingRequestFormData.forEach((page, pageIndex) => {
            console.log(`📄 Page ${pageIndex}: "${page.title}" (${page.id})`);
            
            page.Sections?.forEach((section, sectionIndex) => {
                console.log(`  📋 Section ${sectionIndex}: "${section.label}" (${section.id})`);
                
                // Count questions in Questions array
                section.Questions?.forEach((question, questionIndex) => {
                    if (question.ndis_only === true) {
                        ndisQuestionCount++;
                        console.log(`    🏥 NDIS Question ${questionIndex}: "${question.question}" (${question.type}, answer: ${question.answer})`);
                    } else {
                        regularQuestionCount++;
                        console.log(`    📝 Regular Question ${questionIndex}: "${question.question}" (${question.type}, answer: ${question.answer})`);
                    }
                });
                
                // Count questions in QaPairs array
                section.QaPairs?.forEach((qaPair, qaPairIndex) => {
                    const question = qaPair.Question;
                    if (question && question.ndis_only === true) {
                        console.log(`    🏥 NDIS QaPair ${qaPairIndex}: "${question.question}" (${question.type}, answer: ${qaPair.answer})`);
                    } else {
                        console.log(`    📝 Regular QaPair ${qaPairIndex}: "${question?.question}" (${question?.type}, answer: ${qaPair.answer})`);
                    }
                });
            });
        });
        
        console.log('📊 Question counts:', {
            ndisQuestionCount,
            regularQuestionCount,
            totalQuestions: ndisQuestionCount + regularQuestionCount
        });
    }
    
    // Also debug processed data if available
    if (stableProcessedFormData?.length > 0) {
        console.log('📊 Processed data structure:');
        stableProcessedFormData.forEach((page, pageIndex) => {
            const questionCount = page.Sections?.reduce((count, section) => 
                count + (section.Questions?.length || 0), 0) || 0;
            console.log(`  📄 Processed Page ${pageIndex}: "${page.title}" (${page.id}) - ${questionCount} questions`);
        });
    }
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
                console.log(`✅ Kept answered version of duplicate question: "${question.question}"`);
            } else {
                console.log(`🗑️ Removed unanswered duplicate question: "${question.question}"`);
            }
        } else {
            resolvedQuestions.push(question);
        }
    });
    
    return resolvedQuestions;
};

/**
 * Check for NDIS funding status changes
 * @param {Array} updatedPages - Updated pages to check
 * @param {boolean} isNdisFunded - Current NDIS funding status
 * @param {Function} dispatch - Redux dispatch function
 * @param {Object} bookingRequestFormActions - Redux actions
 * @returns {boolean} - True if funding status changed
 */
export const checkAndUpdateNdisFundingStatus = (updatedPages, isNdisFunded, dispatch, bookingRequestFormActions) => {
    console.log('🔍 Checking for NDIS funding status changes...');

    let fundingDetected = false;
    let newFundingStatus = isNdisFunded;

    // Check all pages for funding question answers
    for (const page of updatedPages) {
        for (const section of page.Sections || []) {
            // Check Questions array
            for (const question of section.Questions || []) {
                if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && question.answer) {
                    const isNdisAnswer = question.answer?.toLowerCase().includes('ndis') ||
                                       question.answer?.toLowerCase().includes('ndia');

                    console.log('💰 Funding answer found in Questions:', {
                        question: question.question,
                        answer: question.answer,
                        isNdisAnswer,
                        currentIsNdisFunded: isNdisFunded
                    });

                    if (isNdisAnswer && !isNdisFunded) {
                        console.log('✅ NDIS funding detected, updating state');
                        dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                        newFundingStatus = true;
                        fundingDetected = true;
                    } else if (!isNdisAnswer && isNdisFunded) {
                        console.log('❌ Non-NDIS funding detected, clearing NDIS state');
                        dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                        newFundingStatus = false;
                        fundingDetected = true;
                    }
                    break;
                }
            }
            
            // Also check QaPairs array
            for (const qaPair of section.QaPairs || []) {
                const question = qaPair.Question;
                if (question && questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE) && qaPair.answer) {
                    const isNdisAnswer = qaPair.answer?.toLowerCase().includes('ndis') ||
                                       qaPair.answer?.toLowerCase().includes('ndia');

                    console.log('💰 Funding answer found in QaPairs:', {
                        question: question.question,
                        answer: qaPair.answer,
                        isNdisAnswer,
                        currentIsNdisFunded: isNdisFunded
                    });

                    if (isNdisAnswer && !isNdisFunded) {
                        console.log('✅ NDIS funding detected, updating state');
                        dispatch(bookingRequestFormActions.setIsNdisFunded(true));
                        newFundingStatus = true;
                        fundingDetected = true;
                    } else if (!isNdisAnswer && isNdisFunded) {
                        console.log('❌ Non-NDIS funding detected, clearing NDIS state');
                        dispatch(bookingRequestFormActions.setIsNdisFunded(false));
                        newFundingStatus = false;
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
            console.log(`🚫 Filtering out NDIS question from original page during QA conversion: "${question.question}"`);
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

// NEW FUNCTIONS FOR NDIS DEPENDENCY FIX:

/**
 * Enhanced function to force refresh all dependencies with comprehensive answer mapping
 * @param {Array} allPages - All form pages
 * @returns {Array} - Updated pages with refreshed dependencies
 */
export const forceRefreshAllDependencies = (allPages) => {
    console.log('🔄 Force refreshing ALL dependencies across all pages...');
    
    // Create a comprehensive dependency map first
    const answerMap = new Map();
    
    // Build maps of all questions and their current answers
    allPages.forEach(page => {
        page.Sections?.forEach(section => {
            section.Questions?.forEach(question => {
                const questionId = question.question_id || question.id;
                const questionKey = question.question_key;
                
                if (questionId) {
                    answerMap.set(questionId, {
                        answer: question.answer,
                        question: question.question,
                        questionKey: questionKey,
                        page: page.title,
                        section: section.label
                    });
                }
                
                if (questionKey) {
                    answerMap.set(questionKey, {
                        answer: question.answer,
                        question: question.question,
                        questionKey: questionKey,
                        page: page.title,
                        section: section.label
                    });
                }
            });
            
            // Also check QaPairs
            section.QaPairs?.forEach(qaPair => {
                const questionId = qaPair.question_id;
                const question = qaPair.Question;
                const questionKey = question?.question_key;
                
                if (questionId) {
                    answerMap.set(questionId, {
                        answer: qaPair.answer,
                        question: question?.question || qaPair.question,
                        questionKey: questionKey,
                        page: page.title,
                        section: section.label,
                        isQaPair: true
                    });
                }
                
                if (questionKey) {
                    answerMap.set(questionKey, {
                        answer: qaPair.answer,
                        question: question?.question || qaPair.question,
                        questionKey: questionKey,
                        page: page.title,
                        section: section.label,
                        isQaPair: true
                    });
                }
            });
        });
    });
    
    console.log('📊 Built answer map with', answerMap.size, 'questions');
    
    // Apply dependencies with the comprehensive answer map
    const updatedPages = allPages.map(page => {
        const updatedPage = { ...page };
        
        updatedPage.Sections = page.Sections.map(section => {
            const updatedSection = { ...section };
            
            updatedSection.Questions = section.Questions.map(question => {
                let q = { ...question };
                
                // Process dependencies if they exist
                if (q.QuestionDependencies && q.QuestionDependencies.length > 0) {
                    let shouldShow = false;
                    
                    console.log(`🔍 Processing dependencies for "${q.question}" on ${page.title}:`, 
                        q.QuestionDependencies.map(dep => ({ id: dep.dependence_id, answer: dep.answer })));
                    
                    q.QuestionDependencies.forEach(dependency => {
                        // Check multiple possible matches including string versions
                        const possibleMatches = [
                            dependency.dependence_id,
                            dependency.dependence_id.toString(),
                            String(dependency.dependence_id)
                        ];
                        
                        let found = false;
                        for (const matchId of possibleMatches) {
                            const dependentAnswer = answerMap.get(matchId);
                            if (dependentAnswer) {
                                const answerMatches = checkAnswerMatch(dependentAnswer.answer, dependency.answer);
                                
                                console.log(`🎯 Dependency check: "${q.question}" depends on "${dependentAnswer.question}" = "${dependency.answer}"`, {
                                    currentAnswer: dependentAnswer.answer,
                                    expectedAnswer: dependency.answer,
                                    matches: answerMatches,
                                    foundOn: dependentAnswer.page
                                });
                                
                                if (answerMatches) {
                                    shouldShow = true;
                                    found = true;
                                    break;
                                }
                            }
                        }
                        
                        if (!found) {
                            console.log(`⚠️ Dependency not found: ${dependency.dependence_id} for question "${q.question}"`);
                        }
                    });
                    
                    const wasHidden = q.hidden;
                    q.hidden = !shouldShow;
                    
                    if (wasHidden !== q.hidden) {
                        console.log(`📊 Question visibility changed: "${q.question}" ${wasHidden ? 'HIDDEN' : 'VISIBLE'} → ${q.hidden ? 'HIDDEN' : 'VISIBLE'}`);
                    }
                } else {
                    // No dependencies, show the question unless explicitly hidden
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
    });
    
    return updatedPages;
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
 * Enhanced function to debug dependencies for a specific question
 * @param {Object} question - The question to debug
 * @param {Array} allPages - All form pages
 * @param {boolean} isNdisFunded - NDIS funding status
 */
export const debugSpecificQuestionDependencies = (question, allPages, isNdisFunded) => {
    console.log('🔍 DEBUG: Analyzing dependencies for specific question');
    console.log('Question:', question.question);
    console.log('Question Key:', question.question_key);
    console.log('Question ID:', question.question_id || question.id);
    console.log('NDIS Only:', question.ndis_only);
    console.log('Current Answer:', question.answer);
    console.log('Currently Hidden:', question.hidden);
    
    if (!question.QuestionDependencies || question.QuestionDependencies.length === 0) {
        console.log('✅ No dependencies found for this question');
        return;
    }
    
    console.log('📋 Dependencies:');
    
    question.QuestionDependencies.forEach((dependency, index) => {
        console.log(`\n  Dependency ${index + 1}:`);
        console.log(`    Dependence ID: ${dependency.dependence_id}`);
        console.log(`    Expected Answer: "${dependency.answer}"`);
        
        // Search for the dependent question
        let found = false;
        
        allPages.forEach(page => {
            page.Sections?.forEach(section => {
                // Check Questions array
                section.Questions?.forEach(searchQuestion => {
                    const matches = 
                        (searchQuestion.question_id === dependency.dependence_id) ||
                        (searchQuestion.id === dependency.dependence_id) ||
                        (searchQuestion.question_key === dependency.dependence_id);
                    
                    if (matches && !found) {
                        found = true;
                        const answerMatches = checkAnswerMatch(searchQuestion.answer, dependency.answer);
                        
                        console.log(`    ✅ Found in Questions array:`);
                        console.log(`      Question: "${searchQuestion.question}"`);
                        console.log(`      Current Answer: "${searchQuestion.answer}"`);
                        console.log(`      Page: ${page.title}`);
                        console.log(`      Section: ${section.label}`);
                        console.log(`      Answer Matches: ${answerMatches}`);
                        console.log(`      Question Hidden: ${searchQuestion.hidden}`);
                    }
                });
                
                // Check QaPairs array
                section.QaPairs?.forEach(qaPair => {
                    const searchQuestion = qaPair.Question;
                    const matches = 
                        (qaPair.question_id === dependency.dependence_id) ||
                        (searchQuestion?.question_key === dependency.dependence_id) ||
                        (searchQuestion?.question_id === dependency.dependence_id);
                    
                    if (matches && !found) {
                        found = true;
                        const answerMatches = checkAnswerMatch(qaPair.answer, dependency.answer);
                        
                        console.log(`    ✅ Found in QaPairs array:`);
                        console.log(`      Question: "${searchQuestion?.question || qaPair.question}"`);
                        console.log(`      Current Answer: "${qaPair.answer}"`);
                        console.log(`      Page: ${page.title}`);
                        console.log(`      Section: ${section.label}`);
                        console.log(`      Answer Matches: ${answerMatches}`);
                    }
                });
            });
        });
        
        if (!found) {
            console.log(`    ❌ Dependency not found anywhere!`);
        }
    });
};

/**
 * Function to validate that NDIS dependencies are working correctly
 * @param {Array} allPages - All form pages
 * @param {boolean} isNdisFunded - NDIS funding status
 */
export const validateNdisDependencies = (allPages, isNdisFunded) => {
    console.log('🔍 Validating NDIS dependencies...');
    
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
    
    console.log('📊 Dependency Validation Results:');
    console.log(`  Total Questions: ${totalQuestions}`);
    console.log(`  Questions with Dependencies: ${questionsWithDependencies}`);
    console.log(`  Dependencies Working Correctly: ${dependenciesWorking}`);
    console.log(`  Issues Found: ${issues.length}`);
    
    if (issues.length > 0) {
        console.log('❌ Issues:');
        issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue.type}: ${issue.question} on ${issue.page}`);
            if (issue.type === 'missing_dependency') {
                console.log(`     Missing dependency: ${issue.dependence_id} = "${issue.expected_answer}"`);
            } else if (issue.type === 'incorrect_visibility') {
                console.log(`     Should be visible: ${issue.shouldBeVisible}, Is visible: ${issue.isVisible}`);
            }
        });
    } else {
        console.log('✅ All dependencies are working correctly!');
    }
    
    return {
        totalQuestions,
        questionsWithDependencies,
        dependenciesWorking,
        issues
    };
};
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import NumberedListComponent, { StepState } from '../ui-v2/NumberedListComponent';

export default function RequestFormSidebar({ setBookingSubmittedState, prevBookingId, bookingRequestFormData }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const [currentUrl, setCurrentUrl] = useState();

    const handleRouterChange = async (url) => {
        // Remove any "&submit=true" parameter from the URL
        const cleanedUrl = url.replace('&submit=true', '');
        await router.push(cleanedUrl);
    }

    // ✅ ADD: Helper function to check for validation errors (same logic as accordion)
    const hasValidationErrors = (page) => {
        if (!page || !page.Sections) return false;
        
        return page.Sections.some(section =>
            section.Questions?.some(question =>
                !question.hidden && // Only check visible questions
                question.error && 
                question.error !== ''
            )
        );
    };

    const setCurrentPage = () => {
        // If URL contains submit=true and we're in submission mode, return null or early
        if (router.asPath.includes('&submit=true')) {
            return null;
        }

        const paths = router.asPath.split('&&');
        let currentPage;

        if (paths.length === 1) {
            // Check if bookingRequestFormData exists and has elements
            if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
                return null;
            }
            
            currentPage = structuredClone(bookingRequestFormData[0]);
            if (currentPage) {
                currentPage.active = true;
                handleRouterChange(router.asPath + currentPage.url);
            }
        } else {
            setCurrentUrl('&&' + paths[1]);
            
            // Extract page ID from URL
            const urlPageId = paths[1].split('=')[1];
            
            // ✅ CRITICAL FIX: Try multiple strategies to find the page
            let foundPage = null;
            
            // Strategy 1: Try exact URL match
            foundPage = bookingRequestFormData.find(r => r.url === "&&" + paths[1]);
            
            // Strategy 2: Try by ID (handling both string and numeric IDs)
            if (!foundPage && urlPageId) {
                // Try string ID match (for dynamic pages like 'ndis_packages_page')
                foundPage = bookingRequestFormData.find(r => 
                    String(r.id) === String(urlPageId)
                );
                
                // Try numeric ID match (for regular pages)
                if (!foundPage) {
                    const numericId = parseInt(urlPageId);
                    if (!isNaN(numericId)) {
                        foundPage = bookingRequestFormData.find(r => r.id === numericId);
                    }
                }
                
                if (foundPage) {
                    console.log(`✅ Found page by ID: ${foundPage.title} (ID: ${foundPage.id})`);
                }
            }
            
            // Strategy 3: Check if this is a special NDIS page
            if (!foundPage && urlPageId === 'ndis_packages_page') {
                foundPage = bookingRequestFormData.find(r => 
                    r.id === 'ndis_packages_page' || r.title === 'NDIS Requirements'
                );
                
                if (foundPage) {
                    console.log(`✅ Found NDIS Requirements page by special lookup`);
                }
            }
            
            // If page doesn't exist in data, log warning but DON'T redirect immediately
            if (!foundPage) {
                console.warn(`⚠️ Page not found for URL: ${paths[1]}`, {
                    urlPageId,
                    urlPageIdType: typeof urlPageId,
                    availablePages: bookingRequestFormData.map(p => ({ 
                        id: p.id, 
                        title: p.title, 
                        url: p.url,
                        idType: typeof p.id
                    }))
                });
                
                // LAST RESORT: If it's supposed to be the NDIS page but we can't find it,
                // it might not have been created yet. Return null to let the system handle it.
                if (urlPageId === 'ndis_packages_page') {
                    console.log('🔄 NDIS page not found but requested - may be pending creation');
                    return null;
                }
                
                // For other missing pages, redirect to first page
                if (bookingRequestFormData.length > 0) {
                    const firstPage = bookingRequestFormData[0];
                    console.log(`⚠️ Redirecting to first page: ${firstPage.title}`);
                    handleRouterChange(router.asPath.split('&&')[0] + firstPage.url);
                    return firstPage;
                }
                return null;
            }
            
            currentPage = structuredClone(foundPage);
            if (currentPage) {
                currentPage.active = true;
            }
        }

        // Safety check before scrolling - using String() for comparison
        const pageId = currentUrl ? currentUrl.split('=')[1] : null;
        if (currentPage && pageId && String(pageId) !== String(currentPage.id)) {
            window.scrollTo(0, 0);
        }

        return currentPage;
    }

    // Clean URL by removing submit parameter
    const getCleanUrl = (baseUrl) => {
        return baseUrl.replace('&submit=true', '');
    }

    // SIMPLIFIED: Just use whatever pages exist in the data
    const steps = useMemo(() => {
        if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
            return [];
        }

        const stablePages = bookingRequestFormData.filter(page => page.id && page.title);

        return stablePages.map((page, index) => {
            // Determine the step state based on page properties
            let stepState = StepState.NOT_SELECTED;
            let status = null;
            let statusType = null;
            
            // ✅ CRITICAL FIX: Check for validation errors FIRST (before completion check)
            const hasErrors = hasValidationErrors(page);
            const isCompleted = Boolean(page.completed);

            if (currentUrl && currentUrl === page.url) {
                // Currently selected page
                stepState = StepState.SELECTED;
                
                // ✅ UPDATED: Check errors before completion
                if (hasErrors) {
                    status = 'Error';
                    statusType = 'error';
                } else if (isCompleted) {
                    status = 'Complete';
                    statusType = 'success';
                } else {
                    status = 'Pending';
                    statusType = 'pending';
                }
            } else {
                // Not currently selected
                // ✅ UPDATED: Check errors before completion
                if (hasErrors) {
                    stepState = StepState.NOT_SELECTED; // Or could use a specific ERROR state
                    status = 'Error';
                    statusType = 'error';
                } else if (isCompleted) {
                    stepState = StepState.COMPLETED;
                    status = 'Complete';
                    statusType = 'success';
                }
                // else: remains NOT_SELECTED with no status
            }

            return {
                id: page.id.toString(),
                label: page.title,
                initialState: stepState,
                status: status,
                statusType: statusType,
                pageData: page,
                url: page.url,
                placeholder: false
            };
        });
    }, [bookingRequestFormData, currentUrl, prevBookingId]); // ✅ Note: hasValidationErrors is stable

    // Handle step click for navigation
    const handleStepClick = (stepId) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) {
            console.log('Step not found:', stepId);
            return;
        }

        // ✅ UPDATED: Allow navigation to error pages too (so users can fix them)
        // Only block navigation to incomplete pages without errors
        const canNavigate = step.pageData.completed || 
                           hasValidationErrors(step.pageData) ||
                           (currentUrl && currentUrl === step.url);
        
        if (canNavigate) {
            let url = router.asPath;
            const paths = router.asPath.split('&&');
            if (paths.length === 2) {
                url = paths[0] + step.url;
            }
            
            // Remove any submit=true parameter
            const cleanUrl = getCleanUrl(url);
            
            console.log('🔄 Sidebar navigation to:', step.label, 'URL:', cleanUrl);
            
            setBookingSubmittedState(false);
            handleRouterChange(cleanUrl);
        } else {
            console.log('❌ Navigation blocked - page not complete and has no errors:', step.label);
        }
    };

    // Set current page when router or form data changes
    useEffect(() => {
        if (router && bookingRequestFormData && bookingRequestFormData.length > 0) {
            try {
                const currentPage = setCurrentPage();
                if (currentPage) {
                    dispatch(bookingRequestFormActions.setCurrentPage(currentPage));
                }
            } catch (error) {
                console.error("Error setting current page:", error);
            }
        }
    }, [router, bookingRequestFormData]);

    // Early return if no data yet
    if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
        return (
            <div className="h-full bg-zinc-100 w-full">
                <div className="flex flex-col justify-center items-center h-full">
                    <div className="p-4 text-gray-500 text-center">Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-100 w-full min-h-full">
            <div className="flex flex-col">
                {/* Mobile Title - Only show on mobile since desktop title is in the unified header */}
                <div className="px-4 py-5 bg-gray-100 flex items-center">
                    <h2 className="text-lg font-bold text-[#00467F]">
                        BOOKINGS REQUEST FORM
                    </h2>
                </div>
                
                {/* Steps Navigation */}
                <div className="p-4">
                    <NumberedListComponent 
                        steps={steps} 
                        onStepClick={handleStepClick}
                        allowClickOnlyCompleted={false}
                        allowClickBasedOnStatus={['success', 'error']}
                        showForms={false}
                    />
                </div>
            </div>
        </div>
    )
}
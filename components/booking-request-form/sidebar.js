import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import NumberedListComponent, { StepState } from '../ui-v2/NumberedListComponent';

export default function RequestFormSidebar({ setBookingSubmittedState }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const bookingRequestFormData = useSelector(state => state.bookingRequestForm.data);
    const isNdisFunded = useSelector(state => state.bookingRequestForm.isNdisFunded);
    const [currentUrl, setCurrentUrl] = useState();

    const handleRouterChange = async (url) => {
        // Remove any "&submit=true" parameter from the URL
        const cleanedUrl = url.replace('&submit=true', '');
        await router.push(cleanedUrl);
    }

    // ENHANCED: Check if NDIS page should exist based on funding status
    const shouldNdisPageExist = () => {
        return isNdisFunded && bookingRequestFormData.some(page => 
            page.Sections?.some(section => 
                section.Questions?.some(question => 
                    question.question_key === 'funding-source' && 
                    question.answer && 
                    (question.answer.toLowerCase().includes('ndis') || question.answer.toLowerCase().includes('ndia'))
                )
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
            
            // Check if the URL actually exists in our data
            let foundPage = bookingRequestFormData.find(r => r.url === "&&" + paths[1]);
            
            // ENHANCED: Special handling for NDIS page
            if (!foundPage && urlPageId === 'ndis_packages_page') {
                // Check if NDIS page should exist but hasn't been created yet
                if (shouldNdisPageExist()) {
                    console.log('NDIS page should exist but not found, waiting for creation...');
                    // Return null to wait for the page to be created
                    return null;
                } else {
                    console.log('NDIS page not needed, redirecting to first page');
                    // NDIS page shouldn't exist, redirect to first page
                    if (bookingRequestFormData.length > 0) {
                        const firstPage = bookingRequestFormData[0];
                        handleRouterChange(router.asPath.split('&&')[0] + firstPage.url);
                        return firstPage;
                    }
                }
            }
            
            // ENHANCED: Better fallback for missing pages
            if (!foundPage) {
                console.log(`Page not found for URL: ${paths[1]}, available pages:`, 
                    bookingRequestFormData.map(p => ({ id: p.id, url: p.url })));
                
                // Try to find page by ID instead of URL
                if (urlPageId) {
                    foundPage = bookingRequestFormData.find(r => r.id === urlPageId);
                    if (foundPage) {
                        console.log(`Found page by ID: ${foundPage.title}`);
                        // Update URL to match the found page
                        handleRouterChange(router.asPath.split('&&')[0] + foundPage.url);
                    }
                }
                
                // If still not found, redirect to first page
                if (!foundPage && bookingRequestFormData.length > 0) {
                    console.log('Redirecting to first page due to missing page');
                    const firstPage = bookingRequestFormData[0];
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

        // Safety check before scrolling
        const pageId = currentUrl ? currentUrl.split('=')[1] : null;
        if (currentPage && pageId && pageId !== currentPage.id) {
            window.scrollTo(0, 0);
        }

        return currentPage;
    }

    // Clean URL by removing submit parameter
    const getCleanUrl = (baseUrl) => {
        return baseUrl.replace('&submit=true', '');
    }

    // ENHANCED: Include NDIS page in steps when it should exist
    const steps = useMemo(() => {
        if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
            return [];
        }

        // ADDED: Check if we should show NDIS page in sidebar even if it doesn't exist yet
        const ndisPageMissing = shouldNdisPageExist() && 
            !bookingRequestFormData.find(p => p.id === 'ndis_packages_page');

        let pagesForSteps = [...bookingRequestFormData];

        // ADDED: Add placeholder NDIS page to sidebar if it should exist but doesn't
        if (ndisPageMissing) {
            // Find funding page to insert after it
            const fundingPageIndex = pagesForSteps.findIndex(page => 
                page.Sections?.some(section => 
                    section.Questions?.some(question => 
                        question.question_key === 'funding-source'
                    )
                )
            );

            if (fundingPageIndex !== -1) {
                const placeholderNdisPage = {
                    id: 'ndis_packages_page',
                    title: 'NDIS Requirements',
                    url: '&&page_id=ndis_packages_page',
                    completed: false,
                    placeholder: true // Mark as placeholder
                };
                pagesForSteps.splice(fundingPageIndex + 1, 0, placeholderNdisPage);
            }
        }

        return pagesForSteps.map((page, index) => {
            // Determine the step state based on page properties
            let stepState = StepState.NOT_SELECTED;
            let status = null;
            let statusType = null;

            if (page.placeholder) {
                // Placeholder page - show as pending
                stepState = StepState.NOT_SELECTED;
                status = 'Pending';
                statusType = 'pending';
            } else if (currentUrl && currentUrl === page.url) {
                stepState = StepState.SELECTED;
                if (page.completed) {
                    status = 'Complete';
                    statusType = 'success';
                } else {
                    status = 'Pending';
                    statusType = 'pending';
                }
            } else if (page.completed) {
                stepState = StepState.COMPLETED;
                status = 'Complete';
                statusType = 'success';
            }

            return {
                id: page.id.toString(),
                label: page.title,
                initialState: stepState,
                status: status,
                statusType: statusType,
                pageData: page,
                url: page.url,
                placeholder: page.placeholder || false
            };
        });
    }, [bookingRequestFormData, currentUrl, isNdisFunded]);

    // Handle step click for navigation
    const handleStepClick = (stepId) => {
        const step = steps.find(s => s.id === stepId);
        if (!step) return;

        // Don't allow navigation to placeholder pages
        if (step.placeholder) {
            console.log('Cannot navigate to placeholder page');
            return;
        }

        // Only allow navigation to completed pages or current page
        if (step.pageData.completed || (currentUrl && currentUrl === step.url)) {
            let url = router.asPath;
            const paths = router.asPath.split('&&');
            if (paths.length === 2) {
                url = paths[0] + step.url;
            }
            
            // Remove any submit=true parameter
            const cleanUrl = getCleanUrl(url);
            
            setBookingSubmittedState(false);
            handleRouterChange(cleanUrl);
        }
    };

    // ENHANCED: Re-run when NDIS funding status changes
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
    }, [router, bookingRequestFormData, isNdisFunded]); // Added isNdisFunded dependency

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
                        allowClickOnlyCompleted={true}
                        showForms={false}
                    />
                </div>
            </div>
        </div>
    )
}
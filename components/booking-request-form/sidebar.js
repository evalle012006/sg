import { useRouter } from "next/router";
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bookingRequestFormActions } from '../../store/bookingRequestFormSlice';
import NumberedListComponent, { StepState } from '../ui-v2/NumberedListComponent';

export default function RequestFormSidebar({ setBookingSubmittedState }) {
    const router = useRouter();
    const dispatch = useDispatch();
    const bookingRequestFormData = useSelector(state => state.bookingRequestForm.data);
    const [currentUrl, setCurrentUrl] = useState();

    const handleRouterChange = async (url) => {
        // Remove any "&submit=true" parameter from the URL
        const cleanedUrl = url.replace('&submit=true', '');
        await router.push(cleanedUrl);
    }

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
            
            // Check if the URL actually exists in our data
            const foundPage = bookingRequestFormData.find(r => r.url === "&&" + paths[1]);
            if (!foundPage) {
                return null;
            }
            
            currentPage = structuredClone(foundPage);
            if (currentPage) {
                currentPage.active = true;
            }
        }

        // Safety check before scrolling
        const pageId = currentUrl ? currentUrl.split('=')[1] : null;
        if (currentPage && pageId && parseInt(pageId) !== currentPage.id) {
            window.scrollTo(0, 0);
        }

        return currentPage;
    }

    // Clean URL by removing submit parameter
    const getCleanUrl = (baseUrl) => {
        return baseUrl.replace('&submit=true', '');
    }

    // Transform bookingRequestFormData to steps format for NumberedListComponent
    const transformToSteps = () => {
        if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
            return [];
        }

        return bookingRequestFormData.map((page, index) => {
            // Determine the step state based on page properties
            let stepState = StepState.NOT_SELECTED;
            let status = null;
            let statusType = null;

            if (page.completed) {
                stepState = StepState.COMPLETED;
                status = 'Complete';
                statusType = 'success';
            } else if (currentUrl && currentUrl === page.url) {
                // Current active page should have blue background (SELECTED)
                // but show shorter "Active" status badge
                stepState = StepState.SELECTED;
                status = 'Pending';
                statusType = 'pending';
            }
            // All other steps remain NOT_SELECTED (gray background, no status)

            return {
                id: page.id.toString(),
                label: page.title,
                initialState: stepState,
                status: status,
                statusType: statusType,
                pageData: page,
                url: page.url
            };
        });
    };

    // Handle step click for navigation
    const handleStepClick = (stepId) => {
        const step = transformToSteps().find(s => s.id === stepId);
        if (!step) return;

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

    const steps = transformToSteps();

    return (
        <div className="bg-zinc-100 w-full min-h-full">
            <div className="flex flex-col">
                {/* Mobile Title - Only show on mobile since desktop title is in the unified header */}
                <div className="px-4 py-5 bg-gray-100 flex items-center">
                    <h2 className="text-lg font-bold text-[#00467F]">
                        BOOKINGS REQUEST FORM
                    </h2>
                </div>
                
                {/* Steps Navigation - FIXED: No height constraint, flows naturally */}
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
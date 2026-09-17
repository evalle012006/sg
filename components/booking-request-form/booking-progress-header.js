import React, { useMemo } from 'react';
import Button from '../ui-v2/Button';

const BookingProgressHeader = ({ 
    bookingRequestFormData,
    origin,
    onSaveExit,
    onCancel,
    onChangePathway,
}) => {
    // FIXED: Use useMemo instead of useEffect + useState to prevent infinite re-renders
    const progressData = useMemo(() => {
        if (!bookingRequestFormData || bookingRequestFormData.length === 0) {
            return {
                progress: 0,
                totalSteps: 0,
                completedSteps: 0
            };
        }

        const totalPages = bookingRequestFormData.length;
        const completedPages = bookingRequestFormData.filter(page => page.completed).length;
        
        // Calculate progress based on completed pages vs total pages
        const pageProgress = totalPages > 0 ? (completedPages / totalPages) * 100 : 0;
        
        return {
            progress: Math.round(pageProgress),
            totalSteps: totalPages,
            completedSteps: completedPages
        };
    }, [bookingRequestFormData]); // Only recalculate when bookingRequestFormData actually changes

    const { progress, totalSteps, completedSteps } = progressData;

    return (
        <>
            {/* Desktop Progress Header */}
            <div className="hidden lg:block w-full bg-gray-100 border-b border-gray-200">
                <div className="flex items-center justify-between px-6 py-4">
                    {/* Left - Change pathway link + Action Buttons */}
                    <div className="flex items-center space-x-6">
                        {!origin && onChangePathway && (completedSteps === 0 || completedSteps === 1) && (
                            <button
                                onClick={onChangePathway}
                                className="text-sm text-gray-500 hover:text-blue-700 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                            >
                                ← Change booking type
                            </button>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center space-x-3">
                            <Button
                                color="outline"
                                size="medium"
                                label="CANCEL"
                                onClick={onCancel}
                            />
                            
                            {!origin && (
                                <Button
                                    color="primary"
                                    size="medium"
                                    label="SAVE & EXIT"
                                    onClick={onSaveExit}
                                />
                            )}
                        </div>
                    </div>

                    {/* Right - Progress Info */}
                    <div className="flex items-center space-x-3">
                        <span className="text-sm font-semibold text-gray-800">
                            {progress}%
                        </span>
                        <div className="w-32 h-3 bg-gray-300 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="text-sm text-gray-600">
                            <span className="font-medium">{completedSteps}</span> of <span className="font-medium">{totalSteps}</span> page completed
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Progress Header */}
            <div className="lg:hidden w-full bg-gray-100 border-b border-gray-200 px-4 py-3">
                {/* Change pathway link - mobile */}
                {!origin && onChangePathway && completedSteps === 0 && (
                    <div className="mb-2">
                        <button
                            onClick={onChangePathway}
                            className="text-sm text-gray-500 hover:text-blue-700 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                        >
                            ← Change booking type
                        </button>
                    </div>
                )}
                {/* Progress Info */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-gray-800">
                                {progress}%
                            </span>
                            <div className="w-24 h-2 bg-gray-300 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            <span className="font-medium">{completedSteps}</span>/<span className="font-medium">{totalSteps}</span> steps
                        </div>
                    </div>
                </div>

                {/* Action Buttons - Mobile */}
                <div className="flex items-center justify-start">
                    <div className="flex items-center space-x-2">
                        <Button
                            color="outline"
                            size="small"
                            label="CANCEL"
                            onClick={onCancel}
                        />
                        
                        {!origin && (
                            <Button
                                color="primary"
                                size="small"
                                label="SAVE & EXIT"
                                onClick={onSaveExit}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default BookingProgressHeader;
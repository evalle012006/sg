import React, { useMemo } from 'react';
import Button from '../ui-v2/Button';

const BookingProgressHeader = ({ 
    bookingRequestFormData,
    origin,
    onSaveExit,
    onCancel
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
                <div className="flex items-center justify-end px-6 py-4">
                    {/* Right - Progress Info + Action Buttons */}
                    <div className="flex items-center space-x-6">
                        {/* Progress Info */}
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
                        </div>
                        <div className="text-sm text-gray-600">
                            <span className="font-medium">{completedSteps}</span> of <span className="font-medium">{totalSteps}</span> page completed
                        </div>

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
                </div>
            </div>

            {/* Mobile Progress Header */}
            <div className="lg:hidden w-full bg-gray-100 border-b border-gray-200 px-4 py-3">
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
                <div className="flex items-center justify-end">
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
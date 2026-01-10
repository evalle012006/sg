import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { X } from 'lucide-react';
import moment from 'moment';

import dynamic from 'next/dynamic';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));

// Spinal cord injury level options
const CERVICAL_LEVELS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
const THORACIC_LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const LUMBAR_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5'];
const SACRAL_LEVELS = ['S1', 'S2', 'S3', 'S4', 'S5'];

const FUNDING_OPTIONS = [
    { value: 'ndis', label: 'NDIS' },
    { value: 'icare', label: 'iCare' },
    { value: 'other', label: 'Other' }
];

const COMPLETING_FOR_OPTIONS = [
    { value: 'myself', label: 'I am completing this form for myself' },
    { value: 'other', label: 'I am completing this form for a client or family member I support' }
];

const SUPPORT_PERSON_ROLE_OPTIONS = [
    { value: 'allied_health', label: 'Allied Health Professional (i.e. OT, PT, EP)' },
    { value: 'support_coordinator', label: 'NDIS Support Coordinator' },
    { value: 'case_manager', label: 'Case Manager' },
    { value: 'other', label: 'Other' }
];

export default function CourseEOIModal({ 
    isOpen, 
    onClose, 
    selectedCourse = null,
    allCourses = [],
    guestData = null 
}) {
    const user = useSelector(state => state.user.user);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    
    // Form state
    const [formData, setFormData] = useState({
        // Who is completing
        completing_for: 'myself',
        has_sci: 'yes',
        
        // Guest details
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        funding_type: null, // Store as object { value, label }
        
        // Support person details (if completing for someone else)
        support_name: '',
        support_phone: '',
        support_email: '',
        support_role: null, // Store as object { value, label }
        
        // SCI Level
        sci_level_cervical: [],
        sci_level_thoracic: [],
        sci_level_lumbar: [],
        sci_level_sacral: [],
        
        // Course selection
        selected_courses: [],
        course_date_preferences: {}, // { courseId: ['date1', 'date2'] }
        
        // Additional info
        comments: ''
    });

    // Pre-fill form with guest data
    useEffect(() => {
        if (isOpen && (user || guestData)) {
            const guest = guestData || user;
            setFormData(prev => ({
                ...prev,
                guest_name: `${guest.first_name || ''} ${guest.last_name || ''}`.trim(),
                guest_email: guest.email || '',
                guest_phone: guest.phone || guest.mobile || ''
            }));
        }
        
        // Pre-select course if one was clicked
        if (isOpen && selectedCourse) {
            setFormData(prev => ({
                ...prev,
                selected_courses: [selectedCourse.id]
            }));
        }
    }, [user, guestData, selectedCourse, isOpen]);

    // Reset form when modal closes
    useEffect(() => {
        if (!isOpen) {
            setCurrentStep(1);
        }
    }, [isOpen]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle Select component click (it returns the full option object)
    const handleSelectChange = (field, option) => {
        setFormData(prev => ({
            ...prev,
            [field]: option // Store the full object { value, label }
        }));
    };

    const handleSCILevelToggle = (category, level) => {
        const fieldName = `sci_level_${category}`;
        setFormData(prev => {
            const currentLevels = prev[fieldName] || [];
            if (currentLevels.includes(level)) {
                return {
                    ...prev,
                    [fieldName]: currentLevels.filter(l => l !== level)
                };
            } else {
                return {
                    ...prev,
                    [fieldName]: [...currentLevels, level]
                };
            }
        });
    };

    const handleCourseToggle = (courseId) => {
        setFormData(prev => {
            const currentCourses = prev.selected_courses || [];
            if (currentCourses.includes(courseId)) {
                // Remove course and its date preferences
                const newDatePrefs = { ...prev.course_date_preferences };
                delete newDatePrefs[courseId];
                return {
                    ...prev,
                    selected_courses: currentCourses.filter(id => id !== courseId),
                    course_date_preferences: newDatePrefs
                };
            } else {
                return {
                    ...prev,
                    selected_courses: [...currentCourses, courseId]
                };
            }
        });
    };

    const handleCourseDatePreference = (courseId, date) => {
        setFormData(prev => {
            const currentPrefs = prev.course_date_preferences[courseId] || [];
            let newPrefs;
            if (currentPrefs.includes(date)) {
                newPrefs = currentPrefs.filter(d => d !== date);
            } else {
                newPrefs = [...currentPrefs, date];
            }
            return {
                ...prev,
                course_date_preferences: {
                    ...prev.course_date_preferences,
                    [courseId]: newPrefs
                }
            };
        });
    };

    const validateStep = (step) => {
        switch (step) {
            case 1:
                // Basic info validation
                if (!formData.completing_for) return 'Please select who you are completing this form for';
                if (!formData.has_sci) return 'Please indicate if you have a Spinal Cord Injury';
                return null;
            case 2:
                // Guest details validation
                if (!formData.guest_name?.trim()) return 'Please enter your full name';
                if (!formData.guest_phone?.trim()) return 'Please enter your contact number';
                if (!formData.guest_email?.trim()) return 'Please enter your email address';
                if (!formData.funding_type) return 'Please select how you are funding your stay';
                
                // Support person validation if completing for someone else
                if (formData.completing_for === 'other') {
                    if (!formData.support_name?.trim()) return 'Please enter the support person\'s name';
                    if (!formData.support_phone?.trim()) return 'Please enter the support person\'s contact number';
                    if (!formData.support_email?.trim()) return 'Please enter the support person\'s email';
                    if (!formData.support_role) return 'Please select the support person\'s role';
                }
                return null;
            case 3:
                // SCI Level validation - at least one level should be selected
                const hasLevel = formData.sci_level_cervical.length > 0 ||
                                formData.sci_level_thoracic.length > 0 ||
                                formData.sci_level_lumbar.length > 0 ||
                                formData.sci_level_sacral.length > 0;
                if (!hasLevel) return 'Please select at least one spinal cord injury level';
                return null;
            case 4:
                // Course selection validation
                if (formData.selected_courses.length === 0) return 'Please select at least one course';
                return null;
            default:
                return null;
        }
    };

    const handleNext = () => {
        const error = validateStep(currentStep);
        if (error) {
            toast.error(error);
            return;
        }
        setCurrentStep(prev => Math.min(prev + 1, 5));
    };

    const handleBack = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async () => {
        const error = validateStep(currentStep);
        if (error) {
            toast.error(error);
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                // Extract value from select objects for API
                funding_type: formData.funding_type?.value || formData.funding_type,
                support_role: formData.support_role?.value || formData.support_role,
                guest_id: user?.id,
                submitted_at: new Date().toISOString()
            };

            const response = await fetch('/api/courses/eoi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                toast.success('Your expression of interest has been submitted successfully!');
                onClose();
            } else {
                const data = await response.json();
                throw new Error(data.message || 'Failed to submit expression of interest');
            }
        } catch (error) {
            console.error('Error submitting EOI:', error);
            toast.error(error.message || 'Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center mb-6">
            {[1, 2, 3, 4, 5].map((step, index) => (
                <React.Fragment key={step}>
                    <div 
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            step === currentStep 
                                ? 'bg-[#00467F] text-white' 
                                : step < currentStep 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                        {step < currentStep ? '✓' : step}
                    </div>
                    {index < 4 && (
                        <div className={`w-12 h-1 ${step < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    const renderStep1 = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Welcome</h3>
                <p className="text-sm text-gray-600 mb-6">
                    Please complete this form to register your interest in one or more of our courses.
                    <br /><br />
                    <strong>Please note:</strong> this is a register of interest only and this is not a confirmation of your stay.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Please select one of the following: <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                    {COMPLETING_FOR_OPTIONS.map(option => (
                        <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
                            <input
                                type="radio"
                                name="completing_for"
                                value={option.value}
                                checked={formData.completing_for === option.value}
                                onChange={(e) => handleInputChange('completing_for', e.target.value)}
                                className="w-4 h-4 text-[#00467F] border-gray-300 focus:ring-[#00467F]"
                            />
                            <span className="text-sm text-gray-700">{option.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do you (or the person you are completing this form for) have a Spinal Cord Injury? <span className="text-red-500">*</span>
                </label>
                <div className="flex space-x-6">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_sci"
                            value="yes"
                            checked={formData.has_sci === 'yes'}
                            onChange={(e) => handleInputChange('has_sci', e.target.value)}
                            className="w-4 h-4 text-[#00467F] border-gray-300 focus:ring-[#00467F]"
                        />
                        <span className="text-sm text-gray-700">Yes</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                            type="radio"
                            name="has_sci"
                            value="no"
                            checked={formData.has_sci === 'no'}
                            onChange={(e) => handleInputChange('has_sci', e.target.value)}
                            className="w-4 h-4 text-[#00467F] border-gray-300 focus:ring-[#00467F]"
                        />
                        <span className="text-sm text-gray-700">No</span>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Guest Details</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                    label="Full Name"
                    value={formData.guest_name}
                    onChange={(value) => handleInputChange('guest_name', value)}
                    placeholder="Enter your full name"
                    required
                />
                <TextField
                    label="Best Contact Number"
                    value={formData.guest_phone}
                    onChange={(value) => handleInputChange('guest_phone', value)}
                    placeholder="Enter your phone number"
                    required
                />
                <TextField
                    label="Email Address"
                    type="email"
                    value={formData.guest_email}
                    onChange={(value) => handleInputChange('guest_email', value)}
                    placeholder="Enter your email"
                    required
                />
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        How are you funding your stay? <span className="text-red-500">*</span>
                    </label>
                    <Select
                        label="Select funding type"
                        options={FUNDING_OPTIONS}
                        value={formData.funding_type}
                        onClick={(option) => handleSelectChange('funding_type', option)}
                        size="medium"
                    />
                </div>
            </div>

            {formData.completing_for === 'other' && (
                <>
                    <div className="border-t pt-6 mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Support Person Details</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <TextField
                            label="Full Name"
                            value={formData.support_name}
                            onChange={(value) => handleInputChange('support_name', value)}
                            placeholder="Enter support person's name"
                            required
                        />
                        <TextField
                            label="Best Contact Number"
                            value={formData.support_phone}
                            onChange={(value) => handleInputChange('support_phone', value)}
                            placeholder="Enter phone number"
                            required
                        />
                        <TextField
                            label="Email Address"
                            type="email"
                            value={formData.support_email}
                            onChange={(value) => handleInputChange('support_email', value)}
                            placeholder="Enter email"
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Please select the best option that describes you <span className="text-red-500">*</span>
                            </label>
                            <Select
                                label="Select your role"
                                options={SUPPORT_PERSON_ROLE_OPTIONS}
                                value={formData.support_role}
                                onClick={(option) => handleSelectChange('support_role', option)}
                                size="medium"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Level of Spinal Cord Injury</h3>
                <p className="text-sm text-gray-600 mb-4">Please select all that apply</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Cervical */}
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Cervical</h4>
                    <div className="space-y-2">
                        {CERVICAL_LEVELS.map(level => (
                            <label key={level} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sci_level_cervical.includes(level)}
                                    onChange={() => handleSCILevelToggle('cervical', level)}
                                    className="w-4 h-4 text-[#00467F] border-gray-300 rounded focus:ring-[#00467F]"
                                />
                                <span className="text-sm text-gray-700">{level}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Thoracic */}
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Thoracic</h4>
                    <div className="space-y-2">
                        {THORACIC_LEVELS.map(level => (
                            <label key={level} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sci_level_thoracic.includes(level)}
                                    onChange={() => handleSCILevelToggle('thoracic', level)}
                                    className="w-4 h-4 text-[#00467F] border-gray-300 rounded focus:ring-[#00467F]"
                                />
                                <span className="text-sm text-gray-700">{level}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Lumbar */}
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Lumbar</h4>
                    <div className="space-y-2">
                        {LUMBAR_LEVELS.map(level => (
                            <label key={level} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sci_level_lumbar.includes(level)}
                                    onChange={() => handleSCILevelToggle('lumbar', level)}
                                    className="w-4 h-4 text-[#00467F] border-gray-300 rounded focus:ring-[#00467F]"
                                />
                                <span className="text-sm text-gray-700">{level}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Sacral */}
                <div>
                    <h4 className="font-medium text-gray-900 mb-3">Sacral</h4>
                    <div className="space-y-2">
                        {SACRAL_LEVELS.map(level => (
                            <label key={level} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.sci_level_sacral.includes(level)}
                                    onChange={() => handleSCILevelToggle('sacral', level)}
                                    className="w-4 h-4 text-[#00467F] border-gray-300 rounded focus:ring-[#00467F]"
                                />
                                <span className="text-sm text-gray-700">{level}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => {
        // Get available courses (either all courses or just the preselected one)
        const availableCourses = selectedCourse ? [selectedCourse] : allCourses;
        
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Course Interested In</h3>
                    <p className="text-sm text-gray-600 mb-4">Please select all that apply</p>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {availableCourses.map(course => {
                        const isSelected = formData.selected_courses.includes(course.id);
                        const courseDates = course.start_date && course.end_date 
                            ? `${moment(course.start_date).format('DD MMM YYYY')} - ${moment(course.end_date).format('DD MMM YYYY')}`
                            : 'Dates TBD';
                        
                        return (
                            <div 
                                key={course.id} 
                                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                    isSelected ? 'border-[#00467F] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => handleCourseToggle(course.id)}
                            >
                                <div className="flex items-start space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}}
                                        className="w-5 h-5 mt-0.5 text-[#00467F] border-gray-300 rounded focus:ring-[#00467F]"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-3">
                                            {course.imageUrl && (
                                                <img 
                                                    src={course.imageUrl} 
                                                    alt={course.title}
                                                    className="w-16 h-16 object-cover rounded"
                                                />
                                            )}
                                            <div>
                                                <h4 className="font-medium text-gray-900">{course.title}</h4>
                                                <p className="text-sm text-gray-500">{courseDates}</p>
                                                {course.description && (
                                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{course.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {availableCourses.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No courses available at this time.
                    </div>
                )}
            </div>
        );
    };

    const renderStep5 = () => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="mb-3">
                    Sargood on Collaroy was established and is run by a not-for-profit organisation with support from the local community and icare. 
                    It has been purpose-built as a resort specifically for <strong>people living with spinal cord injury (SCI)</strong>.
                </p>
                <p className="mb-3">
                    The aim is to facilitate independence and skills for people living with SCI and the offering is tailored specifically for the unique needs of this group.
                </p>
                <p>
                    You can read further about our eligibility criteria at:{' '}
                    <a 
                        href="https://sargoodoncollaroy.com/terms-and-conditions/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#00467F] underline hover:text-blue-800"
                    >
                        sargoodoncollaroy.com/terms-and-conditions
                    </a>
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Do you have any other questions or comments about your interest?
                </label>
                <textarea
                    value={formData.comments}
                    onChange={(e) => handleInputChange('comments', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00467F] focus:border-transparent resize-none"
                    placeholder="Enter any additional questions or comments..."
                />
            </div>

            {/* Summary */}
            <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-3">Summary of your submission</h4>
                <div className="bg-white border rounded-lg p-4 space-y-2 text-sm">
                    <p><span className="text-gray-500">Name:</span> {formData.guest_name}</p>
                    <p><span className="text-gray-500">Email:</span> {formData.guest_email}</p>
                    <p><span className="text-gray-500">Phone:</span> {formData.guest_phone}</p>
                    <p><span className="text-gray-500">Funding:</span> {formData.funding_type?.label || '-'}</p>
                    <p>
                        <span className="text-gray-500">SCI Level:</span>{' '}
                        {[
                            ...formData.sci_level_cervical,
                            ...formData.sci_level_thoracic,
                            ...formData.sci_level_lumbar,
                            ...formData.sci_level_sacral
                        ].join(', ') || '-'}
                    </p>
                    <p>
                        <span className="text-gray-500">Courses:</span>{' '}
                        {formData.selected_courses.map(id => {
                            const course = allCourses.find(c => c.id === id) || selectedCourse;
                            return course?.title;
                        }).filter(Boolean).join(', ') || '-'}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col relative z-[10000]">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Course Expression of Interest</h2>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Step Indicator */}
                <div className="px-6 pt-4">
                    {renderStepIndicator()}
                </div>

                {/* Content - step 2 needs overflow visible for dropdowns */}
                <div 
                    className={`flex-1 px-6 py-4 ${currentStep === 2 ? 'overflow-visible' : 'overflow-y-auto'}`}
                    style={{ minHeight: '400px' }}
                >
                    {currentStep === 1 && renderStep1()}
                    {currentStep === 2 && (
                        <div className="relative" style={{ zIndex: 10001 }}>
                            {renderStep2()}
                        </div>
                    )}
                    {currentStep === 3 && renderStep3()}
                    {currentStep === 4 && renderStep4()}
                    {currentStep === 5 && renderStep5()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t bg-gray-50">
                    <div>
                        {currentStep > 1 && (
                            <Button
                                color="secondary"
                                size="medium"
                                label="BACK"
                                onClick={handleBack}
                                disabled={isSubmitting}
                            />
                        )}
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button
                            color="secondary"
                            size="medium"
                            label="CANCEL"
                            onClick={onClose}
                            disabled={isSubmitting}
                        />
                        {currentStep < 5 ? (
                            <Button
                                color="primary"
                                size="medium"
                                label="NEXT"
                                onClick={handleNext}
                            />
                        ) : (
                            <Button
                                color="primary"
                                size="medium"
                                label={isSubmitting ? "SUBMITTING..." : "SUBMIT"}
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
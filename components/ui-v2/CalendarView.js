import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import moment from 'moment';
import StatusBadge from './StatusBadge';
import Card from './Card';

// Custom Calendar Icon Component
const CalendarIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.20898 1.55273C3.71336 1.60377 4.10733 2.03004 4.10742 2.54785C4.10742 3.06574 3.71341 3.49192 3.20898 3.54297L3.10742 3.54785H2.80859C2.59424 3.54785 2.38792 3.63264 2.23633 3.78418C2.08477 3.93574 2.00005 4.14212 2 4.35645V17.1914L2.00391 17.2705C2.01169 17.3492 2.03118 17.4266 2.06152 17.5C2.1021 17.598 2.16139 17.6877 2.23633 17.7627C2.31135 17.8377 2.40102 17.8969 2.49902 17.9375C2.5971 17.9781 2.70244 17.999 2.80859 17.999H18.2803L18.3594 17.9951C18.4382 17.9873 18.5154 17.9679 18.5889 17.9375C18.6869 17.8969 18.7765 17.8377 18.8516 17.7627C18.9266 17.6876 18.9858 17.598 19.0264 17.5C19.0567 17.4266 19.0762 17.3493 19.084 17.2705L19.0879 17.1914V4.35645C19.0878 4.14212 19.0031 3.93573 18.8516 3.78418C18.7191 3.65183 18.5451 3.5702 18.3604 3.55176L18.2803 3.54785H17.9258C17.3735 3.54785 16.9258 3.10014 16.9258 2.54785C16.9259 1.99565 17.3736 1.54785 17.9258 1.54785H18.2803L18.5576 1.56152C19.2004 1.62535 19.8048 1.90948 20.2656 2.37012C20.7923 2.89675 21.0878 3.61169 21.0879 4.35645V17.1914L21.0752 17.4668C21.0482 17.7409 20.9807 18.0102 20.875 18.2656C20.7339 18.6063 20.5264 18.916 20.2656 19.1768C20.0049 19.4375 19.6952 19.644 19.3545 19.7852C19.099 19.891 18.8299 19.9583 18.5557 19.9854L18.2803 19.999H2.80859C2.43979 19.999 2.07413 19.9263 1.7334 19.7852C1.39284 19.644 1.08294 19.4374 0.822266 19.1768C0.561601 18.916 0.354953 18.6062 0.213867 18.2656C0.108091 18.0102 0.0407272 17.7409 0.0136719 17.4668L0 17.1914V4.35645C4.8441e-05 3.61168 0.295638 2.89674 0.822266 2.37012C1.34893 1.8435 2.06381 1.54785 2.80859 1.54785H3.10742L3.20898 1.55273ZM5.89258 11.7422L6.02246 11.7646L6.15137 11.7959C6.40525 11.8682 6.64041 11.9958 6.83887 12.1699L6.93457 12.2607L7.02441 12.3584C7.19488 12.5599 7.31799 12.7976 7.38574 13.0527L7.41699 13.1855L7.43945 13.3193L7.45117 13.4551L7.45117 13.5918V14.5918C7.45117 14.8571 7.34581 15.1115 7.1582 15.2991C6.9706 15.4868 6.71625 15.5921 6.45117 15.5918C5.93989 15.5918 5.51762 15.2056 5.45898 14.7109L5.45117 14.5918V13.5918C5.45117 13.3266 5.55652 13.0721 5.74414 12.8845C5.90475 12.724 6.11706 12.6216 6.34375 12.5947L6.45117 12.5869H6.95117L6.85156 12.5918H5.95117C5.68594 12.5918 5.43159 12.6971 5.24399 12.8848C5.05637 13.0724 4.95117 13.3267 4.95117 13.5918V14.5918C4.95117 15.4203 5.62274 16.0918 6.45117 16.0918C7.24585 16.0918 7.89638 15.4732 7.94824 14.6914L7.95117 14.5918V13.5918C7.95117 12.7634 7.27961 12.0918 6.45117 12.0918C5.65649 12.0918 5.00596 12.7104 4.9541 13.4922L4.95117 13.5918V14.0918C4.95117 14.3679 4.72732 14.5918 4.45117 14.5918C4.175 14.5918 3.95117 14.3679 3.95117 14.0918V13.5918C3.95117 12.211 5.07032 11.0918 6.45117 11.0918C6.59814 11.0918 6.74256 11.1039 6.88379 11.127L6.77051 11.1064L6.65527 11.0918H6.45117H5.94922C5.93029 11.0918 5.91138 11.0923 5.89258 11.0928V11.7422ZM14.5898 11.7422L14.7197 11.7646L14.8486 11.7959C15.1025 11.8682 15.3377 11.9958 15.5361 12.1699L15.6318 12.2607L15.7217 12.3584C15.8921 12.5599 16.0152 12.7976 16.083 13.0527L16.1143 13.1855L16.1367 13.3193L16.1484 13.4551V14.5918C16.1484 14.8571 16.0431 15.1115 15.8555 15.2991C15.6679 15.4868 15.4135 15.5921 15.1484 15.5918C14.6372 15.5918 14.2149 15.2056 14.1562 14.7109L14.1484 14.5918V13.5918C14.1484 13.3266 14.2538 13.0721 14.4414 12.8845C14.602 12.724 14.8143 12.6216 15.041 12.5947L15.1484 12.5869H15.6484L15.5488 12.5918H14.6484C14.3832 12.5918 14.1289 12.6971 13.9412 12.8848C13.7536 13.0724 13.6484 13.3267 13.6484 13.5918V14.5918C13.6484 15.4203 14.32 16.0918 15.1484 16.0918C15.9431 16.0918 16.5936 15.4732 16.6455 14.6914L16.6484 14.5918V13.5918C16.6484 12.7634 15.9769 12.0918 15.1484 12.0918C14.3538 12.0918 13.7032 12.7104 13.6514 13.4922L13.6484 13.5918V14.0918C13.6484 14.3679 13.4246 14.5918 13.1484 14.5918C12.8723 14.5918 12.6484 14.3679 12.6484 14.0918V13.5918C12.6484 12.211 13.7676 11.0918 15.1484 11.0918C15.2954 11.0918 15.4398 11.1039 15.5811 11.127L15.4678 11.1064L15.3535 11.0918H15.1484H14.6465C14.6276 11.0918 14.6086 11.0923 14.5898 11.0928V11.7422ZM6.45117 4.04785C7.00345 4.04785 7.45117 4.49556 7.45117 5.04785V6.54785C7.45117 7.10014 7.00345 7.54785 6.45117 7.54785C5.89889 7.54785 5.45117 7.10014 5.45117 6.54785V5.04785C5.45117 4.49556 5.89889 4.04785 6.45117 4.04785ZM15.0879 4.04785C15.6402 4.04785 16.0879 4.49556 16.0879 5.04785V6.54785C16.0879 7.10014 15.6402 7.54785 15.0879 7.54785C14.5356 7.54785 14.0879 7.10014 14.0879 6.54785V5.04785C14.0879 4.49556 14.5356 4.04785 15.0879 4.04785Z" fill="currentColor"/>
    </svg>
);

/**
 * CalendarView Component
 * 
 * @param {Object} props
 * @param {Array} props.courses - Array of courses offered to the guest (with booking status)
 * @param {Array} props.allCourses - Array of ALL available courses (including non-offered)
 * @param {Function} props.onBookNow - Callback when "Book Now" is clicked
 * @param {Function} props.onRegisterInterest - Callback when "Register Interest" is clicked
 */
const CalendarView = ({ 
    courses = [], 
    allCourses = [],
    onBookNow,
    onRegisterInterest 
}) => {
    const [currentDate, setCurrentDate] = useState(moment());

    // Navigate to previous month
    const goToPreviousMonth = () => {
        setCurrentDate(prev => prev.clone().subtract(1, 'month'));
    };

    // Navigate to next month
    const goToNextMonth = () => {
        setCurrentDate(prev => prev.clone().add(1, 'month'));
    };

    // Merge offered courses with all courses, marking which are offered
    const mergedCourses = useMemo(() => {
        // Create a map of offered course IDs for quick lookup
        const offeredCourseIds = new Set(courses.map(c => c.id));
        
        // If allCourses is provided, merge with offered courses
        if (allCourses && allCourses.length > 0) {
            const merged = [];
            
            // Add all courses from allCourses, enriching with offer data if available
            allCourses.forEach(course => {
                const offeredCourse = courses.find(oc => oc.id === course.id);
                if (offeredCourse) {
                    // Course is offered - use the offered course data
                    merged.push({
                        ...course,
                        ...offeredCourse,
                        isOffered: true
                    });
                } else {
                    // Course is NOT offered - mark it as such
                    merged.push({
                        ...course,
                        isOffered: false,
                        isLinkedToBooking: false,
                        canBookNow: false
                    });
                }
            });
            
            return merged;
        }
        
        // Fallback to just offered courses if allCourses not provided
        return courses.map(c => ({ ...c, isOffered: true }));
    }, [courses, allCourses]);

    // Check if a course is in the past
    const isCourseInPast = (course) => {
        const today = moment().startOf('day');
        const courseEnd = moment(course.end_date);
        return courseEnd.isBefore(today, 'day');
    };

    // Get user's upcoming/current courses (courses that are offered and not yet ended)
    const myUpcomingCourses = useMemo(() => {
        const today = moment().startOf('day');
        
        return mergedCourses
            .filter(course => {
                if (!course.isOffered || !course.start_date || !course.end_date) return false;
                
                const courseEnd = moment(course.end_date);
                // Show courses that haven't ended yet
                return courseEnd.isSameOrAfter(today, 'day');
            })
            .sort((a, b) => moment(a.start_date).diff(moment(b.start_date)))
            .slice(0, 5); // Limit to 5 courses
    }, [mergedCourses]);

    // Get courses available in the currently viewed month (excluding past courses)
    const coursesInCurrentMonth = useMemo(() => {
        const today = moment().startOf('day');
        const startOfMonth = currentDate.clone().startOf('month');
        const endOfMonth = currentDate.clone().endOf('month');

        return mergedCourses
            .filter(course => {
                if (!course.start_date || !course.end_date) return false;
                
                const courseStart = moment(course.start_date);
                const courseEnd = moment(course.end_date);
                
                // Course overlaps with the current month
                const overlapsMonth = courseStart.isSameOrBefore(endOfMonth, 'day') && 
                                      courseEnd.isSameOrAfter(startOfMonth, 'day');
                
                // Course hasn't ended yet (not in the past)
                const notPast = courseEnd.isSameOrAfter(today, 'day');
                
                return overlapsMonth && notPast;
            })
            .sort((a, b) => moment(a.start_date).diff(moment(b.start_date)));
    }, [mergedCourses, currentDate]);

    // Get calendar data for current month
    const calendarData = useMemo(() => {
        const startOfMonth = currentDate.clone().startOf('month');
        const endOfMonth = currentDate.clone().endOf('month');
        const startOfCalendar = startOfMonth.clone().startOf('week');
        const endOfCalendar = endOfMonth.clone().endOf('week');

        const days = [];
        const current = startOfCalendar.clone();

        while (current.isSameOrBefore(endOfCalendar)) {
            days.push(current.clone());
            current.add(1, 'day');
        }

        return days;
    }, [currentDate]);

    // Get events for a specific date with level tracking for stacking
    const getEventsForDate = (date) => {
        const dayEvents = mergedCourses.filter(course => {
            if (!course.start_date || !course.end_date) return false;
            
            const courseStart = moment(course.start_date);
            const courseEnd = moment(course.end_date);
            
            return date.isBetween(courseStart, courseEnd, 'day', '[]');
        });

        // Assign levels to events to prevent overlap
        const eventsWithLevels = [];
        dayEvents.forEach((course, index) => {
            const courseStart = moment(course.start_date);
            const courseEnd = moment(course.end_date);
            
            // Find the first available level for this event
            let level = 0;
            let levelTaken = true;
            
            while (levelTaken) {
                levelTaken = eventsWithLevels.some(existingEvent => 
                    existingEvent.level === level &&
                    moment(existingEvent.start_date).isSameOrBefore(courseEnd, 'day') &&
                    moment(existingEvent.end_date).isSameOrAfter(courseStart, 'day')
                );
                if (levelTaken) level++;
            }
            
            eventsWithLevels.push({ ...course, level });
        });
        
        return eventsWithLevels;
    };

    // Get event color based on course properties
    const getEventColor = (course, isPast = false) => {
        if (isPast) {
            return '#9CA3AF'; // Darker gray for past courses - more distinct
        }
        
        if (!course.isOffered) {
            return '#E5E7EB'; // Light gray for non-offered courses (Register Interest)
        } else if (course.isLinkedToBooking) {
            return '#95EFEB'; // Teal for booked courses
        } else if (course.canBookNow) {
            return '#FEF3C7'; // Yellow for available courses (offered)
        } else {
            return '#E6EDF3'; // Light blue for offered but not currently bookable
        }
    };

    // Check if a date is in the current month
    const isCurrentMonth = (date) => {
        return date.month() === currentDate.month();
    };

    // Check if a date is today
    const isToday = (date) => {
        return date.isSame(moment(), 'day');
    };

    // Get event style for multi-day events
    const getEventStyle = (course, date) => {
        const courseStart = moment(course.start_date);
        const courseEnd = moment(course.end_date);
        const dayOfWeek = date.day();
        
        // Check if this is the first day of the event in this week
        const weekStart = date.clone().startOf('week');
        const weekEnd = date.clone().endOf('week');
        const eventStartInWeek = moment.max(courseStart, weekStart);
        const eventEndInWeek = moment.min(courseEnd, weekEnd);
        
        if (date.isSame(eventStartInWeek, 'day')) {
            const duration = eventEndInWeek.diff(eventStartInWeek, 'days') + 1;
            const remainingDaysInWeek = 7 - dayOfWeek;
            const width = Math.min(duration, remainingDaysInWeek);
            
            return {
                width: `${(width * 100)}%`,
                position: 'relative',
                zIndex: 1
            };
        }
        
        return null;
    };

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {/* Calendar Section */}
            <div className="lg:col-span-2 xl:col-span-2">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4 lg:mb-6 px-2 sm:px-4">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                        {currentDate.format('MMMM YYYY').toUpperCase()}
                    </h2>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <button 
                            onClick={goToPreviousMonth}
                            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                        <button 
                            onClick={goToNextMonth}
                            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Week Days Header */}
                    <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
                        {weekDays.map(day => (
                            <div 
                                key={day} 
                                className="py-2 sm:py-3 text-center text-[10px] sm:text-xs font-semibold text-gray-600"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7">
                        {calendarData.map((date, index) => {
                            const events = getEventsForDate(date);
                            const isCurrentMonthDate = isCurrentMonth(date);
                            const isTodayDate = isToday(date);

                            return (
                                <div 
                                    key={index}
                                    className={`min-h-[60px] sm:min-h-[80px] lg:min-h-[100px] border-b border-r border-gray-100 p-0.5 sm:p-1 ${
                                        !isCurrentMonthDate ? 'bg-gray-50' : ''
                                    }`}
                                >
                                    {/* Date Number */}
                                    <div className="flex justify-end mb-0.5 sm:mb-1">
                                        <span className={`text-[10px] sm:text-xs lg:text-sm w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                                            isTodayDate 
                                                ? 'bg-blue-600 text-white'
                                                : isCurrentMonthDate
                                                ? 'text-gray-900'
                                                : 'text-gray-400'
                                        }`}>
                                            {date.format('D')}
                                        </span>
                                    </div>

                                    {/* Events */}
                                    <div className="space-y-0.5 sm:space-y-1">
                                        {events.map((course) => {
                                            const eventStyle = getEventStyle(course, date);
                                            if (!eventStyle) return null;

                                            const isPast = isCourseInPast(course);
                                            
                                            // Determine if course is clickable and which handler to use
                                            const isClickable = !isPast && !course.isLinkedToBooking;
                                            const handleClick = () => {
                                                if (!isClickable) return;
                                                
                                                if (!course.isOffered) {
                                                    // Not offered - show register interest
                                                    onRegisterInterest && onRegisterInterest(course);
                                                } else if (course.canBookNow) {
                                                    // Offered and can book - show booking flow
                                                    onBookNow && onBookNow(course);
                                                } else {
                                                    // Offered but not currently bookable - still show register interest
                                                    onRegisterInterest && onRegisterInterest(course);
                                                }
                                            };

                                            return (
                                                <div
                                                    key={`${course.id}-${date.format('YYYY-MM-DD')}`}
                                                    className={`text-[8px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded font-medium truncate transition-opacity ${
                                                        isPast ? 'text-gray-500 opacity-50' :
                                                        !course.isOffered ? 'text-gray-600' : 'text-gray-800'
                                                    } ${
                                                        isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                                                    }`}
                                                    style={{
                                                        backgroundColor: getEventColor(course, isPast),
                                                        ...eventStyle
                                                    }}
                                                    onClick={handleClick}
                                                    title={`${course.title} - ${moment(course.start_date).format('DD/MM/YYYY')} to ${moment(course.end_date).format('DD/MM/YYYY')}${
                                                        isPast ? ' (Past)' :
                                                        course.isLinkedToBooking ? ' (Already booked)' :
                                                        !course.isOffered ? ' (Click to register interest)' : 
                                                        course.canBookNow ? ' (Click to book now)' :
                                                        ' (Click to register interest)'
                                                    }`}
                                                >
                                                    {course.title}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-3 sm:mt-4 flex flex-wrap gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#95EFEB' }}></div>
                        <span className="text-gray-600">Already Booked</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#FEF3C7' }}></div>
                        <span className="text-gray-600">Available to Book</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#E5E7EB' }}></div>
                        <span className="text-gray-600">Register Interest</span>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#9CA3AF' }}></div>
                        <span className="text-gray-600">Past Courses</span>
                    </div>
                </div>
            </div>

            {/* Right Sidebar - Two Panels */}
            <div className="lg:col-span-1 xl:col-span-2 space-y-6">
                {/* Panel 1: My Upcoming Courses */}
                <div className="px-2 sm:px-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#00467F]" />
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg">My Upcoming Courses</h3>
                    </div>
                    
                    <div className="space-y-3">
                        {myUpcomingCourses.length > 0 ? (
                            myUpcomingCourses.map((course, index) => {
                                const startDate = moment(course.start_date);
                                const courseStartDate = startDate.format('DD MMM, YYYY');
                                const courseEndDate = moment(course.end_date).format('DD MMM, YYYY');
                                const dateRange = `${courseStartDate} - ${courseEndDate}`;
                                
                                let cardStatus = "Booked";
                                if (course.isLinkedToBooking) {
                                    cardStatus = "Already Booked";
                                } else if (course.canBookNow) {
                                    cardStatus = "Available";
                                }
                                
                                return (
                                    <div key={index} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="flex">
                                            {/* Image */}
                                            <div className="w-20 sm:w-24 flex-shrink-0">
                                                {course.imageUrl ? (
                                                    <img 
                                                        src={course.imageUrl} 
                                                        alt={course.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`w-full h-full bg-gray-100 flex items-center justify-center ${course.imageUrl ? 'hidden' : ''}`}>
                                                    <CalendarIcon className="w-6 h-6 text-gray-300" />
                                                </div>
                                            </div>
                                            
                                            {/* Content */}
                                            <div className="flex-1 p-3">
                                                <div className="flex items-start justify-between mb-1">
                                                    <h4 className="font-semibold text-sm text-gray-900 line-clamp-1 flex-1">{course.title}</h4>
                                                    <StatusBadge 
                                                        type={course.isLinkedToBooking ? 'success' : course.canBookNow ? 'offer' : 'pending'}
                                                        label={cardStatus}
                                                        size="small"
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">{dateRange}</p>
                                                
                                                {!course.isLinkedToBooking && (
                                                    <button
                                                        onClick={() => course.canBookNow ? onBookNow && onBookNow(course) : onRegisterInterest && onRegisterInterest(course)}
                                                        className="text-xs font-medium text-[#00467F] hover:text-blue-800 underline"
                                                    >
                                                        {course.canBookNow ? 'Book Now' : 'View Details'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg">
                                <User className="w-6 h-6 mx-auto mb-2 text-gray-300" />
                                <p className="text-sm">No upcoming courses</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel 2: Courses in Current Month */}
                <div className="px-2 sm:px-4">
                    <div className="flex items-center space-x-2 mb-4">
                        <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#00467F]" />
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                            Courses in {currentDate.format('MMMM')}
                        </h3>
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4">
                        {coursesInCurrentMonth.length > 0 ? (
                            coursesInCurrentMonth.map((course, index) => {
                                const startDate = moment(course.start_date);
                                const dayOfWeek = startDate.format('dddd');
                                const formattedDate = startDate.format('D MMMM, YYYY');
                                
                                // Determine status and actions based on course offer status
                                let cardStatus = "Register Interest";
                                let showBookNow = false;
                                let showRegisterInterest = false;
                                
                                if (!course.isOffered) {
                                    cardStatus = "Available";
                                    showRegisterInterest = true;
                                } else if (course.isLinkedToBooking) {
                                    cardStatus = "Already Booked";
                                } else if (course.canBookNow) {
                                    cardStatus = "Special Offer";
                                    showBookNow = true;
                                } else {
                                    cardStatus = "Offered";
                                    showBookNow = true;
                                }
                                
                                const courseStartDate = moment(course.start_date).format('DD MMM, YYYY');
                                const courseEndDate = moment(course.end_date).format('DD MMM, YYYY');
                                const dateRange = `${courseStartDate} - ${courseEndDate}`;
                                
                                return (
                                    <div key={index} className="mb-3 sm:mb-4">
                                        {/* Date Header */}
                                        <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2 px-1">
                                            {dayOfWeek}, {formattedDate}
                                        </div>
                                        
                                        {/* Course Card */}
                                        <div className={`bg-white rounded-lg border ${!course.isOffered ? 'border-gray-300' : 'border-gray-200'} overflow-hidden hover:shadow-md transition-shadow`}>
                                            <div className="flex">
                                                {/* Image */}
                                                <div className="w-24 sm:w-28 flex-shrink-0">
                                                    {course.imageUrl ? (
                                                        <img 
                                                            src={course.imageUrl} 
                                                            alt={course.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                                e.target.nextSibling.style.display = 'flex';
                                                            }}
                                                        />
                                                    ) : null}
                                                    <div className={`w-full h-full bg-gray-100 flex items-center justify-center ${course.imageUrl ? 'hidden' : ''}`}>
                                                        <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </div>
                                                
                                                {/* Content */}
                                                <div className="flex-1 p-3">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{course.title}</h4>
                                                        <StatusBadge 
                                                            type={
                                                                !course.isOffered ? 'neutral' :
                                                                course.isLinkedToBooking ? 'success' : 
                                                                course.canBookNow ? 'offer' : 'pending'
                                                            }
                                                            label={cardStatus}
                                                            size="small"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-500 mb-2">{dateRange}</p>
                                                    
                                                    {/* Action Buttons */}
                                                    <div className="flex items-center space-x-2">
                                                        {showRegisterInterest ? (
                                                            <button
                                                                onClick={() => onRegisterInterest && onRegisterInterest(course)}
                                                                className="text-xs font-medium text-[#00467F] hover:text-blue-800 underline"
                                                            >
                                                                Register Interest
                                                            </button>
                                                        ) : showBookNow ? (
                                                            <button
                                                                onClick={() => onBookNow && onBookNow(course)}
                                                                className="text-xs font-medium text-[#00467F] hover:text-blue-800 underline"
                                                            >
                                                                Book Now
                                                            </button>
                                                        ) : course.isLinkedToBooking ? (
                                                            <span className="text-xs text-gray-500">View in My Bookings</span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-500 py-6 sm:py-8 bg-gray-50 rounded-lg">
                                <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-gray-300" />
                                <p className="text-sm sm:text-base">No upcoming courses in {currentDate.format('MMMM YYYY')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import moment from 'moment';
import StatusBadge from './StatusBadge'; // Import StatusBadge component (adjust path as needed)
import Card from './Card'; // Import Card component (adjust path as needed)

// Custom Calendar Icon Component
const CalendarIcon = ({ className = "w-5 h-5" }) => (
    <svg className={className} viewBox="0 0 22 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3.20898 1.55273C3.71336 1.60377 4.10733 2.03004 4.10742 2.54785C4.10742 3.06574 3.71341 3.49192 3.20898 3.54297L3.10742 3.54785H2.80859C2.59424 3.54785 2.38792 3.63264 2.23633 3.78418C2.08477 3.93574 2.00005 4.14212 2 4.35645V17.1914L2.00391 17.2705C2.01169 17.3492 2.03118 17.4266 2.06152 17.5C2.1021 17.598 2.16139 17.6877 2.23633 17.7627C2.31135 17.8377 2.40102 17.8969 2.49902 17.9375C2.5971 17.9781 2.70244 17.999 2.80859 17.999H18.2803L18.3594 17.9951C18.4382 17.9873 18.5154 17.9679 18.5889 17.9375C18.6869 17.8969 18.7765 17.8377 18.8516 17.7627C18.9266 17.6876 18.9858 17.598 19.0264 17.5C19.0567 17.4266 19.0762 17.3493 19.084 17.2705L19.0879 17.1914V4.35645C19.0878 4.14212 19.0031 3.93573 18.8516 3.78418C18.7191 3.65183 18.5451 3.5702 18.3604 3.55176L18.2803 3.54785H17.9258C17.3735 3.54785 16.9258 3.10014 16.9258 2.54785C16.9259 1.99565 17.3736 1.54785 17.9258 1.54785H18.2803L18.5576 1.56152C19.2004 1.62535 19.8048 1.90948 20.2656 2.37012C20.7923 2.89675 21.0878 3.61169 21.0879 4.35645V17.1914L21.0752 17.4668C21.0482 17.7409 20.9807 18.0102 20.875 18.2656C20.7339 18.6063 20.5264 18.916 20.2656 19.1768C20.0049 19.4375 19.6952 19.644 19.3545 19.7852C19.099 19.891 18.8299 19.9583 18.5557 19.9854L18.2803 19.999H2.80859C2.43979 19.999 2.07413 19.9263 1.7334 19.7852C1.39284 19.644 1.08294 19.4374 0.822266 19.1768C0.561601 18.916 0.354953 18.6062 0.213867 18.2656C0.108091 18.0102 0.0407272 17.7409 0.0136719 17.4668L0 17.1914V4.35645C4.8441e-05 3.61168 0.295638 2.89674 0.822266 2.37012C1.34893 1.8435 2.06381 1.54785 2.80859 1.54785H3.10742L3.20898 1.55273ZM5.89258 11.7422L6.02246 11.7646L6.15137 11.7959C6.40525 11.8682 6.64041 11.9958 6.83887 12.1699L6.93457 12.2607L7.02441 12.3584C7.19488 12.5599 7.31799 12.7976 7.38574 13.0527L7.41504 13.1816L7.43457 13.3125C7.46867 13.6186 7.42296 13.9295 7.30078 14.2139C7.161 14.5388 6.92703 14.8149 6.62988 15.0068C6.33499 15.1972 5.99052 15.2957 5.63965 15.291V15.292L5.63672 15.291C5.63488 15.291 5.63269 15.292 5.63086 15.292V15.291C5.1635 15.2843 4.71735 15.0944 4.38965 14.7607C4.06 14.4249 3.87677 13.9715 3.88086 13.501C3.88268 13.1502 3.98796 12.8069 4.18359 12.5156L4.26172 12.4092C4.45188 12.1671 4.70199 11.9775 4.98828 11.8604L5.11328 11.8145C5.36441 11.733 5.63076 11.7082 5.89258 11.7422ZM10.5723 11.7422L10.7021 11.7646L10.8311 11.7959C11.0849 11.8682 11.3201 11.9958 11.5186 12.1699L11.6143 12.2607L11.7041 12.3584C11.8746 12.5599 11.9977 12.7976 12.0654 13.0527L12.0947 13.1816L12.1143 13.3125C12.1484 13.6186 12.1026 13.9295 11.9805 14.2139C11.8407 14.5388 11.6067 14.8149 11.3096 15.0068C11.0147 15.1972 10.6702 15.2957 10.3193 15.291V15.292L10.3164 15.291C10.3146 15.291 10.3124 15.292 10.3105 15.292V15.291C9.84318 15.2843 9.39703 15.0944 9.06934 14.7607C8.7397 14.4249 8.55646 13.9715 8.56055 13.501C8.56236 13.1502 8.66765 12.8069 8.86328 12.5156L8.94141 12.4092C9.13157 12.1671 9.38168 11.9775 9.66797 11.8604L9.79297 11.8145C10.0441 11.733 10.3104 11.7082 10.5723 11.7422ZM5.89062 6.27051L6.02148 6.29199L6.15039 6.32422C6.4041 6.39647 6.63856 6.52433 6.83691 6.69824L6.93359 6.78906L7.02246 6.88672C7.19293 7.08817 7.317 7.32502 7.38477 7.58008L7.41309 7.70898L7.43262 7.83984C7.46677 8.14567 7.42175 8.45607 7.2998 8.74023C7.16029 9.06515 6.9268 9.34116 6.62988 9.5332C6.33505 9.72386 5.99061 9.82189 5.63965 9.81738V9.81934C5.16928 9.81487 4.71938 9.62356 4.38965 9.28809C4.06011 8.95263 3.87718 8.49954 3.88086 8.0293C3.8825 7.67846 3.98794 7.33533 4.18359 7.04395L4.26074 6.9375C4.45093 6.69516 4.70178 6.50587 4.98828 6.38867L5.1123 6.34277C5.36313 6.26134 5.62908 6.23675 5.89062 6.27051ZM10.5713 6.27051L10.7021 6.29199L10.8311 6.32422C11.0848 6.39647 11.3192 6.52433 11.5176 6.69824L11.6143 6.78906L11.7031 6.88672C11.8736 7.08817 11.9977 7.32502 12.0654 7.58008L12.0938 7.70898L12.1133 7.83984C12.1474 8.14567 12.1024 8.45606 11.9805 8.74023C11.8409 9.06516 11.6075 9.34116 11.3105 9.5332C11.0157 9.72386 10.6713 9.82189 10.3203 9.81738V9.81934C9.84995 9.81487 9.40004 9.62356 9.07031 9.28809C8.74078 8.95263 8.55785 8.49954 8.56152 8.0293C8.56317 7.67845 8.66861 7.33532 8.86426 7.04395L8.94141 6.9375C9.13159 6.69517 9.38244 6.50587 9.66895 6.38867L9.79297 6.34277C10.0438 6.26134 10.3097 6.23675 10.5713 6.27051ZM15.5879 6.26465C15.9374 6.29942 16.2693 6.43651 16.541 6.65918L16.6709 6.77734L16.79 6.9082C17.0497 7.22513 17.1933 7.62384 17.1934 8.03711L17.1846 8.21387C17.144 8.62161 16.9632 9.00459 16.6709 9.29688C16.3368 9.63099 15.8836 9.81934 15.4111 9.81934C14.9387 9.81924 14.4854 9.6309 14.1514 9.29688C13.8593 9.00465 13.6792 8.62145 13.6387 8.21387L13.6299 8.03711L13.6387 7.86133C13.6792 7.45349 13.859 7.06967 14.1514 6.77734L14.2822 6.65918C14.5992 6.39949 14.9978 6.25594 15.4111 6.25586L15.5879 6.26465ZM5.6875 0C6.23978 0 6.6875 0.447715 6.6875 1V3.28906C6.68698 3.84091 6.23947 4.28906 5.6875 4.28906C5.13553 4.28906 4.68802 3.84091 4.6875 3.28906V1C4.6875 0.447715 5.13522 0 5.6875 0ZM15.3164 0C15.8687 0 16.3164 0.447715 16.3164 1V3.28906C16.3159 3.84091 15.8684 4.28906 15.3164 4.28906C14.7644 4.28906 14.3169 3.84091 14.3164 3.28906V1C14.3164 0.447715 14.7641 0 15.3164 0ZM12.7822 1.55273C13.2863 1.60404 13.6796 2.03024 13.6797 2.54785C13.6797 3.06554 13.2864 3.49165 12.7822 3.54297L12.6797 3.54785H8.38184C7.82955 3.54785 7.38184 3.10014 7.38184 2.54785C7.38194 1.99565 7.82961 1.54785 8.38184 1.54785H12.6797L12.7822 1.55273Z" fill="#00467F"/>
    </svg>
);

const CalendarView = ({ courses = [], onCourseBookNow }) => {
    const [currentDate, setCurrentDate] = useState(moment());

    // Navigate to previous month
    const goToPreviousMonth = () => {
        setCurrentDate(prev => prev.clone().subtract(1, 'month'));
    };

    // Navigate to next month
    const goToNextMonth = () => {
        setCurrentDate(prev => prev.clone().add(1, 'month'));
    };

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
        const dayEvents = courses.filter(course => {
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
    const getEventColor = (course) => {
        if (course.isLinkedToBooking) {
            return '#95EFEB'; // Teal for booked courses
        } else if (course.canBookNow) {
            return '#FEF3C7'; // Yellow for available courses
        } else if (course.status === 'active') {
            return '#E6EDF3'; // Light blue for active but not bookable
        } else {
            return '#FFBEB1'; // Light red for inactive/expired
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

    // Get upcoming courses (next 30 days)
    const upcomingCourses = useMemo(() => {
        const now = moment();
        const thirtyDaysFromNow = moment().add(30, 'days');
        
        return courses
            .filter(course => {
                const courseStart = moment(course.start_date);
                return courseStart.isBetween(now, thirtyDaysFromNow, 'day', '[]');
            })
            .sort((a, b) => moment(a.start_date).diff(moment(b.start_date)))
            .slice(0, 10); // Limit to 10 upcoming courses
    }, [courses]);

    const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-2 gap-4 sm:gap-6">
            {/* Calendar Section */}
            <div className="lg:col-span-2 xl:col-span-1">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-4 lg:mb-6 px-2 sm:px-4">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                        {currentDate.format('MMMM YYYY').toUpperCase()}
                    </h2>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                        <button
                            onClick={goToPreviousMonth}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Previous Month"
                        >
                            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                        <button
                            onClick={goToNextMonth}
                            className="p-1.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            title="Next Month"
                        >
                            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                    </div>
                </div>

                <div className="px-2 sm:px-4">
                    {/* Calendar Grid */}
                    <div 
                        className="overflow-hidden rounded-lg w-full"
                        style={{
                            border: '1px solid #E6E6E6',
                            boxShadow: '0px 3px 12px 0px #0000001A'
                        }}
                    >
                        {/* Week Days Header */}
                        <div className="grid grid-cols-7 bg-gray-50">
                            {weekDays.map(day => (
                                <div key={day} className="px-1 sm:px-2 lg:px-4 py-2 sm:py-3 lg:py-4 text-center text-xs sm:text-sm font-medium text-gray-700">
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
                                
                                // Calculate minimum height based on number of event levels
                                const maxLevel = events.length > 0 ? Math.max(...events.map(e => e.level)) : -1;
                                // Use CSS classes for responsive sizing
                                const baseHeight = 60; // Base height for mobile
                                const eventHeight = 18; // Event height for mobile
                                const minHeight = baseHeight + (maxLevel + 1) * eventHeight;
                                
                                return (
                                    <div
                                        key={index}
                                        className={`relative px-1 sm:px-2 lg:px-3 py-1 sm:py-2 lg:py-3 ${
                                            !isCurrentMonthDate ? 'bg-gray-50' : 'bg-white'
                                        }`}
                                        style={{ 
                                            minHeight: `${minHeight}px`,
                                            // Use CSS custom properties for responsive heights
                                            '--mobile-base-height': '60px',
                                            '--tablet-base-height': '70px', 
                                            '--desktop-base-height': '80px'
                                        }}
                                    >
                                        {/* Date Number */}
                                        <div className="flex justify-start mb-1">
                                            <span
                                                className={`text-xs sm:text-sm font-medium w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 flex items-center justify-center rounded-full ${
                                                    isTodayDate
                                                        ? 'bg-blue-600 text-white'
                                                        : isCurrentMonthDate
                                                        ? 'text-gray-900'
                                                        : 'text-gray-400'
                                                }`}
                                            >
                                                {date.format('D')}
                                            </span>
                                        </div>

                                        {/* Events - Positioned events that can span multiple days */}
                                        {events.map((course, courseIndex) => {
                                            const eventStyle = getEventStyle(course, date);
                                            if (!eventStyle) return null;

                                            return (
                                                <div
                                                    key={`${course.id}-${date.format('YYYY-MM-DD')}-${courseIndex}`}
                                                    className="text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded text-gray-800 font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
                                                    style={{
                                                        backgroundColor: getEventColor(course),
                                                        ...eventStyle
                                                    }}
                                                    title={`${course.title} - ${moment(course.start_date).format('DD/MM/YYYY')} to ${moment(course.end_date).format('DD/MM/YYYY')}`}
                                                >
                                                    {course.title}
                                                </div>
                                            );
                                        })}
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
                            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded" style={{ backgroundColor: '#E6EDF3' }}></div>
                            <span className="text-gray-600">Not Available</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upcoming Courses Sidebar - No background panel, just content */}
            <div className="lg:col-span-1 xl:col-span-1 mt-6 lg:mt-0">
                <div className="px-2 sm:px-4">
                    <div className="flex items-center space-x-2 mb-4 sm:mb-6">
                        <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[#00467F]" />
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg">Upcoming Courses</h3>
                    </div>
                    
                    <div className="space-y-3 sm:space-y-4">
                        {upcomingCourses.length > 0 ? (
                            upcomingCourses.map((course, index) => {
                                const startDate = moment(course.start_date);
                                const dayOfWeek = startDate.format('dddd');
                                const formattedDate = startDate.format('D MMMM, YYYY');
                                
                                // Determine status for the Card component
                                let cardStatus = "Not Available";
                                let isSpecialOffer = false;
                                
                                if (course.isLinkedToBooking) {
                                    cardStatus = "Already Booked";
                                } else if (course.canBookNow) {
                                    cardStatus = "Special Offer";
                                    isSpecialOffer = true;
                                }
                                
                                // Format dates for the card
                                const courseStartDate = moment(course.start_date).format('DD MMM, YYYY');
                                const courseEndDate = moment(course.end_date).format('DD MMM, YYYY');
                                const dateRange = `${courseStartDate} - ${courseEndDate}`;
                                
                                return (
                                    <div key={index} className="mb-3 sm:mb-4">
                                        {/* Date Header */}
                                        <div className="text-xs sm:text-sm font-medium text-gray-500 mb-2 px-1">
                                            {dayOfWeek}, {formattedDate}
                                        </div>
                                        
                                        {/* Card Component */}
                                        <Card
                                            title={course.title}
                                            image={course.imageUrl}
                                            isSpecialOffer={isSpecialOffer}
                                            status={cardStatus}
                                            minStayDates={dateRange}
                                            onViewDetails={() => console.log(`View details for: ${course.title}`)}
                                            showBookNow={false} // We'll use View details instead
                                        />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-500 py-6 sm:py-8">
                                <CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 sm:mb-3 text-gray-300" />
                                <p className="text-sm sm:text-base">No upcoming courses in the next 30 days</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
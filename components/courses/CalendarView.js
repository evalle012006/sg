import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import moment from 'moment';

const CalendarView = ({ courses = [] }) => {
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

    // Get events for a specific date
    const getEventsForDate = (date) => {
        return courses.filter(course => {
            if (!course.start_date || !course.end_date) return false;
            
            const courseStart = moment(course.start_date);
            const courseEnd = moment(course.end_date);
            
            return date.isBetween(courseStart, courseEnd, 'day', '[]');
        });
    };

    // Get event color based on course properties
    const getEventColor = (course) => {
        if (course.status === 'active') {
            return '#95EFEB';
        } else if (course.status === 'pending') {
            return '#E6EDF3';
        } else if (course.status === 'archived') {
            return '#FFBEB1';
        }
        return '#95EFEB'; // Default to active color
    };

    // Check if a date is in the current month
    const isCurrentMonth = (date) => {
        return date.month() === currentDate.month();
    };

    // Check if a date is today
    const isToday = (date) => {
        return date.isSame(moment(), 'day');
    };

    // Get event position and width for multi-day events
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
        <div className="bg-white">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {currentDate.format('MMMM YYYY').toUpperCase()}
                    </h2>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={goToPreviousMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Previous Month"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                        onClick={goToNextMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title="Next Month"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Week Days Header */}
                <div className="grid grid-cols-7 bg-gray-50">
                    {weekDays.map(day => (
                        <div key={day} className="px-4 py-3 text-center text-sm font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
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
                                className={`min-h-[120px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
                                    !isCurrentMonthDate ? 'bg-gray-50' : 'bg-white'
                                }`}
                            >
                                {/* Date Number */}
                                <div className="flex justify-start mb-1">
                                    <span
                                        className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
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

                                {/* Events */}
                                <div className="space-y-1">
                                    {events.map((course) => {
                                        const eventStyle = getEventStyle(course, date);
                                        if (!eventStyle) return null;

                                        return (
                                            <div
                                                key={`${course.id}-${date.format('YYYY-MM-DD')}`}
                                                className="text-xs px-2 py-1 rounded text-gray-800 font-medium truncate"
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
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#95EFEB' }}></div>
                    <span className="text-gray-600">Active Courses</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#E6EDF3' }}></div>
                    <span className="text-gray-600">Draft Courses</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FFBEB1' }}></div>
                    <span className="text-gray-600">Archived Courses</span>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
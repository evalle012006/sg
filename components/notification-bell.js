import Image from "next/image";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import dynamic from 'next/dynamic';
import { toast } from "react-toastify";
import { notificationActions } from '../store/notificationSlice';

const Notification = dynamic(() => import('./notification'));

// Configuration
const NOTIFICATIONS_PER_PAGE = 10;
const UNREAD_COUNT_POLL_INTERVAL = 60000; // Poll for unread count every 60 seconds

export default function NotificationBell() {
    const [dropdownStatus, setDropdownStatus] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
    
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user?.user);
    // Defensive selector - handle case where notifications slice might not exist yet
    const notifications = useSelector(state => state.notifications?.notifications ?? []);
    const [counter, setCounter] = useState(0);
    
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    /**
     * Fetch only the unread count (lightweight call for badge)
     */
    const fetchUnreadCount = useCallback(async () => {
        if (!user?.id) return;

        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    user_type: user.type,
                    count_only: true
                })
            });

            const data = await res.json();
            if (data.success) {
                setCounter(data.unread_count || 0);
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    }, [user?.id, user?.type]);

    /**
     * Fetch paginated notifications
     */
    const fetchNotifications = useCallback(async (page = 1, appendResults = false) => {
        if (!user?.id) return;

        const isInitialLoad = page === 1 && !appendResults;
        if (isInitialLoad) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    user_type: user.type,
                    limit: NOTIFICATIONS_PER_PAGE,
                    page: page,
                    read_status: filter === 'all' ? undefined : filter
                })
            });

            const data = await res.json();

            if (data.success) {
                const newNotifications = data.notifications || [];
                
                if (appendResults) {
                    // Append to existing notifications
                    dispatch(notificationActions.appendNotifications(newNotifications));
                } else {
                    // Replace notifications
                    dispatch(notificationActions.setNotifications(newNotifications));
                }
                
                setHasMore(data.pagination?.has_more || false);
                setCounter(data.unread_count || 0);
                setCurrentPage(page);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error('Failed to load notifications');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [user?.id, user?.type, filter, dispatch]);

    /**
     * Load more notifications (infinite scroll / load more button)
     */
    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore) {
            fetchNotifications(currentPage + 1, true);
        }
    }, [loadingMore, hasMore, currentPage, fetchNotifications]);

    /**
     * Mark single notification as read
     */
    const handleRead = async (notification) => {
        try {
            const response = await fetch('/api/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_id: notification.id })
            });

            if (response.ok) {
                // Optimistically update the notification in state
                dispatch(notificationActions.markAsRead(notification.id));
                setCounter(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
            toast.error('Failed to mark notification as read');
        }
    };

    /**
     * Mark all notifications as read
     */
    const handleReadAll = async () => {
        try {
            const response = await fetch('/api/notifications/read-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    user_id: user.id,
                    user_type: user.type 
                })
            });

            if (response.ok) {
                // Optimistically update all notifications in state
                dispatch(notificationActions.markAllAsRead());
                setCounter(0);
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
            toast.error('Failed to mark all as read');
        }
    };

    /**
     * Handle filter change
     */
    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        setHasMore(true);
    };

    /**
     * Handle dropdown open
     */
    const handleDropdownOpen = () => {
        setDropdownStatus(true);
        // Only fetch if we haven't loaded notifications yet or filter changed
        fetchNotifications(1, false);
    };

    /**
     * Handle dropdown close
     */
    const handleDropdownClose = () => {
        setDropdownStatus(false);
    };

    /**
     * Handle scroll for infinite scroll
     */
    const handleScroll = useCallback(() => {
        if (!listRef.current || loadingMore || !hasMore) return;
        
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        // Load more when user is 100px from bottom
        if (scrollHeight - scrollTop - clientHeight < 100) {
            loadMore();
        }
    }, [loadMore, loadingMore, hasMore]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                handleDropdownClose();
            }
        };

        if (dropdownStatus) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownStatus]);

    // Fetch unread count on mount and set up polling
    useEffect(() => {
        if (!user?.id) return;

        // Initial fetch of unread count only (lightweight)
        fetchUnreadCount();

        // Poll for unread count periodically
        const pollInterval = setInterval(fetchUnreadCount, UNREAD_COUNT_POLL_INTERVAL);

        return () => clearInterval(pollInterval);
    }, [user?.id, fetchUnreadCount]);

    // Refetch when filter changes
    useEffect(() => {
        if (dropdownStatus) {
            fetchNotifications(1, false);
        }
    }, [filter]);

    return (
        <div className="relative cursor-pointer my-auto text-xs md:text-md" ref={dropdownRef}>
            {user && (
                <div className="flex justify-end md:justify-start mr-6" onClick={handleDropdownOpen}>
                    <div className="relative">
                        <div className='relative w-7 h-7'>
                            <Image alt='Notifications' layout='fill' objectFit="contain" src="/icons/bell.png" />
                        </div>
                        {counter > 0 && (
                            <div className={`py-0.5 ${counter < 10 ? 'px-[7px]' : 'px-1'} bg-red-500 rounded-full text-center text-white text-xs absolute -top-1 -right-2`}>
                                {counter > 99 ? '99+' : counter}
                                <div className="absolute top-0.5 left-0 start-0 rounded-full -z-10 animate-ping bg-red-200 w-full h-full"></div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            {dropdownStatus && (
                <div className="absolute z-50 top-12 right-0 md:-right-10 shadow-xl rounded-lg border border-gray-200 bg-white w-80 md:w-96">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                            {counter > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {counter > 99 ? '99+' : counter}
                                </span>
                            )}
                        </div>
                        {notifications?.length > 0 && counter > 0 && (
                            <button
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                onClick={handleReadAll}
                            >
                                MARK ALL AS READ
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex border-b border-gray-100">
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'unread', label: 'Unread' },
                            { key: 'read', label: 'Read' }
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                    filter === key 
                                        ? 'text-blue-600 border-b-2 border-blue-600' 
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                                onClick={() => handleFilterChange(key)}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Notifications List */}
                    <div 
                        ref={listRef}
                        className="max-h-96 overflow-y-auto"
                        onScroll={handleScroll}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : notifications?.length > 0 ? (
                            <>
                                {notifications.map((notification) => (
                                    <Notification 
                                        key={notification.id} 
                                        data={notification} 
                                        handleRead={handleRead}
                                    />
                                ))}
                                
                                {/* Load More Button / Loading indicator */}
                                {hasMore && (
                                    <div className="p-3 text-center border-t border-gray-100">
                                        {loadingMore ? (
                                            <div className="flex items-center justify-center py-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                                <span className="ml-2 text-sm text-gray-500">Loading more...</span>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={loadMore}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                Load more notifications
                                            </button>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <p className="text-sm">
                                    {filter === 'unread' 
                                        ? 'No unread notifications' 
                                        : filter === 'read' 
                                            ? 'No read notifications' 
                                            : 'No notifications yet'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
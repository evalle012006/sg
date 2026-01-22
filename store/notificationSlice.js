import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    notifications: [],
    unreadCount: 0,
    loading: false,
    error: null
};

const notificationSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        /**
         * Set notifications (replace existing)
         */
        setNotifications: (state, action) => {
            state.notifications = action.payload || [];
            state.error = null;
        },

        /**
         * Append notifications (for pagination/load more)
         */
        appendNotifications: (state, action) => {
            const newNotifications = action.payload || [];
            // Avoid duplicates by checking IDs
            const existingIds = new Set(state.notifications.map(n => n.id));
            const uniqueNew = newNotifications.filter(n => !existingIds.has(n.id));
            state.notifications = [...state.notifications, ...uniqueNew];
        },

        /**
         * Add a single new notification (for real-time updates)
         */
        addNotification: (state, action) => {
            const notification = action.payload;
            // Add to beginning of list
            state.notifications = [notification, ...state.notifications];
            state.unreadCount += 1;
        },

        /**
         * Mark single notification as read (optimistic update)
         */
        markAsRead: (state, action) => {
            const notificationId = action.payload;
            const notification = state.notifications.find(n => n.id === notificationId);
            if (notification && !notification.read) {
                notification.read = true;
                state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
        },

        /**
         * Mark all notifications as read (optimistic update)
         */
        markAllAsRead: (state) => {
            state.notifications = state.notifications.map(n => ({
                ...n,
                read: true
            }));
            state.unreadCount = 0;
        },

        /**
         * Remove a notification
         */
        removeNotification: (state, action) => {
            const notificationId = action.payload;
            const notification = state.notifications.find(n => n.id === notificationId);
            if (notification && !notification.read) {
                state.unreadCount = Math.max(0, state.unreadCount - 1);
            }
            state.notifications = state.notifications.filter(n => n.id !== notificationId);
        },

        /**
         * Set unread count
         */
        setUnreadCount: (state, action) => {
            state.unreadCount = action.payload || 0;
        },

        /**
         * Set loading state
         */
        setLoading: (state, action) => {
            state.loading = action.payload;
        },

        /**
         * Set error state
         */
        setError: (state, action) => {
            state.error = action.payload;
            state.loading = false;
        },

        /**
         * Clear all notifications
         */
        clearNotifications: (state) => {
            state.notifications = [];
            state.unreadCount = 0;
        }
    }
});

export const notificationActions = notificationSlice.actions;
export const notificationReducer = notificationSlice.reducer;
export default notificationSlice.reducer;
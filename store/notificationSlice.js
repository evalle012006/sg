import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const notificationSlice = createSlice({
    name: "notification",
    initialState: {
        notifications: [],
    },
    reducers: {
        setNotifications: (state, action) => {
            state.notifications = action.payload;
        },
    }
})

// export the action
export const notificationActions = notificationSlice.actions;

export const notificationReducer = notificationSlice.reducer;
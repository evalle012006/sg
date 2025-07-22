import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const notificationLibrarySlice = createSlice({
    name: "notificationLibrary",
    initialState: {
        data: null,
        list: [],
    },
    reducers: {
        setData: (state, action) => {
            state.data = action.payload;
        },
        setList: (state, action) => {
            state.list = action.payload;
        },
    }
})

// export the action
export const notificationLibraryActions = notificationLibrarySlice.actions;

export const notificationLibraryReducer = notificationLibrarySlice.reducer;
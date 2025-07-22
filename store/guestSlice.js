import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const guestSlice = createSlice({
    name: "guest",
    initialState: {
        data: null,
        list: [],
        isFiltering: null,
        filteredData: []
    },
    reducers: {
        setData: (state, action) => {
            state.data = action.payload;
        },
        setList: (state, action) => {
            state.list = action.payload;
        },
        setFilteredData: (state, action) => {
            state.filteredData = action.payload;
        },
        setIsFiltering: (state, action) => {
            state.isFiltering = action.payload;
        },
    }
})

// export the action
export const guestActions = guestSlice.actions;

export const guestReducer = guestSlice.reducer;
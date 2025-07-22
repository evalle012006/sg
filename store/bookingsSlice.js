import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const bookingsSlice = createSlice({
    name: "bookings",
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
export const bookingsActions = bookingsSlice.actions;

export const bookingsReducer = bookingsSlice.reducer;
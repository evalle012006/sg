import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const assetListSlice = createSlice({
    name: "assets",
    initialState: {
        data: null,
        list: [],
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
        }
    }
})

// export the action
export const assetListActions = assetListSlice.actions;

export const assetListReducer = assetListSlice.reducer;
import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const assetCategoriesSlice = createSlice({
    name: "asset-categories",
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
export const assetCategoriesActions = assetCategoriesSlice.actions;

export const assetCategoriesReducer = assetCategoriesSlice.reducer;
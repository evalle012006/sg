import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const supplierSlice = createSlice({
    name: "supplier",
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
export const supplierActions = supplierSlice.actions;

export const supplierReducer = supplierSlice.reducer;
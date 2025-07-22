import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const roomTypeSlice = createSlice({
    name: "roomType",
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
export const roomTypeActions = roomTypeSlice.actions;

export const roomTypeReducer = roomTypeSlice.reducer;
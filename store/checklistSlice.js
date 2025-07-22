import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const checklistSlice = createSlice({
    name: "checklist",
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
export const checklistActions = checklistSlice.actions;

export const checklistReducer = checklistSlice.reducer;
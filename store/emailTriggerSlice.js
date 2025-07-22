import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const emailTriggerSlice = createSlice({
    name: "emailTrigger",
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
export const emailTriggerActions = emailTriggerSlice.actions;

export const emailTriggerReducer = emailTriggerSlice.reducer;
import { createSlice } from '@reduxjs/toolkit'

// create a slice 
export const userSlice = createSlice({
    name: "user",
    initialState: {
        user: null,
    },
    reducers: {
        updateUser: (state, action) => {
            state.user = action.payload;
        },
        removeUser: state => {
            state.user = undefined;
        },
    }
})

// export the action
export const userActions = userSlice.actions

export const userReducer = userSlice.reducer
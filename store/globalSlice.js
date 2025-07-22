import { createSlice } from '@reduxjs/toolkit'

export const globalSlice = createSlice({
    name: "global",
    initialState: {
        loading: false,
        menuOpen: false,
    },
    reducers: {
        setLoading: (state, action) => {
            state.loading = action.payload;
        },
        toggleMenu: (state) => {
            state.menuOpen = !state.menuOpen;
        }
    }
})

export const globalActions = globalSlice.actions;

export const globalReducer = globalSlice.reducer;
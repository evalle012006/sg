import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { userReducer } from "./userSlice";
import { persistReducer, persistStore, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { checklistReducer } from "./checklistSlice";
import { bookingRequestFormReducer } from "./bookingRequestFormSlice";
import { templateReducer } from "./templateSlice";
import { globalReducer } from "./globalSlice";
import { roomTypeReducer } from "./roomTypeSlice";
import { assetListReducer } from "./assetsSlice";
import { assetCategoriesReducer } from "./assetCategoriesSlice";
import { guestReducer } from "./guestSlice";
import { supplierReducer } from "./supplierTypeSlice";
import { emailTriggerReducer } from "./emailTriggerSlice";
import { bookingsReducer } from "./bookingsSlice";
import { notificationReducer } from "./notificationSlice";
import { notificationLibraryReducer } from "./notificationLibrarySlice";

const persistConfig = {
    key: 'root',
    storage,
    // ADD: Blacklist slices that should NOT be persisted across sessions
    blacklist: [
        'bookingRequestForm',  // Prevents stale form data from previous sessions
        'global',              // Loading states shouldn't persist
    ]
}

// combine reducers
const rootReducer = combineReducers({
    global: globalReducer,
    user: userReducer,
    bookings: bookingsReducer,
    checklist: checklistReducer,
    bookingRequestForm: bookingRequestFormReducer,
    builder: templateReducer,
    roomType: roomTypeReducer,
    assets: assetListReducer,
    assetCategories: assetCategoriesReducer,
    guest: guestReducer,
    supplier: supplierReducer,
    emailTrigger: emailTriggerReducer,
    notifications: notificationReducer,
    notificationLibrary: notificationLibraryReducer
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

// config the store 
export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: {
            ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        },
    }),
})

// export default the store 
export const persistor = persistStore(store)
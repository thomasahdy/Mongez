import { configureStore } from "@reduxjs/toolkit";
import authReducer from './reducers/authSlice';
import spacesReducer from './reducers/spacesSlice'
export const store = configureStore({
    reducer:{
        users: authReducer,
        spaces: spacesReducer
    }
})

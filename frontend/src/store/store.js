import { configureStore } from "@reduxjs/toolkit";
import authReducer from './auth/authSlice';
import themeReducer from "./theme/themeSlice";

export const store = configureStore({
    reducer:{
        theme: themeReducer,
        users: authReducer
    }
})

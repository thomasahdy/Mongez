import { configureStore } from "@reduxjs/toolkit";
<<<<<<< HEAD

import authReducer from "./auth/authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

export default store;
=======
import authReducer from './reducers/authSlice';
export const store = configureStore({
    reducer:{
        users: authReducer
    }
})
>>>>>>> feature/backen_latest

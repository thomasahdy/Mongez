import { createSlice } from "@reduxjs/toolkit";

import {
  loginUser,
  registerUser,
  logoutUser,
  fetchCurrentUser,
} from "./authThunks";

const initialState = {
  user: null,

  isAuthenticated: false,

  loading: false,

  error: null,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    setAuthSession: (state, action) => {
      state.user = action.payload?.user || null;
      state.isAuthenticated = Boolean(action.payload?.isAuthenticated);
      state.loading = false;
      state.error = null;
    },
    clearAuthState: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
    },
  },

  extraReducers: (builder) => {

    // ======================
    // LOGIN
    // ======================

    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;

        state.user = action.payload.user;

        state.isAuthenticated = true;
      })

      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;

        state.error = action.payload;
      });




    // ======================
    // REGISTER
    // ======================

    builder
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;

        state.user = action.payload.user;

        state.isAuthenticated = true;
      })

      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;

        state.error = action.payload;
      });




    // ======================
    // FETCH CURRENT USER
    // ======================

    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true;
      })

      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false;

        state.user = action.payload;

        state.isAuthenticated = true;
      })

      .addCase(fetchCurrentUser.rejected, (state) => {
        state.loading = false;

        state.user = null;

        state.isAuthenticated = false;
      });




    // ======================
    // LOGOUT
    // ======================

    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;

        state.isAuthenticated = false;

        state.error = null;
      });
  },
});

export const { clearAuthError, setAuthSession, clearAuthState } = authSlice.actions;

export default authSlice.reducer;

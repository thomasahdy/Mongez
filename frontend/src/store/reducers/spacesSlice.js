import { createSlice } from "@reduxjs/toolkit";
import { fetchSpaces } from "../spaces/spacesThunks";

const spacesSlice = createSlice({
  name: "spaces",
  initialState: {
    items:   [],
    loading: false,
    error:   null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchSpaces
      .addCase(fetchSpaces.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchSpaces.fulfilled, (state, { payload }) => { state.loading = false; state.items = payload; })
      .addCase(fetchSpaces.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })
      },
});


export const { clearError } = spacesSlice.actions;
export default spacesSlice.reducer;
import { createAsyncThunk } from "@reduxjs/toolkit";
import { getSpaces } from "../../services/api/spacesService";

export const fetchSpaces = createAsyncThunk(
  "spaces/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await getSpaces();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);
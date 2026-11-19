import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

export const fetchMonthlyAttendance = createAsyncThunk(
  "monthlyAttendance/fetch",
  async (month, { rejectWithValue }) => {
    try {
      const response = await api.get("/daily-attendance/monthly", {
        params: { month },
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Monthly report loading failed",
      );
    }
  },
);

const monthlyAttendanceSlice = createSlice({
  name: "monthlyAttendance",

  initialState: {
    records: [],
    summary: null,
    month: "",
    loading: false,
    error: null,
  },

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(fetchMonthlyAttendance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMonthlyAttendance.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload.data || [];
        state.summary = action.payload.summary || null;
        state.month = action.payload.month || "";
      })
      .addCase(fetchMonthlyAttendance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export default monthlyAttendanceSlice.reducer;

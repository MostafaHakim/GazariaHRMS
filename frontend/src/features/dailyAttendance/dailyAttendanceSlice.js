import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Daily Attendance Fetch
export const fetchDailyAttendance = createAsyncThunk(
  "dailyAttendance/fetch",
  async (params, { rejectWithValue }) => {
    try {
      const response = await api.get("/daily-attendance", {
        params,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Attendance load failed",
      );
    }
  },
);

// Daily Attendance Calculate
export const calculateDailyAttendance = createAsyncThunk(
  "dailyAttendance/calculate",
  // arg: "YYYY-MM-DD" (একদিন) অথবা { fromDate, toDate } (তারিখের Range)
  async (arg, { rejectWithValue }) => {
    try {
      const body = typeof arg === "string" ? { date: arg } : arg;
      const response = await api.post("/daily-attendance/calculate", body);

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Attendance calculation failed",
      );
    }
  },
);

// Manual update (missing punch fix)
export const manualUpdateAttendance = createAsyncThunk(
  "dailyAttendance/manualUpdate",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/daily-attendance/${id}/manual`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Manual update failed",
      );
    }
  },
);

const dailyAttendanceSlice = createSlice({
  name: "dailyAttendance",

  initialState: {
    records: [],
    summary: null,
    sections: [],
    pagination: {
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    },

    loading: false,
    calculating: false,
    error: null,
    successMessage: null,
    calculationSummary: null,
  },

  reducers: {
    clearDailyAttendanceMessages: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchDailyAttendance.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDailyAttendance.fulfilled, (state, action) => {
        state.loading = false;
        state.records = action.payload.data || [];
        state.summary = action.payload.summary || null;
        state.sections = action.payload.sections || [];
        state.pagination = action.payload.pagination || state.pagination;
      })
      .addCase(fetchDailyAttendance.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Calculate
      .addCase(calculateDailyAttendance.pending, (state) => {
        state.calculating = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(calculateDailyAttendance.fulfilled, (state, action) => {
        state.calculating = false;
        state.calculationSummary = action.payload.data;
        state.successMessage =
          action.payload.message || "Attendance calculated successfully";
      })
      .addCase(calculateDailyAttendance.rejected, (state, action) => {
        state.calculating = false;
        state.error = action.payload;
      })

      // Manual update
      .addCase(manualUpdateAttendance.fulfilled, (state, action) => {
        const updated = action.payload.data;
        if (updated?._id) {
          state.records = state.records.map((r) =>
            r._id === updated._id ? updated : r,
          );
        }
        state.successMessage =
          action.payload.message || "Manual update saved";
      })
      .addCase(manualUpdateAttendance.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearDailyAttendanceMessages } = dailyAttendanceSlice.actions;

export default dailyAttendanceSlice.reducer;

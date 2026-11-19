import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

// Fetch Attendance Logs
export const fetchAttendanceLogs = createAsyncThunk(
  "attendance/fetchLogs",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/attendance/logs", {
        params,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to load attendance logs",
      );
    }
  },
);

// Fetch Device Sync History
export const fetchSyncHistory = createAsyncThunk(
  "attendance/fetchSyncHistory",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/attendance/sync-history", { params });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to load sync history",
      );
    }
  },
);

// Manual Device Sync
// options: { deviceId?: string, autoCalculate?: boolean, calculateDates?: string[] }
export const syncAttendance = createAsyncThunk(
  "attendance/sync",
  async (options = {}, { rejectWithValue }) => {
    try {
      const body = {};
      if (options.deviceId) body.deviceId = options.deviceId;
      if (options.autoCalculate) body.autoCalculate = true;
      if (Array.isArray(options.calculateDates) && options.calculateDates.length) {
        body.calculateDates = options.calculateDates;
      }
      const response = await api.post("/attendance/sync", body);

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Attendance synchronization failed",
      );
    }
  },
);

const initialState = {
  logs: [],
  history: [],
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  },

  syncResult: null,

  loading: false,
  syncing: false,
  historyLoading: false,

  error: null,
  syncError: null,
};

const attendanceSlice = createSlice({
  name: "attendance",
  initialState,

  reducers: {
    clearAttendanceError: (state) => {
      state.error = null;
    },

    clearSyncResult: (state) => {
      state.syncResult = null;
      state.syncError = null;
    },
  },

  extraReducers: (builder) => {
    builder

      // Attendance Logs
      .addCase(fetchAttendanceLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAttendanceLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.logs = action.payload.logs || [];
        state.pagination = action.payload.pagination || state.pagination;
      })
      .addCase(fetchAttendanceLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Sync History
      .addCase(fetchSyncHistory.pending, (state) => {
        state.historyLoading = true;
      })
      .addCase(fetchSyncHistory.fulfilled, (state, action) => {
        state.historyLoading = false;
        state.history = action.payload.history || [];
      })
      .addCase(fetchSyncHistory.rejected, (state, action) => {
        state.historyLoading = false;
        state.error = action.payload;
      })

      // Manual Sync
      .addCase(syncAttendance.pending, (state) => {
        state.syncing = true;
        state.syncError = null;
        state.syncResult = null;
      })
      .addCase(syncAttendance.fulfilled, (state, action) => {
        state.syncing = false;
        state.syncResult = action.payload;
      })
      .addCase(syncAttendance.rejected, (state, action) => {
        state.syncing = false;
        state.syncError = action.payload;
      });
  },
});

export const { clearAttendanceError, clearSyncResult } =
  attendanceSlice.actions;

export default attendanceSlice.reducer;

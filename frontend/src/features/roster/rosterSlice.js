import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../../services/api";

// Roster Fetch
export const fetchWeeklyRoster = createAsyncThunk(
  "roster/fetchWeeklyRoster",
  async (weekStartDate, { rejectWithValue }) => {
    try {
      const response = await api.get("/weekly-rosters", {
        params: { weekStartDate },
      });

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Roster Load Failed",
      );
    }
  },
);

// Roster Generate
export const generateWeeklyRoster = createAsyncThunk(
  "roster/generateWeeklyRoster",
  async (weekStartDate, { rejectWithValue }) => {
    try {
      const response = await api.post("/weekly-rosters/generate", {
        weekStartDate,
      });

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Roster Generate Failed",
      );
    }
  },
);

// Manual Shift Change
export const updateRosterShift = createAsyncThunk(
  "roster/updateRosterShift",
  async ({ rosterId, employeeId, shiftCode, remarks }, { rejectWithValue }) => {
    try {
      const response = await api.put(
        `/weekly-rosters/${rosterId}/employee/${employeeId}`,
        { shiftCode, remarks },
      );

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Shift Update Failed",
      );
    }
  },
);

// Mid-week Shift Change (সপ্তাহের মাঝখান থেকে শিফট বদল)
export const changeShiftMidWeek = createAsyncThunk(
  "roster/changeShiftMidWeek",
  async (
    { rosterId, employeeId, fromDate, toDate, shiftCode, remarks },
    { rejectWithValue },
  ) => {
    try {
      const response = await api.put(
        `/weekly-rosters/${rosterId}/employee/${employeeId}/mid-week`,
        { fromDate, toDate, shiftCode, remarks },
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Mid-week Shift Change Failed",
      );
    }
  },
);

// Mid-week change তুলে মূল শিফটে ফেরা
export const clearMidWeekChange = createAsyncThunk(
  "roster/clearMidWeekChange",
  async ({ rosterId, employeeId }, { rejectWithValue }) => {
    try {
      const response = await api.delete(
        `/weekly-rosters/${rosterId}/employee/${employeeId}/mid-week`,
      );

      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Mid-week Change Remove Failed",
      );
    }
  },
);

// Publish Roster
export const publishRoster = createAsyncThunk(
  "roster/publishRoster",
  async (rosterId, { rejectWithValue }) => {
    try {
      const response = await api.patch(`/weekly-rosters/${rosterId}/publish`);

      return response.data.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Roster Publish Failed",
      );
    }
  },
);

const rosterSlice = createSlice({
  name: "roster",

  initialState: {
    rosters: [],
    currentRoster: null,
    loading: false,
    generating: false,
    saving: false,
    publishing: false,
    error: null,
    successMessage: null,
  },

  reducers: {
    clearRosterMessage: (state) => {
      state.error = null;
      state.successMessage = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchWeeklyRoster.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWeeklyRoster.fulfilled, (state, action) => {
        state.loading = false;
        state.rosters = action.payload || [];
        state.currentRoster = action.payload?.[0] || null;
      })
      .addCase(fetchWeeklyRoster.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(generateWeeklyRoster.pending, (state) => {
        state.generating = true;
        state.error = null;
        state.successMessage = null;
      })
      .addCase(generateWeeklyRoster.fulfilled, (state, action) => {
        state.generating = false;
        state.currentRoster = action.payload.data;
        state.successMessage = action.payload.message;
      })
      .addCase(generateWeeklyRoster.rejected, (state, action) => {
        state.generating = false;
        state.error = action.payload;
      })

      .addCase(updateRosterShift.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateRosterShift.fulfilled, (state, action) => {
        state.saving = false;
        state.currentRoster = action.payload;
        state.successMessage = "Shift Successfully Updated";
      })
      .addCase(updateRosterShift.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      .addCase(changeShiftMidWeek.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(changeShiftMidWeek.fulfilled, (state, action) => {
        state.saving = false;
        state.currentRoster = action.payload.data;
        state.successMessage = action.payload.message;
      })
      .addCase(changeShiftMidWeek.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      .addCase(clearMidWeekChange.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(clearMidWeekChange.fulfilled, (state, action) => {
        state.saving = false;
        state.currentRoster = action.payload.data;
        state.successMessage = action.payload.message;
      })
      .addCase(clearMidWeekChange.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload;
      })

      .addCase(publishRoster.pending, (state) => {
        state.publishing = true;
        state.error = null;
      })
      .addCase(publishRoster.fulfilled, (state, action) => {
        state.publishing = false;
        state.currentRoster = action.payload;
        state.successMessage = "Roster Published Successfully";
      })
      .addCase(publishRoster.rejected, (state, action) => {
        state.publishing = false;
        state.error = action.payload;
      });
  },
});

export const { clearRosterMessage } = rosterSlice.actions;

export default rosterSlice.reducer;

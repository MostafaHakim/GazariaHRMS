import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Fetch designations
export const fetchDesignations = createAsyncThunk(
  "designations/fetchDesignations",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/designations", { params });
      return response.data.designations;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch designations",
      );
    }
  },
);

// Create designation
export const createDesignation = createAsyncThunk(
  "designations/createDesignation",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.post("/designations", data);
      return response.data.designation;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create designation",
      );
    }
  },
);

// Update designation
export const updateDesignation = createAsyncThunk(
  "designations/updateDesignation",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/designations/${id}`, data);
      return response.data.designation;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update designation",
      );
    }
  },
);

// Delete designation
export const deleteDesignation = createAsyncThunk(
  "designations/deleteDesignation",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/designations/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete designation",
      );
    }
  },
);

const designationSlice = createSlice({
  name: "designations",

  initialState: {
    designations: [],
    loading: false,
    error: null,
    success: false,
  },

  reducers: {
    clearDesignationError: (state) => {
      state.error = null;
    },
    clearDesignationSuccess: (state) => {
      state.success = false;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchDesignations.pending, (state) => {
        state.designations = [];
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDesignations.fulfilled, (state, action) => {
        state.loading = false;
        state.designations = action.payload || [];
      })
      .addCase(fetchDesignations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createDesignation.fulfilled, (state, action) => {
        state.designations.push(action.payload);
        state.success = true;
      })
      .addCase(updateDesignation.fulfilled, (state, action) => {
        const index = state.designations.findIndex(
          (item) => item._id === action.payload._id,
        );

        if (index !== -1) {
          state.designations[index] = action.payload;
        }

        state.success = true;
      })
      .addCase(deleteDesignation.fulfilled, (state, action) => {
        state.designations = state.designations.filter(
          (item) => item._id !== action.payload,
        );
        state.success = true;
      });
  },
});

export const { clearDesignationError, clearDesignationSuccess } =
  designationSlice.actions;

export default designationSlice.reducer;

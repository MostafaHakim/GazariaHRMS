import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Fetch departments
export const fetchDepartments = createAsyncThunk(
  "departments/fetchDepartments",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/departments", { params });
      return response.data.departments;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch departments",
      );
    }
  },
);

// Create department
export const createDepartment = createAsyncThunk(
  "departments/createDepartment",
  async (data, { rejectWithValue }) => {
    try {
      const response = await api.post("/departments", data);
      return response.data.department;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to create department",
      );
    }
  },
);

// Update department
export const updateDepartment = createAsyncThunk(
  "departments/updateDepartment",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/departments/${id}`, data);
      return response.data.department;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to update department",
      );
    }
  },
);

// Delete department
export const deleteDepartment = createAsyncThunk(
  "departments/deleteDepartment",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/departments/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to delete department",
      );
    }
  },
);

const departmentSlice = createSlice({
  name: "departments",

  initialState: {
    departments: [],
    loading: false,
    error: null,
    success: false,
  },

  reducers: {
    clearDepartmentError: (state) => {
      state.error = null;
    },
    clearDepartmentSuccess: (state) => {
      state.success = false;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchDepartments.pending, (state) => {
        state.departments = [];
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.loading = false;
        state.departments = action.payload || [];
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createDepartment.fulfilled, (state, action) => {
        state.departments.push(action.payload);
        state.success = true;
      })
      .addCase(updateDepartment.fulfilled, (state, action) => {
        const index = state.departments.findIndex(
          (item) => item._id === action.payload._id,
        );

        if (index !== -1) {
          state.departments[index] = action.payload;
        }

        state.success = true;
      })
      .addCase(deleteDepartment.fulfilled, (state, action) => {
        state.departments = state.departments.filter(
          (item) => item._id !== action.payload,
        );
        state.success = true;
      });
  },
});

export const { clearDepartmentError, clearDepartmentSuccess } =
  departmentSlice.actions;

export default departmentSlice.reducer;

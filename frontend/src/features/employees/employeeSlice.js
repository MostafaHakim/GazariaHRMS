import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Get All Employees
export const fetchEmployees = createAsyncThunk(
  "employees/fetchEmployees",
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get("/employees", { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Get Single Employee
export const fetchEmployeeById = createAsyncThunk(
  "employees/fetchEmployeeById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/employees/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Create Employee
export const createEmployee = createAsyncThunk(
  "employees/createEmployee",
  async (employeeData, { rejectWithValue }) => {
    try {
      const response = await api.post("/employees", employeeData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Update Employee
export const updateEmployee = createAsyncThunk(
  "employees/updateEmployee",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/employees/${id}`, data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Delete Employee
export const deleteEmployee = createAsyncThunk(
  "employees/deleteEmployee",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/employees/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  },
);

// Bulk Create Employees
export const bulkCreateEmployees = createAsyncThunk(
  "employees/bulkCreateEmployees",
  async (employees, { rejectWithValue }) => {
    try {
      const response = await api.post("/employees/bulk", { employees });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.message,
      );
    }
  },
);

const employeeSlice = createSlice({
  name: "employees",

  initialState: {
    employees: [],
    selectedEmployee: null,
    loading: false,
    error: null,
    success: false,
    total: 0,
    pagination: { total: 0, page: 1, limit: 100, totalPages: 1 },
    stats: { total: 0, active: 0, inactive: 0 },
    sections: [],
  },

  reducers: {
    clearEmployees: (state) => {
      state.employees = [];
      state.selectedEmployee = null;
      state.total = 0;
      state.pagination = { total: 0, page: 1, limit: 100, totalPages: 1 };
      state.stats = { total: 0, active: 0, inactive: 0 };
      state.sections = [];
      state.error = null;
    },

    clearEmployeeError: (state) => {
      state.error = null;
    },

    clearSelectedEmployee: (state) => {
      state.selectedEmployee = null;
    },

    clearEmployeeSuccess: (state) => {
      state.success = false;
    },
  },

  extraReducers: (builder) => {
    builder

      // Fetch Employees
      .addCase(fetchEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchEmployees.fulfilled, (state, action) => {
        state.loading = false;

        state.employees = action.payload.employees || [];

        state.total = action.payload.pagination?.total || 0;
        state.pagination = action.payload.pagination || state.pagination;
        if (action.payload.stats) state.stats = action.payload.stats;
        state.sections = action.payload.sections || [];
      })
      .addCase(fetchEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Fetch Single Employee
      .addCase(fetchEmployeeById.fulfilled, (state, action) => {
        state.selectedEmployee = action.payload.employee || action.payload;
      })

      // Create Employee
      .addCase(createEmployee.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createEmployee.fulfilled, (state, action) => {
        state.loading = false;
        const employee = action.payload.employee || action.payload;
        state.employees.unshift(employee);
        state.total += 1;
        state.success = true;
      })
      .addCase(createEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Update Employee
      .addCase(updateEmployee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateEmployee.fulfilled, (state, action) => {
        state.loading = false;

        const updatedEmployee = action.payload.employee || action.payload;

        state.employees = state.employees.map((employee) =>
          employee._id === updatedEmployee._id ? updatedEmployee : employee,
        );

        state.selectedEmployee = updatedEmployee;
        state.success = true;
      })
      .addCase(updateEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Delete Employee
      .addCase(deleteEmployee.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteEmployee.fulfilled, (state, action) => {
        state.loading = false;

        state.employees = state.employees.filter(
          (employee) => employee._id !== action.payload,
        );

        state.total = Math.max(0, state.total - 1);
        state.success = true;
      })
      .addCase(deleteEmployee.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // Bulk Create
      .addCase(bulkCreateEmployees.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(bulkCreateEmployees.fulfilled, (state) => {
        state.loading = false;
        state.success = true;
      })
      .addCase(bulkCreateEmployees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearEmployees,
  clearEmployeeError,
  clearSelectedEmployee,
  clearEmployeeSuccess,
} = employeeSlice.actions;

export default employeeSlice.reducer;

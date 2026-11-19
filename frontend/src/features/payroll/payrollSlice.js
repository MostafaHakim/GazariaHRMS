import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

const errMsg = (error, fallback) => error.response?.data?.message || fallback;

export const fetchPayroll = createAsyncThunk(
  "payroll/fetch",
  async ({ month }, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/payroll", { params: { month } });
      return data;
    } catch (error) {
      return rejectWithValue(errMsg(error, "Failed to load payroll"));
    }
  },
);

export const generatePayroll = createAsyncThunk(
  "payroll/generate",
  async ({ month }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/payroll/generate", { month });
      return data;
    } catch (error) {
      return rejectWithValue(errMsg(error, "Failed to generate payroll"));
    }
  },
);

// একটি লাইন সেভ করে মাসের সব হিসাব (সামারি সহ) সার্ভার থেকে আবার আনে
export const updatePayrollLine = createAsyncThunk(
  "payroll/updateLine",
  async ({ id, data, month }, { dispatch, rejectWithValue }) => {
    try {
      await api.patch(`/payroll/lines/${id}`, data);
      const res = await api.get("/payroll", { params: { month } });
      return res.data;
    } catch (error) {
      // ভুল মান হলে সার্ভারের সঠিক মান ফিরিয়ে আনি
      dispatch(fetchPayroll({ month }));
      return rejectWithValue(errMsg(error, "Failed to save"));
    }
  },
);

const statusAction = (name, path, fallback) =>
  createAsyncThunk(`payroll/${name}`, async ({ month }, { dispatch, rejectWithValue }) => {
    try {
      await api.post(`/payroll/${month}/${path}`);
      const res = await api.get("/payroll", { params: { month } });
      return res.data;
    } catch (error) {
      dispatch(fetchPayroll({ month }));
      return rejectWithValue(errMsg(error, fallback));
    }
  });

export const finalizePayroll = statusAction("finalize", "finalize", "Failed to finalize");
export const markPayrollPaid = statusAction("markPaid", "mark-paid", "Failed to mark as paid");
export const reopenPayroll = statusAction("reopen", "reopen", "Failed to reopen");

export const deletePayroll = createAsyncThunk(
  "payroll/delete",
  async ({ month }, { rejectWithValue }) => {
    try {
      await api.delete(`/payroll/${month}`);
      return month;
    } catch (error) {
      return rejectWithValue(errMsg(error, "Failed to delete payroll"));
    }
  },
);

const initialState = {
  run: null,
  lines: [],
  summary: null,
  loading: false, // টেবিল লোড
  working: false, // generate / status পরিবর্তন
  error: null,
  message: null,
};

const apply = (state, payload) => {
  state.run = payload.run;
  state.lines = payload.lines || [];
  state.summary = payload.summary || null;
};

const payrollSlice = createSlice({
  name: "payroll",
  initialState,
  reducers: {
    clearPayrollNotice: (state) => {
      state.error = null;
      state.message = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPayroll.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPayroll.fulfilled, (state, action) => {
        state.loading = false;
        apply(state, action.payload);
      })
      .addCase(fetchPayroll.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(generatePayroll.pending, (state) => {
        state.working = true;
        state.error = null;
        state.message = null;
      })
      .addCase(generatePayroll.fulfilled, (state, action) => {
        state.working = false;
        state.message = action.payload.message;
        apply(state, action.payload);
      })
      .addCase(generatePayroll.rejected, (state, action) => {
        state.working = false;
        state.error = action.payload;
      })

      .addCase(updatePayrollLine.fulfilled, (state, action) => {
        apply(state, action.payload);
      })
      .addCase(updatePayrollLine.rejected, (state, action) => {
        state.error = action.payload;
      })

      .addCase(deletePayroll.fulfilled, (state) => {
        Object.assign(state, initialState, { message: "Payroll deleted" });
      })
      .addCase(deletePayroll.rejected, (state, action) => {
        state.error = action.payload;
      });

    [finalizePayroll, markPayrollPaid, reopenPayroll].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.working = true;
          state.error = null;
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.working = false;
          apply(state, action.payload);
        })
        .addCase(thunk.rejected, (state, action) => {
          state.working = false;
          state.error = action.payload;
        });
    });
  },
});

export const { clearPayrollNotice } = payrollSlice.actions;
export default payrollSlice.reducer;

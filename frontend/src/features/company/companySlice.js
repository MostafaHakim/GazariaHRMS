import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';

const ACTIVE_COMPANY_KEY = 'gazaria_hrms_active_company';
export const fetchCompanies = createAsyncThunk('company/fetchCompanies', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/companies');
    return data.companies || [];
  } catch (error) {
    return rejectWithValue(error.response?.data?.message || 'Could not load companies');
  }
});

const companySlice = createSlice({
  name: 'company',
  initialState: { companies: [], activeCompanyId: localStorage.getItem(ACTIVE_COMPANY_KEY) || '', loading: false, error: null },
  reducers: {
    setActiveCompany(state, action) {
      state.activeCompanyId = action.payload || '';
      if (action.payload) localStorage.setItem(ACTIVE_COMPANY_KEY, action.payload);
      else localStorage.removeItem(ACTIVE_COMPANY_KEY);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchCompanies.pending, (state) => { state.loading = true; state.error = null; });
    builder.addCase(fetchCompanies.fulfilled, (state, action) => {
      state.loading = false;
      state.companies = action.payload;
      const allowed = action.payload.some(c => String(c._id) === state.activeCompanyId);
      if (!allowed) {
        state.activeCompanyId = action.payload[0]?._id || '';
        if (state.activeCompanyId) localStorage.setItem(ACTIVE_COMPANY_KEY, state.activeCompanyId);
        else localStorage.removeItem(ACTIVE_COMPANY_KEY);
      }
    });
    builder.addCase(fetchCompanies.rejected, (state, action) => { state.loading = false; state.error = action.payload; });
  },
});
export const { setActiveCompany } = companySlice.actions;
export default companySlice.reducer;

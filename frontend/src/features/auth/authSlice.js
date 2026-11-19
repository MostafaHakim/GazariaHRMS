import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api, { TOKEN_KEY } from "../../services/api";

const storedToken = localStorage.getItem(TOKEN_KEY);

export const login = createAsyncThunk(
  "auth/login",
  async ({ username, password }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", { username, password });
      return data;
    } catch (error) {
      // response না থাকা মানে সার্ভারে পৌঁছানোই যায়নি (সার্ভার বন্ধ / ভুল VITE_API_URL / CORS)
      if (!error.response) {
        return rejectWithValue(
          `সার্ভারে সংযোগ করা যাচ্ছে না (${api.defaults.baseURL}). ব্যাকএন্ড চালু আছে কি না এবং frontend/.env এর VITE_API_URL ও backend/.env এর FRONTEND_URL ঠিক আছে কি না দেখুন।`,
        );
      }
      return rejectWithValue(error.response?.data?.message || "Login failed");
    }
  },
);

// পেজ রিলোডে টোকেন দিয়ে ইউজার ফিরিয়ে আনা
export const fetchMe = createAsyncThunk(
  "auth/fetchMe",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get("/auth/me");
      return data.user;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || "Session invalid");
    }
  },
);

export const changePassword = createAsyncThunk(
  "auth/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.put("/auth/change-password", payload);
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to change password",
      );
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: storedToken,
    user: null,
    initializing: Boolean(storedToken), // টোকেন আছে, ইউজার যাচাই বাকি
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
      state.user = null;
      state.initializing = false;
      state.error = null;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.initializing = false;
        localStorage.setItem(TOKEN_KEY, action.payload.token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.user = action.payload;
        state.initializing = false;
      })
      .addCase(fetchMe.rejected, (state) => {
        localStorage.removeItem(TOKEN_KEY);
        state.token = null;
        state.user = null;
        state.initializing = false;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.token = action.payload.token;
        localStorage.setItem(TOKEN_KEY, action.payload.token);
      });
  },
});

export const { logout, clearAuthError } = authSlice.actions;
export default authSlice.reducer;

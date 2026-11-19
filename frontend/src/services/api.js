import axios from "axios";

export const TOKEN_KEY = "gazaria_hrms_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// প্রতিটি রিকোয়েস্টে টোকেন যোগ
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const companyId = localStorage.getItem('gazaria_hrms_active_company');
  if (companyId) config.headers['X-Company-Id'] = companyId;
  return config;
});

// টোকেন মেয়াদোত্তীর্ণ/অবৈধ হলে (লগইন রিকোয়েস্ট বাদে) লগআউট
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    if (error.response?.status === 401 && !url.includes("/auth/login")) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

export default api;

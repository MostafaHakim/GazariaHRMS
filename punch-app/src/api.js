export const TOKEN_KEY = "gazaria_punch_token";
const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const api = async (path, { method = "GET", body } = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("সার্ভারে সংযোগ হচ্ছে না। ইন্টারনেট/নেটওয়ার্ক দেখুন।", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || "কিছু একটা ভুল হয়েছে", res.status);
  return data;
};

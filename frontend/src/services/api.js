import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:5000/api",
  headers: {
    "Content-Type": "application/json"
  }
});

// Attach JWT token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// SIGNUP
export const signupUser = async (userData) => {
  const response = await API.post("/auth/signup", userData);
  return response.data;
};

// VERIFY OTP
export const verifyOTP = async (email, otp) => {
  const response = await API.post("/auth/verify-otp", {
    email,
    otp
  });

  return response.data;
};

// RESEND OTP
export const resendOTP = async (email) => {
  const response = await API.post("/auth/resend-otp", {
    email
  });

  return response.data;
};

// LOGIN
export const loginUser = async (userData) => {
  const response = await API.post("/auth/login", userData);
  return response.data;
};

// GET EXPENSES
export const getExpenses = async () => {
  const response = await API.get("/expenses");
  return response.data;
};

// ADD EXPENSE
export const addExpense = async (expense) => {
  const response = await API.post("/expenses", expense);
  return response.data;
};

// UPDATE EXPENSE
export const updateExpense = async (id, expense) => {
  const response = await API.put(`/expenses/${id}`, expense);
  return response.data;
};

// DELETE EXPENSE
export const deleteExpense = async (id) => {
  const response = await API.delete(`/expenses/${id}`);
  return response.data;
};

export default API;
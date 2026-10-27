import axios from "axios";

// Always use VITE_API_URL with a localhost fallback for local development
const rawBaseURL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const baseURL = String(rawBaseURL).trim().replace(/\/$/, "");

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hotelToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Ensure the browser and proxies never serve stale cached API data
  config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  config.headers["Pragma"] = "no-cache";
  config.headers["Expires"] = "0";

  if (config.method === "get") {
    config.params = { ...(config.params || {}), _t: Date.now() };
  }
  return config;
});

export const errorMessage = (error) =>
  error.response?.data?.message ||
  error.message ||
  "Something went wrong. Please try again.";

export const getData = (response) => response.data.data || {};

export const formatRupees = (amount) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

export const formatBookingDate = (value) => {
  const [year, month, day] = String(value || "").slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year.slice(-2)}` : "";
};

export const getRefundStage = (booking) => {
  if (booking?.status !== "cancelled" || booking.paymentStatus !== "paid") return null;
  if (booking.refundStatus === "refunded") return "refunded";
  if (booking.refundStatus === "failed") return "failed";
  if (booking.refundStatus === "pending") return "pending";
  if (booking.refundStatus === "processing") return "processing";

  if (booking.refundStatus === "refund_initiated") {
    const initiatedAt = booking.refundInitiatedAt
      ? new Date(booking.refundInitiatedAt).getTime()
      : NaN;
    return Number.isFinite(initiatedAt) && Date.now() - initiatedAt >= 60_000
      ? "processing"
      : "initiated";
  }

  return null;
};

export default api;

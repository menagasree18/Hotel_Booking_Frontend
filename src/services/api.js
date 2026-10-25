import axios from "axios";

const api =axios.post("https://your-backend.onrender.com/api/auth/login", formData);
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hotelToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (error) =>
  error.response?.data?.message || error.message || "Something went wrong. Please try again.";
export const getData = (response) => response.data.data || {};
export const formatRupees = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN")}`;
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
    const initiatedAt = booking.refundInitiatedAt ? new Date(booking.refundInitiatedAt).getTime() : NaN;
    return Number.isFinite(initiatedAt) && Date.now() - initiatedAt >= 60_000 ? "processing" : "initiated";
  }
  return null;
};
export default api;

import React from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout, Layout } from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { AdminDashboardPage, AllBookingsPage, AllReviewsPage, ManageHotelsPage, ManageRoomsPage } from "./pages/AdminPages";
import PaymentPage from "./pages/Payment";
import { AdminLoginPage, BookingPage, BookingsPage, HomePage, HotelDetailsPage, HotelsPage, LoginPage, ProfilePage, RegisterPage, RoomDetailsPage, WishlistPage } from "./pages/Pages";

function UserRoute({ requireAuth = false }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route element={<UserRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/hotels" element={<HotelsPage />} />
          <Route path="/hotels/:id" element={<HotelDetailsPage />} />
          <Route path="/rooms/:id" element={<RoomDetailsPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<UserRoute requireAuth />}>
          <Route path="/booking/:roomId" element={<BookingPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/payment/:bookingId" element={<PaymentPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute admin />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/hotels" element={<ManageHotelsPage />} />
          <Route path="/admin/rooms" element={<ManageRoomsPage />} />
          <Route path="/admin/bookings" element={<AllBookingsPage />} />
          <Route path="/admin/reviews" element={<AllReviewsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

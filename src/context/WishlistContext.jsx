import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { getData, errorMessage } from "../services/api";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistHotels, setWishlistHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchWishlist = useCallback(async (silent = false) => {
    if (!user || user.role === "admin") {
      setWishlistIds([]);
      setWishlistHotels([]);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const response = await api.get("/wishlist");
      const data = getData(response);
      const hotels = data.wishlist || [];
      const ids = (data.wishlistIds || hotels.map((h) => h._id?.toString())).filter(Boolean);
      setWishlistHotels(hotels);
      setWishlistIds(ids);
      setError("");
    } catch (err) {
      if (!silent) setError(errorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const isInWishlist = useCallback((hotelId) => {
    if (!hotelId) return false;
    const strId = typeof hotelId === "object" ? hotelId._id?.toString() : hotelId.toString();
    return wishlistIds.includes(strId);
  }, [wishlistIds]);

  const toggleWishlist = async (hotel) => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return { success: false, requireAuth: true };
    }
    if (user.role === "admin") {
      return { success: false, isAdmin: true };
    }

    const hotelId = typeof hotel === "object" ? hotel._id?.toString() : hotel.toString();
    const isCurrentlyWishlisted = isInWishlist(hotelId);

    // Optimistic UI update
    setWishlistIds((prev) =>
      isCurrentlyWishlisted ? prev.filter((id) => id !== hotelId) : [...prev, hotelId]
    );

    if (isCurrentlyWishlisted) {
      setWishlistHotels((prev) => prev.filter((h) => h._id?.toString() !== hotelId));
    } else if (typeof hotel === "object" && hotel.name) {
      setWishlistHotels((prev) => [hotel, ...prev]);
    }

    try {
      const response = await api.post(`/wishlist/toggle/${hotelId}`);
      const data = getData(response);
      if (data.wishlistIds) {
        setWishlistIds(data.wishlistIds.map((id) => id.toString()));
      }
      return { success: true, inWishlist: !isCurrentlyWishlisted, message: data.message };
    } catch (err) {
      // Rollback on error
      fetchWishlist(true);
      return { success: false, error: errorMessage(err) };
    }
  };

  const removeFromWishlist = async (hotelId) => {
    return toggleWishlist(hotelId);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistIds,
        wishlistHotels,
        loading,
        error,
        isInWishlist,
        toggleWishlist,
        removeFromWishlist,
        refreshWishlist: fetchWishlist
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
export default WishlistContext;

import React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import HotelCard from "../components/HotelCard";
import FilterSidebar, {
  PROPERTY_TYPES,
  STAR_CATEGORIES,
  AMENITIES_LIST,
  FOR_YOU_OPTIONS,
  BOOKING_PREFERENCES,
  HOUSE_RULES,
  RATING_OPTIONS
} from "../components/FilterSidebar";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import api, { errorMessage, formatBookingDate, formatRupees, getData, getRefundStage } from "../services/api";

const fallbackImage = "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=90";
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const getHotelLocations = (hotels) => [...new Set(hotels.map((hotel) => hotel.location).filter(Boolean))].sort();

function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true, error: "", value: null });
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: "", value: null });
    loader().then((value) => active && setState({ loading: false, error: "", value }))
      .catch((error) => active && setState({ loading: false, error: errorMessage(error), value: null }));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return state;
}

function Loading({ error }) {
  if (error) return <div className="notice notice-error">{error} <button onClick={() => window.location.reload()}>Try again</button></div>;
  return <div className="loading-state"><span className="loader" />Finding your next lovely stay…</div>;
}

function HotelRatingControl({ hotelId, expandedOnLoad = false, onRated, className = "" }) {
  const { user } = useAuth();
  const [canRate, setCanRate] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [review, setReview] = useState("");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showStars, setShowStars] = useState(expandedOnLoad);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (user?.role !== "user") {
      setLoading(false);
      setCanRate(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api.get(`/hotels/${hotelId}/my-rating`)
      .then((response) => {
        if (!active) return;
        const data = getData(response);
        setCanRate(Boolean(data.canRate));
        setMyRating(data.rating?.stars || 0);
        setSelectedRating(data.rating?.stars || 0);
        setReview(data.rating?.review || "");
        setError("");
      })
      .catch((reason) => active && setError(errorMessage(reason)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [hotelId, user?.role]);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(""), 3000);
    return () => clearTimeout(timeout);
  }, [message]);

  const submitRating = async () => {
    if (!selectedRating) {
      setError("Choose a star rating before submitting.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const response = await api.post(`/hotels/${hotelId}/rate`, { stars: selectedRating, review });
      const data = getData(response);
      setMyRating(data.rating.stars);
      setMessage("Thanks for your rating and review");
      if (!expandedOnLoad) setShowStars(false);
      onRated?.(data.hotel);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  };

  if (loading || user?.role !== "user" || (!canRate && !error)) return null;
  return (
    <div className={`hotel-rating-control ${className}`}>
      {canRate && !showStars && myRating > 0 && <span>Your rating: {myRating} ★</span>}
      {canRate && !showStars && <button className="text-button rating-action" type="button" onClick={() => setShowStars(true)}>{myRating ? "Change rating" : "Rate your stay"}</button>}
      {canRate && showStars && (
        <>
          <div className="rating-stars" onMouseLeave={() => setHoveredRating(0)}>
            {[1, 2, 3, 4, 5].map((stars) => (
              <button
                key={stars}
                type="button"
                aria-label={`Rate ${stars} star${stars === 1 ? "" : "s"}`}
                aria-pressed={selectedRating === stars}
                className={stars <= (hoveredRating || selectedRating) ? "rating-star rating-star-active" : "rating-star"}
                onMouseEnter={() => setHoveredRating(stars)}
                onFocus={() => setHoveredRating(stars)}
                onBlur={() => setHoveredRating(0)}
                onClick={() => setSelectedRating(stars)}
              >★</button>
            ))}
          </div>
          <label className="review-input-label">Write a review <textarea maxLength={1000} rows="3" value={review} onChange={(event) => setReview(event.target.value)} placeholder="Share what you liked about your stay." /></label>
          <button className="text-button rating-action" type="button" onClick={submitRating}>{myRating ? "Update review" : "Submit review"}</button>
        </>
      )}
      {message && <span className="rating-feedback">{message}</span>}
      {error && <span className="rating-feedback">{error}</span>}
    </div>
  );
}

const getPriceRangeValue = (minPrice, maxPrice) => {
  const min = minPrice !== undefined && minPrice !== null ? String(minPrice).trim() : "";
  const max = maxPrice !== undefined && maxPrice !== null ? String(maxPrice).trim() : "";
  if ((min === "0" || min === "") && max === "5000") return "0-5000";
  if (min === "5000" && max === "10000") return "5000-10000";
  if (min === "10000" && max === "15000") return "10000-15000";
  if (min === "15000" && !max) return "15000+";
  return "";
};

const getPriceRangeLimits = (rangeValue) => {
  if (rangeValue === "0-5000") return { minPrice: "0", maxPrice: "5000" };
  if (rangeValue === "5000-10000") return { minPrice: "5000", maxPrice: "10000" };
  if (rangeValue === "10000-15000") return { minPrice: "10000", maxPrice: "15000" };
  if (rangeValue === "15000+") return { minPrice: "15000", maxPrice: "" };
  return { minPrice: "", maxPrice: "" };
};

export function HomePage() {
  const [hotels, setHotels] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    destination: "",
    checkIn: today,
    checkOut: tomorrow,
    guests: "2",
    minPrice: "",
    maxPrice: ""
  });
  const loadDestinations = React.useCallback(() => {
    api.get("/hotels/destinations").then((response) => {
      const list = getData(response).destinations || [];
      const unique = Array.from(new Set(list.map((d) => String(d).trim()))).filter(Boolean);
      setDestinations(unique);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/hotels").then((response) => setHotels(getData(response).hotels || []))
      .catch((reason) => setError(errorMessage(reason)));
    loadDestinations();
  }, [loadDestinations]);

  const allDestinations = React.useMemo(() => {
    const set = new Set(destinations);
    hotels.forEach((h) => {
      if (h.location) {
        h.location.split(",").forEach((p) => {
          const t = p.trim();
          if (t) set.add(t);
        });
        set.add(h.location.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [destinations, hotels]);
  const navigate = useNavigate();
  const submitSearch = (event) => {
    event.preventDefault();
    const params = new URLSearchParams(Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined && value !== null)));
    navigate(`/hotels?${params.toString()}`);
  };
  return (
    <>
      <section className="hero">
        <img className="hero-image" src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2200&q=90" alt="" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="hero-kicker"><span /> THE ART OF GETTING AWAY</span>
          <h1>Find your<br />kind of <em>elsewhere.</em></h1>
          <p>Thoughtful places. Meaningful moments. Your next story starts here.</p>
        </div>
        <div className="hero-note"><span>01 — 13</span><span>Quiet mornings, considered stays.</span></div>
      </section>
      <section className="search-panel-wrap">
        <form className="search-panel home-search-panel" onSubmit={submitSearch}>
          <label className="search-field search-destination">
            <span className="field-label">DESTINATION</span>
            <span className="input-icon">⌕</span>
            <select
              aria-label="Destination"
              value={form.destination}
              onFocus={loadDestinations}
              onClick={loadDestinations}
              onMouseDown={loadDestinations}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
            >
              <option value="">All Destinations</option>
              {form.destination && !allDestinations.some((d) => d.toLowerCase() === form.destination.trim().toLowerCase()) && (
                <option value={form.destination}>{form.destination}</option>
              )}
              {allDestinations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="search-field"><span className="field-label">CHECK IN</span><input aria-label="Check in" type="date" min={today} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} /></label>
          <label className="search-field"><span className="field-label">CHECK OUT</span><input aria-label="Check out" type="date" min={form.checkIn || today} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} /></label>
          <label className="search-field search-guests"><span className="field-label">GUESTS</span><select aria-label="Guests" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })}><option value="1">1 guest</option><option value="2">2 guests</option><option value="3">3 guests</option><option value="4">4 guests</option></select></label>
          <label className="search-field search-price"><span className="field-label">PRICE PER NIGHT</span><select aria-label="Price per night" value={getPriceRangeValue(form.minPrice, form.maxPrice)} onChange={(e) => { const range = getPriceRangeLimits(e.target.value); setForm({ ...form, minPrice: range.minPrice, maxPrice: range.maxPrice }); }}><option value="">Any price</option><option value="0-5000">₹0-₹5,000</option><option value="5000-10000">₹5,000-₹10,000</option><option value="10000-15000">₹10,000-₹15,000</option><option value="15000+">₹15,000+</option></select></label>
          <button className="button button-dark search-submit">Find a stay <span>↗</span></button>
        </form>
      </section>
      <section className="section featured-section">
        <div className="section-heading"><div><span className="eyebrow">A LITTLE INSPIRATION</span><h2>Places with a <em>sense of place.</em></h2></div><Link className="underlined-link" to="/hotels">See all stays <span>↗</span></Link></div>
        {error ? (
          <div className="notice notice-error" style={{ margin: "20px 0", padding: "16px 20px", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
            <strong>Unable to load featured stays:</strong> {error}
            <button
              type="button"
              className="button button-outline"
              onClick={() => {
                api.get("/hotels").then((response) => setHotels(getData(response).hotels || [])).catch((err) => setError(errorMessage(err)));
              }}
              style={{ marginLeft: "16px", padding: "4px 12px", fontSize: "0.85rem" }}
            >
              Retry
            </button>
          </div>
        ) : hotels.length ? (
          <div className="hotel-grid">{hotels.slice(0, 3).map((hotel, index) => <HotelCard key={hotel._id} hotel={hotel} index={index} />)}</div>
        ) : (
          <div className="hotel-grid skeleton-grid"><div /><div /><div /></div>
        )}
      </section>
      <section className="quote-band"><span className="eyebrow">THE HAVEN WAY</span><p>“The best journeys aren't just about where you go. They're about how a place makes you feel.”</p><span className="quote-line" /></section>
    </>
  );
}

export function HotelsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [form, setForm] = useState({
    destination: searchParams.get("destination") || "",
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
    guests: searchParams.get("guests") || ""
  });

  const [sidebarFilters, setSidebarFilters] = useState({
    forYou: [],
    priceMode: "perNight",
    priceRange: "",
    customMinPrice: "",
    customMaxPrice: "",
    starCategory: [],
    propertyType: searchParams.get("propertyType")
      ? searchParams.get("propertyType").split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    amenities: [],
    minRating: 0,
    bookingPreferences: [],
    houseRules: [],
    subLocation: ""
  });

  const [sortBy, setSortBy] = useState("recommended");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [hotels, setHotels] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const getNights = (inDate, outDate) => {
    if (!inDate || !outDate) return 1;
    const t1 = new Date(inDate).getTime();
    const t2 = new Date(outDate).getTime();
    if (isNaN(t1) || isNaN(t2) || t2 <= t1) return 1;
    const days = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 1;
  };

  const nights = getNights(form.checkIn, form.checkOut);

  const search = (formState = form) => {
    const params = Object.fromEntries(
      Object.entries(formState).filter(([, value]) => value !== "" && value !== undefined && value !== null)
    );
    setSearchParams(params);
    setLoading(true);
    setError("");
    api.get("/hotels", { params })
      .then((response) => {
        const data = getData(response);
        setHotels(data.hotels || []);
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDestinations = React.useCallback(() => {
    api.get("/hotels/destinations").then((response) => {
      const list = getData(response).destinations || [];
      const unique = Array.from(new Set(list.map((d) => String(d).trim()))).filter(Boolean);
      setDestinations(unique);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const allDestinations = React.useMemo(() => {
    const set = new Set(destinations);
    hotels.forEach((h) => {
      if (h.location) {
        h.location.split(",").forEach((p) => {
          const t = p.trim();
          if (t) set.add(t);
        });
        set.add(h.location.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [destinations, hotels]);

  const handleClearAllFilters = () => {
    setSidebarFilters({
      forYou: [],
      priceMode: sidebarFilters.priceMode,
      priceRange: "",
      customMinPrice: "",
      customMaxPrice: "",
      starCategory: [],
      propertyType: [],
      amenities: [],
      minRating: 0,
      bookingPreferences: [],
      houseRules: [],
      subLocation: ""
    });
  };

  const handleResetTopForm = () => {
    const resetForm = {
      destination: "",
      checkIn: "",
      checkOut: "",
      guests: ""
    };
    setForm(resetForm);
    handleClearAllFilters();
    search(resetForm);
  };

  // Compute dynamic facet counts based on the active destination's loaded hotels
  const facetCounts = React.useMemo(() => {
    const counts = {
      forYou: {},
      starCategory: {},
      propertyType: {},
      amenities: {},
      ratings: {},
      bookingPreferences: {},
      houseRules: {}
    };

    hotels.forEach((h) => {
      // Property Type
      if (h.propertyType) {
        counts.propertyType[h.propertyType] = (counts.propertyType[h.propertyType] || 0) + 1;
      }
      // Star Category
      if (h.starCategory) {
        counts.starCategory[h.starCategory] = (counts.starCategory[h.starCategory] || 0) + 1;
      }
      // Amenities
      const hAmens = (h.amenities || []).map((a) => a.toLowerCase());
      AMENITIES_LIST.forEach((standard) => {
        const sLower = standard.toLowerCase();
        let matched = false;
        if (sLower === "wi-fi") matched = hAmens.some((a) => a.includes("wi-fi") || a.includes("wifi"));
        else if (sLower === "swimming pool") matched = hAmens.some((a) => a.includes("pool"));
        else if (sLower === "gym") matched = hAmens.some((a) => a.includes("gym") || a.includes("fitness"));
        else if (sLower === "breakfast included") matched = hAmens.some((a) => a.includes("breakfast"));
        else if (sLower === "air conditioning") matched = hAmens.some((a) => a.includes("air condition") || a.includes("ac"));
        else if (sLower === "parking") matched = hAmens.some((a) => a.includes("parking"));
        else matched = hAmens.includes(sLower);
        if (matched) {
          counts.amenities[standard] = (counts.amenities[standard] || 0) + 1;
        }
      });
      // Ratings
      RATING_OPTIONS.forEach((opt) => {
        if ((h.rating || 0) >= opt.min) {
          counts.ratings[opt.min] = (counts.ratings[opt.min] || 0) + 1;
        }
      });
      // For You
      const tags = (h.tags || []).map((t) => t.toLowerCase());
      FOR_YOU_OPTIONS.forEach((opt) => {
        const optLower = opt.toLowerCase();
        let matched = false;
        if (optLower.includes("5 star")) matched = h.starCategory === 5 || (h.rating || 0) >= 4.8;
        else if (optLower.includes("beachfront")) {
          matched = tags.some((t) => t.includes("beach")) || hAmens.some((a) => a.includes("beach")) || (h.description || "").toLowerCase().includes("beachfront");
        } else if (optLower.includes("early bird")) {
          const discount = Number(h.earlyBirdDiscount || 0);
          if (discount > 0 || tags.some((t) => t.includes("early bird"))) {
            if (form.checkIn) {
              const todayD = new Date();
              todayD.setHours(0, 0, 0, 0);
              const cIn = new Date(`${form.checkIn}T00:00:00`);
              cIn.setHours(0, 0, 0, 0);
              const adv = Math.ceil((cIn - todayD) / 86400000);
              matched = adv >= Number(h.earlyBirdDays || 7);
            } else {
              matched = true;
            }
          }
        } else if (optLower.includes("self check-in")) {
          matched = tags.some((t) => t.includes("self check-in")) || (h.houseRules || []).some((r) => r.toLowerCase().includes("self check-in"));
        }
        if (matched) {
          counts.forYou[opt] = (counts.forYou[opt] || 0) + 1;
        }
      });
      // Booking Preferences
      const hPrefs = (h.bookingPreferences || []).map((p) => p.toLowerCase());
      BOOKING_PREFERENCES.forEach((std) => {
        if (hPrefs.includes(std.toLowerCase())) {
          counts.bookingPreferences[std] = (counts.bookingPreferences[std] || 0) + 1;
        }
      });
      // House Rules
      const hRules = (h.houseRules || []).map((r) => r.toLowerCase());
      HOUSE_RULES.forEach((std) => {
        if (hRules.includes(std.toLowerCase())) {
          counts.houseRules[std] = (counts.houseRules[std] || 0) + 1;
        }
      });
    });

    return counts;
  }, [hotels, form.checkIn]);

  // Derive Top Locations for the active destination
  const topLocations = React.useMemo(() => {
    const map = new Map();
    hotels.forEach((h) => {
      const candidate = h.subLocation || h.address?.split(",")?.[0]?.trim();
      if (candidate && candidate.toLowerCase() !== (form.destination || "").toLowerCase()) {
        map.set(candidate, (map.get(candidate) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [hotels, form.destination]);

  // Filter hotels according to all active sidebar filters
  const filteredHotels = React.useMemo(() => {
    return hotels.filter((hotel) => {
      // 1. Property Type (OR logic among selected)
      if (sidebarFilters.propertyType?.length > 0) {
        const hType = String(hotel.propertyType || "").toLowerCase();
        const match = sidebarFilters.propertyType.some((t) => t.toLowerCase() === hType);
        if (!match) return false;
      }

      // 2. Star Category (OR logic among selected)
      if (sidebarFilters.starCategory?.length > 0) {
        const hStars = Number(hotel.starCategory || 0);
        if (!sidebarFilters.starCategory.includes(hStars)) return false;
      }

      // 3. Guest Rating
      if (sidebarFilters.minRating && Number(sidebarFilters.minRating) > 0) {
        if ((hotel.rating || 0) < Number(sidebarFilters.minRating)) return false;
      }

      // 4. Price (Per Night or Total Stay)
      const effectivePrice = sidebarFilters.priceMode === "total"
        ? (hotel.startingPrice || 0) * nights
        : (hotel.startingPrice || 0);

      const minP = sidebarFilters.customMinPrice !== "" ? Number(sidebarFilters.customMinPrice) : null;
      const maxP = sidebarFilters.customMaxPrice !== "" ? Number(sidebarFilters.customMaxPrice) : null;

      if (minP !== null && !isNaN(minP) && effectivePrice < minP) return false;
      if (maxP !== null && !isNaN(maxP) && maxP > 0 && effectivePrice > maxP) return false;

      // 5. Amenities (AND logic: property must include every selected amenity)
      if (sidebarFilters.amenities?.length > 0) {
        const hAmens = (hotel.amenities || []).map((a) => a.toLowerCase());
        const hasAll = sidebarFilters.amenities.every((amen) => {
          const aLower = amen.toLowerCase();
          if (aLower === "wi-fi") return hAmens.some((a) => a.includes("wi-fi") || a.includes("wifi"));
          if (aLower === "swimming pool") return hAmens.some((a) => a.includes("pool"));
          if (aLower === "gym") return hAmens.some((a) => a.includes("gym") || a.includes("fitness"));
          if (aLower === "breakfast included") return hAmens.some((a) => a.includes("breakfast"));
          if (aLower === "air conditioning") return hAmens.some((a) => a.includes("air condition") || a.includes("ac"));
          if (aLower === "parking") return hAmens.some((a) => a.includes("parking"));
          return hAmens.includes(aLower);
        });
        if (!hasAll) return false;
      }

      // 6. Booking Preferences (AND logic)
      if (sidebarFilters.bookingPreferences?.length > 0) {
        const hPrefs = (hotel.bookingPreferences || []).map((p) => p.toLowerCase());
        const hasAll = sidebarFilters.bookingPreferences.every((bp) => hPrefs.includes(bp.toLowerCase()));
        if (!hasAll) return false;
      }

      // 7. House Rules (AND logic)
      if (sidebarFilters.houseRules?.length > 0) {
        const hRules = (hotel.houseRules || []).map((r) => r.toLowerCase());
        const hasAll = sidebarFilters.houseRules.every((hr) => hRules.includes(hr.toLowerCase()));
        if (!hasAll) return false;
      }

      // 8. For You Filters
      if (sidebarFilters.forYou?.length > 0) {
        const tags = (hotel.tags || []).map((t) => t.toLowerCase());
        const hAmens = (hotel.amenities || []).map((a) => a.toLowerCase());
        const hasAll = sidebarFilters.forYou.every((item) => {
          const itemLower = item.toLowerCase();
          if (itemLower.includes("5 star")) return (hotel.starCategory === 5) || (hotel.rating >= 4.8);
          if (itemLower.includes("beachfront")) {
            return tags.some((t) => t.includes("beach")) || hAmens.some((a) => a.includes("beach")) || (hotel.description || "").toLowerCase().includes("beachfront");
          }
          if (itemLower.includes("early bird")) {
            const discount = Number(hotel.earlyBirdDiscount || 0);
            if (discount <= 0 && !tags.some((t) => t.includes("early bird"))) return false;
            if (form.checkIn) {
              const todayD = new Date();
              todayD.setHours(0, 0, 0, 0);
              const cIn = new Date(`${form.checkIn}T00:00:00`);
              cIn.setHours(0, 0, 0, 0);
              const adv = Math.ceil((cIn - todayD) / 86400000);
              const reqDays = Number(hotel.earlyBirdDays || 7);
              if (adv < reqDays) return false;
            }
            return true;
          }
          if (itemLower.includes("self check-in")) {
            return tags.some((t) => t.includes("self check-in")) || (hotel.houseRules || []).some((r) => r.toLowerCase().includes("self check-in"));
          }
          return tags.includes(itemLower);
        });
        if (!hasAll) return false;
      }

      // 9. Top Location
      if (sidebarFilters.subLocation && String(sidebarFilters.subLocation).trim()) {
        const target = sidebarFilters.subLocation.toLowerCase().trim();
        const sub = (hotel.subLocation || "").toLowerCase();
        const addr = (hotel.address || "").toLowerCase();
        if (!sub.includes(target) && !addr.includes(target)) return false;
      }

      return true;
    });
  }, [hotels, sidebarFilters, nights, form.checkIn]);

  // Sort filtered hotels
  const sortedHotels = React.useMemo(() => {
    return [...filteredHotels].sort((a, b) => {
      if (sortBy === "price_asc") return (a.startingPrice || 0) - (b.startingPrice || 0);
      if (sortBy === "price_desc") return (b.startingPrice || 0) - (a.startingPrice || 0);
      if (sortBy === "rating_desc") return (b.rating || 0) - (a.rating || 0);
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [filteredHotels, sortBy]);

  // Count total active sidebar filters
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (sidebarFilters.forYou?.length) count += sidebarFilters.forYou.length;
    if (sidebarFilters.priceRange && sidebarFilters.priceRange !== "all") count += 1;
    if (sidebarFilters.customMinPrice !== "" || sidebarFilters.customMaxPrice !== "") count += 1;
    if (sidebarFilters.starCategory?.length) count += sidebarFilters.starCategory.length;
    if (sidebarFilters.propertyType?.length) count += sidebarFilters.propertyType.length;
    if (sidebarFilters.amenities?.length) count += sidebarFilters.amenities.length;
    if (sidebarFilters.minRating > 0) count += 1;
    if (sidebarFilters.bookingPreferences?.length) count += sidebarFilters.bookingPreferences.length;
    if (sidebarFilters.houseRules?.length) count += sidebarFilters.houseRules.length;
    if (sidebarFilters.subLocation) count += 1;
    return count;
  }, [sidebarFilters]);

  // Active filter pills for top removal bar
  const activeFilterPills = React.useMemo(() => {
    const pills = [];

    // For You
    (sidebarFilters.forYou || []).forEach((item) => {
      pills.push({
        label: item,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            forYou: prev.forYou.filter((v) => v !== item)
          }))
      });
    });

    // Star Category
    (sidebarFilters.starCategory || []).forEach((stars) => {
      pills.push({
        label: `${stars} Star`,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            starCategory: prev.starCategory.filter((s) => s !== stars)
          }))
      });
    });

    // Property Type
    (sidebarFilters.propertyType || []).forEach((type) => {
      pills.push({
        label: type,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            propertyType: prev.propertyType.filter((t) => t !== type)
          }))
      });
    });

    // Amenities
    (sidebarFilters.amenities || []).forEach((amen) => {
      pills.push({
        label: amen,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            amenities: prev.amenities.filter((a) => a !== amen)
          }))
      });
    });

    // Price
    if (sidebarFilters.customMinPrice !== "" || sidebarFilters.customMaxPrice !== "") {
      const minLabel = sidebarFilters.customMinPrice !== "" ? `₹${Number(sidebarFilters.customMinPrice).toLocaleString("en-IN")}` : "₹0";
      const maxLabel = sidebarFilters.customMaxPrice !== "" ? `₹${Number(sidebarFilters.customMaxPrice).toLocaleString("en-IN")}` : "Above";
      pills.push({
        label: `${minLabel} - ${maxLabel}`,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            priceRange: "all",
            customMinPrice: "",
            customMaxPrice: ""
          }))
      });
    }

    // Rating
    if (sidebarFilters.minRating > 0) {
      pills.push({
        label: `${sidebarFilters.minRating}+ Rating`,
        onRemove: () =>
          setSidebarFilters((prev) => ({ ...prev, minRating: 0 }))
      });
    }

    // Booking Preferences
    (sidebarFilters.bookingPreferences || []).forEach((pref) => {
      pills.push({
        label: pref,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            bookingPreferences: prev.bookingPreferences.filter((p) => p !== pref)
          }))
      });
    });

    // House Rules
    (sidebarFilters.houseRules || []).forEach((rule) => {
      pills.push({
        label: rule,
        onRemove: () =>
          setSidebarFilters((prev) => ({
            ...prev,
            houseRules: prev.houseRules.filter((r) => r !== rule)
          }))
      });
    });

    // Top Location
    if (sidebarFilters.subLocation) {
      pills.push({
        label: sidebarFilters.subLocation,
        onRemove: () =>
          setSidebarFilters((prev) => ({ ...prev, subLocation: "" }))
      });
    }

    return pills;
  }, [sidebarFilters]);

  return (
    <section className="section listing-page mmt-listing-page">
      <div className="page-intro">
        <span className="eyebrow">THE COLLECTION</span>
        <h1>Find your <em>somewhere.</em></h1>
        <p>Distinctive stays for the moments that matter.</p>
      </div>

      {/* Top Search Bar */}
      <form
        className="listing-search hotel-filters-search mmt-top-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          search(form);
        }}
      >
        <label>
          <span className="field-label">DESTINATION</span>
          <select
            aria-label="Destination"
            value={form.destination}
            onFocus={loadDestinations}
            onClick={loadDestinations}
            onMouseDown={loadDestinations}
            onChange={(e) => {
              const nextForm = { ...form, destination: e.target.value };
              setForm(nextForm);
              search(nextForm);
            }}
          >
            <option value="">All Destinations</option>
            {form.destination && !allDestinations.some((d) => d.toLowerCase() === form.destination.trim().toLowerCase()) && (
              <option value={form.destination}>{form.destination}</option>
            )}
            {allDestinations.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">CHECK IN</span>
          <input
            type="date"
            min={today}
            value={form.checkIn}
            onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
          />
        </label>
        <label>
          <span className="field-label">CHECK OUT</span>
          <input
            type="date"
            min={form.checkIn || today}
            value={form.checkOut}
            onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
          />
        </label>
        <label>
          <span className="field-label">GUESTS</span>
          <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })}>
            <option value="">Any guests</option>
            <option value="1">1 guest</option>
            <option value="2">2 guests</option>
            <option value="3">3 guests</option>
            <option value="4">4 guests</option>
          </select>
        </label>
        <button className="button button-dark search-submit-btn">Search stays ↗</button>
      </form>

      {/* Mobile Filter Trigger Bar */}
      <div className="mmt-mobile-filter-bar">
        <button
          type="button"
          className="button button-outline mmt-mobile-filter-trigger"
          onClick={() => setIsMobileFiltersOpen(true)}
        >
          <span>⚙ Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}</span>
        </button>
        <div className="mmt-mobile-count">
          {filteredHotels.length} {filteredHotels.length === 1 ? "property" : "properties"}
        </div>
      </div>

      {/* MakeMyTrip 2-Column Main Layout */}
      <div className="mmt-layout-container">
        {/* Left Sticky Sidebar */}
        <FilterSidebar
          filters={sidebarFilters}
          onFilterChange={setSidebarFilters}
          onClearAll={handleClearAllFilters}
          activeCount={activeFiltersCount}
          facetCounts={facetCounts}
          topLocations={topLocations}
          nights={nights}
          isOpenMobile={isMobileFiltersOpen}
          onCloseMobile={() => setIsMobileFiltersOpen(false)}
        />

        {/* Right Main Results Pane */}
        <div className="mmt-results-container">
          {/* Results Summary & Sorting Bar */}
          <div className="mmt-results-header">
            <div>
              <h2>
                {loading
                  ? "Discovering stays..."
                  : `${filteredHotels.length} ${
                      filteredHotels.length === 1 ? "property" : "properties"
                    } available`}
              </h2>
              <span className="mmt-results-subheading">
                {form.destination ? `${form.destination} · ` : "All Destinations · "}
                {nights} {nights === 1 ? "night" : "nights"}
              </span>
            </div>

            <div className="mmt-sort-wrap">
              <label htmlFor="mmt-sort-select">SORT BY:</label>
              <select
                id="mmt-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mmt-sort-select"
              >
                <option value="recommended">Popularity & Rating</option>
                <option value="price_asc">Price (Lowest first)</option>
                <option value="price_desc">Price (Highest first)</option>
                <option value="rating_desc">User Rating (Highest)</option>
              </select>
            </div>
          </div>

          {/* Active Filter Pills Bar */}
          {activeFilterPills.length > 0 && (
            <div className="mmt-active-pills-bar">
              <span className="mmt-pills-label">Active filters:</span>
              <div className="mmt-pills-list">
                {activeFilterPills.map((pill, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="mmt-active-pill"
                    onClick={() => pill.onRemove()}
                    title="Remove filter"
                  >
                    <span>{pill.label}</span>
                    <span className="mmt-pill-remove">✕</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="mmt-clear-inline-btn"
                  onClick={handleClearAllFilters}
                >
                  Clear all
                </button>
              </div>
            </div>
          )}

          {/* Property Cards List */}
          {loading ? (
            <Loading />
          ) : error ? (
            <div className="notice notice-error" style={{ margin: "20px 0", padding: "16px 20px", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span><strong>Failed to load hotels:</strong> {error}</span>
              <button
                type="button"
                className="button button-outline"
                onClick={() => search()}
                style={{ marginLeft: "16px", borderColor: "#f87171", color: "#991b1b" }}
              >
                Retry
              </button>
            </div>
          ) : sortedHotels.length ? (
            <div className="mmt-hotel-list">
              {sortedHotels.map((hotel, index) => (
                <HotelCard
                  key={hotel._id}
                  hotel={hotel}
                  index={index}
                  variant="mmt"
                  priceMode={sidebarFilters.priceMode}
                  nights={nights}
                  checkIn={form.checkIn}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state mmt-empty-state">
              <span>⌕</span>
              <h3>No properties found matching your filters.</h3>
              <p>
                Try relaxing one or more filter options like property type, price range, or amenities.
              </p>
              <div className="mmt-empty-actions">
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    className="button button-dark"
                    onClick={handleClearAllFilters}
                  >
                    Clear all filters ({activeFiltersCount}) ✕
                  </button>
                )}
                <button
                  type="button"
                  className="button button-outline"
                  onClick={handleResetTopForm}
                >
                  Reset destination & dates ↗
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function HotelDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState("All");

  const queryParams = Object.fromEntries(
    Object.entries(Object.fromEntries(searchParams)).filter(([, v]) => v !== "" && v !== undefined && v !== null)
  );

  const { loading, error, value } = useLoad(
    async () => getData(await api.get(`/hotels/${id}`, { params: queryParams })),
    [id, searchParams.toString()]
  );
  const reviewsState = useLoad(async () => getData(await api.get(`/hotels/${id}/reviews`)).reviews || [], [id]);

  if (loading || error) return <section className="section"><Loading error={error} /></section>;

  const { hotel, rooms = [], allRooms = rooms } = value;
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWishlisted = isInWishlist(hotel?._id);
  const displayedRating = Number(hotel.rating || 0);
  const ratingCount = Number(hotel.ratingCount || 0);

  // Category tabs: All, Single, Double, Suite (only if the hotel has that type) with counts
  const roomTypesOrder = ["Single", "Double", "Suite"];
  const hotelHasType = (type) => allRooms.some((r) => r.type?.toLowerCase() === type.toLowerCase());

  const categoryTabs = [
    { type: "All", label: `All (${rooms.length})` },
    ...roomTypesOrder
      .filter((type) => hotelHasType(type))
      .map((type) => ({
        type,
        label: `${type} (${rooms.filter((r) => r.type?.toLowerCase() === type.toLowerCase()).length})`
      }))
  ];

  const filteredRooms = selectedCategory === "All"
    ? rooms
    : rooms.filter((r) => r.type?.toLowerCase() === selectedCategory.toLowerCase());

  const searchParamsString = searchParams.toString();
  const querySuffix = searchParamsString ? `?${searchParamsString}` : "";

  // Early Bird Deal calculation
  const checkInParam = searchParams.get("checkIn");
  const earlyBirdDiscount = Number(hotel.earlyBirdDiscount || 0);
  const earlyBirdDays = Number(hotel.earlyBirdDays || 7);

  let isEarlyBirdEligible = false;
  let daysInAdvance = null;

  if (earlyBirdDiscount > 0) {
    if (checkInParam) {
      const todayD = new Date();
      todayD.setHours(0, 0, 0, 0);
      const cIn = new Date(`${checkInParam}T00:00:00`);
      cIn.setHours(0, 0, 0, 0);
      daysInAdvance = Math.ceil((cIn - todayD) / 86400000);
      isEarlyBirdEligible = daysInAdvance >= earlyBirdDays;
    } else {
      isEarlyBirdEligible = true;
    }
  }

  return (
    <div className="detail-page">
      <div className="detail-hero">
        <img src={hotel.imageUrl || hotel.image || fallbackImage} alt={hotel.name} />
        <div className="detail-hero-caption">
          <div className="detail-hero-subline" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            {hotel.propertyType && (
              <span className="detail-property-type-pill" style={{
                background: "rgba(255, 255, 255, 0.95)",
                color: "#283120",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "3px 10px",
                borderRadius: "3px"
              }}>
                {hotel.propertyType}
              </span>
            )}
            <span>{hotel.location}</span>
          </div>
          <div className="detail-hero-title-row">
            <h1>{hotel.name}</h1>
            <button
              type="button"
              className={`detail-wishlist-toggle-btn ${isWishlisted ? "is-wishlisted" : ""}`}
              onClick={() => toggleWishlist(hotel)}
              title={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
              aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
            >
              <span className="wishlist-btn-heart">{isWishlisted ? "♥" : "♡"}</span>
              <span>{isWishlisted ? "Saved" : "Save to Wishlist"}</span>
            </button>
          </div>
          <span>
            {ratingCount > 0 ? `★ ${displayedRating.toFixed(1)} (${ratingCount} ratings)` : "No ratings yet"}
            <i>·</i> {hotel.propertyType ? `${hotel.propertyType} in ${hotel.location}` : "A considered collection stay"}
          </span>
        </div>
      </div>
      <section className="section hotel-overview">
        <div className="hotel-story">
          <span className="eyebrow">
            {hotel.propertyType ? `${hotel.propertyType.toUpperCase()} · A PLACE TO PAUSE` : "A PLACE TO PAUSE"}
          </span>
          <h2>Make yourself<br /><em>at home.</em></h2>
          <p>{hotel.description || "Tucked into a place worth discovering, this property makes every moment feel a little more considered."}</p>
          <div className="story-location">⌖ &nbsp;{hotel.address || hotel.location}</div>
        </div>
        <div className="stay-amenities">
          <span className="eyebrow">PROPERTY DETAILS</span>
          <p>{hotel.propertyType || "Property"}</p>
          <span>Location: {hotel.location}</span>
          {hotel.starCategory && <span>Category: {hotel.starCategory} Star</span>}
          <span>Garden view · Balcony rooms</span>
        </div>
      </section>
      <section className="section hotel-reviews-section">
        <div className="section-heading">
          <div><span className="eyebrow">GUEST EXPERIENCES</span><h2>Reviews from <em>our guests.</em></h2></div>
        </div>
        {reviewsState.loading ? (
          <Loading />
        ) : reviewsState.error ? (
          <div className="notice notice-error">{reviewsState.error}</div>
        ) : reviewsState.value?.length ? (
          <div className="hotel-reviews-list">
            {reviewsState.value.map((review) => (
              <article className="hotel-review-card" key={review._id}>
                <div className="hotel-review-heading">
                  <b>{review.user?.name || "Guest"}</b>
                  <span>★ {review.stars} · {new Date(review.createdAt).toLocaleDateString("en-GB")}</span>
                </div>
                <p>{review.review}</p>
                {review.adminReply && (
                  <div className="hotel-review-admin-reply">
                    <div className="admin-reply-header">
                      <span className="admin-reply-badge">
                        <span className="admin-reply-icon">💬</span> Response from Hotel Management
                      </span>
                      {review.adminRepliedAt && (
                        <span className="admin-reply-date">
                          {new Date(review.adminRepliedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          })}
                        </span>
                      )}
                    </div>
                    <p className="admin-reply-text">{review.adminReply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No written reviews yet.</h3>
            <p>Be the first guest to share your experience.</p>
          </div>
        )}
      </section>
      <section className="section room-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR OWN CORNER</span>
            <h2>Rooms to <em>settle into.</em></h2>
          </div>
        </div>

        {earlyBirdDiscount > 0 && (
          <div className={`hotel-detail-earlybird-banner ${isEarlyBirdEligible ? "earlybird-banner-active" : "earlybird-banner-notice"}`}>
            <span className="earlybird-banner-badge">
              {isEarlyBirdEligible ? `⚡ ${earlyBirdDiscount}% OFF EARLY BIRD DEAL` : `EARLY BIRD DEAL AVAILABLE`}
            </span>
            <p>
              {isEarlyBirdEligible ? (
                <>
                  <b>Early Bird Deal applied!</b> You are booking {daysInAdvance !== null ? `${daysInAdvance} days in advance` : "in advance"} (qualifies for {earlyBirdDiscount}% discount). Discounted room rates are reflected below.
                </>
              ) : (
                <>
                  <b>Save {earlyBirdDiscount}% with Early Bird:</b> Book at least {earlyBirdDays} days before check-in to unlock {earlyBirdDiscount}% off.
                  {daysInAdvance !== null && ` Your selected check-in is in ${daysInAdvance <= 0 ? "0 days" : `${daysInAdvance} ${daysInAdvance === 1 ? "day" : "days"}`}.`}
                </>
              )}
            </p>
          </div>
        )}

        {allRooms.length > 0 && categoryTabs.length > 1 && (
          <div className="hotel-room-category-tabs category-buttons-group" role="tablist" aria-label="Room categories">
            <span className="category-label">ROOM TYPE:</span>
            {categoryTabs.map((tab) => (
              <button
                key={tab.type}
                type="button"
                className={`category-pill-btn ${selectedCategory === tab.type ? "is-active" : ""}`}
                onClick={() => setSelectedCategory(tab.type)}
                aria-pressed={selectedCategory === tab.type}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {filteredRooms.length ? (
          <div className="room-grid">
            {filteredRooms.map((room) => {
              const originalPrice = room.pricePerNight;
              const discountedPrice = isEarlyBirdEligible && earlyBirdDiscount > 0
                ? Math.round(originalPrice * (1 - earlyBirdDiscount / 100))
                : originalPrice;

              return (
                <article className="room-card" key={room._id}>
                  <div className="room-image">
                    <img src={hotel.image || fallbackImage} alt="" />
                    <span>{room.type}</span>
                  </div>
                  <div className="room-content">
                    <div className="room-title">
                      <div><h3>{room.type} Room</h3></div>
                      <span className="capacity">♧ {room.capacity} guests</span>
                    </div>
                    <p>{room.description || "A calm, comfortable space thoughtfully made for a restful stay."}</p>
                    <div className="room-bottom">
                      <div className="room-price-display">
                        {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
                          <del className="room-price-original">{formatRupees(originalPrice)}</del>
                        )}
                        <span className="price"><b>{formatRupees(discountedPrice)}</b> / night</span>
                        {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
                          <span className="room-discount-pill">{earlyBirdDiscount}% OFF</span>
                        )}
                      </div>
                      <Link className="button button-outline" to={`/rooms/${room._id}${querySuffix}`}>View room →</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : allRooms.length > 0 ? (
          <div className="empty-state">
            <span>⌕</span>
            <h3>No rooms available for this selection</h3>
            <p>Try selecting a different room category or adjusting your searched price range, dates, or guests.</p>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "40px 20px", textAlign: "center" }}>
            <h3>No rooms available yet</h3>
            <p>This property currently has no rooms listed. Please check back later.</p>
            <button
              type="button"
              className="button button-dark"
              disabled
              style={{ opacity: 0.6, cursor: "not-allowed", marginTop: "16px" }}
            >
              Booking unavailable
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export function RoomDetailsPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const querySuffix = searchParamsString ? `?${searchParamsString}` : "";
  const { loading, error, value } = useLoad(async () => getData(await api.get(`/rooms/${id}`)).room, [id]);
  if (loading || error) return <section className="section"><Loading error={error} /></section>;
  const { room } = { room: value };
  const hotel = room.hotel || {};

  const checkInParam = searchParams.get("checkIn");
  const earlyBirdDiscount = Number(hotel.earlyBirdDiscount || 0);
  const earlyBirdDays = Number(hotel.earlyBirdDays || 7);
  let isEarlyBirdEligible = false;
  let daysInAdvance = null;
  if (earlyBirdDiscount > 0) {
    if (checkInParam) {
      const todayD = new Date();
      todayD.setHours(0, 0, 0, 0);
      const cIn = new Date(`${checkInParam}T00:00:00`);
      cIn.setHours(0, 0, 0, 0);
      daysInAdvance = Math.ceil((cIn - todayD) / 86400000);
      isEarlyBirdEligible = daysInAdvance >= earlyBirdDays;
    } else {
      isEarlyBirdEligible = true;
    }
  }

  const originalPrice = room.pricePerNight;
  const finalPrice = isEarlyBirdEligible && earlyBirdDiscount > 0
    ? Math.round(originalPrice * (1 - earlyBirdDiscount / 100))
    : originalPrice;

  return (
    <section className="section room-detail-page">
      <Link className="back-link" to={`/hotels/${hotel._id}${querySuffix}`}>← Back to {hotel.name}</Link>
      <div className="room-detail-grid">
        <img src={hotel.image || fallbackImage} alt={hotel.name} />
        <div className="room-detail-copy">
          <span className="eyebrow">{hotel.location}</span>
          <h1>{room.type} <em>Room</em></h1>
          <p>{room.description || `A considered ${room.type.toLowerCase()} room at ${hotel.name}, with everything you need to settle in.`}</p>
          <span className="capacity">Sleeps up to {room.capacity} guests</span>
          <div className="room-detail-price">
            {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
              <del className="room-detail-price-original">{formatRupees(originalPrice)}</del>
            )}
            <b>{formatRupees(finalPrice)}</b> <span>/ night</span>
            {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
              <span className="room-detail-discount-badge">{earlyBirdDiscount}% OFF EARLY BIRD</span>
            )}
          </div>
          <Link className="button button-dark button-wide" to={`/booking/${room._id}${querySuffix}`}>
            Choose your dates <span>↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function AuthPage({ mode, admin = false }) {
  const isRegister = mode === "register";
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setForm({ name: "", email: "", password: "" });
  }, [location.key, location.pathname, user]);

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      let loggedUser;
      if (isRegister) loggedUser = await register(form);
      else loggedUser = await signIn({ email: form.email, password: form.password });
      if (admin || loggedUser?.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        const nextPath = location.state?.from?.pathname || "/profile";
        navigate(nextPath, { replace: true });
      }
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return (
    <section className="auth-page">
      <div className="auth-image">
        <img src={fallbackImage} alt="" />
        <div>
          <span className="eyebrow">A STAY, WELL FOUND</span>
          <p>Make room for<br /><em>somewhere new.</em></p>
        </div>
      </div>
      <div className="auth-side">
        <div className="auth-box">
          <span className="eyebrow">{admin ? "TEAM ACCESS" : "WELCOME TO Royal Nest."}</span>
          <h1>{admin ? "A warm welcome, team." : isRegister ? "Begin your story." : "Welcome back."}</h1>
          <p>{admin ? "Sign in to manage your collection." : isRegister ? "Create an account to start planning your next escape." : "Sign in to pick up where your journey left off."}</p>
          {error && <div className="notice notice-error">{error}</div>}
          <form className="stacked-form" onSubmit={submit} autoComplete="off">
            <input
              type="email"
              name="dummy_email"
              tabIndex={-1}
              autoComplete="off"
              style={{ display: "none" }}
            />
            <input
              type="password"
              name="dummy_password"
              tabIndex={-1}
              autoComplete="new-password"
              style={{ display: "none" }}
            />
            {isRegister && (
              <label>
                Your name
                <input
                  required
                  minLength="2"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="How should we call you?"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <div className="password-input-wrap">
                <input
                  required
                  minLength={isRegister ? 6 : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                        <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9.5 7a11.5 11.5 0 01-3.2 4.3M6.2 6.2A12.2 12.2 0 002.5 12c1 2.5 4.5 7 9.5 7 1.2 0 2.3-.3 3.3-.7" />
                      </>
                    ) : (
                      <>
                        <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </label>
            <button className="button button-dark button-wide" disabled={busy}>
              {busy ? "One moment…" : admin ? "Sign in" : isRegister ? "Create your account" : "Sign in"} <span>↗</span>
            </button>
          </form>
          {!admin && (
            <p className="auth-switch">
              {isRegister ? "Already part of Haven?" : "New to Haven?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
export function LoginPage() { return <AuthPage mode="login" />; }
export function RegisterPage() { return <AuthPage mode="register" />; }
export function AdminLoginPage() { return <AuthPage mode="login" admin />; }

export function BookingPage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const querySuffix = searchParamsString ? `?${searchParamsString}` : "";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    checkIn: searchParams.get("checkIn") || today,
    checkOut: searchParams.get("checkOut") || tomorrow,
    guests: searchParams.get("guests") || "1"
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { loading, value } = useLoad(async () => getData(await api.get(`/rooms/${roomId}`)).room, [roomId]);
  if (loading) return <section className="section"><Loading /></section>;
  if (!value) return <section className="section"><div className="notice notice-error">This room could not be found.</div></section>;
  const room = value;
  const hotel = room.hotel || {};

  const earlyBirdDiscount = Number(hotel.earlyBirdDiscount || 0);
  const earlyBirdDays = Number(hotel.earlyBirdDays || 7);

  const nights = Math.max(1, Math.round((new Date(`${form.checkOut}T00:00:00`) - new Date(`${form.checkIn}T00:00:00`)) / 86400000));

  // Compute days in advance
  const todayD = new Date();
  todayD.setHours(0, 0, 0, 0);
  const checkInDate = new Date(`${form.checkIn}T00:00:00`);
  checkInDate.setHours(0, 0, 0, 0);
  const daysInAdvance = Math.ceil((checkInDate - todayD) / 86400000);

  const isEarlyBirdEligible = earlyBirdDiscount > 0 && daysInAdvance >= earlyBirdDays;
  const baseTotal = Number(room.pricePerNight) * nights;
  const discountAmount = isEarlyBirdEligible ? Math.round((baseTotal * earlyBirdDiscount) / 100) : 0;
  const finalTotal = baseTotal - discountAmount;

  // Calculate earliest eligible date for information alert
  const eligibleDateObj = new Date(todayD);
  eligibleDateObj.setDate(todayD.getDate() + earlyBirdDays);
  const eligibleDateStr = `${String(eligibleDateObj.getDate()).padStart(2, "0")}/${String(eligibleDateObj.getMonth() + 1).padStart(2, "0")}/${eligibleDateObj.getFullYear()}`;

  const submit = async (event) => {
    event.preventDefault();
    if (form.checkOut <= form.checkIn) { setError("Check-out must be after check-in."); return; }
    if (!user) { navigate("/login", { state: { from: { pathname: `/booking/${roomId}${querySuffix}` } } }); return; }
    setBusy(true); setError("");
    try {
      const response = await api.post("/bookings", { room: roomId, checkIn: form.checkIn, checkOut: form.checkOut, guests: Number(form.guests) });
      navigate(`/payment/${getData(response).booking._id}`);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };

  return (
    <section className="section booking-page">
      <Link className="back-link" to={`/rooms/${roomId}${querySuffix}`}>← Back to room</Link>
      <div className="booking-layout">
        <div>
          <span className="eyebrow">MAKE IT YOURS</span>
          <h1>Your stay, <em>your way.</em></h1>
          <p className="muted">Choose your dates and we’ll take care of the rest.</p>

          {/* Early Bird Deal Alerts */}
          {isEarlyBirdEligible && (
            <div className="earlybird-booking-alert earlybird-booking-success">
              <div className="earlybird-alert-title">
                <span>✓</span>
                <strong>Early Bird Deal Applied ({earlyBirdDiscount}% OFF)</strong>
              </div>
              <p>
                You are booking <b>{daysInAdvance} days in advance</b> (meets the {earlyBirdDays}-day requirement).
                You save <b>{formatRupees(discountAmount)}</b> on this stay!
              </p>
            </div>
          )}

          {earlyBirdDiscount > 0 && !isEarlyBirdEligible && (
            <div className="earlybird-booking-alert earlybird-booking-warning">
              <div className="earlybird-alert-title">
                <span>⚠️</span>
                <strong>Early Bird Deal Not Eligible</strong>
              </div>
              <p>
                This property offers a <b>{earlyBirdDiscount}% discount</b> for bookings made at least <b>{earlyBirdDays} days</b> in advance.
                Your check-in is in <b>{daysInAdvance <= 0 ? "0 days" : `${daysInAdvance} ${daysInAdvance === 1 ? "day" : "days"}`}</b>.
                Select a check-in date on or after <b>{eligibleDateStr}</b> to unlock this discount.
              </p>
            </div>
          )}

          <form className="booking-form" onSubmit={submit}>
            {error && <div className="notice notice-error">{error}</div>}
            <div className="form-row">
              <label>
                Check in
                <input required type="date" min={today} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              </label>
              <label>
                Check out
                <input required type="date" min={form.checkIn} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
              </label>
            </div>
            <label>
              Guests
              <select value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })}>
                {Array.from({ length: Math.max(1, Number(room.capacity)) }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1} {i ? "guests" : "guest"}</option>
                ))}
              </select>
            </label>
            <button className="button button-dark button-wide" disabled={busy}>
              {busy ? "Creating your booking…" : user ? "Book stay" : "Sign in to continue"} <span>↗</span>
            </button>
          </form>
        </div>

        <aside className="booking-summary">
          <img src={room.hotel?.image || fallbackImage} alt="" />
          <div className="summary-content">
            <span className="eyebrow">{room.hotel?.location}</span>
            <h2>{room.hotel?.name}</h2>
            <p>{room.type} Room · Up to {room.capacity} guests</p>

            <div className="summary-line">
              <span>{formatRupees(room.pricePerNight)} × {nights} {nights === 1 ? "night" : "nights"}</span>
              <b>{formatRupees(baseTotal)}</b>
            </div>

            {isEarlyBirdEligible && (
              <>
                <div className="summary-line summary-discount-line">
                  <span className="discount-label">Early Bird Discount ({earlyBirdDiscount}%)</span>
                  <b className="discount-value">- {formatRupees(discountAmount)}</b>
                </div>
                <div className="summary-earlybird-pill">
                  ⚡ Early Bird Deal Applied (Saved {formatRupees(discountAmount)})
                </div>
              </>
            )}

            <div className="summary-total">
              <span>Total</span>
              <b>{formatRupees(finalTotal)}</b>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

const USER_CANCELLATION_REASONS = [
  "Change of Plans",
  "Found Another Property",
  "Price Is Too High",
  "Booking Made by Mistake",
  "Other"
];

function UserCancelBookingDialog({ booking, onClose, onConfirm, cancelling, error }) {
  const [selectedReason, setSelectedReason] = useState("Change of Plans");
  const [explanation, setExplanation] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  const isPaid = booking.paymentStatus === "paid";
  const paidAmount = Number(booking.totalAmount || 0);

  useEffect(() => {
    let active = true;
    setPreviewLoading(true);
    api.get(`/bookings/${booking._id}/cancel-preview`)
      .then((res) => {
        if (active) {
          setPreview(getData(res));
          setPreviewLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          const checkInTime = new Date(booking.checkIn).getTime();
          const hours = (checkInTime - Date.now()) / (1000 * 60 * 60);
          const eligible = isPaid && hours >= 24;
          setPreview({
            refundStatus: eligible ? "refund_initiated" : (isPaid ? "no_refund" : "not_applicable"),
            refundAmount: eligible ? paidAmount : 0,
            eligible,
            message: eligible
              ? "Cancelled at least 24 hours before check-in. Eligible for full refund."
              : isPaid
                ? "Cancelled within 24 hours of check-in. In accordance with the policy, this booking is non-refundable."
                : "No payment was collected for this reservation. No refund applicable."
          });
          setPreviewLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [booking._id, booking.checkIn, isPaid, paidAmount]);

  const refundMethod = booking.paymentMethod === "netbanking"
    ? `${booking.bankName ? `${booking.bankName} ` : ""}net banking`
    : booking.paymentMethod === "wallet"
      ? `${booking.walletName || ""}${booking.walletName ? " " : ""}wallet`
      : booking.paymentMethod?.toUpperCase() || "original payment method";

  const isEligibleForRefund = preview ? (preview.refundStatus === "refund_initiated" || preview.eligible) : false;
  const refundAmount = preview?.refundAmount !== undefined ? preview.refundAmount : (isEligibleForRefund ? paidAmount : 0);
  const refundMessage = preview?.message;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedReason) return;
    onConfirm({
      category: selectedReason,
      reason: selectedReason === "Other" && explanation.trim()
        ? `Other: ${explanation.trim()}`
        : (explanation.trim() ? `${selectedReason} (${explanation.trim()})` : selectedReason),
      explanation: explanation.trim()
    });
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !cancelling) onClose();
      }}
    >
      <section
        className="modal user-cancel-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">BOOKING CANCELLATION</span>
            <h2 id="cancel-dialog-title">Cancel Your Booking</h2>
          </div>
          <button
            type="button"
            className="close-button"
            aria-label="Keep booking"
            disabled={cancelling}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="user-cancel-dialog-form">
          {error && <div className="notice notice-error">{error}</div>}

          {/* Stay Details Summary */}
          <div className="user-cancel-stay-summary">
            <b>{booking.hotel?.name || "Hotel stay"}</b>
            <span>{booking.room?.type} Room</span>
            <span>{formatBookingDate(booking.checkIn)} – {formatBookingDate(booking.checkOut)}</span>
          </div>

          {/* Cancellation Reason Selection */}
          <div className="user-cancel-reason-group">
            <label className="user-cancel-section-title">
              <b>Why do you want to cancel? <span className="required-star">*</span></b>
            </label>
            <div className="user-cancel-radio-list">
              {USER_CANCELLATION_REASONS.map((opt) => (
                <label
                  key={opt}
                  className={`user-cancel-radio-item ${selectedReason === opt ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="userCancelReason"
                    value={opt}
                    checked={selectedReason === opt}
                    onChange={() => setSelectedReason(opt)}
                    disabled={cancelling}
                  />
                  <span className="radio-text">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional Explanation for Other */}
          {selectedReason === "Other" && (
            <div className="user-cancel-explanation-wrap">
              <label htmlFor="user-cancel-explanation">
                <b>Explanation (Optional)</b>
                <small className="field-hint">Please share any additional details with us (optional):</small>
              </label>
              <textarea
                id="user-cancel-explanation"
                rows={2}
                placeholder="Enter details (optional)..."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={cancelling}
                className="user-cancel-textarea"
              />
            </div>
          )}

          {/* Cancellation Policy & Refund Details from backend calculateRefund */}
          <div
            className={`user-cancel-policy-card ${
              isPaid
                ? isEligibleForRefund
                  ? "policy-refundable"
                  : "policy-nonrefundable"
                : "policy-unpaid"
            }`}
          >
            {previewLoading ? (
              <div className="policy-card-header">
                <span className="policy-badge-icon">⏳</span>
                <div>
                  <strong>Checking cancellation policy…</strong>
                </div>
              </div>
            ) : isPaid ? (
              isEligibleForRefund ? (
                <>
                  <div className="policy-card-header">
                    <span className="policy-badge-icon">✓</span>
                    <div>
                      <strong>Refund Amount: {formatRupees(refundAmount)}</strong>
                      <p>
                        {refundMessage || "Cancelled at least 24 hours before check-in. Eligible for full refund."}
                      </p>
                    </div>
                  </div>
                  <p className="policy-note">
                    A full refund will be processed to your <b>{refundMethod}</b> within 5–7 business days.
                  </p>
                </>
              ) : (
                <>
                  <div className="policy-card-header">
                    <span className="policy-badge-icon">⚠️</span>
                    <div>
                      <strong>Refund Amount: ₹0 (Non-refundable)</strong>
                      <p>
                        {refundMessage || "Cancellation is within 24 hours of scheduled check-in. In accordance with the property's cancellation policy, this booking is non-refundable."}
                      </p>
                    </div>
                  </div>
                  <p className="policy-note warning-text">
                    No refund will be issued if you proceed with this cancellation.
                  </p>
                </>
              )
            ) : (
              <div className="policy-card-header">
                <span className="policy-badge-icon">ℹ️</span>
                <div>
                  <strong>No Payment Charged</strong>
                  <p>
                    {booking.paymentStatus === "pay_at_hotel" || booking.paymentMethod === "payathotel"
                      ? "This is a Pay at Hotel reservation. No payment was collected, so no refund is needed."
                      : (refundMessage || "No upfront payment was made for this reservation.")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons: Keep Booking vs Confirm Cancellation */}
          <div className="modal-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={cancelling}
              onClick={onClose}
            >
              Keep Booking
            </button>
            <button
              type="submit"
              className="button button-danger"
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function UserCancellationModal({ booking, onClose }) {
  if (!booking) return null;
  const isPaid = booking.paymentStatus === "paid";
  const paidAmount = Number(booking.totalAmount || 0);
  const refundAmountVal = Number(booking.refundAmount || booking.totalAmount || 0);
  const refundMethod = booking.paymentMethod === "netbanking"
    ? `${booking.bankName ? `${booking.bankName} ` : ""}net banking`
    : booking.paymentMethod === "wallet"
      ? `${booking.walletName || ""}${booking.walletName ? " " : ""}wallet`
      : booking.paymentMethod?.toUpperCase() || "original payment method";

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal user-cancellation-modal" role="dialog" aria-modal="true" aria-labelledby="user-cancel-modal-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">RESERVATION NOTICE</span>
            <h2 id="user-cancel-modal-title">Cancellation Notice</h2>
          </div>
          <button aria-label="Close" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="user-cancellation-modal-content">
          <div className="user-cancellation-stay-summary">
            <b>{booking.hotel?.name || "Hotel Stay"}</b>
            <span>{booking.room?.type} Room</span>
            <span>{formatBookingDate(booking.checkIn)} – {formatBookingDate(booking.checkOut)}</span>
          </div>

          <div className="user-cancellation-reason-highlight">
            <div className="highlight-tag">
              {booking.cancelledBy === "admin"
                ? "⚠️ Notice from Hotel Administration"
                : "Cancelled by You"}
            </div>
            <h4>Cancellation Reason:</h4>
            <p className="highlight-reason-text">
              &ldquo;{booking.cancellationReason || booking.cancellationCategory || "No reason specified"}&rdquo;
            </p>
            {booking.cancellationCategory && booking.cancellationCategory !== booking.cancellationReason && (
              <div className="highlight-category">
                Reason Category: <b>{booking.cancellationCategory}</b>
              </div>
            )}
            {booking.cancellationNotes && 
             booking.cancellationNotes !== booking.cancellationReason && 
             booking.cancellationNotes !== booking.cancellationCategory && (
              <p className="highlight-notes">
                <b>Optional Details:</b> {booking.cancellationNotes}
              </p>
            )}
            {booking.cancelledBy === "admin" && (
              <div className="highlight-author">
                Authorized by: <b>{booking.cancelledByAdmin?.name || "Hotel Administration"}</b>
                {booking.cancelledAt && ` on ${new Date(booking.cancelledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              </div>
            )}
            {booking.cancelledBy === "user" && booking.cancelledAt && (
              <div className="highlight-author">
                Cancelled on {new Date(booking.cancelledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
          </div>

          {/* Refund Breakdown */}
          {isPaid ? (
            <div className="user-cancellation-modal-refund">
              <span className="summary-title">Payment &amp; Refund Status</span>
              <div className="modal-refund-row">
                <span>Amount Paid:</span>
                <b>{formatRupees(paidAmount)} via {refundMethod}</b>
              </div>
              <div className="modal-refund-row">
                <span>Refund Status:</span>
                <b className="modal-refund-badge">
                  {booking.refundStatus === "refunded"
                    ? `✓ Refund Completed (${formatRupees(refundAmountVal)})`
                    : booking.refundStatus === "processing"
                      ? `⏳ Processing (${formatRupees(refundAmountVal)})`
                      : booking.refundStatus === "refund_initiated"
                        ? `⚡ Refund Initiated (${formatRupees(refundAmountVal)})`
                        : booking.refundStatus === "pending"
                          ? "⌛ Pending Approval"
                          : booking.refundStatus === "failed"
                            ? "⚠️ Failed — Contact Support"
                            : booking.refundStatus === "no_refund"
                              ? "Cancelled - no refund (cancelled within 24 hours of check-in)"
                              : "No Refund"}
                </b>
              </div>
              <p className="modal-refund-note">
                {booking.refundStatus === "no_refund"
                  ? "In accordance with the cancellation policy, bookings cancelled within 24 hours of check-in are non-refundable."
                  : "Refunds are credited directly to your original payment method in 5-7 business days."}
              </p>
            </div>
          ) : (
            <div className="user-cancellation-modal-unpaid">
              <small>
                {booking.paymentStatus === "pay_at_hotel"
                  ? "This reservation was set to Pay at Hotel. Since no payment was collected, no refund is needed."
                  : "No payment was collected for this reservation."}
              </small>
            </div>
          )}

          <div className="modal-actions">
            <Link className="button button-outline" to="/hotels" onClick={onClose}>
              Find Another Stay ↗
            </Link>
            <button className="button button-dark" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function isBookingEligibleForCancellation(booking) {
  if (!booking) return false;
  const status = String(booking.status || "").trim().toLowerCase();
  if (status !== "confirmed") return false;
  if (!booking.checkIn) return false;

  const checkInDate = new Date(booking.checkIn);
  if (Number.isNaN(checkInDate.getTime())) return false;

  const now = new Date();
  let checkInDeadline = new Date(checkInDate.getTime());
  if (checkInDate.getUTCHours() === 0 && checkInDate.getUTCMinutes() === 0 && checkInDate.getUTCSeconds() === 0) {
    const dateStr = typeof booking.checkIn === "string" ? booking.checkIn.slice(0, 10) : checkInDate.toISOString().slice(0, 10);
    const [y, m, d] = dateStr.split("-").map(Number);
    checkInDeadline = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  }

  return now.getTime() <= checkInDeadline.getTime();
}

export function BookingsPage() {
  const [notice, setNotice] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [bookingUpdates, setBookingUpdates] = useState({});
  const [viewingCancellationBooking, setViewingCancellationBooking] = useState(null);
  const { user } = useAuth();
  const state = useLocation().state;
  const { loading, error, value } = useLoad(async () => getData(await api.get("/bookings")).bookings || [], []);
  useEffect(() => { if (state?.confirmation) setNotice("Booking Confirmed. Your stay is now confirmed."); }, [state]);

  const cancel = async ({ category, reason, explanation }) => {
    try {
      setCancelling(true);
      setCancelError("");
      const response = await api.patch(`/bookings/${selectedBooking._id}/cancel`, {
        cancellationCategory: category,
        cancellationReason: reason,
        cancellationNotes: explanation,
        explanation
      });
      const cancelledBooking = getData(response).booking;
      setBookingUpdates((previous) => ({
        ...previous,
        [selectedBooking._id]: {
          ...selectedBooking,
          ...cancelledBooking,
          hotel: selectedBooking.hotel,
          room: selectedBooking.room
        }
      }));
      setSelectedBooking(null);
      setNotice("Your booking has been cancelled.");
    } catch (reasonErr) {
      setCancelError(errorMessage(reasonErr));
    } finally {
      setCancelling(false);
    }
  };

  const bookings = value?.map((booking) => bookingUpdates[booking._id] || booking);
  return (
    <section className="section listing-page bookings-page">
      <div className="page-intro"><span className="eyebrow">YOUR JOURNEY, IN ONE PLACE</span><h1>My <em>stays.</em></h1><p>Every journey begins with somewhere special.</p></div>
      {notice && <div className={`notice ${notice.startsWith("Your booking") || notice.startsWith("Booking Confirmed") ? "notice-success" : "notice-error"}`}>{notice}</div>}
      {loading || error ? <Loading error={error} /> : bookings?.length ? (
        <div className="booking-list">
          {bookings.map((booking) => {
            const normStatus = String(booking.status || "").trim().toLowerCase();
            const isConfirmed = normStatus === "confirmed";
            const isCancelled = normStatus === "cancelled";
            const canCancel = isBookingEligibleForCancellation(booking);
            const refundStage = getRefundStage(booking);
            const refundMethod = booking.paymentMethod === "netbanking"
              ? `${booking.bankName ? `${booking.bankName} ` : ""}net banking`
              : booking.paymentMethod === "wallet"
                ? `${booking.walletName || ""}${booking.walletName ? " " : ""}wallet`
                : booking.paymentMethod?.toUpperCase() || "original payment method";
            const refundLine = refundStage
              ? `Refund of ${formatRupees(booking.refundAmount)} ${refundStage} to ${refundMethod}`
              : booking.refundStatus === "no_refund"
                ? "Cancelled - no refund (cancelled within 24 hours of check-in)"
                : booking.refundStatus === "not_applicable"
                  ? booking.paymentMethod === "payathotel"
                    ? "Booking cancelled. No payment was made, so no refund is needed."
                    : "No refund applicable for this unpaid booking."
                  : "";

            const isPaid = booking.paymentStatus === "paid";
            const paidAmount = Number(booking.totalAmount || 0);
            const refundAmountVal = Number(booking.refundAmount || booking.totalAmount || 0);
            const cancellationDate = booking.cancelledAt
              ? new Date(booking.cancelledAt)
              : (booking.updatedAt ? new Date(booking.updatedAt) : null);
            const cancellationDateStr = cancellationDate && !Number.isNaN(cancellationDate.getTime())
              ? cancellationDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "";

            return (
              <article className={`booking-card ${isCancelled ? "booking-card-cancelled" : ""}`} key={booking._id}>
                <img src={booking.hotel?.image || fallbackImage} alt="" />
                <div className="booking-card-content">
                  <span className="eyebrow">{booking.hotel?.location || "YOUR GETAWAY"}</span>
                  <h3>{booking.hotel?.name || "Hotel stay"}</h3>
                  <p>{booking.room?.type} Room · {formatBookingDate(booking.checkIn)} – {formatBookingDate(booking.checkOut)}</p>
                  {isConfirmed && booking.paymentStatus === "paid" && booking.paymentMethod !== "payathotel" && booking.room?.roomNumber && <p>Room {booking.room.roomNumber}</p>}
                  {isConfirmed && (booking.paymentStatus === "pay_at_hotel" || booking.paymentMethod === "payathotel") && <p>Room will be assigned at check-in</p>}

                  <div className="booking-status-badges-row">
                    <span className={`status-pill status-${normStatus}`}>{normStatus ? normStatus[0].toUpperCase() + normStatus.slice(1) : "Confirmed"}</span>
                    {isConfirmed && (
                      <span className={`booking-payment-status-badge ${isPaid ? "badge-paid" : "badge-unpaid"}`}>
                        {isPaid
                          ? `✓ Paid Online · ${refundMethod}`
                          : booking.paymentStatus === "pay_at_hotel" || booking.paymentMethod === "payathotel"
                            ? "Pay at Hotel (Unpaid)"
                            : "Payment Pending"}
                      </span>
                    )}
                    {isCancelled && (
                      <span className="user-cancellation-timestamp">
                        {booking.cancelledBy === "admin"
                          ? `Cancelled by hotel${cancellationDateStr ? ` on ${cancellationDateStr}` : ""}`
                          : `Cancelled${cancellationDateStr ? ` on ${cancellationDateStr}` : ""}`}
                      </span>
                    )}
                  </div>

                  {/* Single Cancel button is on the right side next to price. Keep small policy text here without button */}
                  {canCancel && (
                    <div className="booking-card-cancel-action-wrap">
                      <span className="cancellation-policy-hint">
                        {isPaid
                          ? "Free cancellation up to 24 hours before check-in."
                          : "Free cancellation · No payment charged for Pay at Hotel bookings."}
                      </span>
                    </div>
                  )}

                  {/* Compact Cancellation & Refund Info for Cancelled Bookings */}
                  {isCancelled && (
                    <div className="user-cancellation-compact">
                      {isPaid ? (
                        <div className="user-cancellation-refund-compact">
                          <div className="user-cancellation-paid-summary">
                            <span>Actual Paid Amount:</span>
                            <b className="user-paid-amount-text">{formatRupees(paidAmount)}</b>
                            <span className="user-payment-method-tag">via {refundMethod}</span>
                          </div>

                          {["refund_initiated", "processing", "refunded"].includes(booking.refundStatus) && refundStage && (
                            <div className="user-cancellation-tracker-wrap">
                              <ol className="booking-refund-progress" aria-label="Refund progress">
                                {["initiated", "processing", "refunded"].map((step, index) => (
                                  <li
                                    className={["initiated", "processing", "refunded"].indexOf(refundStage) >= index ? "is-complete" : ""}
                                    key={step}
                                  >
                                    <span>{["Refund initiated", "Processing", "Refund completed"][index]}</span>
                                  </li>
                                ))}
                              </ol>
                              <small className="booking-refund-demo-note">Demo: real refunds take 5-7 working days</small>
                            </div>
                          )}

                          {booking.refundStatus === "no_refund" && (
                            <small className="cancellation-policy-hint">
                              Cancelled - no refund (cancelled within 24 hours of check-in)
                            </small>
                          )}
                        </div>
                      ) : (
                        <p className="user-cancellation-unpaid-line">
                          No payment was made, no refund needed
                        </p>
                      )}
                    </div>
                  )}

                  {!isCancelled && refundLine && <p className="booking-refund-info">{refundLine}</p>}
                </div>
                <div className="booking-card-end">
                  <b>{formatRupees(booking.totalAmount)}</b>
                  {booking.isEarlyBirdApplied && booking.discountAmount > 0 && (
                    <span className="booking-earlybird-saved-tag">
                      ⚡ Saved {formatRupees(booking.discountAmount)} (Early Bird)
                    </span>
                  )}
                  {isCancelled && isPaid && (
                    <span className="booking-paid-status-tag">
                      Paid: {formatRupees(paidAmount)}
                    </span>
                  )}
                  {isCancelled && (
                    <button
                      className="button button-outline user-view-reason-btn"
                      type="button"
                      onClick={() => setViewingCancellationBooking(booking)}
                    >
                      View Reason Details ↗
                    </button>
                  )}
                  {booking.status === "pending" && <Link className="text-button" to={`/payment/${booking._id}`}>Pay now</Link>}
                  {canCancel && (
                    <button
                      className="button button-outline cancel-booking-btn-end"
                      type="button"
                      onClick={() => {
                        setSelectedBooking(booking);
                        setCancelError("");
                        setNotice("");
                      }}
                    >
                      Cancel Booking
                    </button>
                  )}
                  {user?.role === "user" && ["confirmed", "completed"].includes(normStatus) && <HotelRatingControl hotelId={booking.hotel?._id} className="booking-rating" />}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="empty-state"><span>✳</span><h3>Your next story is waiting.</h3><p>You haven’t booked a stay yet.</p><Link className="button button-dark" to="/hotels">Discover stays <span>↗</span></Link></div>}
      {selectedBooking && (
        <UserCancelBookingDialog
          booking={selectedBooking}
          onClose={() => {
            if (!cancelling) {
              setSelectedBooking(null);
              setCancelError("");
            }
          }}
          onConfirm={cancel}
          cancelling={cancelling}
          error={cancelError}
        />
      )}
      {viewingCancellationBooking && (
        <UserCancellationModal
          booking={viewingCancellationBooking}
          onClose={() => setViewingCancellationBooking(null)}
        />
      )}
    </section>
  );
}


export function WishlistPage() {
  const { wishlistHotels, loading, error } = useWishlist();

  return (
    <section className="section listing-page wishlist-page">
      <div className="page-intro">
        <span className="eyebrow">SAVED STAYS &amp; GETAWAYS</span>
        <h1>My <em>wishlist.</em></h1>
        <p>Curated stays you have saved for your upcoming journeys.</p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {loading ? (
        <Loading />
      ) : wishlistHotels?.length ? (
        <div className="mmt-hotel-list wishlist-hotel-list">
          {wishlistHotels.map((hotel, index) => (
            <HotelCard
              key={hotel._id}
              hotel={hotel}
              index={index}
              variant="mmt"
            />
          ))}
        </div>
      ) : (
        <div className="empty-state wishlist-empty-state">
          <span className="empty-wishlist-heart">♡</span>
          <h3>Your wishlist is empty.</h3>
          <p>
            When exploring stays on Haven &amp; Co., click the heart icon on any hotel card or details page to save it to your wishlist.
          </p>
          <div className="mmt-empty-actions" style={{ marginTop: "14px" }}>
            <Link className="button button-dark" to="/hotels">
              Discover hotels ↗
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  return (
    <section className="section profile-page">
      <span className="eyebrow">YOUR HAVEN</span>
      <h1>A little space <em>for you.</em></h1>
      <div className="profile-card">
        <span className="profile-avatar">{user?.name?.[0]?.toUpperCase()}</span>
        <div><span className="eyebrow">YOUR PROFILE</span><h2>{user?.name}</h2><p>{user?.email}</p></div>
        <span className="role-pill">{user?.role}</span>
      </div>
      <div className="profile-links">
        {user?.role === "user" && <Link to="/bookings"><span><b>Your bookings</b><small>See and manage your upcoming stays</small></span><span>↗</span></Link>}
        {user?.role === "user" && <Link to="/wishlist"><span><b>Your wishlist</b><small>View and manage your saved hotels</small></span><span>↗</span></Link>}
        {user?.role === "admin" && <Link to="/admin"><span><b>Admin workspace</b><small>Manage your hotel collection</small></span><span>↗</span></Link>}
        <button onClick={signOut}><span><b>Sign out</b><small>We’ll be here when you return</small></span><span>→</span></button>
      </div>
    </section>
  );
}

export { fallbackImage };

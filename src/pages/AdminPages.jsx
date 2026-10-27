import React from "react";
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import api, { errorMessage, formatRupees, getData, getRefundStage } from "../services/api";

function useAdminData(path, pollInterval = 0) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get(path);
      const body = getData(response);
      setData(body.hotels || body.rooms || body.bookings || body.reviews || []);
      setError("");
    } catch (reason) { if (!silent) setError(errorMessage(reason)); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => {
    refresh();
    const onFocus = () => refresh(true);
    window.addEventListener("focus", onFocus);
    let timer;
    if (pollInterval > 0) {
      timer = setInterval(() => refresh(true), pollInterval);
    }
    return () => {
      window.removeEventListener("focus", onFocus);
      if (timer) clearInterval(timer);
    };
  }, [path, pollInterval]);
  return { data, loading, error, refresh, setError, setData };
}

export function AdminDashboardPage() {
  const hotels = useAdminData("/hotels?admin=true", 10000);
  const rooms = useAdminData("/rooms", 10000);
  const bookings = useAdminData("/bookings/admin/all", 4000);
  const reviews = useAdminData("/hotels/admin/reviews", 10000);

  const validBookings = bookings.data.filter((b) => b.status !== "cancelled");
  const totalRevenue = validBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

  const hotelRevenueMap = new Map();
  const hotelBookingsCountMap = new Map();
  validBookings.forEach((b) => {
    const hotelId = String(b.hotel?._id || b.hotel || "");
    if (hotelId) {
      hotelRevenueMap.set(hotelId, (hotelRevenueMap.get(hotelId) || 0) + (Number(b.totalAmount) || 0));
      hotelBookingsCountMap.set(hotelId, (hotelBookingsCountMap.get(hotelId) || 0) + 1);
    }
  });

  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">YOUR COLLECTION, AT A GLANCE</span>
          <h1>Good morning.</h1>
          <p>Welcome to your hotel workspace.</p>
        </div>
      </div>
      <div className="stat-grid">
        <article><span className="eyebrow">HOTELS</span><strong>{hotels.loading ? "—" : hotels.data.length}</strong><Link to="/admin/hotels">Manage hotels →</Link></article>
        <article><span className="eyebrow">ROOMS</span><strong>{rooms.loading ? "—" : rooms.data.length}</strong><Link to="/admin/rooms">Manage rooms →</Link></article>
        <article><span className="eyebrow">ALL BOOKINGS</span><strong>{bookings.loading ? "—" : bookings.data.length}</strong><Link to="/admin/bookings">View bookings →</Link></article>
        <article><span className="eyebrow">TOTAL REVENUE</span><strong>{bookings.loading ? "—" : formatRupees(totalRevenue)}</strong><Link to="/admin/bookings">View bookings →</Link></article>
        <article><span className="eyebrow">GUEST REVIEWS</span><strong>{reviews.loading ? "—" : reviews.data.length}</strong><Link to="/admin/reviews">View reviews →</Link></article>
      </div>

      <section className="admin-review-section">
        <div className="admin-page-heading">
          <div>
            <span className="eyebrow">FINANCIAL PERFORMANCE</span>
            <h2>Hotel revenue.</h2>
          </div>
          <Link className="underlined-link" to="/admin/bookings">View all bookings →</Link>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>HOTEL</th>
                <th>LOCATION</th>
                <th>CONFIRMED BOOKINGS</th>
                <th>TOTAL REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {hotels.loading || bookings.loading ? (
                <tr><td colSpan="4">Loading revenue data…</td></tr>
              ) : hotels.data.length ? (
                hotels.data.map((hotel) => (
                  <tr key={hotel._id}>
                    <td>
                      <div className="table-hotel">
                        <img src={hotel.image || hotel.imageUrl || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=160&q=80"} alt="" />
                        <span>{hotel.name}</span>
                      </div>
                    </td>
                    <td>{hotel.location}</td>
                    <td>{hotelBookingsCountMap.get(String(hotel._id)) || 0}</td>
                    <td><b>{formatRupees(hotelRevenueMap.get(String(hotel._id)) || 0)}</b></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4">No hotels available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AdminReviewList reviews={reviews.data.slice(0, 5)} loading={reviews.loading} error={reviews.error} onReviewUpdated={reviews.refresh} />
      <section className="admin-welcome">
        <span className="eyebrow">THE HAVEN WAY</span>
        <h2>Little details.<br /><em>Lovely stays.</em></h2>
        <p>Thoughtful hospitality begins with the people and places you bring together. Manage your collection here, and make every guest feel at home.</p>
      </section>
    </div>
  );
}

function AdminReviewCard({ review, showHotel = true, onReviewUpdated }) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState(review.adminReply || "");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [localReply, setLocalReply] = useState(review.adminReply || "");
  const [localRepliedAt, setLocalRepliedAt] = useState(review.adminRepliedAt);
  const [localRepliedBy, setLocalRepliedBy] = useState(review.adminRepliedBy);

  useEffect(() => {
    setLocalReply(review.adminReply || "");
    setLocalRepliedAt(review.adminRepliedAt);
    setLocalRepliedBy(review.adminRepliedBy);
    setReplyText(review.adminReply || "");
  }, [review.adminReply, review.adminRepliedAt, review.adminRepliedBy]);

  const handleStartReply = () => {
    setReplyText(localReply || "");
    setActionError("");
    setIsReplying(true);
  };

  const handleCancelReply = () => {
    setIsReplying(false);
    setActionError("");
    setReplyText(localReply || "");
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed) {
      setActionError("Reply text cannot be empty.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    try {
      const response = await api.post(`/hotels/admin/reviews/${review._id}/reply`, { reply: trimmed });
      const updated = getData(response).rating;
      setLocalReply(updated?.adminReply || trimmed);
      setLocalRepliedAt(updated?.adminRepliedAt || new Date().toISOString());
      setLocalRepliedBy(updated?.adminRepliedBy);
      setIsReplying(false);
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!window.confirm("Are you sure you want to remove your reply to this review?")) return;
    setSubmitting(true);
    setActionError("");
    try {
      await api.delete(`/hotels/admin/reviews/${review._id}/reply`);
      setLocalReply("");
      setLocalRepliedAt(null);
      setLocalRepliedBy(undefined);
      setIsReplying(false);
      setReplyText("");
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="admin-review-card" key={review._id}>
      <div className="admin-review-heading">
        <b>{review.user?.name || "Guest"}</b>
        <span className="admin-review-stars">★ {review.stars} / 5</span>
      </div>
      {showHotel && (
        <small className="admin-review-hotel-info">
          {review.hotel?.name || "Hotel"} · {review.hotel?.location || ""}
        </small>
      )}
      <p className="admin-review-content">{review.review}</p>
      <small className="admin-review-date">
        {new Date(review.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </small>

      {/* Admin Reply Section */}
      <div className="admin-review-reply-section">
        {actionError && <div className="notice notice-error" style={{ margin: "8px 0" }}>{actionError}</div>}

        {!isReplying && localReply && (
          <div className="admin-review-existing-reply">
            <div className="admin-reply-meta-row">
              <span className="admin-reply-author-tag">
                💬 Management Reply · {localRepliedBy?.name || "Hotel Administrator"}
              </span>
              {localRepliedAt && (
                <span className="admin-reply-time">
                  {new Date(localRepliedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              )}
            </div>
            <p className="admin-reply-message">{localReply}</p>
            <div className="admin-reply-action-buttons">
              <button
                type="button"
                className="button-link-reply"
                onClick={handleStartReply}
                disabled={submitting}
              >
                ✏️ Edit Reply
              </button>
              <button
                type="button"
                className="button-link-delete-reply"
                onClick={handleDeleteReply}
                disabled={submitting}
              >
                🗑️ Remove
              </button>
            </div>
          </div>
        )}

        {!isReplying && !localReply && (
          <div className="admin-review-no-reply">
            <button
              type="button"
              className="button button-outline admin-reply-trigger-btn"
              onClick={handleStartReply}
            >
              💬 Reply to Review
            </button>
          </div>
        )}

        {isReplying && (
          <form onSubmit={handleSubmitReply} className="admin-reply-form">
            <label className="admin-reply-label" htmlFor={`reply-input-${review._id}`}>
              <b>{localReply ? "Edit Response to Guest" : "Response from Hotel Management"}</b>
              <small className="field-hint">This response will be visible to guests on the hotel page.</small>
            </label>
            <textarea
              id={`reply-input-${review._id}`}
              rows={3}
              maxLength={1000}
              placeholder="Write a thoughtful, professional response to this guest's review..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={submitting}
              className="admin-reply-textarea"
              required
            />
            <div className="admin-reply-form-footer">
              <small className="char-counter">{replyText.length} / 1000 characters</small>
              <div className="admin-reply-form-actions">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={handleCancelReply}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-dark"
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? "Saving…" : (localReply ? "Update Reply" : "Post Reply")}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </article>
  );
}

function AdminReviewList({ reviews, loading, error, showHotel = true, showViewAll = true, onReviewUpdated }) {
  return (
    <section className="admin-review-section">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">GUEST VOICES</span>
          <h2>Guest reviews.</h2>
        </div>
        {showViewAll && <Link className="underlined-link" to="/admin/reviews">View all →</Link>}
      </div>
      {error && (
        <div className="notice notice-error" style={{ margin: "16px 0", padding: "14px 18px", borderRadius: "6px", background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span><strong>Failed to load hotels:</strong> {error}</span>
          <button
            type="button"
            onClick={() => refresh()}
            style={{ marginLeft: "12px", background: "none", border: "none", textDecoration: "underline", cursor: "pointer", color: "inherit", fontWeight: "bold" }}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <p>Loading reviews…</p>
      ) : reviews?.length ? (
        <div className="admin-review-list">
          {reviews.map((review) => (
            <AdminReviewCard
              key={review._id}
              review={review}
              showHotel={showHotel}
              onReviewUpdated={onReviewUpdated}
            />
          ))}
        </div>
      ) : (
        !error && (
          <div className="empty-state">
            <h3>No written reviews yet.</h3>
            <p>Guest reviews will appear here.</p>
          </div>
        )
      )}
    </section>
  );
}

export function AllReviewsPage() {
  const reviews = useAdminData("/hotels/admin/reviews");
  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">GUEST VOICES</span>
          <h1>Guest reviews.</h1>
          <p>Ratings and written feedback shared by your guests.</p>
        </div>
      </div>
      <AdminReviewList
        reviews={reviews.data}
        loading={reviews.loading}
        error={reviews.error}
        showViewAll={false}
        onReviewUpdated={reviews.refresh}
      />
    </div>
  );
}

function HotelForm({ initial = {}, onSave, onClose, busy }) {
  const [form, setForm] = useState({
    name: initial.name || "",
    location: initial.location || "",
    propertyType: initial.propertyType || "Hotel",
    description: initial.description || "",
    imageUrl: initial.imageUrl || initial.image || "",
    earlyBirdDiscount: initial.earlyBirdDiscount !== undefined ? initial.earlyBirdDiscount : 0,
    earlyBirdDays: initial.earlyBirdDays !== undefined ? initial.earlyBirdDays : 7
  });
  const field = (name, value) => setForm((old) => ({ ...old, [name]: value }));
  return (
    <form
      className="admin-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...form,
          propertyType: form.propertyType,
          earlyBirdDiscount: Number(form.earlyBirdDiscount || 0),
          earlyBirdDays: Number(form.earlyBirdDays || 7)
        });
      }}
    >
      <label>Hotel name<input required value={form.name} onChange={(e) => field("name", e.target.value)} /></label>
      <label>Location<input required value={form.location} onChange={(e) => field("location", e.target.value)} /></label>
      <label>
        Property Type
        <select
          required
          value={form.propertyType}
          onChange={(e) => field("propertyType", e.target.value)}
        >
          <option value="Hotel">Hotel</option>
          <option value="Resort">Resort</option>
          <option value="Villa">Villa</option>
          <option value="Cottage">Cottage</option>
          <option value="Apartment">Apartment</option>
          <option value="Homestay">Homestay</option>
          <option value="Guest House">Guest House</option>
        </select>
      </label>
      <label>Early Bird Discount (%)
        <input type="number" min="0" max="100" placeholder="e.g. 15" value={form.earlyBirdDiscount} onChange={(e) => field("earlyBirdDiscount", e.target.value)} />
      </label>
      <label>Min. Advance Days
        <input type="number" min="0" max="90" placeholder="e.g. 7" value={form.earlyBirdDays} onChange={(e) => field("earlyBirdDays", e.target.value)} />
      </label>
      <label className="form-span">Image URL<input type="url" value={form.imageUrl} onChange={(e) => field("imageUrl", e.target.value)} /></label>
      <label className="form-span">Description<textarea rows="4" value={form.description} onChange={(e) => field("description", e.target.value)} /></label>
      <div className="modal-actions">
        <button type="button" className="button button-outline" onClick={onClose}>Cancel</button>
        <button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Save hotel"}</button>
      </div>
    </form>
  );
}

function RoomForm({ initial = {}, hotels = [], onSave, onClose, busy }) {
  const sortedHotels = useMemo(() => {
    return [...hotels].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [hotels]);

  const defaultHotelId = initial.hotel?._id || initial.hotel || sortedHotels[0]?._id || "";
  const [form, setForm] = useState({
    hotel: defaultHotelId,
    roomNumber: initial.roomNumber || "",
    type: initial.type || "Single",
    description: initial.description || "",
    pricePerNight: initial.pricePerNight !== undefined ? initial.pricePerNight : "",
    capacity: initial.capacity || 2
  });

  useEffect(() => {
    if (!form.hotel && sortedHotels.length > 0) {
      setForm((prev) => ({ ...prev, hotel: sortedHotels[0]._id }));
    }
  }, [sortedHotels, form.hotel]);

  const field = (name, value) => setForm((old) => ({ ...old, [name]: value }));

  return (
    <form
      className="admin-form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...form,
          pricePerNight: Number(form.pricePerNight),
          capacity: Number(form.capacity)
        });
      }}
    >
      <label className="form-span">
        Hotel
        <select required value={form.hotel} onChange={(e) => field("hotel", e.target.value)}>
          {sortedHotels.map((hotel) => (
            <option value={hotel._id} key={hotel._id}>
              {hotel.name} {hotel.location ? `(${hotel.location})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Room number
        <input required value={form.roomNumber} onChange={(e) => field("roomNumber", e.target.value)} />
      </label>
      <label>
        Room type
        <select value={form.type} onChange={(e) => field("type", e.target.value)}>
          <option>Single</option>
          <option>Double</option>
          <option>Suite</option>
        </select>
      </label>
      <label>
        Price per night (₹)
        <input
          required
          type="number"
          min="1"
          value={form.pricePerNight}
          onChange={(e) => field("pricePerNight", e.target.value)}
        />
      </label>
      <label>
        Guest capacity
        <input
          required
          type="number"
          min="1"
          value={form.capacity}
          onChange={(e) => field("capacity", e.target.value)}
        />
      </label>
      <label className="form-span">
        Description
        <textarea rows="3" value={form.description} onChange={(e) => field("description", e.target.value)} />
      </label>
      <div className="modal-actions">
        <button type="button" className="button button-outline" onClick={onClose}>
          Cancel
        </button>
        <button className="button button-dark" disabled={busy || !sortedHotels.length}>
          {busy ? "Saving…" : "Save room"}
        </button>
      </div>
    </form>
  );
}

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal"><div className="modal-heading"><div><span className="eyebrow">THE COLLECTION</span><h2>{title}</h2></div><button aria-label="Close" className="close-button" onClick={onClose}>×</button></div>{children}</section></div>;
}

export function ManageHotelsPage() {
  const { data, loading, error, refresh, setError, setData } = useAdminData("/hotels?admin=true");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const save = async (details) => {
    setBusy(true);
    setError("");
    try {
      const hotelDetails = { ...details, image: details.imageUrl };
      delete hotelDetails.imageUrl;
      let savedHotel = null;
      if (editing?._id) {
        const response = await api.put(`/hotels/${editing._id}`, hotelDetails);
        savedHotel = getData(response).hotel || { ...editing, ...hotelDetails };
      } else {
        const response = await api.post("/hotels", hotelDetails);
        savedHotel = getData(response).hotel;
        if (savedHotel && savedHotel._id) {
          try {
            await api.post("/rooms", {
              hotel: savedHotel._id,
              roomNumber: "101",
              type: "Single",
              description: `Standard room at ${savedHotel.name || "hotel"}`,
              pricePerNight: Number(savedHotel.startingPrice) || 5000,
              capacity: 2,
              amenities: Array.isArray(savedHotel.amenities) && savedHotel.amenities.length > 0 ? savedHotel.amenities.slice(0, 3) : ["Wi-Fi", "Air conditioning"],
              available: true
            });
          } catch (roomErr) {
            console.warn("Auto room creation note:", roomErr);
          }
        }
      }

      // Optimistically update the list immediately so the admin sees the new/updated hotel instantly
      if (savedHotel && savedHotel._id) {
        setData((prev) => {
          const exists = prev.some((h) => String(h._id) === String(savedHotel._id));
          if (exists) {
            return prev.map((h) => String(h._id) === String(savedHotel._id) ? { ...h, ...savedHotel } : h);
          }
          return [savedHotel, ...prev];
        });
      }

      setEditing(null);
      await refresh();
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  const remove = async (hotel) => {
    if (!window.confirm(`Delete ${hotel.name} and its rooms?`)) return;
    try { await api.delete(`/hotels/${hotel._id}`); await refresh(); }
    catch (reason) { setError(errorMessage(reason)); }
  };
  return <div className="admin-content"><div className="admin-page-heading"><div><span className="eyebrow">YOUR PLACES</span><h1>Manage hotels.</h1><p>Thoughtfully curate every stay in your collection.</p></div><button className="button button-dark" onClick={() => setEditing({})}>+ Add hotel</button></div>{error && <div className="notice notice-error">{error}</div>}<div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>HOTEL</th><th>PROPERTY TYPE</th><th>LOCATION</th><th>RATING</th><th>ACTIONS</th></tr></thead><tbody>{loading ? <tr><td colSpan="5">Loading your hotels…</td></tr> : data.map((hotel) => <tr key={hotel._id}><td><div className="table-hotel"><img src={hotel.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=160&q=80"} alt="" /><span>{hotel.name}</span>{hotel.earlyBirdDiscount > 0 && <span className="admin-tag-earlybird" style={{ marginLeft: "8px", fontSize: "0.75rem", color: "#0d7a53", background: "#e6f7ef", padding: "2px 6px", borderRadius: "4px" }}>{hotel.earlyBirdDiscount}% Early Bird ({hotel.earlyBirdDays}d)</span>}</div></td><td>{hotel.propertyType ? <span className="admin-tag-property-type" style={{ display: "inline-block", fontSize: "0.75rem", color: "#2c3b28", background: "#e4ece0", padding: "3px 8px", borderRadius: "4px", fontWeight: 600 }}>{hotel.propertyType}</span> : <span style={{ color: "#999", fontSize: "0.75rem", fontStyle: "italic" }}>Not set</span>}</td><td>{hotel.location}</td><td>{Number(hotel.ratingCount || 0) > 0 ? `★ ${Number(hotel.rating || 0).toFixed(1)} (${hotel.ratingCount} ratings)` : "No ratings yet"}</td><td><div className="table-actions">
    {/* <Link to={`/hotels/${hotel._id}`}>View</Link> */}
    <button onClick={() => setEditing(hotel)}>Edit</button>
    <button className="delete-action" onClick={() => remove(hotel)}>Delete</button></div></td></tr>)}</tbody></table>{!loading && !data.length && <div className="empty-state"><h3>Nothing here just yet.</h3><p>Add your first hotel to begin your collection.</p></div>}</div>{editing && <Modal title={editing._id ? "Edit hotel" : "A new hotel"} onClose={() => setEditing(null)}><HotelForm initial={editing} onSave={save} onClose={() => setEditing(null)} busy={busy} /></Modal>}</div>;
}

export function ManageRoomsPage() {
  const rooms = useAdminData("/rooms");
  const hotels = useAdminData("/hotels?admin=true");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [hotelFilter, setHotelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // Quick lookup map of hotels by MongoDB _id
  const hotelsMap = useMemo(() => {
    const map = new Map();
    (hotels.data || []).forEach((h) => {
      if (h && h._id) map.set(String(h._id), h);
    });
    return map;
  }, [hotels.data]);

  // Alphabetically sorted hotel list for dropdown filter
  const sortedHotelsForFilter = useMemo(() => {
    return [...(hotels.data || [])].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }, [hotels.data]);

  const save = async (details) => {
    setBusy(true);
    try {
      if (editing?._id) await api.put(`/rooms/${editing._id}`, details);
      else await api.post("/rooms", details);
      setEditing(null);
      await rooms.refresh();
    } catch (reason) {
      rooms.setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (room) => {
    if (!window.confirm(`Delete room ${room.roomNumber}?`)) return;
    try {
      await api.delete(`/rooms/${room._id}`);
      await rooms.refresh();
    } catch (reason) {
      rooms.setError(errorMessage(reason));
    }
  };

  // Filter rooms based on search query, hotel filter, and type filter
  const filteredRooms = useMemo(() => {
    return (rooms.data || []).filter((room) => {
      const hotelId = String(room.hotel?._id || room.hotel || "");
      const hotelObj = (room.hotel && typeof room.hotel === "object" && room.hotel.name)
        ? room.hotel
        : hotelsMap.get(hotelId) || { _id: hotelId, name: "Unassigned Property", location: "" };

      if (hotelFilter !== "all" && hotelId !== hotelFilter) {
        return false;
      }
      if (typeFilter !== "all" && String(room.type || "").toLowerCase() !== String(typeFilter).toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchRoom = String(room.roomNumber || "").toLowerCase().includes(q);
        const matchType = String(room.type || "").toLowerCase().includes(q);
        const matchHotel = String(hotelObj.name || "").toLowerCase().includes(q);
        const matchLoc = String(hotelObj.location || "").toLowerCase().includes(q);
        if (!matchRoom && !matchType && !matchHotel && !matchLoc) {
          return false;
        }
      }
      return true;
    });
  }, [rooms.data, hotelsMap, hotelFilter, typeFilter, searchQuery]);

  // Group rooms by associated hotel (using MongoDB hotel ID)
  // Sort hotels alphabetically by hotel name
  // Display all rooms belonging to each hotel consecutively
  const hotelGroups = useMemo(() => {
    const map = new Map();

    filteredRooms.forEach((room) => {
      const hotelId = String(room.hotel?._id || room.hotel || "unassigned");
      const hotelObj = (room.hotel && typeof room.hotel === "object" && room.hotel.name)
        ? room.hotel
        : hotelsMap.get(hotelId) || { _id: hotelId, name: "Unassigned Property", location: "—" };

      if (!map.has(hotelId)) {
        map.set(hotelId, {
          hotelId,
          hotel: hotelObj,
          rooms: []
        });
      }
      map.get(hotelId).rooms.push(room);
    });

    const groups = Array.from(map.values());

    // Sort hotel groups alphabetically by hotel name
    groups.sort((a, b) => {
      const nameA = (a.hotel?.name || "").trim();
      const nameB = (b.hotel?.name || "").trim();
      const cmp = nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
      return a.hotelId.localeCompare(b.hotelId);
    });

    // Sort rooms within each hotel group naturally by roomNumber
    groups.forEach((g) => {
      g.rooms.sort((a, b) => {
        const numA = String(a.roomNumber || "");
        const numB = String(b.roomNumber || "");
        return numA.localeCompare(numB, undefined, { numeric: true, sensitivity: "base" });
      });
    });

    return groups;
  }, [filteredRooms, hotelsMap]);

  const totalHotels = hotelGroups.length;
  const displayedGroups = hotelGroups;

  const hasActiveFilters = searchQuery.trim() !== "" || hotelFilter !== "all" || typeFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setHotelFilter("all");
    setTypeFilter("all");
  };

  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">ROOMS &amp; SUITES</span>
          <h1>Manage rooms.</h1>
          <p>Rooms are grouped by hotel and sorted alphabetically.</p>
        </div>
        <button className="button button-dark" onClick={() => setEditing({})}>
          + Add room
        </button>
      </div>

      {rooms.error && <div className="notice notice-error">{rooms.error}</div>}

      {/* Admin Filters & Search Toolbar */}
      <div className="admin-rooms-toolbar">
        <div className="admin-rooms-search-wrap">
          <input
            type="search"
            placeholder="Search room, type or hotel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-rooms-search-input"
          />
        </div>

        <div className="admin-rooms-select-group">
          <select
            value={hotelFilter}
            onChange={(e) => setHotelFilter(e.target.value)}
            className="admin-rooms-select"
            aria-label="Filter by hotel"
          >
            <option value="all">All Hotels ({sortedHotelsForFilter.length})</option>
            {sortedHotelsForFilter.map((h) => (
              <option key={h._id} value={h._id}>
                {h.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="admin-rooms-select"
            aria-label="Filter by room type"
          >
            <option value="all">All Types</option>
            <option value="Single">Single</option>
            <option value="Double">Double</option>
            <option value="Suite">Suite</option>
          </select>


          {hasActiveFilters && (
            <button type="button" className="admin-rooms-clear-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div className="admin-rooms-stats-pill">
          <span>{totalHotels} {totalHotels === 1 ? "hotel" : "hotels"}</span>
          <span className="dot-divider">·</span>
          <span>{filteredRooms.length} {filteredRooms.length === 1 ? "room" : "rooms"}</span>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ROOM</th>
              <th>HOTEL</th>
              <th>CAPACITY</th>
              <th>RATE / NIGHT (₹)</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rooms.loading ? (
              <tr>
                <td colSpan="5">Loading rooms…</td>
              </tr>
            ) : displayedGroups.length === 0 ? (
              <tr>
                <td colSpan="5">
                  <div className="empty-state" style={{ padding: "30px 20px" }}>
                    <h3>{hasActiveFilters ? "No matching rooms found." : "No rooms added."}</h3>
                    <p>
                      {hasActiveFilters
                        ? "Try adjusting your search or filters to see available rooms."
                        : "Add a hotel room to make it available to guests."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="button button-outline"
                        style={{ marginTop: "10px" }}
                        onClick={clearFilters}
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              displayedGroups.map((group) => (
                <React.Fragment key={`hotel-group-${group.hotelId}`}>
                  {/* Distinct Hotel Group Banner */}
                  <tr className="admin-hotel-group-row">
                    <td colSpan="5">
                      <div className="admin-hotel-group-banner">
                        <div className="admin-hotel-group-left">
                          {(group.hotel.image || group.hotel.imageUrl) && (
                            <img
                              src={group.hotel.image || group.hotel.imageUrl}
                              alt=""
                              className="admin-hotel-group-thumb"
                            />
                          )}
                          <div className="admin-hotel-group-title">
                            <span className="admin-hotel-group-eyebrow">HOTEL / PROPERTY</span>
                            <span className="admin-hotel-group-name">{group.hotel.name}</span>
                            {group.hotel.location && (
                              <span className="admin-hotel-group-location">📍 {group.hotel.location}</span>
                            )}
                          </div>
                        </div>
                        <div className="admin-hotel-group-right">
                          <span className="admin-hotel-group-count">
                            {group.rooms.length} {group.rooms.length === 1 ? "room" : "rooms"}
                          </span>
                          <button
                            type="button"
                            className="admin-hotel-add-room-btn"
                            onClick={() => setEditing({ hotel: group.hotelId })}
                            title={`Add room for ${group.hotel.name}`}
                          >
                            + Add room for this hotel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* All Rooms Belonging to this Hotel Consecutively */}
                  {group.rooms.map((room) => (
                    <tr key={room._id} className="admin-room-row">
                      <td>
                        <b>{room.type}</b>
                        <small className="table-subline">Room {room.roomNumber}</small>
                      </td>
                      <td>
                        <span className="admin-room-hotel-name">{group.hotel.name}</span>
                        {group.hotel.location && (
                          <small className="table-subline">{group.hotel.location}</small>
                        )}
                      </td>
                      <td>{room.capacity} guests</td>
                      <td>{formatRupees(room.pricePerNight)}</td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => setEditing(room)}>Edit</button>
                          <button className="delete-action" onClick={() => remove(room)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

      </div>

      {editing && (
        <Modal
          title={editing._id ? `Edit room ${editing.roomNumber || ""}` : "A new room"}
          onClose={() => setEditing(null)}
        >
          <RoomForm
            initial={editing}
            hotels={hotels.data}
            onSave={save}
            onClose={() => setEditing(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  );
}

const PREDEFINED_CANCELLATION_REASONS = [
  "Hotel unavailable",
  "Maintenance or operational issue",
  "Overbooking",
  "Incorrect room or pricing information",
  "Other"
];

const DEFAULT_CATEGORY_MESSAGES = {
  "Hotel unavailable": "The property is unavailable for the booked dates due to unforeseen operational circumstances.",
  "Maintenance or operational issue": "The property is undergoing emergency maintenance and cannot accommodate guests on these dates.",
  "Overbooking": "The hotel experienced an unexpected overbooking for this room category on your selected stay dates.",
  "Incorrect room or pricing information": "This reservation contained an incorrect room category or pricing error.",
  "Other": ""
};

function AdminCancelBookingModal({ booking, onClose, onSuccess }) {
  const [category, setCategory] = useState("Overbooking");
  const [reasonForGuest, setReasonForGuest] = useState(DEFAULT_CATEGORY_MESSAGES["Overbooking"]);
  const [adminNotes, setAdminNotes] = useState("");
  const [refundStatus, setRefundStatus] = useState("refund_initiated");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isPaid = booking.paymentStatus === "paid";
  const paidAmount = Number(booking.totalAmount || 0);

  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setError("");
    const prevDefaults = Object.values(DEFAULT_CATEGORY_MESSAGES);
    if (!reasonForGuest.trim() || prevDefaults.includes(reasonForGuest.trim())) {
      setReasonForGuest(DEFAULT_CATEGORY_MESSAGES[newCat] || "");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!category) {
      setError("Please select a cancellation category.");
      return;
    }

    const trimmedReason = reasonForGuest.trim();
    if (!trimmedReason && category === "Other") {
      setError("Please enter the cancellation explanation that will be shown to the guest.");
      return;
    }

    setBusy(true);
    try {
      const finalReason = trimmedReason || category;
      const payload = {
        status: "cancelled",
        cancellationCategory: category,
        cancellationReason: finalReason,
        cancellationNotes: adminNotes.trim() ? adminNotes.trim() : finalReason,
        refundStatus: isPaid ? refundStatus : "not_applicable",
        refundAmount: isPaid && refundStatus === "no_refund" ? 0 : Number(booking.totalAmount || 0)
      };

      await api.patch(`/bookings/admin/${booking._id}`, payload);
      onSuccess();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section className="modal admin-cancellation-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">BOOKING ADMINISTRATION</span>
            <h2 id="cancel-modal-title">Cancel Guest Booking</h2>
          </div>
          <button aria-label="Close" className="close-button" disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="admin-cancel-form">
          {error && <div className="notice notice-error">{error}</div>}

          {/* Booking Summary Box */}
          <div className="admin-cancel-booking-summary">
            <div className="summary-row">
              <span className="summary-label">Guest:</span>
              <strong>{booking.user?.name || "Guest"}</strong>
              <small className="muted">({booking.user?.email || "No email"})</small>
            </div>
            <div className="summary-row">
              <span className="summary-label">Hotel &amp; Room:</span>
              <span>{booking.hotel?.name || "Hotel"} · {booking.room?.type} Room</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Stay Dates:</span>
              <span>
                {new Date(booking.checkIn).toLocaleDateString()} to {new Date(booking.checkOut).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Payment & Refund Alert Box */}
          <div className={`admin-cancel-payment-alert ${isPaid ? "alert-paid" : "alert-unpaid"}`}>
            {isPaid ? (
              <>
                <div className="alert-header">
                  <span className="alert-icon">💳</span>
                  <div>
                    <strong>Paid Booking: {formatRupees(paidAmount)}</strong>
                    <p>
                      Payment Method: <b>{booking.paymentMethod?.toUpperCase() || "Online"}</b>.
                      Cancelling will initiate a refund for the actual paid amount.
                    </p>
                  </div>
                </div>

                <div className="refund-status-selector">
                  <label htmlFor="admin-refund-status">
                    <b>Refund Status:</b>
                  </label>
                  <select
                    id="admin-refund-status"
                    value={refundStatus}
                    onChange={(e) => setRefundStatus(e.target.value)}
                    className="admin-select"
                  >
                    <option value="refund_initiated">Refund Initiated (Standard automated processing)</option>
                    <option value="processing">Processing (Gateway processing)</option>
                    <option value="refunded">Refunded (Mark as already refunded)</option>
                    <option value="pending">Pending (Awaiting manual clearance / review)</option>
                    <option value="failed">Failed (Flag payment error / gateway failure)</option>
                    <option value="no_refund">No Refund (Cancelled within 24 hours of check-in)</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="alert-header">
                <span className="alert-icon">ℹ️</span>
                <div>
                  <strong>{booking.paymentStatus === "pay_at_hotel" ? "Pay at Hotel Booking" : "Unpaid Booking"}</strong>
                  <p>No online payment was received. No refund is required.</p>
                </div>
              </div>
            )}
          </div>

          {/* Cancellation Reasons Selection */}
          <div className="admin-cancel-reason-group">
            <label className="admin-cancel-section-title">
              <b>1. Select Cancellation Category <span className="required-star">*</span></b>
            </label>
            <div className="admin-reason-radio-list">
              {PREDEFINED_CANCELLATION_REASONS.map((reason) => (
                <label key={reason} className={`admin-reason-radio-item ${category === reason ? "is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="adminCancellationReason"
                    value={reason}
                    checked={category === reason}
                    onChange={() => handleCategoryChange(reason)}
                  />
                  <span className="radio-label-text">{reason}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cancellation Reason Shown to the Guest */}
          <div className="admin-cancel-custom-reason">
            <label htmlFor="custom-cancellation-reason">
              <b>2. Cancellation Reason Shown to Guest <span className="required-star">*</span></b>
              <small className="field-hint">
                👁️ This exact explanation will be displayed to the guest in their booking details &amp; history.
              </small>
            </label>
            <textarea
              id="custom-cancellation-reason"
              required
              rows={3}
              placeholder="Enter the cancellation reason that will be displayed to the guest..."
              value={reasonForGuest}
              onChange={(e) => setReasonForGuest(e.target.value)}
              className="admin-textarea"
            />
          </div>

          {/* Optional Internal Staff Notes */}
          <div className="admin-cancel-optional-notes">
            <label htmlFor="admin-cancellation-notes">
              <b>3. Internal Administrative Notes (Optional)</b>
              <small className="field-hint">Internal operational notes for hotel staff records.</small>
            </label>
            <textarea
              id="admin-cancellation-notes"
              rows={2}
              placeholder="Optional staff notes for management audit..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="admin-textarea"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="button button-outline"
              disabled={busy}
              onClick={onClose}
            >
              Keep Booking
            </button>
            <button
              type="submit"
              className="button button-danger"
              disabled={busy}
            >
              {busy ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminCancellationDetailsModal({ booking, onClose }) {
  if (!booking) return null;
  const isPaid = booking.paymentStatus === "paid";
  const paidAmount = Number(booking.totalAmount || 0);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal admin-cancellation-modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">CANCELLATION DETAILS</span>
            <h2>Booking #{booking._id?.slice(-8).toUpperCase()}</h2>
          </div>
          <button aria-label="Close" className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-cancellation-details-body">
          <div className="details-grid">
            <div className="details-item">
              <span className="details-label">Guest</span>
              <strong>{booking.user?.name || "Guest"}</strong>
              <small>{booking.user?.email || "No email"}</small>
            </div>
            <div className="details-item">
              <span className="details-label">Hotel &amp; Room</span>
              <strong>{booking.hotel?.name || "Hotel"}</strong>
              <small>{booking.room?.type} Room</small>
            </div>
            <div className="details-item">
              <span className="details-label">Stay Dates</span>
              <span>{new Date(booking.checkIn).toLocaleDateString()} – {new Date(booking.checkOut).toLocaleDateString()}</span>
            </div>
            <div className="details-item">
              <span className="details-label">Cancelled On</span>
              <span>{booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString() : "—"}</span>
            </div>
            <div className="details-item">
              <span className="details-label">Cancelled By</span>
              <strong style={{ color: booking.cancelledBy === "admin" ? "#965e52" : "#30362f" }}>
                {booking.cancelledBy === "admin"
                  ? `Hotel Administration (${booking.cancelledByAdmin?.name || booking.cancelledByAdmin?.email || "Admin"})`
                  : "Guest"}
              </strong>
            </div>
            <div className="details-item">
              <span className="details-label">Cancellation Category</span>
              <span>{booking.cancellationCategory || booking.cancellationReason || "—"}</span>
            </div>
          </div>

          <div className="details-box">
            <span className="details-label">Full Cancellation Reason</span>
            <p className="details-value-box">
              {booking.cancellationReason || "No explanation provided."}
            </p>
          </div>

          {booking.cancellationNotes && booking.cancellationNotes !== booking.cancellationReason && (
            <div className="details-box">
              <span className="details-label">Operational Notes</span>
              <p className="details-value-box muted">{booking.cancellationNotes}</p>
            </div>
          )}

          <div className="details-payment-section">
            <span className="details-label">Financial &amp; Refund Status</span>
            <div className="details-payment-summary">
              <div>
                <span>Total Amount:</span> <b>{formatRupees(paidAmount)}</b>
              </div>
              <div>
                <span>Payment Status:</span>{" "}
                <b className={isPaid ? "color-paid" : "color-unpaid"}>
                  {isPaid ? `Paid via ${booking.paymentMethod?.toUpperCase() || "Online"}` : booking.paymentStatus?.toUpperCase()}
                </b>
              </div>
              {isPaid && (
                <div>
                  <span>Refund Status:</span>{" "}
                  <b>
                    {booking.refundStatus === "refunded"
                      ? `Completed (${formatRupees(booking.refundAmount || paidAmount)})`
                      : booking.refundStatus === "processing"
                        ? `Processing (${formatRupees(booking.refundAmount || paidAmount)})`
                        : booking.refundStatus === "refund_initiated"
                          ? `Initiated (${formatRupees(booking.refundAmount || paidAmount)})`
                          : booking.refundStatus === "pending"
                            ? "Pending Approval"
                            : booking.refundStatus === "failed"
                              ? "Failed"
                              : booking.refundStatus === "no_refund"
                                ? "Cancelled - no refund (cancelled within 24 hours of check-in)"
                                : "No Refund"}
                  </b>
                </div>
              )}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="button button-dark" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AllBookingsPage() {
  const { data, loading, error, refresh, setError } = useAdminData("/bookings/admin/all");
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [viewingDetails, setViewingDetails] = useState(null);
  const [notice, setNotice] = useState("");

  const handleCancelSuccess = async () => {
    setCancellingBooking(null);
    setNotice("Booking successfully cancelled and reason recorded.");
    await refresh();
    setTimeout(() => setNotice(""), 4000);
  };

  return (
    <div className="admin-content">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">GUEST JOURNEYS</span>
          <h1>All bookings.</h1>
          <p>A closer look at the stays your guests are planning.</p>
        </div>
      </div>

      {notice && <div className="notice notice-success">{notice}</div>}
      {error && <div className="notice notice-error">{error}</div>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>GUEST</th>
              <th>HOTEL &amp; ROOM</th>
              <th>DATES</th>
              <th>AMOUNT &amp; PAYMENT</th>
              <th>STATUS &amp; CANCELLATION</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6">Loading bookings…</td></tr>
            ) : data.map((booking) => {
              const isCancelled = booking.status === "cancelled";
              const isPaid = booking.paymentStatus === "paid";
              const refundStage = getRefundStage(booking);

              return (
                <tr key={booking._id} className={isCancelled ? "row-cancelled" : ""}>
                  <td>
                    <b>{booking.user?.name || "Guest"}</b>
                    <small className="table-subline">{booking.user?.email}</small>
                  </td>
                  <td>
                    <b>{booking.hotel?.name || "—"}</b>
                    <small className="table-subline">{booking.room?.type} {booking.room?.roomNumber ? `· Rm ${booking.room.roomNumber}` : ""}</small>
                  </td>
                  <td>
                    {new Date(booking.checkIn).toLocaleDateString()}
                    <small className="table-subline">to {new Date(booking.checkOut).toLocaleDateString()}</small>
                  </td>
                  <td>
                    <b>{formatRupees(booking.totalAmount)}</b>
                    {booking.isEarlyBirdApplied && booking.discountAmount > 0 && (
                      <small className="table-subline" style={{ color: "#0d7a53", fontWeight: 600 }}>
                        Saved {formatRupees(booking.discountAmount)} ({booking.discountPercentage}% Early Bird)
                      </small>
                    )}
                    <div className="admin-payment-pill-wrap">
                      {isPaid ? (
                        <span className="admin-pay-badge admin-pay-badge-paid">
                          Paid: {formatRupees(booking.totalAmount)} ({booking.paymentMethod?.toUpperCase() || "ONLINE"})
                        </span>
                      ) : booking.paymentStatus === "pay_at_hotel" ? (
                        <span className="admin-pay-badge admin-pay-badge-hotel">Pay at Hotel</span>
                      ) : (
                        <span className="admin-pay-badge admin-pay-badge-unpaid">Unpaid</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="admin-status-cell">
                      <span className={`status-pill status-${booking.status}`}>
                        {booking.status[0].toUpperCase() + booking.status.slice(1)}
                      </span>

                      {isCancelled && (
                        <div className="admin-cancellation-card">
                          <div className="admin-cancel-meta">
                            <span className="admin-cancelled-by-tag">
                              {booking.cancelledBy === "admin"
                                ? `By Admin${booking.cancelledByAdmin?.name ? ` (${booking.cancelledByAdmin.name})` : ""}`
                                : "By Guest"}
                            </span>
                            {booking.cancelledAt && (
                              <span className="admin-cancelled-date">
                                {new Date(booking.cancelledAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })}
                              </span>
                            )}
                          </div>

                          <div className="admin-cancel-reason-line">
                            <span className="admin-cancel-reason-title">Reason:</span>
                            <span className="admin-cancel-reason-text">
                              {booking.cancellationReason || booking.cancellationCategory || "No reason specified"}
                            </span>
                          </div>

                          {booking.cancellationNotes && booking.cancellationNotes !== booking.cancellationReason && (
                            <div className="admin-cancel-notes-line">
                              <small>Note: {booking.cancellationNotes}</small>
                            </div>
                          )}

                          {/* Paid Booking Refund Status Badges */}
                          {isPaid && (
                            <div className="admin-cancel-refund-wrap">
                              {booking.refundStatus === "refunded" && (
                                <span className="refund-pill refund-pill-refunded">
                                  ✓ Refund Completed ({formatRupees(booking.refundAmount || booking.totalAmount)})
                                </span>
                              )}
                              {booking.refundStatus === "processing" && (
                                <span className="refund-pill refund-pill-processing">
                                  ⏳ Refund Processing ({formatRupees(booking.refundAmount || booking.totalAmount)})
                                </span>
                              )}
                              {booking.refundStatus === "refund_initiated" && (
                                <span className="refund-pill refund-pill-initiated">
                                  ⚡ Refund Initiated ({formatRupees(booking.refundAmount || booking.totalAmount)})
                                </span>
                              )}
                              {booking.refundStatus === "pending" && (
                                <span className="refund-pill refund-pill-pending">
                                  ⌛ Refund Pending Approval
                                </span>
                              )}
                              {booking.refundStatus === "failed" && (
                                <span className="refund-pill refund-pill-failed">
                                  ⚠️ Refund Failed
                                </span>
                              )}
                              {booking.refundStatus === "no_refund" && (
                                <span className="refund-pill refund-pill-norefund">
                                  Cancelled - no refund (cancelled within 24 hours of check-in)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      {booking.status === "confirmed" && (
                        <button
                          type="button"
                          className="delete-action"
                          onClick={() => setCancellingBooking(booking)}
                          title="Cancel booking"
                        >
                          Cancel
                        </button>
                      )}
                      {isCancelled && (
                        <button
                          type="button"
                          className="button-link-details"
                          onClick={() => setViewingDetails(booking)}
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && !data.length && (
          <div className="empty-state">
            <h3>No bookings yet.</h3>
            <p>Guest stays will appear here.</p>
          </div>
        )}
      </div>

      {cancellingBooking && (
        <AdminCancelBookingModal
          booking={cancellingBooking}
          onClose={() => setCancellingBooking(null)}
          onSuccess={handleCancelSuccess}
        />
      )}

      {viewingDetails && (
        <AdminCancellationDetailsModal
          booking={viewingDetails}
          onClose={() => setViewingDetails(null)}
        />
      )}
    </div>
  );
}


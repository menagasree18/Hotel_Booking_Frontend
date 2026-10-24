import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext";

export default function HotelCard({
  hotel,
  index = 0,
  variant = "grid",
  priceMode = "perNight",
  nights = 1,
  checkIn = ""
}) {
  const location = useLocation();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const isWishlisted = isInWishlist(hotel._id);
  const hotelUrl = `/hotels/${hotel._id}${location.search || ""}`;
  const image =
    hotel.imageUrl ||
    hotel.image ||
    `https://images.unsplash.com/photo-${
      ["1566073771259-6a8506099945", "1571896349842-33c89424de2d", "1542314831-068cd1dbfeeb"][index % 3]
    }?auto=format&fit=crop&w=1000&q=85`;

  const starCategory = Number(hotel.starCategory || 4);
  const rating = Number(hotel.rating || 4.5);
  const ratingCount = hotel.ratingCount || 0;
  const ratingText = rating >= 4.5 ? "Excellent" : rating >= 4.0 ? "Very Good" : rating >= 3.5 ? "Good" : "Fair";

  // Check Early Bird eligibility
  const searchParams = new URLSearchParams(location.search);
  const checkInDateStr = checkIn || searchParams.get("checkIn");
  const earlyBirdDiscount = Number(hotel.earlyBirdDiscount || 0);
  const earlyBirdDays = Number(hotel.earlyBirdDays || 7);

  let isEarlyBirdEligible = false;
  let daysInAdvance = null;

  if (earlyBirdDiscount > 0) {
    if (checkInDateStr) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cIn = new Date(`${checkInDateStr}T00:00:00`);
      cIn.setHours(0, 0, 0, 0);
      daysInAdvance = Math.ceil((cIn - today) / (1000 * 60 * 60 * 24));
      isEarlyBirdEligible = daysInAdvance >= earlyBirdDays;
    } else {
      isEarlyBirdEligible = true;
    }
  }

  const startingPrice = hotel.startingPrice !== undefined ? Number(hotel.startingPrice) : null;
  const originalPerNight = startingPrice;
  const discountedPerNight = (startingPrice !== null && isEarlyBirdEligible && earlyBirdDiscount > 0)
    ? Math.round(startingPrice * (1 - earlyBirdDiscount / 100))
    : startingPrice;
  const discountAmountPerNight = (startingPrice !== null) ? startingPrice - discountedPerNight : 0;

  const originalTotalPrice = startingPrice !== null ? startingPrice * nights : null;
  const discountedTotalPrice = discountedPerNight !== null ? discountedPerNight * nights : null;
  const totalDiscountAmount = discountAmountPerNight * nights;

  const displayOriginalPrice = priceMode === "total" && nights > 1 ? originalTotalPrice : originalPerNight;
  const displayFinalPrice = priceMode === "total" && nights > 1 ? discountedTotalPrice : discountedPerNight;
  const displaySavingsAmount = priceMode === "total" && nights > 1 ? totalDiscountAmount : discountAmountPerNight;

  // MakeMyTrip-inspired list card layout
  if (variant === "mmt" || variant === "list") {
    return (
      <article className="mmt-hotel-card">
        {/* Left Column: Image & Badges */}
        <div className="mmt-card-image-col">
          <Link to={hotelUrl} className="mmt-card-image-link">
            <img src={image} alt={hotel.name} loading="lazy" />
            <div className="mmt-image-badges">
              {hotel.propertyType && (
                <span className="mmt-badge mmt-badge-type">
                  {hotel.propertyType.toUpperCase()}
                </span>
              )}
              {hotel.tags?.includes("Beachfront Properties") && (
                <span className="mmt-badge mmt-badge-beach">BEACHFRONT</span>
              )}
              {earlyBirdDiscount > 0 && isEarlyBirdEligible ? (
                <span className="mmt-badge mmt-badge-deal">
                  {earlyBirdDiscount}% OFF EARLY BIRD
                </span>
              ) : earlyBirdDiscount > 0 ? (
                <span className="mmt-badge mmt-badge-info" title={`Requires booking ${earlyBirdDays}+ days in advance`}>
                  EARLY BIRD ({earlyBirdDiscount}%)
                </span>
              ) : null}
            </div>
          </Link>
          <button
            type="button"
            className={`hotel-card-wishlist-btn ${isWishlisted ? "is-wishlisted" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(hotel);
            }}
            title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <span className="heart-icon">{isWishlisted ? "♥" : "♡"}</span>
          </button>
        </div>

        {/* Center Column: Information, Stars, Location, Amenities */}
        <div className="mmt-card-info-col">
          <div className="mmt-card-header">
            <div className="mmt-card-title-wrap">
              <div className="mmt-meta-badge-row" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span className="mmt-star-display">{"★".repeat(starCategory)}</span>
                {hotel.propertyType && (
                  <span className="mmt-property-type-label" style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#354029",
                    background: "#e6ede1",
                    border: "1px solid #c9d8bf",
                    padding: "2px 7px",
                    borderRadius: "3px"
                  }}>
                    {hotel.propertyType}
                  </span>
                )}
              </div>
              <h3 className="mmt-card-name">
                <Link to={hotelUrl}>{hotel.name}</Link>
              </h3>
            </div>
            <div className="mmt-card-location">
              <span>📍 {hotel.subLocation || hotel.address || hotel.location}</span>
              {hotel.subLocation && hotel.location && (
                <span className="mmt-city-tag"> · {hotel.location}</span>
              )}
            </div>
          </div>

          {/* Rating Badge Row */}
          <div className="mmt-rating-row">
            <span className="mmt-rating-pill">
              ★ {rating.toFixed(1)} <small>/ 5</small>
            </span>
            <span className="mmt-rating-summary">
              <b>{ratingText}</b>
              {ratingCount > 0 && <small> ({ratingCount} reviews)</small>}
            </span>
          </div>

          {/* Key Amenities */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="mmt-amenities-row">
              {hotel.amenities.slice(0, 4).map((amenity, idx) => (
                <span key={idx} className="mmt-amenity-tag">
                  ✓ {amenity}
                </span>
              ))}
              {hotel.amenities.length > 4 && (
                <span className="mmt-amenity-more">+{hotel.amenities.length - 4} more</span>
              )}
            </div>
          )}

          {/* Perks Row (Free Cancellation, Instant Booking, Self Check-in) */}
          <div className="mmt-perks-row">
            {hotel.bookingPreferences?.includes("Free Cancellation") && (
              <span className="mmt-perk mmt-perk-free-cancel">Free Cancellation</span>
            )}
            {hotel.bookingPreferences?.includes("Instant Booking") && (
              <span className="mmt-perk mmt-perk-instant">⚡ Instant Booking</span>
            )}
            {hotel.houseRules?.includes("Self Check-In Available") && (
              <span className="mmt-perk mmt-perk-checkin">Self Check-In</span>
            )}
            {hotel.houseRules?.includes("Pets Allowed") && (
              <span className="mmt-perk mmt-perk-pets">🐾 Pets Allowed</span>
            )}
          </div>
        </div>

        {/* Right Column: Pricing & Action */}
        <div className="mmt-card-pricing-col">
          <div className="mmt-price-block">
            {startingPrice !== null ? (
              <>
                <span className="mmt-price-from-label">
                  {priceMode === "total" && nights > 1 ? "Total for Stay" : "Starts from"}
                </span>
                <div className="mmt-price-amount-wrap">
                  {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
                    <del className="mmt-price-original" title="Original price before Early Bird discount">
                      ₹{Number(displayOriginalPrice).toLocaleString("en-IN")}
                    </del>
                  )}
                  <div className="mmt-price-amount">
                    <b>
                      ₹{Number(displayFinalPrice).toLocaleString("en-IN")}
                    </b>
                    <span className="mmt-price-period">
                      {priceMode === "total" && nights > 1 ? ` / ${nights} nights` : " / night"}
                    </span>
                  </div>
                </div>

                {isEarlyBirdEligible && earlyBirdDiscount > 0 ? (
                  <div className="mmt-earlybird-savings-chip">
                    <span>⚡ Save ₹{Number(displaySavingsAmount).toLocaleString("en-IN")} ({earlyBirdDiscount}% Early Bird Deal)</span>
                  </div>
                ) : earlyBirdDiscount > 0 && !isEarlyBirdEligible ? (
                  <div className="mmt-earlybird-ineligible-note" title={`Book at least ${earlyBirdDays} days ahead to qualify for ${earlyBirdDiscount}% off`}>
                    <span>ℹ Book {earlyBirdDays}+ days ahead for {earlyBirdDiscount}% off</span>
                  </div>
                ) : null}

                {priceMode === "total" && nights > 1 ? (
                  <span className="mmt-price-subnote">
                    (₹{Number(discountedPerNight).toLocaleString("en-IN")} per night)
                  </span>
                ) : nights > 1 ? (
                  <span className="mmt-price-subnote">
                    ₹{Number(discountedTotalPrice).toLocaleString("en-IN")} total for {nights} nights
                  </span>
                ) : null}
                <span className="mmt-taxes-note">+ Taxes & fees included</span>
              </>
            ) : (
              <span className="mmt-price-check">Check room availability</span>
            )}

            {((hotel.matchingRoomsCount !== undefined && hotel.matchingRoomsCount > 0) || (hotel.rooms?.length > 0)) && (
              <span className="mmt-rooms-avail">
                {hotel.matchingRoomsCount ?? hotel.rooms?.length} {(hotel.matchingRoomsCount ?? hotel.rooms?.length) === 1 ? "room" : "rooms"} available
              </span>
            )}
          </div>

          <Link className="button button-dark mmt-view-hotel-btn" to={hotelUrl}>
            View Property ↗
          </Link>
        </div>
      </article>
    );
  }

  // Default Grid layout (Preserved for Home Page featured section)
  return (
    <article className="hotel-card">
      <div className="hotel-card-image-wrap">
        <Link to={hotelUrl} className="hotel-card-image">
          <img src={image} alt={hotel.name} loading="lazy" />
          <span className="image-tag">{hotel.propertyType ? hotel.propertyType.toUpperCase() : "A ROYAL NEST TO RETURN TO"}</span>
          <span className="image-arrow">↗</span>
        </Link>
        <button
          type="button"
          className={`hotel-card-wishlist-btn ${isWishlisted ? "is-wishlisted" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(hotel);
          }}
          title={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span className="heart-icon">{isWishlisted ? "♥" : "♡"}</span>
        </button>
      </div>
      <div className="hotel-card-info">
        <div>
          <span className="eyebrow">{hotel.propertyType ? `${hotel.propertyType} · ${hotel.location}` : hotel.location}</span>
          <h3><Link to={hotelUrl}>{hotel.name}</Link></h3>
        </div>
        <span className="rating">★ {rating.toFixed(1)}</span>
      </div>
      <p className="hotel-card-description">{hotel.description || "A considered stay in a place worth discovering."}</p>
      {hotel.startingPrice !== undefined && (
        <p className="hotel-card-price">
          From{" "}
          {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
            <del className="grid-price-original" title="Original price">
              ₹{Number(originalPerNight).toLocaleString("en-IN")}
            </del>
          )}{" "}
          <b>₹{Number(discountedPerNight).toLocaleString("en-IN")}</b> / night
          {isEarlyBirdEligible && earlyBirdDiscount > 0 && (
            <span className="grid-earlybird-badge"> · {earlyBirdDiscount}% OFF</span>
          )}
          {hotel.matchingRoomsCount !== undefined && hotel.matchingRoomsCount > 0 && (
            <span className="hotel-matching-rooms-pill"> · {hotel.matchingRoomsCount} {hotel.matchingRoomsCount === 1 ? "room" : "rooms"}</span>
          )}
        </p>
      )}
      <Link className="card-link" to={hotelUrl}>Explore hotel <span>→</span></Link>
    </article>
  );
}

export function RoomSearchResultCard({ room, index = 0 }) {
  const hotel = room.hotel || {};
  const image =
    room.image ||
    hotel.imageUrl ||
    hotel.image ||
    `https://images.unsplash.com/photo-${
      ["1566073771259-6a8506099945", "1571896349842-33c89424de2d", "1542314831-068cd1dbfeeb"][index % 3]
    }?auto=format&fit=crop&w=1000&q=85`;

  return (
    <article className="hotel-card room-search-card">
      <Link to={`/rooms/${room._id}`} className="hotel-card-image">
        <img src={image} alt={`${hotel.name || "Hotel"} - ${room.type} Room`} loading="lazy" />
        <span className={`image-tag room-type-tag room-type-${String(room.type).toLowerCase()}`}>
          {room.type?.toUpperCase()} ROOM
        </span>
        <span className="image-arrow">↗</span>
      </Link>
      <div className="hotel-card-info">
        <div>
          <span className="eyebrow">{hotel.location || "Distinctive Stay"}</span>
          <h3>
            <Link to={`/rooms/${room._id}`}>
              {room.type} Room · <small className="room-hotel-subtitle">{hotel.name}</small>
            </Link>
          </h3>
        </div>
        <span className="rating">★ {Number(hotel.rating || 4.7).toFixed(1)}</span>
      </div>
      <p className="hotel-card-description">
        {room.description || `A restful ${String(room.type).toLowerCase()} room at ${hotel.name || "this hotel"}, with everything you need.`}
      </p>
      <div className="room-price-capacity-row">
        <span className="room-capacity-badge">♧ Up to {room.capacity} {room.capacity === 1 ? "guest" : "guests"}</span>
        <span className="hotel-card-price">
          <b>₹{Number(room.pricePerNight).toLocaleString("en-IN")}</b> / night
        </span>
      </div>
      <div className="room-card-footer">
        <Link className="button button-dark room-book-action" to={`/booking/${room._id}`}>
          Book stay ↗
        </Link>
        <Link className="card-link" to={`/rooms/${room._id}`}>
          Room details →
        </Link>
      </div>
    </article>
  );
}

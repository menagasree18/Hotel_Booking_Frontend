import React, { useState } from "react";

export const PROPERTY_TYPES = [
  "Villa",
  "Apartment",
  "Hotel",
  "Resort",
  "Homestay",
  "Guest House",
  "Cottage"
];

export const STAR_CATEGORIES = [5, 4, 3];

export const AMENITIES_LIST = [
  "Swimming Pool",
  "Gym",
  "Wi-Fi",
  "Breakfast Included",
  "Parking",
  "Air Conditioning"
];

export const FOR_YOU_OPTIONS = [
  "Early Bird Deals",
  "5 Star",
  "Self Check-In Available",
  "Beachfront Properties"
];

export const BOOKING_PREFERENCES = [
  "Free Cancellation",
  "Instant Booking",
  "Entire Villa/Apartment"
];

export const HOUSE_RULES = [
  "Pets Allowed",
  "Smoking Allowed",
  "Self Check-In Available"
];

export const RATING_OPTIONS = [
  { label: "4.5+ Excellent", min: 4.5 },
  { label: "4.0+ Very Good", min: 4.0 },
  { label: "3.5+ Good", min: 3.5 },
  { label: "3.0+ Fair", min: 3.0 }
];

export const PRICE_RANGES = [
  { id: "all", label: "Any price", min: "", max: "" },
  { id: "0-2500", label: "Up to ₹2,500", min: "0", max: "2500" },
  { id: "2500-5000", label: "₹2,500 - ₹5,000", min: "2500", max: "5000" },
  { id: "5000-10000", label: "₹5,000 - ₹10,000", min: "5000", max: "10000" },
  { id: "10000-15000", label: "₹10,000 - ₹15,000", min: "10000", max: "15000" },
  { id: "15000+", label: "₹15,000+", min: "15000", max: "" }
];

export default function FilterSidebar({
  filters,
  onFilterChange,
  onClearAll,
  activeCount = 0,
  facetCounts = {},
  topLocations = [],
  nights = 1,
  isOpenMobile = false,
  onCloseMobile = () => {}
}) {
  const [customMin, setCustomMin] = useState(filters.customMinPrice || "");
  const [customMax, setCustomMax] = useState(filters.customMaxPrice || "");

  const toggleArrayFilter = (field, value) => {
    const current = filters[field] || [];
    const exists = current.includes(value);
    const updated = exists ? current.filter((v) => v !== value) : [...current, value];
    onFilterChange({ ...filters, [field]: updated });
  };

  const handlePriceModeChange = (mode) => {
    onFilterChange({ ...filters, priceMode: mode });
  };

  const handleRangeClick = (range) => {
    setCustomMin(range.min);
    setCustomMax(range.max);
    onFilterChange({
      ...filters,
      priceRange: range.id,
      customMinPrice: range.min,
      customMaxPrice: range.max
    });
  };

  const handleApplyCustomPrice = (e) => {
    e.preventDefault();
    onFilterChange({
      ...filters,
      priceRange: "custom",
      customMinPrice: customMin,
      customMaxPrice: customMax
    });
  };

  const handleRatingSelect = (minVal) => {
    const nextVal = filters.minRating === minVal ? 0 : minVal;
    onFilterChange({ ...filters, minRating: nextVal });
  };

  const handleLocationSelect = (locName) => {
    const nextVal = filters.subLocation === locName ? "" : locName;
    onFilterChange({ ...filters, subLocation: nextVal });
  };

  return (
    <aside className={`mmt-sidebar ${isOpenMobile ? "mmt-sidebar-open" : ""}`}>
      <div className="mmt-sidebar-header">
        <div className="mmt-sidebar-title-row">
          <h3>Filters {activeCount > 0 && <span className="mmt-filter-badge">{activeCount}</span>}</h3>
          {activeCount > 0 && (
            <button type="button" className="mmt-clear-all-btn" onClick={onClearAll}>
              CLEAR ALL
            </button>
          )}
        </div>
        <button
          type="button"
          className="mmt-sidebar-close-btn"
          aria-label="Close filters"
          onClick={onCloseMobile}
        >
          ✕
        </button>
      </div>

      <div className="mmt-sidebar-scroll">
        {/* 1. FOR YOU */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">For You</h4>
          <div className="mmt-options-list">
            {FOR_YOU_OPTIONS.map((item) => {
              const checked = (filters.forYou || []).includes(item);
              const count = facetCounts.forYou?.[item] ?? 0;
              return (
                <label key={item} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("forYou", item)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text">{item}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 2. PRICE */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Price</h4>
          {/* Price Mode Toggle */}
          <div className="mmt-price-toggle-group">
            <button
              type="button"
              className={`mmt-toggle-pill ${filters.priceMode !== "total" ? "active" : ""}`}
              onClick={() => handlePriceModeChange("perNight")}
            >
              Per Night
            </button>
            <button
              type="button"
              className={`mmt-toggle-pill ${filters.priceMode === "total" ? "active" : ""}`}
              onClick={() => handlePriceModeChange("total")}
            >
              Total Stay ({nights} {nights === 1 ? "night" : "nights"})
            </button>
          </div>

          {/* Quick Price Ranges */}
          <div className="mmt-options-list mmt-price-range-list">
            {PRICE_RANGES.map((range) => {
              const selected = filters.priceRange === range.id;
              return (
                <button
                  key={range.id}
                  type="button"
                  className={`mmt-range-pill ${selected ? "active" : ""}`}
                  onClick={() => handleRangeClick(range)}
                >
                  {range.label}
                </button>
              );
            })}
          </div>

          {/* Custom Min / Max Inputs */}
          <form className="mmt-custom-price-form" onSubmit={handleApplyCustomPrice}>
            <div className="mmt-price-inputs-row">
              <div className="mmt-price-field">
                <span className="mmt-price-currency">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Min"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  aria-label="Minimum price"
                />
              </div>
              <span className="mmt-price-dash">—</span>
              <div className="mmt-price-field">
                <span className="mmt-price-currency">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  aria-label="Maximum price"
                />
              </div>
            </div>
            <button type="submit" className="button button-outline mmt-price-apply-btn">
              Apply Price
            </button>
          </form>
        </div>

        {/* 3. STAR CATEGORY */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Star Category</h4>
          <div className="mmt-options-list">
            {STAR_CATEGORIES.map((stars) => {
              const checked = (filters.starCategory || []).includes(stars);
              const count = facetCounts.starCategory?.[stars] ?? 0;
              return (
                <label key={stars} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("starCategory", stars)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text mmt-stars-text">
                    {stars} Star <span className="mmt-star-icons">{"★".repeat(stars)}</span>
                  </span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 4. PROPERTY TYPE */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Property Type</h4>
          <div className="mmt-options-list">
            {PROPERTY_TYPES.map((type) => {
              const checked = (filters.propertyType || []).includes(type);
              const count = facetCounts.propertyType?.[type] ?? 0;
              return (
                <label key={type} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("propertyType", type)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text">{type}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 5. AMENITIES */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Amenities</h4>
          <div className="mmt-options-list">
            {AMENITIES_LIST.map((amenity) => {
              const checked = (filters.amenities || []).includes(amenity);
              const count = facetCounts.amenities?.[amenity] ?? 0;
              return (
                <label key={amenity} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("amenities", amenity)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text">{amenity}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 6. GUEST RATING */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Guest Rating</h4>
          <div className="mmt-options-list">
            {RATING_OPTIONS.map((opt) => {
              const selected = filters.minRating === opt.min;
              const count = facetCounts.ratings?.[opt.min] ?? 0;
              return (
                <button
                  key={opt.min}
                  type="button"
                  className={`mmt-rating-pill-btn ${selected ? "active" : ""}`}
                  onClick={() => handleRatingSelect(opt.min)}
                >
                  <span className="mmt-rating-num">{opt.min} ★</span>
                  <span className="mmt-rating-name">{opt.label.split(" ")[1]}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 7. BOOKING PREFERENCES */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">Booking Preferences</h4>
          <div className="mmt-options-list">
            {BOOKING_PREFERENCES.map((pref) => {
              const checked = (filters.bookingPreferences || []).includes(pref);
              const count = facetCounts.bookingPreferences?.[pref] ?? 0;
              return (
                <label key={pref} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("bookingPreferences", pref)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text">{pref}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 8. HOUSE RULES */}
        <div className="mmt-filter-section">
          <h4 className="mmt-section-title">House Rules</h4>
          <div className="mmt-options-list">
            {HOUSE_RULES.map((rule) => {
              const checked = (filters.houseRules || []).includes(rule);
              const count = facetCounts.houseRules?.[rule] ?? 0;
              return (
                <label key={rule} className="mmt-checkbox-label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArrayFilter("houseRules", rule)}
                  />
                  <span className="mmt-checkbox-custom" />
                  <span className="mmt-option-text">{rule}</span>
                  {count > 0 && <span className="mmt-option-count">({count})</span>}
                </label>
              );
            })}
          </div>
        </div>

        {/* 9. TOP LOCATIONS */}
        {topLocations && topLocations.length > 0 && (
          <div className="mmt-filter-section">
            <h4 className="mmt-section-title">Top Locations</h4>
            <div className="mmt-options-list">
              {topLocations.map((loc) => {
                const selected = filters.subLocation === loc.name;
                return (
                  <button
                    key={loc.name}
                    type="button"
                    className={`mmt-location-chip ${selected ? "active" : ""}`}
                    onClick={() => handleLocationSelect(loc.name)}
                  >
                    <span>{loc.name}</span>
                    <span className="mmt-option-count">({loc.count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isOpenMobile && (
        <div className="mmt-mobile-actions">
          <button type="button" className="button button-dark mmt-mobile-apply" onClick={onCloseMobile}>
            View Matching Properties
          </button>
        </div>
      )}
    </aside>
  );
}

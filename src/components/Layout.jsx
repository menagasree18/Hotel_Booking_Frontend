import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, signOut } = useAuth();
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="wordmark" to={user?.role === "admin" ? "/admin" : "/"} aria-label="Hotel Booking home">
          <span className="wordmark-mark">H</span><span>Haven<span className="wordmark-light"> &amp; Co.</span></span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {user?.role !== "admin" && (
            <>
              <NavLink to="/">Stay</NavLink>
              <NavLink to="/hotels">Discover</NavLink>
              {user?.role === "user" && <NavLink to="/bookings">My stays</NavLink>}
              {user?.role === "user" && <NavLink to="/wishlist">Wishlist</NavLink>}
            </>
          )}
          {user?.role === "admin" && (  
            <>
              <NavLink to="/admin">Admin Dashboard</NavLink>
              <NavLink to="/admin/hotels">Manage Hotels</NavLink>
              <NavLink to="/admin/rooms">Manage Rooms</NavLink>
              <NavLink to="/admin/bookings">All Bookings</NavLink>
            </>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              {user.role === "admin" && <Link className="button button-dark header-cta" to="/admin/hotels">Add Hotel</Link>}
              {user.role !== "admin" && (
                <Link className="header-user" to="/profile">
                  <span className="avatar">{user.name?.[0]?.toUpperCase()}</span>
                  <span>{user.name?.split(" ")[0]}</span>
                </Link>
              )}
              <button className="text-button signout-button" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <><Link className="text-button" to="/login">Sign in</Link><Link className="button button-dark header-cta" to="/register">Join us</Link></>
          )}
        </div>
      </header>
      <main className="page-content"><Outlet /></main>
      <footer className="site-footer">
        <Link className="wordmark footer-brand" to={user?.role === "admin" ? "/admin" : "/"}><span className="wordmark-mark">H</span><span>Haven<span className="wordmark-light"> &amp; Co.</span></span></Link>
        <span>Thoughtful stays, beautifully found.</span>
        {/* <Link to="/admin/login">Staff access</Link> */}
      </footer>
      <nav className="mobile-bar" aria-label="Mobile navigation">
        {user?.role === "admin" ? (
          <>
            <NavLink to="/admin"><span>⌂</span>Dashboard</NavLink>
            <NavLink to="/admin/hotels"><span>🏨</span>Hotels</NavLink>
            <NavLink to="/admin/rooms"><span>🛏</span>Rooms</NavLink>
            <NavLink to="/admin/bookings"><span>📋</span>Bookings</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/"><span>⌂</span>Home</NavLink>
            <NavLink to="/hotels"><span>⌕</span>Search</NavLink>
            {user?.role === "user" && <NavLink to="/wishlist"><span>♥</span>Wishlist</NavLink>}
            <NavLink to={user ? "/profile" : "/login"}><span>◯</span>Profile</NavLink>
          </>
        )}
      </nav>
    </div>
  );
}

export function AdminLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand"><span className="wordmark-mark">H</span> Haven &amp; Co.</Link>
        <span className="sidebar-caption">WORKSPACE</span>
        <NavLink end to="/admin">Overview</NavLink>
        <NavLink to="/admin/hotels">Manage hotels</NavLink>
        <NavLink to="/admin/rooms">Manage rooms</NavLink>
        <NavLink to="/admin/bookings">All bookings</NavLink>
        <NavLink to="/admin/reviews">Guest reviews</NavLink>
        
        {/* <Link className="sidebar-back" to="/">← Back to website</Link> */}
        <button className="sidebar-signout" onClick={signOut}>Sign out · {user?.name}</button>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
}

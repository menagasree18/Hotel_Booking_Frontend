import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getData } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("hotelUser")) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem("hotelToken");
    if (!token) return;
    api.get("/auth/me").then((response) => {
      const currentUser = getData(response).user;
      setUser(currentUser);
      localStorage.setItem("hotelUser", JSON.stringify(currentUser));
    }).catch(() => {
      localStorage.removeItem("hotelToken");
      localStorage.removeItem("hotelUser");
      setUser(null);
    });
  }, []);

  const signIn = async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    const data = getData(response);
    saveSession(data);
    return data.user;
  };
  const register = async (details) => {
    const response = await api.post("/auth/register", details);
    const data = getData(response);
    saveSession(data);
    return data.user;
  };
  const saveSession = ({ token, user: nextUser }) => {
    localStorage.setItem("hotelToken", token);
    localStorage.setItem("hotelUser", JSON.stringify(nextUser));
    setUser(nextUser);
  };
  const signOut = () => {
    const loginPath = user?.role === "admin" ? "/admin/login" : "/login";
    localStorage.removeItem("hotelToken");
    localStorage.removeItem("hotelUser");
    setUser(null);
    navigate(loginPath, { replace: true });
  };

  return <AuthContext.Provider value={{ user, signIn, register, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

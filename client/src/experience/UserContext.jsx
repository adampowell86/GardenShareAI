import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Auth, AUTH_EVENT, isApiOrigin } from "../api.js";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [providerStatus, setProviderStatus] = useState([]);
  const [socialError, setSocialError] = useState("");

  const refreshUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const me = await Auth.me();
      setUser(me);
    } catch (err) {
      console.error("Failed to refresh user", err);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    Auth.csrf().catch(() => {});
  }, []);

  useEffect(() => {
    Auth.providers()
      .then((list) => setProviderStatus(list || []))
      .catch(() => setProviderStatus([]));
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (!isApiOrigin(event.origin)) return;
      if (event.data?.type === "oauth-success") {
        setSocialError("");
        refreshUser();
      }
      if (event.data?.type === "oauth-error") {
        setSocialError(event.data.message || "Social login failed");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refreshUser]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
    };

    window.addEventListener(AUTH_EVENT, handler);
    return () => window.removeEventListener(AUTH_EVENT, handler);
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      refreshUser,
      loadingUser,
      providerStatus,
      socialError,
      setSocialError,
    }),
    [user, refreshUser, loadingUser, providerStatus, socialError]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}

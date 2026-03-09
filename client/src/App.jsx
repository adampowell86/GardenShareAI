import React, { useState } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import HavePage from "./HavePage.jsx";
import SuggestionsPage from "./pages/SuggestionsPage.jsx";
import NeedPage from "./pages/NeedPage.jsx";
import TradesPage from "./TradesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import TimingPage from "./pages/TimingPage.jsx";
import GardensPage from "./pages/GardensPage.jsx";
import PlantsPage from "./pages/PlantsPage.jsx";
import { Auth } from "./api.js";
import { useUser } from "./experience/UserContext.jsx";
import OnboardingPanel from "./components/OnboardingPanel.jsx";

export default function App() {
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoMissing, setLogoMissing] = useState(false);
  const [logoIndex, setLogoIndex] = useState(0);
  const logoSources = ["/logo.png", "/logo.jpg", "/logo.svg"];
  const logoSrc = logoSources[Math.min(logoIndex, logoSources.length - 1)];
  const pendingTrades = user?.pendingTrades || 0;

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await Auth.logout();
      setUser(null);
    } catch (e) {
      console.error("Failed to log out", e);
    } finally {
      setLoggingOut(false);
      if (window.location.pathname === "/") {
        window.location.reload();
      } else {
        navigate("/");
      }
    }
  }

  return (
    <div className="app-shell">
      <header className="primary-nav">
        <div className="brand">
          {!logoMissing ? (
            <img
              src={logoSrc}
              alt="GardenShare logo"
              onError={() => {
                if (logoIndex < logoSources.length - 1) {
                  setLogoIndex((idx) => idx + 1);
                } else {
                  setLogoMissing(true);
                }
              }}
            />
          ) : (
            <div className="logo-fallback" aria-label="GardenShare logo">
              GS
            </div>
          )}
          <div className="brand-text">
            <div className="brand-name">GardenShare AI</div>
            <div className="brand-tagline">Grow, swap, thrive</div>
          </div>
        </div>
        <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
          Have
        </NavLink>
        <NavLink to="/need" className={({ isActive }) => (isActive ? "active" : "")}>
          Need
        </NavLink>
        <NavLink to="/suggestions" className={({ isActive }) => (isActive ? "active" : "")}>
          Suggestions
        </NavLink>
        <NavLink to="/timing" className={({ isActive }) => (isActive ? "active" : "")}>
          Timing
        </NavLink>
        <NavLink to="/trades" className={({ isActive }) => (isActive ? "active" : "")}>
          Trades
          {pendingTrades > 0 && <span className="nav-badge">{pendingTrades}</span>}
        </NavLink>
        <NavLink to="/gardens" className={({ isActive }) => (isActive ? "active" : "")}>
          Gardens
        </NavLink>
        <NavLink to="/plants" className={({ isActive }) => (isActive ? "active" : "")}>
          Plants
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
          Profile
        </NavLink>
        <span className="nav-spacer" />
        {user && (
          <div className="nav-user">
            <div className="nav-dot" />
            <div>
              <div className="nav-email">{user.displayName || user.email}</div>
              {user?.onboarding && (
                <div className="nav-onboarding">
                  {user.onboarding.completed ? "Test-ready" : `${user.onboarding.progress}% ready`}
                </div>
              )}
            </div>
          </div>
        )}
        {user ? (
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="nav-button"
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        ) : (
          <NavLink to="/" className="nav-button secondary">
            Login
          </NavLink>
        )}
      </header>

      {user && (
        <div className="page">
          <OnboardingPanel onboarding={user?.onboarding} />
        </div>
      )}

      <Routes>
        <Route path="/" element={<HavePage />} />
        <Route path="/need" element={<NeedPage />} />
        <Route path="/suggestions" element={<SuggestionsPage />} />
        <Route path="/timing" element={<TimingPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/gardens" element={<GardensPage />} />
        <Route path="/plants" element={<PlantsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </div>
  );
}

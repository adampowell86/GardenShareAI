import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";
import App from "../App.jsx";

vi.mock("../experience/UserContext.jsx", () => ({
  useUser: () => ({
    user: { email: "tester@example.com", pendingTrades: 2, onboarding: { completed: false, progress: 40 } },
    setUser: vi.fn(),
    refreshUser: vi.fn(),
    loadingUser: false,
    providerStatus: [],
    socialError: "",
    setSocialError: vi.fn(),
  }),
}));

vi.mock("../api.js", () => ({
  API_BASE: "http://localhost:4000",
  INVENTORY_EVENT: "inventory:changed",
  Auth: { logout: vi.fn(), login: vi.fn(), signup: vi.fn() },
  Inventory: { list: vi.fn().mockResolvedValue([]), createHave: vi.fn(), update: vi.fn(), delete: vi.fn() },
  Plants: { list: vi.fn().mockResolvedValue([]) },
  emitInventoryChanged: vi.fn(),
  Trades: { list: vi.fn().mockResolvedValue([]), accept: vi.fn(), reject: vi.fn(), cancel: vi.fn() },
}));

describe("App shell", () => {
  it("renders nav links and pending trade badge", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText("Trades")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Have")).toBeInTheDocument();
    expect(screen.getByText("Need")).toBeInTheDocument();
  });
});

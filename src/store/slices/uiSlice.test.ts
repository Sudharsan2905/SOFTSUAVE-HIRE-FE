/**
 * uiSlice tests — theme and sidebar state management.
 *
 * Each test builds its own isolated store with a known preloaded state so
 * that tests are fully independent (no shared mutable state).
 *
 * Side-effects tested:
 *  – localStorage persistence of theme
 *  – document.documentElement.setAttribute("data-theme", …)
 */
import { describe, it, expect } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import uiReducer, { toggleTheme, setTheme, toggleSidebar } from "./uiSlice";

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

type UIPreload = { ui: { theme: "light" | "dark"; sidebarCollapsed: boolean } };

function makeStore(preloadedState?: UIPreload) {
  return configureStore({
    reducer: { ui: uiReducer },
    preloadedState,
  });
}

const LIGHT_STORE = (): ReturnType<typeof makeStore> =>
  makeStore({ ui: { theme: "light", sidebarCollapsed: false } });

const DARK_STORE = (): ReturnType<typeof makeStore> =>
  makeStore({ ui: { theme: "dark", sidebarCollapsed: false } });

// ---------------------------------------------------------------------------
// toggleTheme
// ---------------------------------------------------------------------------

describe("uiSlice — toggleTheme", () => {
  it("switches from light to dark", () => {
    const store = LIGHT_STORE();
    store.dispatch(toggleTheme());
    expect(store.getState().ui.theme).toBe("dark");
  });

  it("switches from dark to light", () => {
    const store = DARK_STORE();
    store.dispatch(toggleTheme());
    expect(store.getState().ui.theme).toBe("light");
  });

  it("alternates correctly on successive dispatches", () => {
    const store = LIGHT_STORE();
    store.dispatch(toggleTheme()); // dark
    store.dispatch(toggleTheme()); // light
    store.dispatch(toggleTheme()); // dark
    expect(store.getState().ui.theme).toBe("dark");
  });

  it("persists the new theme to localStorage (key: ssh_theme)", () => {
    const store = LIGHT_STORE();
    store.dispatch(toggleTheme());
    expect(localStorage.getItem("ssh_theme")).toBe("dark");
  });

  it("sets data-theme on document.documentElement", () => {
    const store = LIGHT_STORE();
    store.dispatch(toggleTheme());
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// setTheme
// ---------------------------------------------------------------------------

describe("uiSlice — setTheme", () => {
  it("sets theme to dark directly", () => {
    const store = LIGHT_STORE();
    store.dispatch(setTheme("dark"));
    expect(store.getState().ui.theme).toBe("dark");
  });

  it("sets theme to light directly", () => {
    const store = DARK_STORE();
    store.dispatch(setTheme("light"));
    expect(store.getState().ui.theme).toBe("light");
  });

  it("is idempotent — setting the same theme again changes nothing", () => {
    const store = LIGHT_STORE();
    store.dispatch(setTheme("light"));
    store.dispatch(setTheme("light"));
    expect(store.getState().ui.theme).toBe("light");
  });

  it("persists the chosen theme to localStorage", () => {
    const store = LIGHT_STORE();
    store.dispatch(setTheme("dark"));
    expect(localStorage.getItem("ssh_theme")).toBe("dark");
  });

  it("updates data-theme on document.documentElement", () => {
    const store = DARK_STORE();
    store.dispatch(setTheme("light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

// ---------------------------------------------------------------------------
// toggleSidebar
// ---------------------------------------------------------------------------

describe("uiSlice — toggleSidebar", () => {
  it("collapses the sidebar when it is currently expanded", () => {
    const store = makeStore({ ui: { theme: "light", sidebarCollapsed: false } });
    store.dispatch(toggleSidebar());
    expect(store.getState().ui.sidebarCollapsed).toBe(true);
  });

  it("expands the sidebar when it is currently collapsed", () => {
    const store = makeStore({ ui: { theme: "light", sidebarCollapsed: true } });
    store.dispatch(toggleSidebar());
    expect(store.getState().ui.sidebarCollapsed).toBe(false);
  });

  it("alternates correctly on successive dispatches", () => {
    const store = makeStore({ ui: { theme: "light", sidebarCollapsed: false } });
    store.dispatch(toggleSidebar()); // collapsed
    store.dispatch(toggleSidebar()); // expanded
    expect(store.getState().ui.sidebarCollapsed).toBe(false);
  });
});

/**
 * Centralised test utilities.
 *
 * Usage:
 *   import { renderWithProviders, makeStore } from "@/test/utils";
 *
 * renderWithProviders wraps the given UI with:
 *   – Redux Provider (real reducers, configurable preloaded state)
 *   – MemoryRouter   (configurable initial entries & path)
 *   – Suspense       (captures lazy-loaded components)
 *
 * The returned object spreads the standard RTL render result and also
 * exposes `store` so tests can inspect post-render state.
 */
import React, { PropsWithChildren, Suspense } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { MemoryRouter, MemoryRouterProps } from "react-router-dom";

import authReducer from "@/store/slices/authSlice";
import workspaceReducer from "@/store/slices/workspaceSlice";
import uiReducer from "@/store/slices/uiSlice";
import notificationReducer from "@/store/slices/notificationSlice";
import proctoringReducer from "@/store/slices/proctoringSlice";
import type { RootState } from "@/store";

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function makeStore(preloadedState: Partial<RootState> = {}) {
  return configureStore({
    reducer: {
      auth: authReducer,
      workspace: workspaceReducer,
      ui: uiReducer,
      notifications: notificationReducer,
      proctoring: proctoringReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }),
    preloadedState: preloadedState as Parameters<typeof configureStore>[0]["preloadedState"],
  });
}

export type TestStore = ReturnType<typeof makeStore>;

// ---------------------------------------------------------------------------
// Custom render
// ---------------------------------------------------------------------------

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: Partial<RootState>;
  routerProps?: MemoryRouterProps;
  /** Pass a pre-built store when you need to share it across multiple renders. */
  store?: TestStore;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    routerProps = {},
    store: externalStore,
    ...renderOptions
  }: RenderWithProvidersOptions = {}
) {
  const store = externalStore ?? makeStore(preloadedState);

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <MemoryRouter {...routerProps}>
          <Suspense fallback={<div data-testid="suspense-fallback">Loading…</div>}>
            {children}
          </Suspense>
        </MemoryRouter>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

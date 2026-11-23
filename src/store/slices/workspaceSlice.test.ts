import { describe, it, expect, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import workspaceReducer, {
  setActiveWorkspace,
  setWorkspaces,
  clearWorkspace,
} from "./workspaceSlice";
import type { Workspace } from "@/types";

const WORKSPACE_KEY = "talentia_workspace";

function makeStore(preloadedState?: Partial<{ workspace: ReturnType<typeof workspaceReducer> }>) {
  return configureStore({
    // @ts-expect-error RTK 2.x preloadedState inference requires undefined in reducer type
    reducer: { workspace: workspaceReducer },
    ...(preloadedState && { preloadedState }),
  });
}

const ws1: Workspace = {
  id: "ws-1",
  name: "Engineering",
  description: "Eng team",
  members: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  created_by: "user-1",
};

const ws2: Workspace = {
  id: "ws-2",
  name: "Design",
  description: "Design team",
  members: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  created_by: "user-1",
};

describe("workspaceSlice — reducers", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe("initial state", () => {
    it("starts with no active workspace and empty list when sessionStorage is empty", () => {
      const store = makeStore();
      const state = store.getState().workspace;
      expect(state.activeWorkspace).toBeNull();
      expect(state.workspaces).toEqual([]);
    });

    // Note: loadFromStorage() runs once at module import (not per store creation),
    // so restoring activeWorkspace from sessionStorage on init cannot be exercised
    // after import. Persistence is covered by the setActiveWorkspace + clearWorkspace tests.

    it("returns null when sessionStorage value is invalid JSON", () => {
      sessionStorage.setItem(WORKSPACE_KEY, "not-valid-json");
      const store = makeStore();
      expect(store.getState().workspace.activeWorkspace).toBeNull();
    });
  });

  describe("setActiveWorkspace", () => {
    it("sets the activeWorkspace in state", () => {
      const store = makeStore();
      store.dispatch(setActiveWorkspace(ws1));
      expect(store.getState().workspace.activeWorkspace).toEqual(ws1);
    });

    it("persists activeWorkspace to sessionStorage", () => {
      const store = makeStore();
      store.dispatch(setActiveWorkspace(ws1));
      expect(JSON.parse(sessionStorage.getItem(WORKSPACE_KEY) ?? "null")).toEqual(ws1);
    });

    it("replaces a previously-set workspace", () => {
      const store = makeStore();
      store.dispatch(setActiveWorkspace(ws1));
      store.dispatch(setActiveWorkspace(ws2));
      expect(store.getState().workspace.activeWorkspace).toEqual(ws2);
    });
  });

  describe("setWorkspaces", () => {
    it("replaces the workspaces list", () => {
      const store = makeStore();
      store.dispatch(setWorkspaces([ws1, ws2]));
      expect(store.getState().workspace.workspaces).toEqual([ws1, ws2]);
    });

    it("accepts an empty array", () => {
      const store = makeStore();
      store.dispatch(setWorkspaces([ws1]));
      store.dispatch(setWorkspaces([]));
      expect(store.getState().workspace.workspaces).toEqual([]);
    });
  });

  describe("clearWorkspace", () => {
    it("resets activeWorkspace to null", () => {
      const store = makeStore();
      store.dispatch(setActiveWorkspace(ws1));
      store.dispatch(clearWorkspace());
      expect(store.getState().workspace.activeWorkspace).toBeNull();
    });

    it("resets workspaces to empty array", () => {
      const store = makeStore();
      store.dispatch(setWorkspaces([ws1, ws2]));
      store.dispatch(clearWorkspace());
      expect(store.getState().workspace.workspaces).toEqual([]);
    });

    it("removes the workspace key from sessionStorage", () => {
      sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws1));
      const store = makeStore();
      store.dispatch(clearWorkspace());
      expect(sessionStorage.getItem(WORKSPACE_KEY)).toBeNull();
    });
  });

  describe("auth/logout action", () => {
    it("resets workspace state when auth/logout is dispatched", () => {
      const store = makeStore();
      store.dispatch(setActiveWorkspace(ws1));
      store.dispatch(setWorkspaces([ws1, ws2]));
      store.dispatch({ type: "auth/logout" });
      const state = store.getState().workspace;
      expect(state.activeWorkspace).toBeNull();
      expect(state.workspaces).toEqual([]);
    });

    it("removes workspace from sessionStorage on auth/logout", () => {
      sessionStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws1));
      const store = makeStore();
      store.dispatch({ type: "auth/logout" });
      expect(sessionStorage.getItem(WORKSPACE_KEY)).toBeNull();
    });
  });
});

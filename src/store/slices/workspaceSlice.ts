import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Workspace } from "@/types";

interface WorkspaceState {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
}

const WORKSPACE_KEY = "ssh_workspace";

const savedWorkspace = (): Workspace | null => {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "null");
  } catch {
    return null;
  }
};

const initialState: WorkspaceState = {
  activeWorkspace: savedWorkspace(),
  workspaces: [],
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setActiveWorkspace(state, action: PayloadAction<Workspace>) {
      state.activeWorkspace = action.payload;
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(action.payload));
    },
    setWorkspaces(state, action: PayloadAction<Workspace[]>) {
      state.workspaces = action.payload;
    },
    clearWorkspace(state) {
      state.activeWorkspace = null;
      state.workspaces = [];
      localStorage.removeItem(WORKSPACE_KEY);
    },
  },
  extraReducers: (builder) => {
    builder.addCase("auth/logout", (state) => {
      state.activeWorkspace = null;
      state.workspaces = [];
      localStorage.removeItem(WORKSPACE_KEY);
    });
  },
});

export const { setActiveWorkspace, setWorkspaces, clearWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;

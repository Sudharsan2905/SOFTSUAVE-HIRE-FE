import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Workspace } from "@/types";

const WORKSPACE_KEY = "ssh_workspace";
const AUTH_LOGOUT_ACTION = "auth/logout";

interface WorkspaceState {
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
}

const savedWorkspace = (): Workspace | null => {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? "null");
  } catch {
    return null;
  }
};

function resetWorkspaceState(state: WorkspaceState) {
  state.activeWorkspace = null;
  state.workspaces = [];
  localStorage.removeItem(WORKSPACE_KEY);
}

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
      resetWorkspaceState(state);
    },
  },
  extraReducers: (builder) => {
    builder.addCase(AUTH_LOGOUT_ACTION, (state) => {
      resetWorkspaceState(state);
    });
  },
});

export const { setActiveWorkspace, setWorkspaces, clearWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;

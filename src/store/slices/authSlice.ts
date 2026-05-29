import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { User } from "@/types";
import { api } from "@/utils/api";
import toast from "react-hot-toast";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const TOKEN_KEY = "ssh_access";
const REFRESH_KEY = "ssh_refresh";
const USER_KEY = "ssh_user";

const loadFromStorage = (): Partial<AuthState> => {
  try {
    return {
      accessToken: localStorage.getItem(TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: JSON.parse(localStorage.getItem(USER_KEY) || "null"),
      isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
    };
  } catch {
    return {};
  }
};

export const adminLogin = createAsyncThunk(
  "auth/adminLogin",
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/auth/admin/login", payload);
      return data.data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Login failed";
      return rejectWithValue(msg);
    }
  }
);

export const candidateLogin = createAsyncThunk(
  "auth/candidateLogin",
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/auth/login", payload);
      return data.data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Login failed";
      return rejectWithValue(msg);
    }
  }
);

export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (credential: string, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/auth/google", { credential });
      return data.data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Google login failed";
      return rejectWithValue(msg);
    }
  }
);

export const candidateRegister = createAsyncThunk(
  "auth/candidateRegister",
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/api/auth/register", payload);
      return data.data;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Registration failed";
      return rejectWithValue(msg);
    }
  }
);

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  ...loadFromStorage(),
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      if (state.refreshToken) {
        api.post("/api/auth/logout", { refresh_token: state.refreshToken }).catch(() => {
          // best-effort: ignore logout API errors, user is already logged out locally
        });
      }
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    },
    setTokens(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem(TOKEN_KEY, action.payload.accessToken);
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload));
    },
  },
  extraReducers: (builder) => {
    const handleAuthFulfilled = (
      state: AuthState,
      action: PayloadAction<{ access_token: string; refresh_token: string; user: User }>
    ) => {
      state.isLoading = false;
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      localStorage.setItem(TOKEN_KEY, action.payload.access_token);
      localStorage.setItem(REFRESH_KEY, action.payload.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(action.payload.user));
    };

    builder
      .addCase(adminLogin.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(adminLogin.fulfilled, handleAuthFulfilled)
      .addCase(adminLogin.rejected, (state, action) => {
        state.isLoading = false;
        toast.error(action.payload as string);
      })
      .addCase(candidateLogin.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(candidateLogin.fulfilled, handleAuthFulfilled)
      .addCase(candidateLogin.rejected, (state, action) => {
        state.isLoading = false;
        toast.error(action.payload as string);
      })
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(googleLogin.fulfilled, handleAuthFulfilled)
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        toast.error(action.payload as string);
      })
      .addCase(candidateRegister.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(candidateRegister.fulfilled, handleAuthFulfilled)
      .addCase(candidateRegister.rejected, (state, action) => {
        state.isLoading = false;
        toast.error(action.payload as string);
      });
  },
});

export const { logout, setTokens, updateUser } = authSlice.actions;
export default authSlice.reducer;

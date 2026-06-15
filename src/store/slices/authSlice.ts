import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { User } from "@/types";
import { api, extractApiErrorMessage } from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { LOCAL_STORAGE_KEYS } from "@/constants/storage";
import toast from "react-hot-toast";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const loadFromStorage = (): Partial<AuthState> => {
  try {
    return {
      accessToken: localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN),
      refreshToken: localStorage.getItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN),
      user: JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.USER) ?? "null"),
      isAuthenticated: !!localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN),
    };
  } catch {
    return {};
  }
};

export const adminLogin = createAsyncThunk(
  "auth/adminLogin",
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(API_ENDPOINTS.AUTH.ADMIN_LOGIN, payload);
      return data.data;
    } catch (err: unknown) {
      return rejectWithValue(extractApiErrorMessage(err, "Login failed"));
    }
  }
);

export const candidateLogin = createAsyncThunk(
  "auth/candidateLogin",
  async (payload: { email: string; password: string; share_link?: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post(API_ENDPOINTS.AUTH.CANDIDATE_LOGIN, payload);
      return data.data;
    } catch (err: unknown) {
      return rejectWithValue(extractApiErrorMessage(err, "Login failed"));
    }
  }
);

export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async (credential: string, { rejectWithValue }) => {
    try {
      const { data } = await api.post(API_ENDPOINTS.AUTH.GOOGLE, { credential });
      return data.data;
    } catch (err: unknown) {
      return rejectWithValue(extractApiErrorMessage(err, "Google login failed"));
    }
  }
);

export const candidateRegister = createAsyncThunk(
  "auth/candidateRegister",
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const { data } = await api.post(API_ENDPOINTS.AUTH.CANDIDATE_REGISTER, payload);
      return data.data;
    } catch (err: unknown) {
      return rejectWithValue(extractApiErrorMessage(err, "Registration failed"));
    }
  }
);

type AuthPayload = { access_token: string; refresh_token: string; user: User };

function persistAuthData(state: AuthState, payload: AuthPayload) {
  state.isLoading = false;
  state.accessToken = payload.access_token;
  state.refreshToken = payload.refresh_token;
  state.user = payload.user;
  state.isAuthenticated = true;
  localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, payload.access_token);
  localStorage.setItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN, payload.refresh_token);
  localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(payload.user));
}

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
        api.post(API_ENDPOINTS.AUTH.LOGOUT, { refresh_token: state.refreshToken }).catch(() => {
          // best-effort: ignore logout API errors, user is already logged out locally
        });
      }
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
    },
    setTokens(state, action: PayloadAction<{ accessToken: string }>) {
      state.accessToken = action.payload.accessToken;
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, action.payload.accessToken);
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER, JSON.stringify(action.payload));
    },
    setAuthData(state, action: PayloadAction<AuthPayload>) {
      persistAuthData(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    const handleAuthFulfilled = (state: AuthState, action: PayloadAction<AuthPayload>) =>
      persistAuthData(state, action.payload);

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

export const { logout, setTokens, updateUser, setAuthData } = authSlice.actions;
export default authSlice.reducer;

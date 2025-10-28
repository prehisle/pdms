import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  User,
  login as apiLogin,
  logout as apiLogout,
  getCurrentUser,
  LoginRequest,
} from "../api/auth";

/**
 * Token 存储键名
 */
const TOKEN_KEY = "ydms_auth_token";

/**
 * AuthContext 状态
 */
interface AuthContextState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * AuthContext
 */
const AuthContext = createContext<AuthContextState | undefined>(undefined);

/**
 * AuthProvider props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider 组件
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    // 从 localStorage 读取 token
    return localStorage.getItem(TOKEN_KEY);
  });
  const [loading, setLoading] = useState(true);

  /**
   * 加载当前用户信息
   */
  const loadUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Failed to load user:", error);
      // Token 可能已过期，清除
      setToken(null);
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * 登录
   */
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      const response = await apiLogin(credentials);
      setToken(response.token);
      setUser(response.user);
      localStorage.setItem(TOKEN_KEY, response.token);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  /**
   * 登出
   */
  const logout = async (): Promise<void> => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  /**
   * 初始加载
   */
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  /**
   * 监听 401 未授权事件
   */
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(TOKEN_KEY);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const value: AuthContextState = {
    user,
    token,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook
 */
export function useAuth(): AuthContextState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

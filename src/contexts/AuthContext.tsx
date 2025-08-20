import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { AuthUser, LoginCredentials, Notification } from "../types";
import { showErrorToast, showSuccessToast } from "../components/ui/Toast";
import axios from "axios";

interface AuthContextType {
  user: AuthUser | null;
  login: (
    credentials: LoginCredentials
  ) => Promise<{ success: boolean; message?: string }>;
  loginWithUserData: (userData: AuthUser) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  updateProfile: (data: {
    photoFile?: File | null;
    [key: string]: any;
  }) => Promise<void>;
  showBirthdayBanner: boolean;
  hideBirthdayBanner: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBirthdayBanner, setShowBirthdayBanner] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "Bem-vindo ao sistema!",
      message:
        "Sua conta foi criada com sucesso. Explore todas as funcionalidades disponíveis.",
      type: "success",
      fromUserId: "system",
      fromUserName: "Sistema",
      toUserId: "1",
      isRead: false,
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Nova política de home office",
      message:
        "Uma nova política de trabalho remoto foi aprovada. Confira os detalhes na seção de notícias.",
      type: "info",
      fromUserId: "admin",
      fromUserName: "Administrador",
      toUserId: "1",
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ]);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
  }, []);

  const unreadCount = notifications.filter(
    (n) => !n.isRead && n.toUserId === user?.id
  ).length;

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.toUserId === user?.id
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  // Função para buscar dados do Office 365 após login
  const fetchOffice365Data = async (email: string): Promise<any | null> => {
    try {
      console.log("Buscando dados do Office 365 para:", email);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/usuarios?email=${email}`
      );

      console.log("Dados do Office 365 encontrados:", response.data);
      return response.data;
    } catch (error) {
      console.warn("Não foi possível buscar dados do Office 365:", error);
      return null; // Continua sem os dados do Office 365
    }
  };

  const updateProfile = async (data: {
    photoFile?: File | null;
    [key: string]: any;
  }) => {
    if (!user) {
      throw new Error("Usuário não está logado");
    }
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", data.name || "");
      formData.append("email", data.email || "");

      if (data.photoFile) {
        formData.append("photo", data.photoFile);
      }

      // const response = await axios.put(
      //   `${import.meta.env.VITE_API_URL}/api/usuarios/${user.id}`,
      //   formData,
      //   {
      //     headers: {
      //       "Content-Type": "multipart/form-data",
      //       Authorization: `Bearer ${localStorage.getItem("token")}`,
      //     },
      //   }
      // );

      const updatedUser = {
        ...user,
        photo: data.photoFile ? data.photo : user.photo,
      };

      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      showSuccessToast("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error);
      const message =
        error?.response?.data?.message || "Erro ao atualizar perfil";
      showErrorToast(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const hideBirthdayBanner = () => {
    setShowBirthdayBanner(false);
  };

  const loginWithUserData = async (userData: AuthUser) => {
    try {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
      setShowBirthdayBanner(true);
    } catch (error) {
      console.error("Erro ao processar login SSO:", error);
      throw error;
    }
  };

  const login = async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    try {
      // Faz o login local
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/login`,
        credentials
      );
      const data = response.data;

      // Cria o objeto do usuário a partir dos dados locais
      const authUser: AuthUser = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        permissions: data.user.permissions,
        photo: data.user.photo,
        status: data.user.status,
        office365: {
          displayName: "",
          jobTitle: "",
          department: "",
          mobilePhone: "",
          businessPhones: "",
        },
      };

      // Tenta buscar dados adicionais do Office 365
      try {
        const office365Data = await fetchOffice365Data(authUser.email);

        if (office365Data) {
          // Enriquece os dados do usuário com informações do Office 365
          const enrichedUser: AuthUser = {
            ...authUser,
            // Mantém dados locais como prioridade, mas adiciona dados do Office 365
            name: authUser.name || office365Data.displayName,
            photo: office365Data.photo || authUser.photo, // Foto do Office 365 tem prioridade
            // Adiciona novos campos do Office 365 (se necessário)
            office365: {
              displayName: office365Data.displayName,
              jobTitle: office365Data.jobTitle,
              department: office365Data.department,
              mobilePhone: office365Data.mobilePhone,
              businessPhones: office365Data.businessPhones,
            },
          };

          console.log(
            "Usuário enriquecido com dados do Office 365:",
            enrichedUser
          );
          setUser(enrichedUser);
          localStorage.setItem("user", JSON.stringify(enrichedUser));
        } else {
          // Se não conseguir buscar do Office 365, usa apenas dados locais
          setUser(authUser);
          localStorage.setItem("user", JSON.stringify(authUser));
        }
      } catch (office365Error) {
        console.warn(
          "Erro ao buscar dados do Office 365, continuando apenas com dados locais:",
          office365Error
        );
        setUser(authUser);
        localStorage.setItem("user", JSON.stringify(authUser));
      }

      localStorage.setItem("token", data.token);
      setShowBirthdayBanner(true);

      showSuccessToast("Login realizado com sucesso!");
      return { success: true };
    } catch (error: any) {
      const message = error?.response?.data?.message || "Erro ao fazer login";
      showErrorToast(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setShowBirthdayBanner(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  };

  const contextValue: AuthContextType = {
    user,
    login,
    loginWithUserData,
    logout,
    isLoading,
    notifications: notifications.filter((n) => n.toUserId === user?.id),
    unreadCount,
    markAsRead,
    markAllAsRead,
    updateProfile,
    showBirthdayBanner,
    hideBirthdayBanner,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

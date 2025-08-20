import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastContainer } from "./components/ui/Toast";
import { LoginForm } from "./components/LoginForm";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Funcionarios } from "./pages/Funcionarios";
import { Positions } from "./pages/Positions";
import { Organograma } from "./pages/Organograma";
import { Departments } from "./pages/Departments";
import { Documents } from "./pages/Documents";
import { NewsPage } from "./pages/News";
import { Users } from "./pages/Users";
import { PasswordManagement } from "./pages/PasswordManagement";

const AppContent: React.FC = () => {
  const { user, isLoading, loginWithUserData } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [isProcessingSSO, setIsProcessingSSO] = useState(false);

  // 🔄 Processar SSO callback - VERSÃO CORRIGIDA
  useEffect(() => {
    const processSSO = async () => {
      // Verifica se estamos na rota de SSO callback
      // const currentPath = window.location.pathname;
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get("user");
      const errorParam = urlParams.get("error");

      // console.log("📍 Current path:", currentPath);

      // Se não há parâmetros SSO, não faz nada
      if (!userParam && !errorParam) {
        return;
      }

      setIsProcessingSSO(true);

      // Se há erro, redireciona para login
      if (userParam && !user) {
        try {
          // Decodificar e parsear os dados do usuário
          const decodedUserParam = decodeURIComponent(userParam);
          const userData = JSON.parse(decodedUserParam);

          // Salvar token e fazer login
          if (userData.token) {
            localStorage.setItem("token", userData.token);
            await loginWithUserData({
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              photo: userData.photo,
              username: userData.username || userData.email || "",
              permissions: userData.permissions || [],
              status: userData.status || "active",
              office365: userData.office365 || false,
            });
          }

          // Limpar a URL
          window.history.replaceState(
            {},
            document.title,
            "/intranet/dashboard"
          );
        } catch (error) {
          console.error("Erro ao processar SSO:", error);
          window.history.replaceState({}, document.title, "/intranet/login");
        } finally {
          setIsProcessingSSO(false);
        }
      }
    };

    processSSO();
  }, [user, loginWithUserData]);

  // 🔄 Loading para SSO
  if (isProcessingSSO) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-gray-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Processando SSO...</p>
          <p className="text-sm mt-2 opacity-75">
            Aguarde enquanto validamos suas credenciais
          </p>
        </div>
      </div>
    );
  }

  // 🔄 Loading normal
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-gray-800 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não há usuário, mostra login
  if (!user) {
    return <LoginForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onPageChange={setCurrentPage} />;
      case "funcionarios":
        return <Funcionarios />;
      case "positions":
        return <Positions />;
      case "organograma":
        return <Organograma />;
      case "departments":
        return <Departments />;
      case "documents":
        return <Documents />;
      case "news":
        return <NewsPage />;
      case "users":
        return <Users />;
      case "passwordManagement":
        return <PasswordManagement />;
      default:
        return <Dashboard onPageChange={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <AppContent />
    </AuthProvider>
  );
}

export default App;

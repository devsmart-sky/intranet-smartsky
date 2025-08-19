import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export const SSOCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithUserData } = useAuth();

  useEffect(() => {
    const processSSO = async () => {
      try {
        console.log("Processando SSO callback...");
        const userParam = searchParams.get("user");
        const errorParam = searchParams.get("error");

        console.log("Parâmetros recebidos:", { userParam, errorParam });

        if (errorParam) {
          console.error("Erro recebido no callback:", errorParam);

          // Mapeia erros para mensagens mais amigáveis
          let errorMessage = "Erro desconhecido no login";
          switch (errorParam) {
            case "user_not_found":
              errorMessage = "Usuário não encontrado no sistema";
              break;
            case "login_failed":
              errorMessage = "Falha no processo de login";
              break;
            case "sso_processing_failed":
              errorMessage = "Erro ao processar login SSO";
              break;
          }

          // Redireciona para login com erro
          navigate(
            `/intranet/login?error=${errorParam}&message=${encodeURIComponent(
              errorMessage
            )}`,
            { replace: true }
          );
          return;
        }

        if (userParam) {
          console.log("Dados do usuário recebidos, processando...");

          // Decodifica os dados do usuário
          const userData = JSON.parse(decodeURIComponent(userParam));
          console.log("Dados decodificados:", userData);

          // Salva o token no localStorage
          if (userData.token) {
            localStorage.setItem("token", userData.token);
            console.log("Token salvo no localStorage");
          }

          // Remove o token dos dados do usuário antes de passar para o contexto
          const { token, ...userInfo } = userData;

          // Faz login usando os dados recebidos
          await loginWithUserData(userInfo);
          console.log("Login realizado com sucesso");

          // Redireciona para o dashboard
          navigate("/intranet/dashboard", { replace: true });
        } else {
          console.log("Nenhum dado de usuário ou erro recebido");
          // Se não há dados, redireciona para login
          navigate("/intranet/login", { replace: true });
        }
      } catch (error) {
        console.error("Erro ao processar SSO:", error);
        navigate(
          "/intranet/login?error=sso_processing_failed&message=Erro+ao+processar+login+SSO",
          { replace: true }
        );
      }
    };

    processSSO();
  }, [searchParams, navigate, loginWithUserData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-gray-800 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-lg">Processando login...</p>
        <p className="text-sm mt-2 opacity-75">
          Aguarde enquanto validamos suas credenciais
        </p>
      </div>
    </div>
  );
};

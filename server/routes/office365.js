const express = require('express');
const router = express.Router();
const graph = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const { ClientSecretCredential } = require('@azure/identity');
require('dotenv').config()
const msal = require('@azure/msal-node');
const { pool } = require('../db');
const jwt = require('jsonwebtoken'); 

// ✅ DADOS DA APLICAÇÃO REGISTRADA NO AZURE
const tenantId = process.env.AZURE_TENANT_ID
const clientId = process.env.AZURE_CLIENT_ID
const clientSecret = process.env.AZURE_CLIENT_SECRET

// ✅ DADOS DO USUÁRIO REGISTRADO NO AZURE
const clientIdUser = process.env.IDCLIENTEUSUARIO
const tenantIdUser = process.env.TENANTIDUSUARIO
const clientSecretUser = process.env.INTRANETSECRETUSUARIO

// 🔐 Função para obter token com as credenciais da aplicação
async function getAccessToken() {
  const credential = new ClientSecretCredential(tenantIdUser, clientIdUser, clientSecretUser);
  const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
  return tokenResponse.token;
}

// 📡 Cria o client autenticado do Microsoft Graph
function getAuthenticatedClient(accessToken) {
  return graph.Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

const defaultUserSelect = [
  'id',
  'displayName',
  'mail',
  'userPrincipalName',
  'jobTitle',
  'mobilePhone',
  'givenName',
  'surname',
  'department',
  'hireDate',
];

// 🔍 Busca dados do usuário pelo e-mail
async function buscarUsuarioPorEmail(email, accessToken) {
  const client = getAuthenticatedClient(accessToken);
  try {
    const user = await client
      .api(`/users/${email}`)
      .select(defaultUserSelect.join(','))
      .get();
    
    console.log('Dados do usuário encontrados:', user);

    let photoBase64 = null;
    try {
      console.log('Tentando buscar foto do usuário...');
      
      const photoResponse = await client
        .api(`/users/${email}/photo/$value`)
        .responseType('arraybuffer')
        .get();

      const buffer = Buffer.from(photoResponse);
      photoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      
      console.log('Foto encontrada e convertida com sucesso');
      
    } catch (photoError) {
      console.warn('Erro ao buscar foto (normal se usuário não tiver foto):', photoError.code || photoError.message);
      photoBase64 = null;
    }

    return {
      id: user.id,
      displayName: user.displayName,
      mail: user.mail,
      userPrincipalName: user.userPrincipalName,
      jobTitle: user.jobTitle,
      mobilePhone: user.mobilePhone,
      businessPhones: user.businessPhones,
      givenName: user.givenName,
      surname: user.surname,
      department: user.department,
      officeLocation: user.officeLocation,
      photo: photoBase64,
    };

  } catch (error) {
    console.error('Erro ao buscar dados básicos do usuário:', error);
    throw error;
  }
}

// 🔎 Rota GET /usuarios?email=fulano@empresa.com
router.get('/usuarios', async (req, res) => {
  const email = req.query.email;

  if (!email) {
    return res.status(400).json({ error: 'E-mail é obrigatório', message: 'Por favor, fornecer o e-mail válido' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Email inválido',
      message: 'Por favor, forneça um email válido'
    });
  }

  try {
    const token = await getAccessToken();
    const user = await buscarUsuarioPorEmail(email, token);
    res.json(user);
  } catch (err) {
    console.error('Erro ao buscar usuário:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário no Microsoft Graph', detalhes: err.message });
  }
});

// SINGLE SIGN-ON - MANTENDO LOCALHOST:5000 COMO REDIRECT
const REDIRECT_URI = 'http://localhost:5000';

const config = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret: clientSecret,
  },
};

const cca = new msal.ConfidentialClientApplication(config);

// Rota para iniciar o login (redireciona para a Microsoft)
router.get('/singleSignon', (req, res) => {
  const authCodeUrlParameters = {
    scopes: ['user.read'],
    redirectUri: REDIRECT_URI,
  };

  cca.getAuthCodeUrl(authCodeUrlParameters)
    .then((response) => {
      console.log('URL de autorização gerada:', response);
      res.redirect(response);
    })
    .catch((error) => {
      console.error('Erro ao gerar URL de login:', error);
      res.status(500).send('Erro ao gerar URL de login');
    });
});

// 🎯 CALLBACK DO SSO - Processa na rota root do router
router.get('/', async (req, res) => {
  console.log('Callback ROOT recebido com parâmetros:', req.query);
  
  // Se não há código, é uma requisição normal - redireciona para o frontend
  if (!req.query.code) {
    console.log('Sem código de autorização - redirecionando para frontend');
    return res.redirect('http://localhost:5173/intranet/login');
  }
  
  // Se há código, processa o SSO
  const tokenRequest = {
    code: req.query.code,
    scopes: ['user.read'],
    redirectUri: REDIRECT_URI,
  };
  
  try {
    console.log('Processando SSO callback...');
    const response = await cca.acquireTokenByCode(tokenRequest);
    
    if (!response || !response.account) {
      console.error('Resposta inválida do MSAL:', response);
      return res.redirect('http://localhost:5173/intranet/sso-callback?error=invalid_token_response');
    }
    
    const account = response.account;
    const emailLogado = account.username;
    
    console.log('Token obtido com sucesso, email do usuário:', emailLogado);

    // Busca usuário no banco de dados
    const [rows] = await pool.promise().query(
      'SELECT * FROM view_usuarios WHERE email = ?', 
      [emailLogado]
    );

    if (rows.length > 0) {
      const user = rows[0];
      console.log('Usuário encontrado no banco:', user.email);
      
      // Gera o JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1d' }
      );

      // Prepara dados do usuário
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.foto || null,
        token: token
      };

      // Codifica os dados do usuário para passar na URL
      const encodedUserData = encodeURIComponent(JSON.stringify(userData));

      console.log('Redirecionando para o SSO callback do frontend');
      console.log('Dados do usuário que serão enviados:', userData);
      
      // Redireciona para a aplicação principal com os dados do usuário
      res.redirect(`http://localhost:5173/intranet/sso-callback?user=${encodedUserData}`);
      
    } else {
      console.log('Usuário não encontrado no banco de dados para email:', emailLogado);
      res.redirect('http://localhost:5173/intranet?error=user_not_found');
    }
    
  } catch (error) {
    console.error('Erro detalhado no callback SSO:', error);
    
    // Log mais detalhado do erro
    if (error.errorCode) {
      console.error('Código do erro:', error.errorCode);
      console.error('Mensagem do erro:', error.errorMessage);
    }
    
    res.redirect('http://localhost:5173/intranet?error=login_failed');
  }
});

module.exports = router;
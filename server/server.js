require('dotenv').config({ path: __dirname + '/../.env' }); // para acessar o .env da raiz
console.log('Ambiente:', process.env.NODE_ENV);
console.log('CLIENT_SECRET:', process.env.AZURE_CLIENT_SECRET);

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const msal = require('@azure/msal-node');

// ========================
// CONFIGURAÇÃO CORS PARA LOCALHOST
// ========================
const corsOptions = {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware de log para debug
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========================
// ARQUIVOS ESTÁTICOS
// ========================
app.use('/docs', (req, res, next) => {
  req.url = decodeURIComponent(req.url); 
  express.static(path.join(__dirname, 'public', 'docs'))(req, res, next);
});
app.use('/uploads', express.static('uploads'));

// ========================
// ROTAS DA API
// ========================
// Office 365
const office = require('./routes/office365');
app.use('/api', office); // Para /api/singleSignon
app.use('/', office);    // Para callback do Azure na raiz

// Outras rotas da API com prefixo /api
const authRoutes = require('./routes/auths');
app.use('/api', authRoutes);
app.use('/api', authRoutes);

// Funcionários - IMPORTANTE: usar /api como prefixo
const funcionarioRoutes = require('./routes/funcionarios');
app.use('/api', funcionarioRoutes);

// Posições/Cargos
const positionRoutes = require('./routes/positions');
app.use('/api', positionRoutes);

// Departamentos
const departmentRoutes = require('./routes/departments');
app.use('/api', departmentRoutes);

// Documentos
const documentoRoutes = require('./routes/documents');
app.use('/api', documentoRoutes);

// Notícias
const noticiasRoutes = require('./routes/noticias');
app.use('/api', noticiasRoutes);

// Usuários
const usuariosRoutes = require('./routes/usuarios');
app.use('/api', usuariosRoutes);


// ========================
// ROTA DE HEALTH CHECK
// ========================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// ========================
// INICIALIZAÇÃO DO SERVIDOR
// ========================
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📁 Arquivos estáticos: http://localhost:${PORT}/uploads`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});


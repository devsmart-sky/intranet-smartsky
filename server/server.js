require('dotenv').config({ path: __dirname + '/../.env' }); // para acessar o .env da raiz
console.log('CLIENT_SECRET:', process.env.AZURE_CLIENT_SECRET);

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const msal = require('@azure/msal-node');

// app.use(cors());

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
// Configuração do CORS
// const allowedOrigins = [
//   '*'
// ];

// app.use(cors({
//   origin: allowedOrigins, // Permite apenas essas origens
//   methods: ['GET', 'POST', 'PUT', 'DELETE'], // Métodos permitidos
//   allowedHeaders: ['Content-Type', 'Authorization'] // Cabeçalhos permitidos
// }));

// app.use(cors());
// app.use(express.json());
// app.use('/docs', express.static(path.join(__dirname, 'public/docs')));
app.use('/docs', (req, res, next) => {
  req.url = decodeURIComponent(req.url); 
  express.static(path.join(__dirname, 'public', 'docs'))(req, res, next);
});
app.use('/uploads', express.static('uploads'));


const office = require('./routes/office365')
app.use('/', office)

// Outras rotas da aplicação
const authRoutes = require('./routes/auths');
app.use('/api/login', authRoutes);

const funcionarioRoutes = require('./routes/funcionarios');
app.use('/api/funcionarios', funcionarioRoutes);

const positionRoutes = require('./routes/positions');
app.use(positionRoutes);

const departmentRoutes = require('./routes/departments');
app.use(departmentRoutes);

const documentoRoutes = require('./routes/documents');
app.use(documentoRoutes);

const noticiasRoutes = require('./routes/noticias');
app.use(noticiasRoutes);

const usuariosRoutes = require('./routes/usuarios');
app.use('/api/usuarios', usuariosRoutes);


// Pegue a porta do .env
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


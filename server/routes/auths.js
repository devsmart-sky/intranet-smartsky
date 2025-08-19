// backend/routes/auth.ts
const express = require('express');
const router = express.Router();
const db = require('../db'); // conexão com MySQL
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

// Função para validar email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Função para gerar hash da senha
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Função para comparar senhas
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// ✅ ROTA DE LOGIN HÍBRIDA (Email/Username + Password)
router.post('/', async (req, res) => {
  const { email, username, password, loginType } = req.body;

  console.log('Dados recebidos:', { email, username, loginType });

  // Validação básica
  if (!password) {
    return res.status(400).json({ 
      error: true, 
      message: 'Senha é obrigatória' 
    });
  }

  // Determina qual campo usar para busca
  let searchField, searchValue;
  
  if (loginType === 'email' || email) {
    if (!email) {
      return res.status(400).json({ 
        error: true, 
        message: 'Email é obrigatório para login por email' 
      });
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        error: true, 
        message: 'Email inválido' 
      });
    }
    
    searchField = 'email';
    searchValue = email;
  } else {
    if (!username) {
      return res.status(400).json({ 
        error: true, 
        message: 'Usuário é obrigatório para login por username' 
      });
    }
    
    searchField = 'username';
    searchValue = username;
  }

  try {
    console.log(`Buscando usuário por ${searchField}:`, searchValue);

    // Busca o usuário no banco
    const [rows] = await db.query(
      `SELECT * FROM view_usuarios WHERE ${searchField} = ? AND status = 'Ativo'`,
      [searchValue]
    );

    if (rows.length === 0) {
      console.log('Usuário não encontrado ou inativo');
      return res.status(401).json({ 
        error: true, 
        message: 'Credenciais inválidas ou usuário inativo' 
      });
    }

    const user = rows[0];
    console.log('Usuário encontrado:', { id: user.id, email: user.email, username: user.username });

    // Verifica se o usuário tem senha cadastrada
    if (!user.password) {
      console.log('Usuário sem senha cadastrada');
      return res.status(401).json({ 
        error: true, 
        message: 'Usuário não possui senha cadastrada. Entre em contato com o administrador.' 
      });
    }

    // Compara a senha
    const passwordMatch = await comparePassword(password, user.password);
    
    if (!passwordMatch) {
      console.log('Senha incorreta');
      return res.status(401).json({ 
        error: true, 
        message: 'Credenciais inválidas' 
      });
    }

    console.log('Login bem-sucedido para usuário:', user.email);

    // Gera o JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        role: user.role 
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    // Retorna os dados do usuário (sem a senha)
    const userResponse = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
      photo: user.foto || null, // Campo 'foto' da view
      status: user.status
    };

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      token,
      user: userResponse
    });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ 
      error: true, 
      message: 'Erro interno do servidor' 
    });
  }
});

// ✅ ROTA PARA CADASTRAR/ATUALIZAR SENHA DO USUÁRIO
router.post('/set-password', async (req, res) => {
  const { userId, newPassword, username } = req.body;

  if (!userId || !newPassword || !username) {
    return res.status(400).json({ 
      error: true, 
      message: 'ID do usuário e nova senha são obrigatórios' 
    });
  }

  // Validação da senha (mínimo 6 caracteres)
  if (newPassword.length < 6) {
    return res.status(400).json({ 
      error: true, 
      message: 'A senha deve ter pelo menos 6 caracteres' 
    });
  }

  try {
    // Verifica se o usuário existe
    const [userRows] = await db.query('SELECT id FROM usuarios WHERE id = ?', [userId]);
    
    if (userRows.length === 0) {
      return res.status(404).json({ 
        error: true, 
        message: 'Usuário não encontrado' 
      });
    }

    // Gera o hash da nova senha
    const hashedPassword = await hashPassword(newPassword);

    // Atualiza a senha no banco
    const [result] = await db.query(
      'UPDATE usuarios SET password = ?, username = ? WHERE id = ?',
      [hashedPassword, username, userId]
    );

    if (result.affectedRows === 1) {
      console.log(`Senha atualizada para usuário ID: ${userId}`);
      res.json({
        success: true,
        message: 'Senha cadastrada com sucesso'
      });
    } else {
      res.status(500).json({ 
        error: true, 
        message: 'Erro ao atualizar senha' 
      });
    }
  } catch (err) {
    console.error('Erro ao definir senha:', err);
    res.status(500).json({ 
      error: true, 
      message: 'Erro interno do servidor' 
    });
  }
});

// ✅ ROTA PARA VERIFICAR STATUS DO USUÁRIO
router.get('/status/:email', async (req, res) => {
  const { email } = req.params;

  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: true, 
      message: 'Email inválido' 
    });
  }

  try {
    const [rows] = await db.query('SELECT id, email, status, password FROM usuarios WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      return res.status(404).json({ 
        error: true, 
        message: 'Usuário não encontrado' 
      });
    }

    const user = rows[0];
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        hasPassword: !!user.password
      }
    });
  } catch (err) {
    console.error('Erro ao verificar status:', err);
    res.status(500).json({ 
      error: true, 
      message: 'Erro interno do servidor' 
    });
  }
});



router.post('/', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];

    if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Senha incorreta' });

    // Garanta que o valor 'Inativo' no código corresponde EXATAMENTE ao valor no seu banco de dados
    if (user.status === 'Inativo') {
      return res.status(403).json({ success: false, message: 'Sua conta está inativa. Por favor, entre em contato com o administrador.' });
    }

    // Processar permissões: se for string JSON, converte para objeto
    if (user.permissions && typeof user.permissions === 'string') {
        try {
            user.permissions = JSON.parse(user.permissions);
        } catch (parseError) {
            console.error('Erro ao fazer parse das permissões:', parseError);
            user.permissions = {}; // Em caso de erro, defina como um objeto vazio
        }
    } else if (user.permissions === null || user.permissions === undefined) {
        user.permissions = {}; // Garante que seja um objeto se for null/undefined
    }

    const token = jwt.sign(
      { id: user.idUsuario, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        photo: user.foto,
      },
    });
  } catch (error) {

console.log(error);

    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro no login' });
  }
});

module.exports = router;

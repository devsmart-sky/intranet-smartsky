// server/routes/positions.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL

// Configurar destino e nome do arquivo
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    // Verificar se o diretório existe, se não, criar
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'profile_' + uniqueSuffix + fileExtension);
  }
});

// Configuração do multer
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas (JPEG, JPG, PNG, GIF)'));
    }
  }
});

// Função para verificar se email já existe em funcionários ou usuários
const verificarEmailExistente = async (email, excludeId = null) => {
  try {
    // Verifica na tabela funcionários
    const [funcionarioExistente] = await db.query('SELECT email FROM usuarios WHERE email = ?', [email]);
    
    // Verifica na tabela usuários
    let queryUsuarios;
    let paramsUsuarios;
    
    if (excludeId) {
      queryUsuarios = 'SELECT email FROM usuarios WHERE email = ? AND id != ?';
      paramsUsuarios = [email, excludeId];
    } else {
      queryUsuarios = 'SELECT email FROM usuarios WHERE email = ?';
      paramsUsuarios = [email];
    }
    
    const [usuarioExistente] = await db.query(queryUsuarios, paramsUsuarios);
    
    return {
      funcionarioExiste: funcionarioExistente.length > 0,
      usuarioExiste: usuarioExistente.length > 0,
      emailExiste: funcionarioExistente.length > 0 || usuarioExistente.length > 0
    };
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    throw error;
  }
};

// Rota para buscar um funcionário que não tem um usuário
router.get('/', async (req, res) => {

  try {
    const [rows] = await db.query('SELECT * FROM view_usuarios');

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar cargos' });
  }
});

// Rota para buscar um funcionário que não tem um usuário
router.get('/filtraFuncionario', async (req, res) => {
  
  try {
    const [rows] = await db.query('SELECT * FROM view_select_usuarios');

    // ✅ Filtrar o registro (N/A) se existir
    const validRows = rows.filter(row => 
      row.funcionario && 
      row.funcionario !== '(N/A)' && 
      row.funcionario.trim() !== ''
    );
    
    if (validRows.length > 0) {
      res.json(validRows);
    } else {
      // ✅ Resposta mais amigável quando não há funcionários disponíveis
      res.json([]); // Array vazio ao invés de erro 404
    }
    
  } catch (err) {
    console.error('❌ Erro na query:', err);
    res.status(500).json({ error: true, message: err.message });
  }
})

// Rota para inserir um novo usuário
router.post('/', upload.single('photo'), async (req, res) => {
  const { name, email, role, status, permissions, id_funcionario } = req.body;
  const photo = req.file ? req.file.filename : null;

  try {
    // Verificar se o email já existe em funcionários ou usuários
    const emailCheck = await verificarEmailExistente(email);
    
    if (emailCheck.emailExiste) {
      let mensagem = 'Email já cadastrado';
      if (emailCheck.funcionarioExiste) {
        mensagem += ' na tabela de funcionários';
      }
      if (emailCheck.usuarioExiste) {
        if (emailCheck.funcionarioExiste) {
          mensagem += ' e usuários';
        } else {
          mensagem += ' na tabela de usuários';
        }
      }
      
      return res.status(400).json({ 
        error: true, 
        message: mensagem,
        details: {
          funcionarioExiste: emailCheck.funcionarioExiste,
          usuarioExiste: emailCheck.usuarioExiste
        }
      });
    }

    const [result] = await db.query(
      'INSERT INTO usuarios (id_funcionario, name, email, role, status, permissions, photo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id_funcionario, name, email, role, status, JSON.stringify(permissions), photo]
    ); 

    if (result.affectedRows === 1) {
      res.status(201).json({ 
        message: 'Usuário criado com sucesso',
        photo: photo 
      });
    } else {
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Rota para editar um usuário
router.put('/:id', upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  const { name, email, role, status } = req.body;
  const photo = req.file ? req.file.filename : req.body.photo;

  try {
    // 1. Busque o usuário atual para obter o e-mail existente
    const [existingUsers] = await db.query('SELECT email FROM usuarios WHERE id = ?', [id]);
    const existingUser = existingUsers[0];

    // 2. Se o e-mail foi alterado, verifique a duplicidade
    if (existingUser && existingUser.email !== email) {
      const emailCheck = await verificarEmailExistente(email);
      if (emailCheck.emailExiste) {
        return res.status(400).json({
          error: true,
          message: 'Novo e-mail já cadastrado.',
        });
      }
    }

    const [result] = await db.query(
      'UPDATE usuarios SET name = ?, email = ?, role = ?, status = ?, photo = ? WHERE id = ?',
      [name, email, role, status, photo, id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Usuário atualizado com sucesso' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (err) {
    console.error('Erro ao editar usuário:', err);
    res.status(500).json({ error: 'Erro ao editar usuário' });
  }
});

// Rota específica para atualizar apenas o perfil (foto)
router.put('/:id/profile', upload.single('photo'), async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar usuário atual
    const [currentUser] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    
    if (currentUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = currentUser[0];
    let photoPath = user.photo; // Mantém foto existente por padrão
    
    // Se uma nova foto foi enviada
    if (req.file) {
      photoPath = req.file.filename;
      console.log('Nova foto de perfil recebida:', photoPath);
      
      // Remove foto antiga se existir
      if (user.photo) {
        const oldPhotoPath = path.join('uploads', user.photo);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
          console.log('Foto antiga de perfil removida:', oldPhotoPath);
        }
      }
    }

    // Atualizar apenas a foto do usuário
    const [result] = await db.query(
      'UPDATE usuarios SET photo = ? WHERE id = ?',
      [photoPath, id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ 
        message: 'Foto do perfil atualizada com sucesso',
        photo: photoPath,
        user: {
          ...user,
          photo: photoPath
        }
      });
    } else {
      res.status(404).json({ error: 'Erro ao atualizar perfil' });
    }
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Rota para excluir um usuário
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar foto do usuário antes de excluir
    const [user] = await db.query('SELECT photo FROM usuarios WHERE id = ?', [id]);

    const [result] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);

    if (result.affectedRows === 1) {
      // Remover foto se existir
      if (user.length > 0 && user[0].photo) {
        const photoPath = path.join('uploads', user[0].photo);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
          console.log('Foto do usuário removida:', photoPath);
        }
      }
      
      res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// Rota para excluir um usuário
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Buscar foto do usuário antes de excluir
    const [user] = await db.query('SELECT photo FROM usuarios WHERE id = ?', [id]);

    const [result] = await db.query('DELETE FROM usuarios WHERE id = ?', [id]);

    if (result.affectedRows === 1) {
      // Remover foto se existir
      if (user.length > 0 && user[0].photo) {
        const photoPath = path.join('uploads', user[0].photo);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
          console.log('Foto do usuário removida:', photoPath);
        }
      }
      
      res.status(200).json({ message: 'Usuário excluído com sucesso' });
    } else {
      res.status(404).json({ error: 'Usuário não encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

module.exports = router;
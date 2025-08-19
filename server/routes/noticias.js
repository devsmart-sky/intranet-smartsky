// server/routes/noticias.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL

// Configuração do multer para upload de imagens de notícias
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/image';
    // Cria o diretório se ele não existir
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Listar
router.get('/noticias', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM view_noticias');

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar noticias' });
  }
});

// Rota para inserir uma nova notícia
router.post('/noticias', upload.single('image'), async (req, res) => {
  const { titulo, resumo, conteudo, categoria, url_imagem, foto, sourceUrl, sourceName, ativo, destaque, criado } = req.body;
  const urlImagem = req.file ? req.file.filename : null;

  try {
    const [result] = await db.query(
      'INSERT INTO noticias (titulo, resumo, conteudo, categoria, url_imagem, url_fonte, nome_fonte, ativo, destaque) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [titulo, resumo, conteudo, categoria, url_imagem, sourceUrl, sourceName, ativo, destaque]
    );

    if (result.affectedRows === 1) {
      res.status(201).json({ message: 'Noticia criada com sucesso' });
    }


  } catch (error) {
    console.error('Erro ao inserir noticia:', error);
    res.status(500).json({ error: 'Erro ao inserir noticia' });
  }
})

// Rota para atualizar uma noticia
router.put('/noticias/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { titulo, resumo, conteudo, categoria, url_imagem, ativo, destaque } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE noticias SET titulo = ?, resumo = ?, conteudo = ?, categoria = ?, url_imagem = ?, ativo = ?, destaque = ? WHERE id_noticias = ?',
      [titulo, resumo, conteudo, categoria, url_imagem, ativo, destaque, id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Noticia atualizada com sucesso' });
    } else {
      res.status(404).json({ error: 'Noticia nao encontrada' });
    }
  } catch (error) {
    console.error('Erro ao atualizar noticia:', error);
    res.status(500).json({ error: 'Erro ao atualizar noticia' });
  }
})

// Rota para excluir uma noticia
router.delete('/noticias/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM noticias WHERE id_noticias = ?', [id]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Noticia excluida com sucesso' });
    } else {
      res.status(404).json({ error: 'Noticia nao encontrada' });
    }
  } catch (error) {
    console.error('Erro ao excluir noticia:', error);
    res.status(500).json({ error: 'Erro ao excluir noticia' });
  }
})

module.exports = router;
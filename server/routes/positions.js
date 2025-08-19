// server/routes/positions.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL

// Listar todos os cargos
router.get('/cargos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM view_cargos');

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar cargos' });
  }
});

// Rota para inserir um novo cargo
router.post('/cargos', async (req, res) => {
  const { cargo, descricao, status, criado } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO cargos (cargo, descricao, status) VALUES (?, ?, ?)',
      [cargo, descricao, status]
    ); 

    if (result.affectedRows === 1) {
      res.status(201).json({ message: 'Cargo criado com sucesso' });
    } else {
      res.status(500).json({ error: 'Erro ao criar cargo' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar cargo' });
  }
});

// Rota para editar um cargo
router.put('/cargos/:id', async (req, res) => {
  const { id } = req.params;
  const { cargo, descricao, status } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE cargos SET cargo = ?, descricao = ?, status = ?, alterado = NOW() WHERE id_cargo = ?',
      [cargo, descricao, status, id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Cargo atualizado com sucesso' });
    } else {
      res.status(404).json({ error: 'Cargo nao encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar cargo' });
  }
});

// Rota para excluir um cargo
router.delete('/cargos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM cargos WHERE id_cargo = ?', [id]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Cargo excluido com sucesso' });
    } else {
      res.status(404).json({ error: 'Cargo nao encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir cargo' });
  }
});

module.exports = router;
// server/routes/departments.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL

// Listar todos os cargos
router.get('/departamentos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM view_departamentos');

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar departamentos' });
  }
});

// Rota para inserir um novo cargo
router.post('/departamentos', async (req, res) => {
  const { departamento, descricao, status, criado } = req.body;

  try {
    const [result] = await db.query(
      'INSERT INTO departamentos (departamento, descricao, status) VALUES (?, ?, ?)',
      [departamento, descricao, status]
    ); 

    if (result.affectedRows === 1) {
      res.status(201).json({ message: 'Departamento criado com sucesso' });
    } else {
      res.status(500).json({ error: 'Erro ao criar departamento' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar departamento' });
  }
});

// Rota para editar um cargo
router.put('/departamentos/:id', async (req, res) => {
  const { id } = req.params;
  const { departamento, descricao, status } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE departamentos SET departamento = ?, descricao = ?, status = ?, alterado = NOW() WHERE id_departamento = ?',
      [departamento, descricao, status, id]
    );

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Departamento atualizado com sucesso' });
    } else {
      res.status(404).json({ error: 'Departamento nao encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar departamento' });
  }
});

// Rota para excluir um cargo
router.delete('/departamentos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM departamentos WHERE id_departamento = ?', [id]);

    if (result.affectedRows === 1) {
      res.status(200).json({ message: 'Departamento excluido com sucesso' });
    } else {
      res.status(404).json({ error: 'Departamento nao encontrado' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir Departamento' });
  }
});

module.exports = router;
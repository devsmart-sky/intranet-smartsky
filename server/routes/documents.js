// server/routes/positions.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL

const storage = multer.memoryStorage();
const upload = multer({
	storage: storage,
	limits: { fileSize: 10 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const filePermitidos = [
			"application/pdf",
			"application/msword", // .doc
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
			"application/vnd.ms-excel", // .xls
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
			"image/jpeg",
			"image/jpg",
			"image/png",
		];
		const extensoesPermitidas = [
			".pdf",
			".doc",
			".docx",
			".xls",
			".xlsx",
			".jpg",
			".jpeg",
			".png",
		];
		const isFilePermitido = filePermitidos.includes(file.mimetype);
		const isExtensaoPermitida = extensoesPermitidas.includes(
			path.extname(file.originalname).toLowerCase(),
		);
		// const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
		// const mimetype = filetypes.test(file.mimetype);

		if (isFilePermitido && isExtensaoPermitida) {
			return cb(null, true);
		} else {
			cb(
				new Error(
					"Formato de arquivo inválido. Somente PDF, Word, Excel, JPEG, JPG e PNG são permitidos.",
				),
			);
		}
	},
});

// Listar todos os registros
router.get('/documento', async (req, res) => {
	const tipoUsuario = req.user?.tipo;  // Verifica o tipo do usuário logado admin ou comum

	let query = 'SELECT * FROM view_documento';
  let values = [];

	if(tipoUsuario !== 'admin') {
		query += ' WHERE nivel IN ("Público", "Restrito")';
	}

  try {
    const [rows] = await db.query(query, values);
 
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar cargos' });
  }
});

// Rota para enviar um novo documento
router.post('/documento', async (req, res) => {
  upload.single("documento")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "O tamanho do arquivo excede o limite de 10MB.",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Erro no upload do arquivo: ${err.message}`,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message:
          err.message || "Erro desconhecido ao processar o upload do documento.",
      });
    }

    const { nome, categoria, descricao, nivel } = req.body;
    const documento = req.file;

    if (!nome || !categoria || !documento) {
      return res.status(400).json({
        success: false,
        message: "Nome, categoria e documento são obrigatórios.",
      });
    }

    let caminhoPastaDocs = path.join(__dirname, '..', 'public', 'docs');
    let caminhoPastaCategoria = path.join(caminhoPastaDocs, categoria);
    let nomeArquivoSalvo = `${Date.now()}_${Buffer.from(documento.originalname, 'latin1').toString('utf8')}`;
    let caminhoCompletoArquivo = path.join(caminhoPastaCategoria, nomeArquivoSalvo);

    try {
      // Garante que a pasta da categoria existe
      if (!fs.existsSync(caminhoPastaCategoria)) {
        fs.mkdirSync(caminhoPastaCategoria, { recursive: true });
      }

      // Salva o arquivo no disco
      fs.writeFileSync(caminhoCompletoArquivo, documento.buffer);

      // Insere no banco
      const dataEnvio = new Date();
      const idUsuarioEnviando = req.user ? req.user.id : 1;

      const query = `
        INSERT INTO documento 
        (nome, categoria, descricao, arquivo, criado, id_funcionario, nivel)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      // Aqui usamos "/" para evitar problemas com `\` no Windows
      const caminhoRelativo = `${categoria}/${nomeArquivoSalvo}`;

      const values = [
        nome,
        categoria,
        descricao,
        caminhoRelativo,
        dataEnvio,
        idUsuarioEnviando,
				nivel
      ];

      const [result] = await db.query(query, values);

      return res.status(201).json({
        success: true,
        message: "Documento enviado com sucesso.",
        documento: {
          id_documento: result.insertId,
          nome,
          categoria,
          descricao,
          arquivo: caminhoRelativo,
          criado: dataEnvio,
          funcionario: idUsuarioEnviando,
        },
      });

    } catch (error) {
      console.error("Erro ao salvar documento:", error);
      if (fs.existsSync(caminhoCompletoArquivo)) {
        fs.unlinkSync(caminhoCompletoArquivo);
      }
      return res.status(500).json({
        success: false,
        message: "Erro ao enviar o documento.",
      });
    }
  });
});

// Rota para editar um documento
router.put('/documento/:id', async (req, res) => {
  upload.single("documento")(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    const { id } = req.params;
    const { nome, categoria, descricao, nivel } = req.body;
    const novoArquivo = req.file;

    try {
      // Buscar info atual do documento
      const [rows] = await db.query("SELECT * FROM documento WHERE id_documento = ?", [id]);
      if (rows.length === 0) return res.status(404).json({ success: false, message: 'Documento não encontrado.' });

      let caminhoRelativo = rows[0].arquivo;

      // Atualiza arquivo se novo for enviado
      if (novoArquivo) {
        const pastaCategoria = path.join(__dirname, '..', 'public', 'docs', categoria);
        if (!fs.existsSync(pastaCategoria)) fs.mkdirSync(pastaCategoria, { recursive: true });

        const nomeArquivo = `${Date.now()}_${Buffer.from(novoArquivo.originalname, 'latin1').toString('utf8')}`;
        const caminhoNovo = path.join(pastaCategoria, nomeArquivo);
        fs.writeFileSync(caminhoNovo, novoArquivo.buffer);

        // Remove o arquivo antigo do disco
        const caminhoAntigo = path.join(__dirname, '..', 'public', 'docs', caminhoRelativo);
        if (fs.existsSync(caminhoAntigo)) fs.unlinkSync(caminhoAntigo);

        caminhoRelativo = `${categoria}/${nomeArquivo}`;
      }

      await db.query(`
        UPDATE documento SET nome = ?, categoria = ?, descricao = ?, arquivo = ?, nivel = ?
        WHERE id_documento = ?
      `, [nome, categoria, descricao, caminhoRelativo, nivel, id]);

      res.json({ success: true, message: 'Documento atualizado com sucesso.' });

    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      res.status(500).json({ success: false, message: 'Erro ao atualizar documento.' });
    }
  });
});

// Rota para excluir um documento
router.delete('/documento/:id', async (req, res) => {
	const { id } = req.params;

		try {
			// Obter o caminho do arquivo
			const [rows] = await db.query( "SELECT arquivo FROM documento WHERE id_documento = ?", [id]);

			if (rows.length === 0) {
				return res
					.status(404)
					.json({ success: false, message: "Documento não encontrado." });
			}

			const caminhoRelativo = rows[0].arquivo;
    	const caminhoAbsoluto = path.join(__dirname, '..', 'public', 'docs', caminhoRelativo);

			// Deletar do banco
			const [result] = await db.query('DELETE FROM documento WHERE id_documento = ?', [id]);

			if (result.affectedRows !== 1) {
			return res.status(500).json({ success: false, message: 'Erro ao excluir documento.' });
			}

			// Deletar o arquivo do disco
			if (fs.existsSync(caminhoAbsoluto)) {
				fs.unlinkSync(caminhoAbsoluto);
				console.log('Arquivo excluído:', caminhoAbsoluto);
			} else {
				console.log('Arquivo não encontrado para excluir:', caminhoAbsoluto);
			}

			const pastaCategoria = path.dirname(caminhoAbsoluto); // ex: /public/docs/financeiro

			// Verifica se a pasta está vazia
			if (fs.existsSync(pastaCategoria)) {
				const arquivosRestantes = fs.readdirSync(pastaCategoria);
				if (arquivosRestantes.length === 0) {
					fs.rmdirSync(pastaCategoria); // Remove a pasta se vazia
					console.log('Pasta da categoria removida:', pastaCategoria);
				}
			}

			return res.json({ success: true, message: 'Documento e arquivo excluídos com sucesso.' });

			} catch (error) {
				console.error('Erro ao excluir documento:', error);
				return res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
			}
});

module.exports = router;
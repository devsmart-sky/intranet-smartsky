// server/routes/funionarios.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../db'); // conexão com o MySQL
const nodemailer = require('nodemailer');  // ✅ Importação do Nodemailer para envio de e-mails[
const open = require('open');

// ✅ Configuração do Nodemailer com OAuth2 para envio de e-mails
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com', // Host recomendado para OAuth2
  port: 587,
  secure: false, // Use STARTTLS com a porta 587
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN,
  }
});

// Configuração do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // pasta onde as imagens serão salvas
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Função para formatar data em 'YYYY-MM-DD'
const formatDate = (isoDate) => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return date.toISOString().split('T')[0];
};

// Função para formatar data e hora em 'YYYY-MM-DD HH:MM:SS'
function formatDateTimeForMySQL(isoDate) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  // yyyy-mm-dd hh:mm:ss
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0');
};

// Função para verificar e-mail
// Esta função é mais precisa, pois ignora o funcionário que está sendo editado.
async function verificarEmailExistente(email, id_funcionario) {
    const [rows] = await db.query(
        'SELECT COUNT(*) AS count FROM funcionarios WHERE email = ? AND id_funcionario != ?',
        [email, id_funcionario]
    );
    return rows[0].count > 0;
}

// Rota para Listar todos os funcionários
router.get('/funcionarios', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM view_funcionarios');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar funcionários' });
  }
});

// Rota para Inserir funcionário
router.post('/funcionarios', upload.single('foto'), async (req, res) => {
  const criado = formatDateTimeForMySQL(new Date().toISOString());

  const {
    funcionario,
    cpf,
    telefone,
    telefone2,
    razao_social,
    cnpj,
    tipo_contrato,
    cep,
    endereco,
    bairro,
    cidade,
    uf,
    email,
    descricao,
    idCargo,
    idDepartamento,
    datanascimento,
    dataadmissao,
    status,
    id_office,
    cargo,
    departamento,
    fotoBase64
  } = req.body;

  let fotoFilename = null;
  // const foto = req.file ? req.file.filename : null;

  try {

    // 1. Prioriza o arquivo de upload do Multer
    if (req.file) {
      fotoFilename = req.file.filename;
    } 
    // 2. Se não houver arquivo, verifica se há uma string Base64 no corpo
    else if (fotoBase64) {
      // Verifica se a string é um formato Base64 válido (opcional, mas recomendado)
      const base64Data = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Gera um nome de arquivo único
      const originalExtension = fotoBase64.substring('data:image/'.length, fotoBase64.indexOf(';base64'));
      const uniqueName = `${Date.now()}-office365.${originalExtension}`;
      
      const filePath = path.join('uploads', uniqueName);
      
      // Salva o arquivo no diretório 'uploads'
      fs.writeFileSync(filePath, buffer);
      
      console.log('Foto do Office 365 salva com sucesso:', uniqueName);
      fotoFilename = uniqueName;
    }

    // Formatar datas para 'YYYY-MM-DD'
    const dataNascimentoFormatada = formatDate(datanascimento);
    const dataAdmissaoFormatada = formatDate(dataadmissao);

    // Verificar se o email já existe
    const [emailExistente] = await db.query('SELECT email FROM funcionarios WHERE email = ?', [email]);

    if(emailExistente.length > 0){
      console.log('Email ja cadastrado');
      return res.json({ error: true });
    }

    const [result] = await db.query(
      `INSERT INTO funcionarios (
        funcionario, cpf, telefone, telefone_2, razao_social, cnpj, tipo_contrato, cep, endereco, bairro, cidade, uf, email,
        descricao, id_cargo, id_departamento, cargo_365, departamento_365, data_nascimento, data_admissao, status, foto, id_office, criado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        funcionario,
        cpf,
        telefone,
        telefone2,
        razao_social,
        cnpj,
        tipo_contrato,
        cep,
        endereco,
        bairro,
        cidade,
        uf,
        email,
        descricao,
        idCargo && !isNaN(+idCargo) ? Number(idCargo) : null,
        idDepartamento && !isNaN(+idDepartamento) ? Number(idDepartamento) : null,
        cargo || null,
        departamento || null,
        dataNascimentoFormatada,
        dataAdmissaoFormatada,
        status,
        fotoFilename || null,
        id_office || null,
        criado
      ]
    );

    res.status(201).json({ message: 'Funcionário inserido com sucesso', id: result.insertId });
  } catch (error) {
    console.error('Erro ao inserir funcionário:', error);
    res.status(500).json({ error: 'Erro ao inserir funcionário' });
  }
});

// Rota para Atualizar funcionário
router.put('/funcionarios/:id', upload.single('foto'), async (req, res) => {

  const { id } = req.params;
  const alterado = formatDateTimeForMySQL(new Date().toISOString());

  const {
    funcionario,
    cpf,
    telefone,
    telefone2,
    razao_social,
    cnpj,
    tipo_contrato,
    cep,
    endereco,
    bairro,
    cidade,
    uf,
    email,
    descricao,
    idCargo,
    idDepartamento,
    datanascimento,
    dataadmissao,
    status,
    cargo,
    departamento,
    fotoBase64
  } = req.body;

  const statusFormatado = status == 1 ? "Ativo" : "Inativo"


  try {
    // Buscar funcionário atual para obter foto existente
    const [currentEmployee] = await db.query('SELECT foto, status, funcionario, email FROM funcionarios WHERE id_funcionario = ?', [id]);
    
    if (currentEmployee.length === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const statusAntigo = currentEmployee[0].status;
    const nomeAtual = currentEmployee[0].funcionario;
    const emailAtual = currentEmployee[0].email;
    
    let fotoPath = currentEmployee[0].foto; // Mantém foto existente por padrão

    // Se uma nova foto foi enviada
    if (req.file) {
      fotoPath = req.file.filename;
      
      // Remove foto antiga se existir
      if (currentEmployee[0].foto) {
        const oldPhotoPath = path.join('uploads', currentEmployee[0].foto);
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
          console.log('Foto antiga removida:', oldPhotoPath); // Debug
        }
      }
    }

        // 1. Se uma nova foto foi enviada via upload
        if (req.file) {
          fotoPath = req.file.filename;
        } 
        // 2. Se a foto veio do Office 365 como Base64
        else if (fotoBase64) {
            const base64Data = fotoBase64.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const originalExtension = fotoBase64.substring('data:image/'.length, fotoBase64.indexOf(';base64'));
            const uniqueName = `${Date.now()}-office365-edit.${originalExtension}`;
            
            const filePath = path.join('uploads', uniqueName);
            fs.writeFileSync(filePath, buffer);
            
            console.log('Nova foto do Office 365 salva com sucesso:', uniqueName);
            fotoPath = uniqueName;
        }

        // Chama a nova função de verificação de e-mail.
        const emailJaExiste = await verificarEmailExistente(email, id);
        
        if (emailJaExiste) {
            // Se o e-mail existir para outro funcionário, retorna o erro
            return res.json({ 
                error: true, 
                message: 'Este email já está cadastrado para outro funcionário ou usuário' 
            });
        }

    const dataNascimentoFormatada = datanascimento ? formatDate(datanascimento) : null;
    const dataAdmissaoFormatada = dataadmissao ? formatDate(dataadmissao) : null;

    const [result] = await db.query(
      `UPDATE funcionarios SET
        funcionario = ?, cpf = ?, telefone = ?, telefone_2 = ?, razao_social = ?, cnpj = ?, tipo_contrato = ?,
        cep = ?, endereco = ?, bairro = ?, cidade = ?, uf = ?, email = ?, descricao = ?,
        id_cargo = ?, id_departamento = ?, cargo_365 = ?, departamento_365 = ?, data_nascimento = ?, data_admissao = ?, status = ?, foto = ?, alterado = ?
      WHERE id_funcionario = ?`,
      [
        funcionario,
        cpf,
        telefone,
        telefone2,
        razao_social,
        cnpj,
        tipo_contrato,
        cep,
        endereco,
        bairro,
        cidade,
        uf,
        email,
        descricao,
        idCargo && !isNaN(+idCargo) ? Number(idCargo) : null,
        idDepartamento && !isNaN(+idDepartamento) ? Number(idDepartamento) : null,
        cargo || null,
        departamento || null,
        dataNascimentoFormatada,
        dataAdmissaoFormatada,
        statusFormatado,
        fotoPath,
        alterado,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }
    
    // 🚀 LÓGICA DE ENVIO DE E-MAIL PARA INATIVAÇÃO
    console.log('Status anterior:', statusAntigo, '| Status novo:', statusFormatado);
    
    if (statusAntigo === 'Ativo' && statusFormatado === 'Inativo') {
      console.log('Enviando e-mail de inativação para:', process.env.EMAIL_TI);
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TI,
        subject: `🚨 [AÇÃO NECESSÁRIA] Inativação de Colaborador: ${funcionario}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <div style="background: linear-gradient(90deg, #f87171, #ef4444); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <h2 style="margin: 0;">⚠️ INATIVAÇÃO DE COLABORADOR</h2>
            </div>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 20px;">
              <h3 style="color: #dc2626; margin: 0 0 10px 0;">Ação Requerida - Departamento de TI</h3>
              <p style="margin: 0; color: #7f1d1d;">Um colaborador foi inativado no sistema e requer remoção de acessos.</p>
            </div>

            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #374151; margin: 0 0 15px 0;">📋 Detalhes do Colaborador:</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Nome:</td>
                  <td style="padding: 8px 0; color: #374151;">${funcionario}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">E-mail:</td>
                  <td style="padding: 8px 0; color: #374151;">${email}</td>
                </tr>
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Cargo:</td>
                  <td style="padding: 8px 0; color: #374151;">${cargo || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Departamento:</td>
                  <td style="padding: 8px 0; color: #374151;">${departamento || 'Não informado'}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <h4 style="color: #92400e; margin: 0 0 10px 0;">🔧 Procedimentos Necessários:</h4>
              <ul style="color: #78350f; margin: 0; padding-left: 20px;">
                <li>Revogar acesso ao Microsoft 365</li>
                <li>Desativar contas de e-mail</li>
                <li>Remover acessos a sistemas internos</li>
                <li>Recolher equipamentos (se aplicável)</li>
                <li>Revogar credenciais de VPN/Sistemas</li>
                <li>Atualizar grupos de segurança</li>
              </ul>
            </div>

            <div style="text-align: center; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
              <p style="margin: 0;">📧 Este e-mail foi enviado automaticamente pelo Sistema de Gestão de Funcionários</p>
              <p style="margin: 5px 0 0 0;">📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ E-mail de inativação enviado com sucesso para: ${process.env.EMAIL_TI}`);
      } catch (mailError) {
        console.error('❌ Erro ao enviar e-mail de inativação:', mailError);
        // Continua o fluxo da aplicação mesmo com erro no envio do e-mail
      }
    }

    res.status(200).json({ 
      message: 'Funcionário atualizado com sucesso',
      emailSent: statusAntigo === 'Ativo' && statusFormatado === 'Inativo'
    });
  } catch (error) {

    console.error('Erro ao atualizar funcionário:', error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

// Rota para Deletar funcionário
router.delete('/funcionarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM funcionarios WHERE id_funcionario = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    res.status(200).json({ message: 'Funcionário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    res.status(500).json({ error: 'Erro ao excluir funcionário' });
  }
});

// ROTA PARA INSERIR USUARIO APOS CRIAÇÃO DO FUNCIONARIO
router.post('/funcionarios/criaUsuario', async (req, res) => {
  const { name, email, role, permissions } = req.body;
  
  try {
    // Verificar se o email já existe na tabela de usuários
    const [usuarioExistente] = await db.query('SELECT email FROM usuarios WHERE email = ?', [email]);
    
    if (usuarioExistente.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email já cadastrado na tabela de usuários' 
      });
    }

    const [query] = await db.query('SELECT id_funcionario FROM funcionarios WHERE email = ? and funcionario = ?',[email, name]);
    
    if (query.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Funcionário não encontrado' 
      });
    }
    
    const id_funcionario = query[0].id_funcionario;

    const [query2] = await db.query('INSERT INTO usuarios (id_funcionario, name, email, role, status, permissions) VALUES(?, ?, ?, ?, ?, ?)', [id_funcionario, name, email, role, 'Ativo', JSON.stringify(permissions)]);

    if(query2.affectedRows > 0){
      res.json({success:true, message: 'Usuário criado com sucesso'})
    }
    else{
      res.json({success:false, message: 'Erro ao criar usuário'})
    }
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor' });
  }
});

module.exports = router;
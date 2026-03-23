// app.js
//CRIAR TABELA DE EXAMES NO DATABASE E LIGAR COM A DE MEDICO E PACIENTE

require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const nodemailer = require('nodemailer');  
const multer = require('multer');


const app = express();
app.use(cors());  
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o banco de dados MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ROTA: Página inicial (login)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pre-login.html"));
});


// ROTA: Cadastro de usuário
app.post('/api/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Preencha todos os campos!' });
    }
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'E-mail já cadastrado!' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    await pool.query('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)', [nome, email, senhaCriptografada]);
    return res.json({ mensagem: 'Usuário cadastrado com sucesso!' });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro no servidor ao cadastrar usuário.' });
  }
});

// ROTA: Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha!' });
    }
    const [usuarios] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (usuarios.length === 0) {
      return res.status(400).json({ erro: 'E-mail ou senha inválidos!' });
    }

    const usuario = usuarios[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos!' });
    }
    const token = jwt.sign({ id: usuario.id, email: usuario.email }, process.env.JWT_SECRET, { expiresIn: '2h' });
    return res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro no servidor ao realizar login.' });
  }
});

// Middleware de autenticação
function autenticarToken(req, res, next) {
  const cabecalho = req.headers['authorization'];
  const token = cabecalho && cabecalho.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não informado!' });

  jwt.verify(token, process.env.JWT_SECRET, (erro, dados) => {
    if (erro) return res.status(403).json({ erro: 'Token inválido!' });
    req.usuario = dados;
    next();
  });
}

// ROTA: Perfil (protegida)
app.get('/api/perfil', autenticarToken, async (req, res) => {
  try {
    const [usuarios] = await pool.query(
      'SELECT id, nome, email FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );

    if (usuarios.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    return res.json({ usuario: usuarios[0] });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro ao buscar perfil.' });
  }
});

//parte de medico
const storage = multer.diskStorage({
    destination: function (req, file, cb){
        cb(null, 'C:\\Users\\cauaa\\OneDrive\\Imagens\\Documentos\\tcc-senai-Cimatec\\Meu-Paciente-TCC\\public\\Certificados')
    },
    filename    : function (req, file, cb){
        cb(null, Date.now() + '-' + file.originalname);
    }
    });
    const upload = multer({ storage: storage });

 


    app.post('/cadastrar-medico' , upload.single('certificado'), async (req, res) => {
        try{
            //PASSANDO REQUISIÇÕOES EM FORMA DE VARIAVEIS PARA FACILITAR O USO
            const { nome, email, senha, atuacao } = req.body;
            const certificado_caminho = 'Certificados/' + req.file.filename;

            //cripitografando senha do medico
            const hashSenha = await bcrypt.hash(senha, 10);


            const [result] = await pool.execute(
                `INSERT INTO medicos (nome, email, senha, atuacao, certificado_caminho) VALUES (?, ?, ?, ?, ?)`,
                [nome, email, hashSenha, atuacao, certificado_caminho]
                

            );

            const medico_id = result.insertId;

            // 3. Dispara o E-mail para o Admin
             await enviarEmailParaOAdmin(medico_id, nome, certificado_caminho);

             res.send("Cadastro realizado! Aguardando aprovação do administrador.");
    
        } catch (error){
            console.error(error);
            res.status(500).json({ error: 'Erro ao cadastrar médico' });
        }

    });



    async function enviarEmailParaOAdmin(id_medico,nome,caminho){
        //configurando o email 
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth : {user: 'cauaamorim05@gmail.com', pass: 'xhlk zfvj woaa xzyu'}
        }); 

        //LINK DOS BOÕES DE APROVAR E REJEITAR, PASSANDO O ID DO MEDICO PARA O ADMIN REALIZAR A AÇÃO DE APROVAR OU REJEITAR O CADASTRO
        const linkAprovar = `http://localhost:3000/admin/acao?id=${id_medico}&acao=aprovado`;
        const linkRejeitar = `http://localhost:3000/admin/acao?id=${id_medico}&acao=rejeitado`;

        
        //Enviando o email para o admin com as informações do medico e os links de ação
        let info = await transporter.sendMail({
        from: '"Sistema Médico" <cauaamorim05@gmail.com>',
        to: "cauaamorim05@gmail.com", // E-mail do administrador
        subject: `Novo Médico: ${nome}`,
        html: `
           <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Novo Cadastro de Médico</title>
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
        
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    
                    <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); overflow: hidden; max-width: 600px; width: 100%;">
                        
                        <tr>
                            <td align="center" style="background: linear-gradient(135deg, #caf0f8, #90e0ef); padding: 40px 20px;">
                                <h1 style="margin: 0; font-size: 24px; color: #0077b6; font-weight: 700; letter-spacing: -0.5px;">Ação Necessária</h1>
                                <p style="margin: 10px 0 0 0; font-size: 16px; color: #0077b6; opacity: 0.8;">Um novo médico aguarda sua aprovação.</p>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #64748b;">
                                    Olá, Administrador.
                                    <br><br>
                                    O médico <strong>${nome}</strong> acabou de se cadastrar na plataforma e enviou seu CRM/Certificado para análise.
                                </p>

                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-radius: 10px; padding: 20px; margin-bottom: 30px;">
                                    <tr>
                                        <td style="font-size: 14px; color: #0f172a; line-height: 1.8;">
                                            <strong>Nome:</strong> ${nome}<br>
                                            <strong>Status:</strong> <span style="color: #f59e0b; font-weight: 600;">Pendente</span><br>
                                            <strong>Documento:</strong> <a href="http://localhost:3000/${caminho}" target="_blank" style="color: #00b4d8; text-decoration: none; font-weight: 600;">Ver Certificado Anexado &rarr;</a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="margin: 0 0 25px 0; font-size: 16px; color: #0f172a; font-weight: 600; text-align: center;">
                                    Qual a sua decisão?
                                </p>

                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td align="center" style="padding-bottom: 20px;">
                                            
                                            <a href="${linkAprovar}" style="display: inline-block; background-color: #2ecc71; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 30px; border-radius: 50px; margin: 0 10px 10px 0; border: 2px solid #2ecc71; text-align: center;">
                                                &check; Aprovar Médico
                                            </a>

                                            <a href="${linkRejeitar}" style="display: inline-block; background-color: transparent; color: #e74c3c; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 30px; border-radius: 50px; margin: 0 0 10px 0; border: 2px solid #e74c3c; text-align: center;">
                                                &times; Rejeitar
                                            </a>
                                            
                                        </td>
                                    </tr>
                                </table>

                            </td>
                        </tr>

                        <tr>
                            <td align="center" style="background-color: #0f172a; padding: 20px; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
                                <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                                    Este é um e-mail automático do seu sistema.<br>
                                    Não é necessário responder.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `
    });
    }


    app.get('/admin/acao', async (req, res) => {
    const { id, acao } = req.query; // Pega os dados da URL 

    if (acao === 'aprovado' || acao === 'rejeitado') {
        try {
            await pool.execute(
                `UPDATE medicos SET status = ? WHERE medico_id = ?`,
                [acao, id]
            );

            if (acao === 'aprovado') {
                res.send("<h1>Médico APROVADO com sucesso!</h1>");
            } else {
                res.send("<h1>Médico REJEITADO.</h1>");
            }
        } catch (error) {
          console.error("🔴 ERRO NO BANCO DE DADOS:", error);
            res.status(500).send("Erro ao atualizar status.");
        }
    } else {
        res.status(400).send("Ação inválida.");
    }
});


// Rota de Login do medico 
app.post('/login-medico', async (req, res) => {
    const { email, senha } = req.body;

    try {
        // 1. Busca o médico no banco
        const [rows] = await pool.execute(`SELECT * FROM medicos WHERE email = ?`, [email]);
        const medico = rows[0];

        // 2. Se o médico NÃO existir, barra aqui
        if (!medico) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        // 3. Verifica a senha
        const senhaValida = await bcrypt.compare(senha, medico.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        // 4. Verifica o status do cadastro
        if (medico.status === 'pendente') {
            return res.status(403).json({ erro: "Seu cadastro ainda está em análise pelo administrador." });
        } 
        
        if (medico.status === 'rejeitado') {
            return res.status(403).json({ erro: "Seu cadastro foi desaprovado pelo administrador." });
        }

        // 5. Se passou por todas as barreiras, está APROVADO! Gera o Token:
        if (medico.status === 'aprovado') {
            const tokenReal = jwt.sign(
                { id: medico.id, nome: medico.nome }, 
                process.env.JWT_SECRET, 
                { expiresIn: '2h' } 
            );

            return res.status(200).json({ 
                mensagem: "Login aprovado",
                token: tokenReal, 
                nome: medico.nome 
            });
        }

    } catch (error) {
       
        console.error("🔴 ERRO INTERNO NO LOGIN:", error);
        return res.status(500).json({ erro: "Erro interno no servidor. Tente novamente mais tarde." });
    }
});
//parte de medico termina aqui

const PORTA = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${process.env.PORT}`);
  console.log(`🌐 Acesse: http://localhost:${process.env.PORT}`);
});


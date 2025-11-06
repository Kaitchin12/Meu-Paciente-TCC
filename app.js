// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

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
  res.sendFile(path.join(__dirname, "public", "login.html"));
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


const PORTA = process.env.PORT || 3000;
app.listen(process.env.PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${process.env.PORT}`);
  console.log(`🌐 Acesse: http://localhost:${process.env.PORT}`);
});


// Cadastro e Login - arquivo.js
// Cadastro
const formCadastro = document.getElementById('formCadastro');
if (formCadastro) {
  formCadastro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(formCadastro).entries());

    const resp = await fetch('/api/cadastro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await resp.json();
    document.getElementById('mensagem').textContent = resultado.mensagem || resultado.erro;
  });
}

// Login
const formLogin = document.getElementById('formLogin');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = Object.fromEntries(new FormData(formLogin).entries());

    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await resp.json();

    if (resultado.token) {
      localStorage.setItem('token', resultado.token);
      window.location.href = 'perfil.html';
    } else {
      document.getElementById('mensagem').textContent = resultado.erro;
    }
  });
}

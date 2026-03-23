// 1. Lógica do Cadastro (Com upload de arquivo)
const formCadastroMedico = document.getElementById('formCadastroMedico');

if (formCadastroMedico) {
  formCadastroMedico.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.textContent = "Enviando dados e certificado, aguarde...";
    mensagemEl.style.color = "var(--primary-dark)"; // Usando a cor do seu CSS

    // Usamos o FormData puro para que o arquivo seja enviado corretamente
    const formData = new FormData(formCadastroMedico);

    try {
      const resp = await fetch('/cadastrar-medico', { 
        method: 'POST',
        body: formData // Sem headers, o navegador faz isso sozinho!
      });

      if (resp.ok) {
        mensagemEl.textContent = "Cadastro realizado com sucesso! Aguardando aprovação do administrador.";
        mensagemEl.style.color = "var(--success)"; // Verde do seu CSS
        
        // Limpa o formulário após o sucesso
        formCadastroMedico.reset();
        
        // Opcional: Redirecionar para o login após 3 segundos
        setTimeout(() => {
            window.location.href = 'login-medico.html';
        }, 3000);

      } else {
        const erroTexto = await resp.text(); 
        mensagemEl.textContent = erroTexto || "Erro ao realizar o cadastro.";
        mensagemEl.style.color = "red";
      }

    } catch (error) {
      console.error("Erro na requisição:", error);
      mensagemEl.textContent = "Erro de conexão com o servidor.";
      mensagemEl.style.color = "red";
    }
  });
}


// 2. Lógica do Login (Checando o Status: Aprovado, Pendente, Rejeitado)
// Assumindo que no seu HTML de login o form tem id="formLogin"
const formLogin = document.getElementById('formLoginMedico');

if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    

    const mensagemEl = document.getElementById('mensagem');
    mensagemEl.textContent = "Verificando credenciais...";
    mensagemEl.style.color = "var(--primary-dark)";

    // Como o login é só texto (email e senha), podemos usar JSON
    const dados = Object.fromEntries(new FormData(formLogin).entries());

    try {
      const resp = await fetch('/login-medico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });

      // Pega a resposta do backend (que configuramos para ser res.json)
      const resultado = await resp.json();
   
     

      if (resp.ok && resultado.token) {
        
       
        localStorage.setItem('token', resultado.token);
        
        // Se quiser salvar o nome do médico para exibir na Home:
        if(resultado.nome) localStorage.setItem('nomeMedico', resultado.nome);
        
        window.location.href = 'home_medico.html'; 
      } else {
    
        // Aqui vai cair a mensagem de "Pendente", "Rejeitado" ou "Senha Incorreta"
        mensagemEl.textContent = resultado.erro || "Erro ao fazer login.";
        mensagemEl.style.color = "red";
      } 

    } catch (error) {
      console.error("Erro na requisição:", error);
      mensagemEl.textContent = "Erro de conexão com o servidor.";
      mensagemEl.style.color = "red";
    }
  });
}
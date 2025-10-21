// auth.js - Login simples (localStorage)

// Usuário padrão (você pode mudar)
const USER = {
  email: "admin@paiva.com",
  password: "123456"
};

// API exposta globalmente (compatível com layout.js)
window.AUTH = {
  waitForAuth() {
    return Promise.resolve(AUTH.isLoggedIn() ? { email: localStorage.getItem("userEmail") } : null);
  },
  isLoggedIn() {
    return !!localStorage.getItem("userEmail");
  },
  getUser() {
    if (!AUTH.isLoggedIn()) return null;
    return { email: localStorage.getItem("userEmail") };
  },
  loginWithEmail(email, password) {
    if (email === USER.email && password === USER.password) {
      localStorage.setItem("userEmail", email);
      return Promise.resolve({ email });
    } else {
      return Promise.reject("E-mail ou senha incorretos.");
    }
  },
  signUpWithEmail() {
    alert("Cadastro desativado neste sistema. Solicite acesso ao administrador.");
  },
  sendPasswordReset() {
    alert("Recuperação de senha não disponível neste modo offline.");
  },
  logout() {
    localStorage.removeItem("userEmail");
    location.href = "login.html";
  }
};


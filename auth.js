// auth.js — controle de login/sessão no front-end (simples)

// >>> Ajuste aqui seu usuário e senha (hash). <<<
// Usuário padrão:
const AUTH_USER = "admin";

// Senha padrão: "admin123"
// SHA-256("admin123") = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
// Troque o hash abaixo para o hash da senha que você quiser.
const AUTH_PASS_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

const AUTH_STORAGE_KEY = "paiva_auth_v1";

async function sha256(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const AUTH = {
  async login(user, pass) {
    const passHash = await sha256(pass || "");
    if (String(user).trim() === AUTH_USER && passHash === AUTH_PASS_HASH) {
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const session = { user: AUTH_USER, token, ts: Date.now() };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      return { ok: true };
    }
    return { ok: false, message: "Usuário ou senha inválidos." };
  },

  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  isLoggedIn() {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return false;
      const sess = JSON.parse(raw);
      // (Opcional) expirar sessão, ex.: 24h
      // if (Date.now() - (sess.ts || 0) > 24 * 60 * 60 * 1000) { this.logout(); return false; }
      return !!sess?.token && sess?.user === AUTH_USER;
    } catch {
      return false;
    }
  }
};

// Torna global caso precise em outros scripts
window.AUTH = AUTH;

// Dica: para gerar o hash da sua própria senha no console do navegador:
// (async () => console.log(await sha256("minhaSenhaForte")))();

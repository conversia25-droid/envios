<!-- auth-firebase.js — cole este bloco em um arquivo .js e referencie nas páginas -->
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script>
/* ===========================================================
   🔧 CONFIG DO FIREBASE
   Troque pelos valores do seu projeto (Project settings → General → Your apps)
   =========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyDZEsP1TxB9LZmGqqGzTsLnoNqr1UqpkoU",
  authDomain: "conversia-5083d.firebaseapp.com",
  projectId: "conversia-5083d",
  appId: "1:1015173309969:web:94cac3288c25b0ab8833b0",
  // measurementId: "opcional"
};

// Inicializa Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

/* ===========================================================
   👤 API de Autenticação exposta ao site
   Compatível com layout.js e login.html
   =========================================================== */
window.AUTH = {
  /** Aguarda o Firebase decidir (logado ou não) */
  waitForAuth() {
    return new Promise(resolve => {
      const unsub = auth.onAuthStateChanged(user => { unsub(); resolve(user || null); });
    });
  },

  /** Está logado? */
  isLoggedIn() { return !!auth.currentUser; },

  /** Dados do usuário atual (ou null) */
  getUser() {
    const u = auth.currentUser;
    if (!u) return null;
    return {
      uid: u.uid,
      email: u.email || null,
      name: u.displayName || null,
      photo: u.photoURL || null,
      emailVerified: !!u.emailVerified,
    };
  },

  /** Login com Google (popup) */
  async loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();

    // (Opcional) Force account selection sempre:
    provider.setCustomParameters({ prompt: 'select_account' });

    const cred = await auth.signInWithPopup(provider);

    /* (Opcional) restringir a um domínio:
       const email = cred.user?.email || '';
       if (!email.endsWith('@paiva.com.br')) {
         await auth.signOut();
         throw new Error('Acesso restrito a contas @paiva.com.br');
       }
    */
    return cred.user;
  },

  /** Login com e-mail/senha */
  async loginWithEmail(email, pass) {
    const { user } = await auth.signInWithEmailAndPassword(email, pass);
    return user;
  },

  /** Cadastro com e-mail/senha */
  async signUpWithEmail(email, pass) {
    const { user } = await auth.createUserWithEmailAndPassword(email, pass);
    // (Opcional) Enviar verificação de e-mail:
    try { await user.sendEmailVerification(); } catch {}
    return user;
  },

  /** Enviar e-mail de reset de senha */
  async sendPasswordReset(email) {
    await auth.sendPasswordResetEmail(email);
  },

  /** Sair */
  async logout() { await auth.signOut(); }
};

/* ===========================================================
   🧪 Util: loga mudanças de auth no console (pode remover)
   =========================================================== */
auth.onAuthStateChanged(u => {
  if (u) {
    console.log('[Auth] Logado:', u.email || u.displayName || u.uid);
  } else {
    console.log('[Auth] Deslogado');
  }
});
</script>

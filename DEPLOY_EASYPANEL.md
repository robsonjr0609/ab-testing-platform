# Deploy no Easypanel (Hetzner)

## Pré-requisitos
- Conta no GitHub
- Servidor Hetzner com Easypanel instalado

---

## Passo 1 — Subir o código no GitHub

Abra o terminal na pasta `ab-testing-platform` e rode:

```bash
git init
git add .
git commit -m "Initial commit - AB Testing Platform"
git remote add origin https://github.com/SEU_USUARIO/ab-testing.git
git push -u origin main
```

---

## Passo 2 — Criar o banco PostgreSQL no Easypanel

1. No Easypanel, clique em **"+ Create Service"**
2. Escolha **PostgreSQL**
3. Dê o nome: `ab-testing-db`
4. Clique em **Create** e aguarde inicializar
5. Copie a **Connection String** (algo como `postgresql://postgres:senha@ab-testing-db:5432/ab-testing-db`)

---

## Passo 3 — Criar o App no Easypanel

1. Clique em **"+ Create Service"** → **App**
2. Dê o nome: `ab-testing`
3. Em **Source**, escolha **GitHub** e selecione seu repositório
4. Em **Build**, selecione **Dockerfile** (o Easypanel detecta automaticamente)
5. Em **Environment Variables**, adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Cole a Connection String do Passo 2 |
| `PORT` | `3000` |
| `CORS_ORIGIN` | `*` (ou seu domínio: `https://meusite.com`) |
| `USE_SQLITE` | `false` |

6. Em **Domains**, adicione um subdomínio (ex: `ab-testing.seuservidor.com`)
7. Clique em **Deploy**

---

## Passo 4 — Usar o Tracker no seu site

Após o deploy, adicione este script em **todas as páginas** que você quer testar:

```html
<script src="https://ab-testing.seuservidor.com/tracker.js"></script>
```

> O tracker detecta automaticamente o servidor — não precisa configurar nada!

---

## Passo 5 — Acessar o Dashboard

Abra no navegador:
```
https://ab-testing.seuservidor.com/dashboard.html
```

---

## Estrutura de arquivos do projeto

```
ab-testing-platform/
├── Dockerfile          ← Usado pelo Easypanel
├── .gitignore
├── client/
│   ├── dashboard.html  ← Painel de controle
│   ├── tracker.js      ← Script para colocar nos sites
│   └── index.html      ← Página de demo
└── server/
    ├── index.js        ← API principal
    ├── db.js           ← Banco de dados (SQLite ou PostgreSQL)
    ├── package.json
    └── .env.example    ← Exemplo de variáveis de ambiente
```

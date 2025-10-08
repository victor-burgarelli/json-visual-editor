# JSON Editor - Deploy no GitHub Pages

## 📝 Passos para publicar

### 1. Crie um repositório no GitHub
- Acesse https://github.com/new
- Escolha um nome (ex: `json-editor`)
- Marque como **Public**
- Clique em "Create repository"

### 2. Configure o vite.config.ts

Adicione a propriedade `base` com o nome do seu repositório:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  base: '/nome-do-seu-repositorio/', // ⚠️ IMPORTANTE: Substitua pelo nome real!
})
```

**Exemplo:** Se seu repositório for `https://github.com/seunome/json-editor`, use:
```ts
base: '/json-editor/',
```

### 3. Inicialize o Git e faça o push

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### 4. Ative o GitHub Pages

1. Vá até o repositório no GitHub
2. Clique em **Settings** (Configurações)
3. No menu lateral, clique em **Pages**
4. Em **Source**, selecione **GitHub Actions**

### 5. Aguarde o deploy

- O GitHub Actions vai rodar automaticamente
- Acesse a aba **Actions** para ver o progresso
- Quando terminar, seu site estará disponível em:
  `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`

## 🔄 Atualizações futuras

Sempre que você fizer um `git push` para a branch `main`, o site será automaticamente atualizado!

## ⚠️ Importante

- Não esqueça de configurar o `base` no `vite.config.ts`
- Use o nome EXATO do repositório (case-sensitive)
- Adicione a barra `/` no final do `base`

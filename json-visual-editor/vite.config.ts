import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Repositório alvo informado: "victor-burgarelli/json-visual-editor"
// A aplicação ficará acessível em: https://victor-burgarelli.github.io/json-visual-editor/
// Portanto definimos base: '/json-visual-editor/'.
// Caso mude o nome do repositório ou use domínio customizado (CNAME), ajuste este valor.
export default defineConfig({
  base: '/json-visual-editor/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})


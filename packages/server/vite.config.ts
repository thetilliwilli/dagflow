// Сборка сервера в один самодостаточный файл для Node, Bun и Deno (research R11)
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // ws и пакеты монорепо — внутрь файла: рядом с ним не нужен node_modules
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rolldownOptions: {
      output: { format: 'es', entryFileNames: 'dagflow-server.mjs', codeSplitting: false },
    },
  },
});

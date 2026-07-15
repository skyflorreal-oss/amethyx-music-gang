// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// แท่นสตาร์ทมาตรฐานสำหรับ Tailwind v3
export default defineConfig({
  plugins: [react()],
})
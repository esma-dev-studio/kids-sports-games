import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' で GitHub Pages のサブパス配信でも壊れないようにする
export default defineConfig({
  plugins: [react()],
  base: './',
})

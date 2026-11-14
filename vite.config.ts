import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// GitHub Pages ではリポジトリ名のパス配下で配信されるため、
// ビルド時に環境変数 VITE_BASE(例: /kotoba-path/)で base を指定する。
// 未指定ならルート('/')。ローカルの dev / preview はそのまま動く。
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

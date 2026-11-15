// Vitest 共通セットアップ。IndexedDB を Node 上で動かすためのダミー実装を読み込む。
import 'fake-indexeddb/auto'

import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

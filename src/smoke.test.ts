import { describe, expect, it } from 'vitest'

// 土台の動作確認用。Vitest と IndexedDB のダミー(fake-indexeddb)が使えることだけを確かめる。
describe('テスト環境', () => {
  it('IndexedDB が使える', () => {
    expect(typeof indexedDB.open).toBe('function')
  })
})

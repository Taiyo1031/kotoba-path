/// <reference types="node" />

// src内のNode APIを使う既存テストにも、インストール済みの型を読み込む。
import { create } from 'zustand'
import { getAppStore } from '../db'
import type { StudyData } from '../schema'

interface AppState {
  status: 'loading' | 'ready' | 'error'
  data: StudyData | null
  lastBackupAt: string | null
  error?: string
  reload(): Promise<void>
}

export const useAppState = create<AppState>((set) => ({
  status: 'loading',
  data: null,
  lastBackupAt: null,
  async reload() {
    set({ status: 'loading', error: undefined })
    try {
      const store = getAppStore()
      const [data, lastBackupAt] = await Promise.all([
        store.loadStudyData(),
        store.getLastBackupAt(),
      ])
      set({ status: 'ready', data, lastBackupAt })
    } catch {
      set({ status: 'error', data: null, error: 'data.operationError' })
    }
  },
}))

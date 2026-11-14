export type PersistResult = 'granted' | 'denied' | 'unsupported'

export async function requestPersistentStorage(): Promise<PersistResult> {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') {
      return 'unsupported'
    }
    return (await navigator.storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

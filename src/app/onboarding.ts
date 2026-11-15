export const ONBOARDED_KEY = 'kp.onboarded'

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

export function setOnboarded(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } else {
      localStorage.removeItem(ONBOARDED_KEY)
    }
  } catch {
    // 例外は握りつぶす
  }
}

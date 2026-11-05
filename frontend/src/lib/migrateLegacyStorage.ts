// One-time move of localStorage keys from the old "LifeOS" name to "Tallyo".
// Imported first in main.tsx so it runs before anything reads storage.
const SKIP = new Set(['lifeos_token', 'lifeos_user']) // legacy auth keys, removed by AuthContext

function migrate(storage: Storage): void {
  const oldKeys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && /^lifeos[_-]/.test(key) && !SKIP.has(key)) oldKeys.push(key)
  }
  for (const oldKey of oldKeys) {
    const newKey = 'tallyo' + oldKey.slice('lifeos'.length)
    const value = storage.getItem(oldKey)
    if (value !== null && storage.getItem(newKey) === null) storage.setItem(newKey, value)
    storage.removeItem(oldKey)
  }
}

try {
  migrate(localStorage)
} catch {
  // storage unavailable (private mode etc.) — nothing to migrate
}

import { app, safeStorage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { AppConfig, SensitiveConfig } from '../../shared/types'

const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json')
const SECRETS_FILE = path.join(app.getPath('userData'), 'secrets.json')

const defaultConfig: AppConfig = {
  github: { repo: '', branch: 'master', clientId: '' },
  azure: { container: 'img' },
  author: ''
}

export function readConfig(): AppConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return structuredClone(defaultConfig)
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const saved = JSON.parse(raw) as Partial<AppConfig>
    return {
      github: { ...defaultConfig.github, ...(saved.github ?? {}) },
      azure: { ...defaultConfig.azure, ...(saved.azure ?? {}) },
      author: saved.author ?? defaultConfig.author
    }
  } catch {
    return structuredClone(defaultConfig)
  }
}

export function writeConfig(config: AppConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

export function readSecrets(): SensitiveConfig {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return {}
    const raw = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as Record<string, string>
    const result: SensitiveConfig = {}
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'string') {
        try {
          if (safeStorage.isEncryptionAvailable()) {
            result[key as keyof SensitiveConfig] = safeStorage.decryptString(
              Buffer.from(val, 'base64')
            )
          } else {
            // Fallback: stored as base64
            result[key as keyof SensitiveConfig] = Buffer.from(val, 'base64').toString('utf-8')
          }
        } catch {
          // Ignore corrupted entry
        }
      }
    }
    return result
  } catch {
    return {}
  }
}

export function writeSecrets(secrets: Partial<SensitiveConfig>): void {
  fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true })
  const current = readEncryptedRaw()
  const updated: Record<string, string> = { ...current }

  for (const [key, val] of Object.entries(secrets)) {
    if (val !== undefined && val !== '') {
      if (safeStorage.isEncryptionAvailable()) {
        updated[key] = safeStorage.encryptString(val as string).toString('base64')
      } else {
        updated[key] = Buffer.from(val as string).toString('base64')
      }
    } else {
      delete updated[key]
    }
  }

  fs.writeFileSync(SECRETS_FILE, JSON.stringify(updated, null, 2), 'utf-8')
}

function readEncryptedRaw(): Record<string, string> {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return {}
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

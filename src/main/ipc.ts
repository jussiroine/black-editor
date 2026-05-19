import { ipcMain, shell, dialog } from 'electron'
import { readConfig, readSecrets, writeConfig, writeSecrets } from './services/config'
import {
  initGitHub,
  listPosts,
  getPost,
  savePost,
  startDeviceFlow,
  pollDeviceToken
} from './services/github'
import { initAzure, uploadImage } from './services/azure'
import { initOllama, generateDescription, suggestTags } from './services/ollama'
import type { AppConfig, FrontMatter, SensitiveConfig } from '../shared/types'

function ok<T>(data: T) {
  return { ok: true as const, data }
}
function err(error: unknown) {
  return { ok: false as const, error: error instanceof Error ? error.message : String(error) }
}

function bootServices(): void {
  const config = readConfig()
  const secrets = readSecrets()
  if (secrets.githubToken && config.github.repo) {
    initGitHub(secrets.githubToken, config.github.repo, config.github.branch || 'main')
  }
  if (secrets.azureConnectionString) {
    initAzure(secrets.azureConnectionString, config.azure.container || 'blog-images')
  }
  initOllama(config.ollama?.url ?? 'http://localhost:11434', config.ollama?.model ?? 'gemma4:e4b')
}

export function registerIpcHandlers(): void {
  bootServices()

  // ---- Config ----------------------------------------------------------------
  ipcMain.handle('config:get', () => ok(readConfig()))

  ipcMain.handle(
    'config:set',
    (_e, config: AppConfig, secrets: Partial<SensitiveConfig>) => {
      try {
        writeConfig(config)
        writeSecrets(secrets)
        bootServices()
        return ok(null)
      } catch (e) {
        return err(e)
      }
    }
  )

  // ---- GitHub Auth -----------------------------------------------------------
  ipcMain.handle('github:startDeviceFlow', async (_e, clientId: string) => {
    try {
      const result = await startDeviceFlow(clientId)
      // Log to terminal and show native dialog so the code survives any renderer crash
      console.log(`\n[GitHub Device Flow]\n  Code : ${result.user_code}\n  URL  : ${result.verification_uri}\n`)
      dialog.showMessageBox({
        type: 'info',
        title: 'GitHub Authorization Code',
        message: result.user_code,
        detail: `Visit ${result.verification_uri} and enter the code above.\n\nThe code is also printed in the terminal.`,
        buttons: ['OK — I have the code']
      }).catch(() => {})
      return ok(result)
    } catch (e) {
      return err(e)
    }
  })

  ipcMain.handle('github:openDeviceUrl', async (_e, url: string) => {
    try {
      await shell.openExternal(url)
      return ok(null)
    } catch (e) {
      return err(e)
    }
  })

  ipcMain.handle(
    'github:pollDeviceToken',
    async (_e, clientId: string, deviceCode: string) => {
      try {
        const data = await pollDeviceToken(clientId, deviceCode)
        console.log('[poll]', JSON.stringify(data))
        return ok(data)
      } catch (e) {
        return err(e)
      }
    }
  )

  // ---- GitHub Posts ----------------------------------------------------------
  ipcMain.handle('github:listPosts', async () => {
    try {
      return ok(await listPosts())
    } catch (e) {
      return err(e)
    }
  })

  ipcMain.handle('github:getPost', async (_e, path: string) => {
    try {
      return ok(await getPost(path))
    } catch (e) {
      return err(e)
    }
  })

  ipcMain.handle(
    'github:savePost',
    async (
      _e,
      filePath: string,
      frontMatter: FrontMatter,
      content: string,
      sha: string | undefined,
      message: string
    ) => {
      try {
        const newSha = await savePost(filePath, frontMatter, content, sha, message)
        return ok(newSha)
      } catch (e) {
        return err(e)
      }
    }
  )

  // ---- Azure -----------------------------------------------------------------
  ipcMain.handle(
    'azure:uploadImage',
    async (_e, bufferData: number[], filename: string, mimeType: string) => {
      try {
        const buffer = Buffer.from(bufferData)
        const url = await uploadImage(buffer, filename, mimeType)
        return ok(url)
      } catch (e) {
        return err(e)
      }
    }
  )

  // ---- Ollama ----------------------------------------------------------------
  ipcMain.handle('ollama:suggestTags', async (_e, content: string) => {
    try {
      return ok(await suggestTags(content))
    } catch (e) {
      return err(e)
    }
  })

  ipcMain.handle('ollama:generateDescription', async (_e, content: string) => {
    try {
      return ok(await generateDescription(content))
    } catch (e) {
      return err(e)
    }
  })
}

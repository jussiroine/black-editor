import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppConfig,
  DeviceFlowResponse,
  FrontMatter,
  IpcResult,
  LoadedPost,
  PostMeta,
  SensitiveConfig,
  TokenPollResponse
} from '../shared/types'

const api = {
  config: {
    get: (): Promise<IpcResult<AppConfig>> => ipcRenderer.invoke('config:get'),
    set: (
      config: AppConfig,
      secrets: Partial<SensitiveConfig>
    ): Promise<IpcResult<null>> => ipcRenderer.invoke('config:set', config, secrets)
  },

  github: {
    startDeviceFlow: (clientId: string): Promise<IpcResult<DeviceFlowResponse>> =>
      ipcRenderer.invoke('github:startDeviceFlow', clientId),

    openDeviceUrl: (url: string): Promise<IpcResult<null>> =>
      ipcRenderer.invoke('github:openDeviceUrl', url),

    pollDeviceToken: (
      clientId: string,
      deviceCode: string
    ): Promise<IpcResult<TokenPollResponse>> =>
      ipcRenderer.invoke('github:pollDeviceToken', clientId, deviceCode),

    listPosts: (): Promise<IpcResult<PostMeta[]>> => ipcRenderer.invoke('github:listPosts'),

    getPost: (path: string): Promise<IpcResult<LoadedPost>> =>
      ipcRenderer.invoke('github:getPost', path),

    savePost: (
      path: string,
      frontMatter: FrontMatter,
      content: string,
      sha: string | undefined,
      message: string
    ): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('github:savePost', path, frontMatter, content, sha, message)
  },

  azure: {
    uploadImage: (
      buffer: number[],
      filename: string,
      mimeType: string
    ): Promise<IpcResult<string>> =>
      ipcRenderer.invoke('azure:uploadImage', buffer, filename, mimeType)
  },

  openai: {
    suggestTags: (content: string): Promise<IpcResult<string[]>> =>
      ipcRenderer.invoke('openai:suggestTags', content)
  }
}

contextBridge.exposeInMainWorld('api', api)

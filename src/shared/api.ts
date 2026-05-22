import type {
  AppConfig,
  DeviceFlowResponse,
  FrontMatter,
  IpcResult,
  LoadedPost,
  PostMeta,
  SensitiveConfig,
  TokenPollResponse
} from './types'

export interface ElectronAPI {
  config: {
    get(): Promise<IpcResult<AppConfig>>
    set(config: AppConfig, secrets: Partial<SensitiveConfig>): Promise<IpcResult<null>>
  }
  github: {
    startDeviceFlow(clientId: string): Promise<IpcResult<DeviceFlowResponse>>
    openDeviceUrl(url: string): Promise<IpcResult<null>>
    pollDeviceToken(
      clientId: string,
      deviceCode: string
    ): Promise<IpcResult<TokenPollResponse>>
    listPosts(): Promise<IpcResult<PostMeta[]>>
    getPost(path: string): Promise<IpcResult<LoadedPost>>
    savePost(
      path: string,
      frontMatter: FrontMatter,
      content: string,
      sha: string | undefined,
      message: string
    ): Promise<IpcResult<string>>
    deletePost(path: string, sha: string, message: string): Promise<IpcResult<null>>
  }
  azure: {
    uploadImage(
      buffer: number[],
      filename: string,
      mimeType: string
    ): Promise<IpcResult<string>>
  }
  ollama: {
    generateAbstract(content: string): Promise<IpcResult<string>>
  }
}

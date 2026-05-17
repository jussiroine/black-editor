import { BlobServiceClient } from '@azure/storage-blob'
import { v4 as uuidv4 } from 'uuid'
import * as path from 'path'

let _connectionString: string | undefined
let _container: string | undefined

export function initAzure(connectionString: string, container: string): void {
  _connectionString = connectionString
  _container = container || 'blog-images'
}

export function isAzureReady(): boolean {
  return !!_connectionString
}

export async function uploadImage(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  if (!_connectionString) throw new Error('Azure Storage not configured. Please add connection string in Settings.')

  const client = BlobServiceClient.fromConnectionString(_connectionString)
  const containerClient = client.getContainerClient(_container!)

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const ext = path.extname(filename) || '.jpg'
  const safeName = path
    .basename(filename, ext)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase()
    .slice(0, 40)
  const blobPath = `${year}/${month}/${uuidv4()}-${safeName}${ext}`

  const blockBlobClient = containerClient.getBlockBlobClient(blobPath)
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType }
  })

  return blockBlobClient.url
}

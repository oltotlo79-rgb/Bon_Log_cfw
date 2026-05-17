/**
 * @module lib/storage/s3-sign
 * 最小限の AWS Signature V4 実装。R2 / S3 互換ストレージへの PUT / DELETE / LIST と
 * presigned PUT URL の生成を Node.js 内蔵 crypto だけで行う (@aws-sdk/client-s3 不要)。
 */
import crypto from 'crypto'

function hmacSha256(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmacSha256(`AWS4${secretKey}`, date)
  const kRegion = hmacSha256(kDate, region)
  const kService = hmacSha256(kRegion, service)
  return hmacSha256(kService, 'aws4_request')
}

/** AWS 推奨のパーセントエンコーディング（スラッシュはオプションで保持） */
function awsEncode(str: string, keepSlash = false): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, keepSlash ? '/' : '%2F')
}

/** キーをパス用にエンコード（スラッシュ区切りを維持） */
function encodeKey(key: string): string {
  return key.split('/').map(s => awsEncode(s)).join('/')
}

function getDateStrings(): { date: string; datetime: string } {
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return { date: iso.substring(0, 8), datetime: iso }
}

export interface S3Config {
  endpoint: string        // https://ACCOUNT_ID.r2.cloudflarestorage.com
  region: string          // 'auto' for R2
  accessKeyId: string
  secretAccessKey: string
  bucket: string
}

export async function putObject(
  config: S3Config,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = config
  const host = new URL(endpoint).host
  const { date, datetime } = getDateStrings()
  const path = `/${bucket}/${encodeKey(key)}`
  const contentHash = sha256Hex(body)

  const credentialScope = `${date}/${region}/s3/aws4_request`
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${datetime}\n`
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, contentHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacSha256(getSigningKey(secretAccessKey, date, region, 's3'), stringToSign).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': datetime,
    },
    body: new Uint8Array(body),
  })
  if (!response.ok) {
    throw new Error(`R2 PUT failed: ${response.status} ${await response.text()}`)
  }
}

export async function deleteObject(config: S3Config, key: string): Promise<void> {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = config
  const host = new URL(endpoint).host
  const { date, datetime } = getDateStrings()
  const path = `/${bucket}/${encodeKey(key)}`
  const contentHash = sha256Hex('')

  const credentialScope = `${date}/${region}/s3/aws4_request`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${datetime}\n`
  const canonicalRequest = ['DELETE', path, '', canonicalHeaders, signedHeaders, contentHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacSha256(getSigningKey(secretAccessKey, date, region, 's3'), stringToSign).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint}${path}`, {
    method: 'DELETE',
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': datetime,
    },
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(`R2 DELETE failed: ${response.status} ${await response.text()}`)
  }
}

/**
 * Presigned PUT URL を生成する。
 *
 * Why content-length は signed header に含む:
 *   AWS Signature V4 では署名対象 header 以外を改ざんしても署名検証は通る。
 *   `content-length` を含めないと、API 側で fileSize を申告チェックしても
 *   発行後の URL に任意サイズの payload を投げる迂回が成立する。
 *   `signedContentLength` を渡し署名対象に含めることで、PUT 時に必ずその長さを送る必要がある。
 */
export function createPresignedPutUrl(
  config: S3Config,
  key: string,
  contentType: string,
  expiresIn: number,
  signedContentLength?: number,
): string {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = config
  const host = new URL(endpoint).host
  const { date, datetime } = getDateStrings()
  const path = `/${bucket}/${encodeKey(key)}`

  const credentialScope = `${date}/${region}/s3/aws4_request`
  const includeContentLength = typeof signedContentLength === 'number' && signedContentLength > 0
  const signedHeaders = includeContentLength ? 'content-length;content-type;host' : 'content-type;host'

  const qp: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  }
  const sortedQuery = Object.entries(qp)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .join('&')

  const canonicalHeaders = includeContentLength
    ? `content-length:${signedContentLength}\ncontent-type:${contentType}\nhost:${host}\n`
    : `content-type:${contentType}\nhost:${host}\n`
  const canonicalRequest = ['PUT', path, sortedQuery, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacSha256(getSigningKey(secretAccessKey, date, region, 's3'), stringToSign).toString('hex')

  return `${endpoint}${path}?${sortedQuery}&X-Amz-Signature=${signature}`
}

export interface S3Object {
  Key: string
  Size: number
}

export interface ListObjectsResult {
  Contents: S3Object[]
  IsTruncated: boolean
  NextContinuationToken?: string
}

export async function listObjects(
  config: S3Config,
  options: { maxKeys?: number; continuationToken?: string } = {}
): Promise<ListObjectsResult> {
  const { endpoint, region, accessKeyId, secretAccessKey, bucket } = config
  const host = new URL(endpoint).host
  const { date, datetime } = getDateStrings()

  const qpEntries: [string, string][] = [['list-type', '2']]
  if (options.maxKeys) qpEntries.push(['max-keys', String(options.maxKeys)])
  if (options.continuationToken) qpEntries.push(['continuation-token', options.continuationToken])
  const sortedQuery = qpEntries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${awsEncode(k)}=${awsEncode(v)}`)
    .join('&')

  const path = `/${bucket}`
  const contentHash = sha256Hex('')
  const credentialScope = `${date}/${region}/s3/aws4_request`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${datetime}\n`
  const canonicalRequest = ['GET', path, sortedQuery, canonicalHeaders, signedHeaders, contentHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', datetime, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacSha256(getSigningKey(secretAccessKey, date, region, 's3'), stringToSign).toString('hex')
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(`${endpoint}/${bucket}?${sortedQuery}`, {
    headers: {
      Authorization: authorization,
      'x-amz-content-sha256': contentHash,
      'x-amz-date': datetime,
    },
  })
  if (!response.ok) {
    throw new Error(`R2 LIST failed: ${response.status} ${await response.text()}`)
  }

  return parseListObjectsXml(await response.text())
}

function parseListObjectsXml(xml: string): ListObjectsResult {
  const contents: S3Object[] = []
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const block = match[1]
    if (!block) continue
    const key = block.match(/<Key>([\s\S]*?)<\/Key>/)?.[1]
    const size = block.match(/<Size>(\d+)<\/Size>/)?.[1]
    if (key && size) contents.push({ Key: key, Size: parseInt(size, 10) })
  }
  return {
    Contents: contents,
    IsTruncated: xml.includes('<IsTruncated>true</IsTruncated>'),
    NextContinuationToken: xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1],
  }
}

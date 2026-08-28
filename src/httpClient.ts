import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { URL } from 'url';
import { resolveWildcards } from './wildcardResolver';

export interface HttpRequestOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponseData {
  success: boolean;
  status?: number;
  statusText?: string;
  timeMs: number;
  headers?: Record<string, string>;
  body?: string;
  isJson?: boolean;
  error?: string;
  resolvedRequest?: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
}

/**
 * 使用 Node 原生 http / https 模块发送请求
 * 完美支持所有自定义 Headers（如 Postman-Token, Host, Connection, Content-Length 等），不产生 Undici fetch 的 terminated 限制
 */
export async function executeHttpRequest(options: HttpRequestOptions): Promise<HttpResponseData> {
  const startTime = Date.now();

  try {
    // 1. 处理 URL 与通配符
    let resolvedUrl = resolveWildcards(options.url.trim());
    if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://')) {
      resolvedUrl = 'http://' + resolvedUrl;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(resolvedUrl);
    } catch {
      throw new Error(`Invalid URL: ${resolvedUrl}`);
    }

    // 2. 处理 Body
    let resolvedBody: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase()) && options.body) {
      // 自动剥离类似 // 或 /* */ 的注释，确保服务端能正常解析 JSON
      const strippedBody = options.body
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^\\])\/\/.*$/gm, '$1');
      resolvedBody = resolveWildcards(strippedBody);
    }

    // 3. 处理 Headers
    const resolvedHeaders: Record<string, string> = {};
    for (const [rawKey, rawValue] of Object.entries(options.headers)) {
      const key = rawKey.trim();
      if (!key) continue;

      let value = resolveWildcards(rawValue);

      // 处理 Postman 专有的 <calculated when request is sent>
      if (value.includes('<calculated when request is sent>')) {
        const lowerKey = key.toLowerCase();
        if (lowerKey === 'postman-token') {
          value = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        } else if (lowerKey === 'host') {
          value = parsedUrl.host;
        } else if (lowerKey === 'content-length') {
          if (resolvedBody) {
            value = Buffer.byteLength(resolvedBody, 'utf8').toString();
          } else {
            continue;
          }
        }
      }

      resolvedHeaders[key] = value;
    }

    // 如果有 Body 且没有设置 Content-Length，自动补充
    if (resolvedBody && !resolvedHeaders['Content-Length'] && !resolvedHeaders['content-length']) {
      resolvedHeaders['Content-Length'] = Buffer.byteLength(resolvedBody, 'utf8').toString();
    }

    // 4. 发起请求
    const isHttps = parsedUrl.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions: https.RequestOptions = {
      method: options.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: (parsedUrl.pathname || '/') + (parsedUrl.search || ''),
      headers: resolvedHeaders,
      timeout: 30000,
      rejectUnauthorized: false
    };

    const responseData = await new Promise<HttpResponseData>((resolve) => {
      const req = requestModule.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];

        // 处理压缩编码 (gzip, deflate, br)
        let stream: NodeJS.ReadableStream = res;
        const contentEncoding = (res.headers['content-encoding'] || '').toLowerCase();

        if (contentEncoding.includes('gzip')) {
          const gunzip = zlib.createGunzip();
          res.pipe(gunzip);
          stream = gunzip;
        } else if (contentEncoding.includes('deflate')) {
          const inflate = zlib.createInflate();
          res.pipe(inflate);
          stream = inflate;
        } else if (contentEncoding.includes('br')) {
          const brotli = zlib.createBrotliDecompress();
          res.pipe(brotli);
          stream = brotli;
        }

        stream.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        stream.on('end', () => {
          const duration = Date.now() - startTime;
          const rawBuffer = Buffer.concat(chunks);
          const rawText = rawBuffer.toString('utf8');

          // 整理响应头
          const respHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) {
              respHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
            }
          }

          // 尝试格式化 JSON
          let isJson = false;
          let formattedBody = rawText;
          try {
            const parsed = JSON.parse(rawText);
            formattedBody = JSON.stringify(parsed, null, 2);
            isJson = true;
          } catch {
            isJson = false;
          }

          resolve({
            success: true,
            status: res.statusCode || 200,
            statusText: res.statusMessage || 'OK',
            timeMs: duration,
            headers: respHeaders,
            body: formattedBody,
            isJson,
            resolvedRequest: {
              method: options.method.toUpperCase(),
              url: resolvedUrl,
              headers: resolvedHeaders,
              body: resolvedBody
            }
          });
        });

        stream.on('error', (err) => {
          const duration = Date.now() - startTime;
          resolve({
            success: false,
            timeMs: duration,
            error: `Stream decompression error: ${err.message}`
          });
        });
      });

      req.on('error', (err) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          timeMs: duration,
          error: err.message || String(err)
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          timeMs: duration,
          error: 'Request Timeout (30s exceeded)'
        });
      });

      // 写入请求体
      if (resolvedBody) {
        req.write(resolvedBody);
      }
      req.end();
    });

    return responseData;
  } catch (err: any) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      timeMs: duration,
      error: err?.message || String(err)
    };
  }
}

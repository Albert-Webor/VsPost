/**
 * 通配符 / 动态变量解析器
 * 支持在 URL、Header、Body 中使用类似 {{timestamp}} 的占位符
 */

export function resolveWildcards(text: string): string {
  if (!text) {
    return text;
  }

  return text.replace(/\{\{([^{}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    switch (trimmedKey.toLowerCase()) {
      case 'timestamp':
      case '$timestamp':
        return Date.now().toString();

      case 'iso':
      case '$iso':
      case 'isodate':
        return new Date().toISOString();

      case 'date':
      case '$date':
        return new Date().toISOString().split('T')[0];

      case 'guid':
      case 'uuid':
      case '$guid':
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

      case 'randomint':
      case '$randomint':
        return Math.floor(Math.random() * 10000).toString();

      default:
        // 如果未匹配到内置变量，保留原样
        return match;
    }
  });
}

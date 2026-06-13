import fs from 'fs';
import path from 'path';
import { AuditProvider, AuditResult } from './AuditProvider';

export class LocalAuditProvider implements AuditProvider {
  private sensitiveWords: string[] = [];

  constructor() {
    this.loadSensitiveWords();
  }

  // 读取并解析本地文本词库文件
  private loadSensitiveWords() {
    try {
      const filePath = path.resolve(__dirname, '../../sensitive_words.txt');
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.sensitiveWords = content
          .split(/\r?\n/)
          .map(word => word.trim())
          .filter(word => word.length > 0 && !word.startsWith('#'));
        console.log(`[LocalAudit] 成功加载 ${this.sensitiveWords.length} 个本地过滤词`);
      } else {
        // Fallback 默认防护，防止文件缺失导致拦截失效
        this.sensitiveWords = ['垃圾', '广告', '发票', '违禁词', '敏感词', '测试垃圾信息', '你妈的'];
        console.warn('[LocalAudit] 未找到 sensitive_words.txt，已降级为内置基础词库');
      }
    } catch (error: any) {
      console.error('[LocalAudit] 加载敏感词库异常:', error.message || error);
      this.sensitiveWords = ['垃圾', '广告', '发票', '违禁词', '敏感词', '测试垃圾信息', '你妈的'];
    }
  }

  async audit(content: string, nickname?: string): Promise<AuditResult> {
    const matchedContentWords: string[] = [];
    const matchedNicknameWords: string[] = [];
    
    // 对内容进行敏感词检测
    for (const word of this.sensitiveWords) {
      if (content.includes(word)) {
        matchedContentWords.push(word);
      }
    }

    // 对昵称进行敏感词检测
    const nameStr = nickname || '匿名';
    for (const word of this.sensitiveWords) {
      if (nameStr.includes(word)) {
        matchedNicknameWords.push(word);
      }
    }

    const contentMatched = matchedContentWords.length > 0;
    const nicknameMatched = matchedNicknameWords.length > 0;

    if (contentMatched || nicknameMatched) {
      let filteredContent = content;
      let filteredNickname = nameStr;

      // 替换内容的敏感词
      if (contentMatched) {
        // 按长度从长到短匹配替换
        const uniqueContentWords = Array.from(new Set(matchedContentWords));
        uniqueContentWords.sort((a, b) => b.length - a.length);
        uniqueContentWords.forEach(word => {
          filteredContent = filteredContent.split(word).join('***');
        });
      }

      // 替换昵称的敏感词
      if (nicknameMatched) {
        const uniqueNicknameWords = Array.from(new Set(matchedNicknameWords));
        uniqueNicknameWords.sort((a, b) => b.length - a.length);
        uniqueNicknameWords.forEach(word => {
          filteredNickname = filteredNickname.split(word).join('***');
        });
      }

      const reasons: string[] = [];
      if (contentMatched) reasons.push(`内容敏感词: [${matchedContentWords.join(', ')}]`);
      if (nicknameMatched) reasons.push(`昵称敏感词: [${matchedNicknameWords.join(', ')}]`);

      return {
        passed: false,
        reason: reasons.join('; '),
        filteredContent,
        filteredNickname,
        filteredText: filteredContent // 向下兼容旧字段
      };
    }

    return {
      passed: true
    };
  }
}

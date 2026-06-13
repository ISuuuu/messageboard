import { AuditProvider, AuditResult } from './AuditProvider';

export class LocalAuditProvider implements AuditProvider {
  // 定义一些本地测试用的敏感词
  private sensitiveWords: string[] = [
    '垃圾',
    '广告',
    '发票',
    '办证',
    '赌博',
    '毒品',
    '翻墙',
    '科学上网',
    '违禁词',
    '敏感词',
    '测试垃圾信息'
  ];

  async audit(text: string): Promise<AuditResult> {
    const matchedWords: string[] = [];
    
    for (const word of this.sensitiveWords) {
      if (text.includes(word)) {
        matchedWords.push(word);
      }
    }

    if (matchedWords.length > 0) {
      return {
        passed: false,
        reason: `内容包含敏感词: [${matchedWords.join(', ')}]`
      };
    }

    return {
      passed: true
    };
  }
}

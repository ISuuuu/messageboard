import fs from 'fs';
import path from 'path';
import { AuditProvider, AuditResult } from './AuditProvider';

interface TrieNode {
  isEnd?: boolean;
  children: Record<string, TrieNode>;
}

export class LocalAuditProvider implements AuditProvider {
  private root: TrieNode = { children: {} };
  private sensitiveWords: string[] = [];

  constructor() {
    this.loadSensitiveWords();
  }

  // 向 Trie 树中插入敏感词
  private insertWord(word: string) {
    let node = this.root;
    for (const char of word) {
      if (!node.children[char]) {
        node.children[char] = { children: {} };
      }
      node = node.children[char];
    }
    node.isEnd = true;
  }

  // 读取并解析本地文本词库文件并构建 Trie 树
  private loadSensitiveWords() {
    this.root = { children: {} }; // 重置 Trie 树
    try {
      // 自适应寻路：兼容 ts-node 本地运行、dist 编译目录运行、以及打包成单体文件运行等各种部署场景
      const possiblePaths = [
        path.resolve(__dirname, '../../sensitive_words.txt'), // 源码开发路径: src/services/ -> server/
        path.resolve(__dirname, '../sensitive_words.txt'),    // 编译或打包路径: dist/services/ 或 dist/ -> server/
        path.resolve(process.cwd(), 'sensitive_words.txt'),   // 在 server 目录下直接启动: cwd -> server/
        path.resolve(process.cwd(), 'server/sensitive_words.txt'), // 在项目根目录下启动: cwd -> server/
      ];

      let filePath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          filePath = p;
          break;
        }
      }

      if (filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.sensitiveWords = content
          .split(/\r?\n/)
          .map(word => word.trim())
          .filter(word => word.length > 0 && !word.startsWith('#') && !word.startsWith('//') && !word.startsWith(';'));
        console.log(`[LocalAudit] 成功自适应加载词库: ${filePath} (共 ${this.sensitiveWords.length} 个过滤词)`);
      } else {
        // Fallback 默认防护，防止文件缺失导致拦截失效
        this.sensitiveWords = ['垃圾', '广告', '发票', '违禁词', '敏感词', '测试垃圾信息', '你妈的'];
        console.warn(`[LocalAudit] 未找到 sensitive_words.txt，已降级为内置基础词库。尝试过的路径:`, possiblePaths);
      }
    } catch (error: any) {
      console.error('[LocalAudit] 加载敏感词库异常:', error.message || error);
      this.sensitiveWords = ['垃圾', '广告', '发票', '违禁词', '敏感词', '测试垃圾信息', '你妈的'];
    }

    // 构建 Trie 树
    for (const word of this.sensitiveWords) {
      this.insertWord(word);
    }
  }

  /**
   * 使用 DFA 算法进行文本匹配和脱敏
   * @param text 输入文本
   * @returns matchedWords 匹配到的敏感词列表, filteredText 脱敏替换后的文本
   */
  private filterText(text: string): { matchedWords: string[]; filteredText: string } {
    const matchedWords = new Set<string>();
    const chars = Array.from(text);
    const result: string[] = [...chars];

    for (let i = 0; i < chars.length; i++) {
      let node = this.root;
      let matchLength = 0;
      let tempMatchLength = 0;

      for (let j = i; j < chars.length; j++) {
        const char = chars[j];
        if (node.children[char]) {
          node = node.children[char];
          tempMatchLength++;
          if (node.isEnd) {
            matchLength = tempMatchLength;
          }
        } else {
          break;
        }
      }

      // 匹配到最长敏感词
      if (matchLength > 0) {
        const matchedWord = text.substring(i, i + matchLength);
        matchedWords.add(matchedWord);
        
        // 执行脱敏替换：将第一个字符位置替换为 '***'，后续匹配字符替换为空字符串，合并后即为单个 '***'
        result[i] = '***';
        for (let k = i + 1; k < i + matchLength; k++) {
          result[k] = '';
        }
        
        // 跳过被匹配的部分，防止重复计算
        i += matchLength - 1;
      }
    }

    return {
      matchedWords: Array.from(matchedWords),
      filteredText: result.join('')
    };
  }

  async audit(content: string, nickname?: string): Promise<AuditResult> {
    const nameStr = nickname || '匿名';

    const contentRes = this.filterText(content);
    const nicknameRes = this.filterText(nameStr);

    const contentMatched = contentRes.matchedWords.length > 0;
    const nicknameMatched = nicknameRes.matchedWords.length > 0;

    if (contentMatched || nicknameMatched) {
      const reasons: string[] = [];
      if (contentMatched) reasons.push(`内容敏感词: [${contentRes.matchedWords.join(', ')}]`);
      if (nicknameMatched) reasons.push(`昵称敏感词: [${nicknameRes.matchedWords.join(', ')}]`);

      return {
        passed: false,
        reason: reasons.join('; '),
        filteredContent: contentRes.filteredText,
        filteredNickname: nicknameRes.filteredText,
        filteredText: contentRes.filteredText // 向下兼容旧字段
      };
    }

    return {
      passed: true
    };
  }
}

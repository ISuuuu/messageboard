import { AuditProvider, AuditResult } from './AuditProvider';
import { LocalAuditProvider } from './LocalAuditProvider';
import { AliyunAuditProvider } from './AliyunAuditProvider';
import { BaiduAuditProvider } from './BaiduAuditProvider';
import { LlmAuditProvider } from './LlmAuditProvider';
import { config } from '../config';

class AuditManager implements AuditProvider {
  private provider: AuditProvider;

  constructor() {
    const providerType = config.auditProvider;
    console.log(`Initializing Content Audit Service with provider: [${providerType}]`);

    switch (providerType) {
      case 'aliyun':
        this.provider = new AliyunAuditProvider();
        break;
      case 'baidu':
        this.provider = new BaiduAuditProvider();
        break;
      case 'llm':
        this.provider = new LlmAuditProvider();
        break;
      case 'local':
      default:
        this.provider = new LocalAuditProvider();
        break;
    }
  }

  async audit(text: string): Promise<AuditResult> {
    // 基础校验：空内容或纯空白字符拦截
    if (!text || text.trim() === '') {
      return { passed: false, reason: '留言内容不能为空' };
    }
    
    if (text.length > 500) {
      return { passed: false, reason: '留言内容长度不能超过 500 字' };
    }

    try {
      return await this.provider.audit(text);
    } catch (e: any) {
      console.error(`Audit provider [${config.auditProvider}] failed, fallback to local audit.`, e.message || e);
      // Fallback 机制：如果云端 API 出现未捕获异常，退回到本地敏感词库过滤，保证服务可靠
      const localProvider = new LocalAuditProvider();
      return await localProvider.audit(text);
    }
  }
}

export const auditManager = new AuditManager();

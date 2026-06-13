import { AuditProvider, AuditResult } from './AuditProvider';
import { LocalAuditProvider } from './LocalAuditProvider';
import { AliyunAuditProvider } from './AliyunAuditProvider';
import { BaiduAuditProvider } from './BaiduAuditProvider';
import { LlmAuditProvider } from './LlmAuditProvider';
import { config } from '../config';

class AuditManager implements AuditProvider {
  private localProvider: LocalAuditProvider;
  private externalProvider: AuditProvider | null = null;

  constructor() {
    this.localProvider = new LocalAuditProvider();
    const providerType = config.auditProvider;
    console.log(`Initializing Content Audit Service. Primary: [local], Secondary: [${providerType || 'none'}]`);

    if (providerType && providerType !== 'local') {
      switch (providerType) {
        case 'aliyun':
          this.externalProvider = new AliyunAuditProvider();
          break;
        case 'baidu':
          this.externalProvider = new BaiduAuditProvider();
          break;
        case 'llm':
          this.externalProvider = new LlmAuditProvider();
          break;
        default:
          break;
      }
    }
  }

  async audit(content: string, nickname?: string): Promise<AuditResult> {
    // 基础校验：留言内容不能为空
    if (!content || content.trim() === '') {
      return { 
        passed: false, 
        reason: '留言内容不能为空',
        filteredContent: '***(内容违规已屏蔽)',
        filteredNickname: nickname || '匿名'
      };
    }
    
    if (content.length > 500) {
      return { 
        passed: false, 
        reason: '留言内容长度不能超过 500 字',
        filteredContent: '***(内容违规已屏蔽)',
        filteredNickname: nickname || '匿名'
      };
    }

    // 昵称长度校验
    if (nickname && nickname.length > 50) {
      return {
        passed: false,
        reason: '昵称长度不能超过 50 字',
        filteredContent: content,
        filteredNickname: '***'
      };
    }

    // 第一层：本地高效敏感词初筛
    const localResult = await this.localProvider.audit(content, nickname);
    if (!localResult.passed) {
      console.log(`[AuditManager] 本地敏感词拦截拦截成功: ${localResult.reason}`);
      return localResult; // 违禁词命中，直接返回，阻断后续外部 API 请求
    }

    // 第二层：本地通过，若配置了外部服务则进行大模型/云端深度审核
    if (this.externalProvider) {
      try {
        console.log(`[AuditManager] 本地初筛通过，开始使用 [${config.auditProvider}] 进行深度审核...`);
        return await this.externalProvider.audit(content, nickname);
      } catch (e: any) {
        console.error(`[AuditManager] 外部审核服务 [${config.auditProvider}] 异常, 信任本地初筛通过结果:`, e.message || e);
        // 云端接口异常时 Fallback 信任本地初筛结果
        return {
          passed: true,
          filteredContent: content,
          filteredNickname: nickname || '匿名',
          filteredText: content
        };
      }
    }

    // 没有配置外部服务，直接返回本地初筛（已通过）结果
    return localResult;
  }
}

export const auditManager = new AuditManager();

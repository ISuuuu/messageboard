import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { AuditProvider, AuditResult } from './AuditProvider';
import { LlmAuditProvider } from './LlmAuditProvider';
import { config } from '../config';

export class BaiduAuditProvider implements AuditProvider {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0; // 时间戳，毫秒

  private async getAccessToken(): Promise<string> {
    const { apiKey, secretKey } = config.baidu;
    if (!apiKey || !secretKey) {
      throw new Error('百度智能云 API Key 或 Secret Key 未配置，请在 .env 中配置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY');
    }

    // 检查缓存的 Token 是否还有效（预留 60 秒缓冲区）
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
      const response = await axios.post(url, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data.access_token) {
        this.accessToken = response.data.access_token;
        // expires_in 单位是秒，转换为毫秒
        const expiresInMs = (response.data.expires_in || 2592000) * 1000;
        this.tokenExpiresAt = Date.now() + expiresInMs;
        return this.accessToken!;
      } else {
        throw new Error(response.data.error_description || '获取百度 Token 失败');
      }
    } catch (error: any) {
      console.error('百度智能云获取 AccessToken 错误:', error.message || error);
      throw new Error(`获取百度 Token 异常: ${error.message || '未知错误'}`);
    }
  }

  async audit(content: string, nickname?: string): Promise<AuditResult> {
    const nameStr = nickname || '匿名';
    // 联合检测：将昵称和内容拼接发送给百度云，减少请求次数
    const textToAudit = `昵称：${nameStr}\n内容：${content}`;

    try {
      const token = await this.getAccessToken();
      const url = `https://aip.baidubce.com/rest/2.0/solution/v1/text_censor/v2/user_defined?access_token=${token}`;
      
      const response = await axios.post(url, 
        new URLSearchParams({ text: textToAudit }).toString(), 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const data = response.data;

      // 1. 打印百度云原始响应数据，方便排错
      console.log('【百度云审核原始响应】:', JSON.stringify(data, null, 2));

      // 百度文本审核返回值中：
      // conclusionType: 1-合规, 2-不合规, 3-疑似, 4-审核失败
      if (data.conclusionType === 1) {
        return { passed: true };
      } else if (data.conclusionType === 2 || data.conclusionType === 3) {
        // 不合规或疑似不合规
        const reason = data.data && data.data.length > 0 
          ? data.data.map((item: any) => item.msg).join('; ') 
          : '内容不合规';

        // 2. 提取百度云命中的违禁词（多层级字段兼容器）
        const sensitiveWords: string[] = [];
        if (data.data && data.data.length > 0) {
          data.data.forEach((item: any) => {
            // 提取 item 级字段
            if (item.words && Array.isArray(item.words)) {
              sensitiveWords.push(...item.words);
            }
            if (item.word_list && Array.isArray(item.word_list)) {
              sensitiveWords.push(...item.word_list);
            }

            // 提取 hits 内部
            if (item.hits && item.hits.length > 0) {
              item.hits.forEach((hit: any) => {
                // 兼容 words 字段
                if (hit.words) {
                  if (Array.isArray(hit.words)) {
                    sensitiveWords.push(...hit.words);
                  } else if (typeof hit.words === 'string') {
                    sensitiveWords.push(hit.words);
                  }
                }
                // 兼容 word_list 字段
                if (hit.word_list) {
                  if (Array.isArray(hit.word_list)) {
                    sensitiveWords.push(...hit.word_list);
                  } else if (typeof hit.word_list === 'string') {
                    sensitiveWords.push(hit.word_list);
                  }
                }
                // 兼容 word 字段
                if (hit.word) {
                  if (Array.isArray(hit.word)) {
                    sensitiveWords.push(...hit.word);
                  } else if (typeof hit.word === 'string') {
                    sensitiveWords.push(hit.word);
                  }
                }
              });
            }
          });
        }

        let filteredContent = content;
        let filteredNickname = nameStr;

        // 3. 第一轮：用百度检测出的具体敏感词对内容和昵称分别进行星号替换
        if (sensitiveWords.length > 0) {
          const uniqueWords = Array.from(new Set(sensitiveWords.map(w => w.trim()).filter(w => w.length > 0)));
          uniqueWords.sort((a, b) => b.length - a.length);
          uniqueWords.forEach(word => {
            filteredContent = filteredContent.split(word).join('***');
            filteredNickname = filteredNickname.split(word).join('***');
          });
        }

        // 4. 第二轮：联合本地 sensitive_words.txt 词库对留言和昵称再次分别进行过滤
        try {
          const localWordsPath = path.resolve(__dirname, '../../sensitive_words.txt');
          if (fs.existsSync(localWordsPath)) {
            const contentFile = fs.readFileSync(localWordsPath, 'utf-8');
            const localWords = contentFile
              .split(/\r?\n/)
              .map(w => w.trim())
              .filter(w => w.length > 0 && !w.startsWith('#'));
            
            localWords.sort((a, b) => b.length - a.length);
            localWords.forEach(word => {
              filteredContent = filteredContent.split(word).join('***');
              filteredNickname = filteredNickname.split(word).join('***');
            });
          }
        } catch (e) {
          // 忽略本地词库读取报错
        }

        // 5. 第三轮（Hybrid 智能脱敏）：如果前两轮过滤后内容和昵称都依然与原始文本完全一致
        // （代表完全没有抓出局部词，但百度又判违规，多见于广告、水贴等分类模型判定）
        if (filteredContent === content && filteredNickname === nameStr) {
          if (config.llm && config.llm.apiKey) {
            console.log('【混合审查】百度判定违规但未能获取到具体违规词，启动 LLM 智能脱敏...');
            try {
              const llmProvider = new LlmAuditProvider();
              const llmResult = await llmProvider.audit(content, nameStr);
              if (llmResult) {
                filteredContent = llmResult.filteredContent || '***(内容违规已屏蔽)';
                filteredNickname = llmResult.filteredNickname || '***';
                console.log('【混合审查】LLM 智能脱敏成功。内容:', filteredContent, '昵称:', filteredNickname);
              }
            } catch (llmError: any) {
              console.error('【混合审查】LLM 脱敏请求失败，使用安全保底替换。原因:', llmError.message || llmError);
              filteredContent = '***(内容违规已屏蔽)';
              filteredNickname = '***';
            }
          } else {
            console.warn(`【运营提示】百度云判定内容不合规(原因: ${reason})，但未提供具体违规词，且未配置大模型 API Key。已将整句及昵称屏蔽。`);
            console.warn(`若想实现对特定敏感词的局部星号替换，请将其手动写入本地词库中: ${path.resolve(__dirname, '../../sensitive_words.txt')}`);
            filteredContent = '***(内容违规已屏蔽)';
            filteredNickname = '***';
          }
        }

        return {
          passed: false,
          reason: `百度审核拦截: [${reason}]`,
          filteredContent,
          filteredNickname,
          filteredText: filteredContent // 向下兼容旧字段
        };
      } else {
        // 比如 4 或者有其他 error_code 错误
        if (data.error_code) {
          throw new Error(`[${data.error_code}] ${data.error_msg}`);
        }
        // 对于 conclusionType === 4 (审核失败) 等其他无法判定状态，抛出 Error，以便 AuditManager 捕获后降级到本地敏感词过滤
        throw new Error(`百度审核服务异常或无法判定 (conclusionType: ${data.conclusionType}, conclusion: ${data.conclusion || '无法判定'})`);
      }
    } catch (error: any) {
      console.error('百度文本审核服务请求异常:', error.message || error);
      // 抛出错误以触发 AuditManager 的本地降级过滤机制，保证在云服务异常时留言板依然能使用本地词库脱敏放行
      throw new Error(`百度云文本审核接口调用失败 (${error.message || '网络异常'})`);
    }
  }
}

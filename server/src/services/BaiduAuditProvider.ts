import axios from 'axios';
import { AuditProvider, AuditResult } from './AuditProvider';
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

  async audit(text: string): Promise<AuditResult> {
    try {
      const token = await this.getAccessToken();
      const url = `https://aip.baidubce.com/rest/2.2/anticensor/v1/user_defined?access_token=${token}`;
      
      const response = await axios.post(url, 
        new URLSearchParams({ text }).toString(), 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        }
      );

      const data = response.data;

      // 百度文本审核返回值中：
      // conclusionType: 1-合规, 2-不合规, 3-疑似, 4-审核失败
      if (data.conclusionType === 1) {
        return { passed: true };
      } else if (data.conclusionType === 2 || data.conclusionType === 3) {
        // 不合规或疑似不合规
        const reason = data.data && data.data.length > 0 
          ? data.data.map((item: any) => item.msg).join('; ') 
          : '内容不合规';
        return {
          passed: false,
          reason: `百度审核拦截: [${reason}]`
        };
      } else {
        // 比如 4 或者有其他 error_code 错误
        if (data.error_code) {
          throw new Error(`[${data.error_code}] ${data.error_msg}`);
        }
        return {
          passed: false,
          reason: `审核服务异常: ${data.conclusion || '无法判定'}`
        };
      }
    } catch (error: any) {
      console.error('百度文本审核服务请求异常:', error.message || error);
      // 如果发生网络或配置错误，建议 Fallback 为本地简单词库，不直接挂掉
      return {
        passed: false,
        reason: `文本审核接口调用失败 (${error.message || '网络异常'})`
      };
    }
  }
}

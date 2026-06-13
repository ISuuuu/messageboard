import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { AuditProvider, AuditResult } from './AuditProvider';
import { config } from '../config';

export class AliyunAuditProvider implements AuditProvider {
  // 阿里云百分号编码 (Percent Encode)
  private percentEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/\+/g, '%20')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~');
  }

  // 计算阿里云 RPC 签名
  private calculateSignature(params: Record<string, string>, accessKeySecret: string): string {
    // 1. 按参数名排序
    const sortedKeys = Object.keys(params).sort();
    
    // 2. 构造 CanonicalizedQueryString
    const canonicalizedQueryString = sortedKeys
      .map(key => `${this.percentEncode(key)}=${this.percentEncode(params[key])}`)
      .join('&');

    // 3. 构造 StringToSign
    // 阿里云 RPC API 规则：HTTPMethod + "&" + percentEncode("/") + "&" + percentEncode(CanonicalizedQueryString)
    const stringToSign = `POST&%2F&${this.percentEncode(canonicalizedQueryString)}`;

    // 4. 计算 HMAC-SHA1 签名
    const key = `${accessKeySecret}&`;
    return crypto
      .createHmac('sha1', key)
      .update(stringToSign)
      .digest('base64');
  }

  async audit(content: string, nickname?: string): Promise<AuditResult> {
    const { accessKeyId, accessKeySecret, endpoint } = config.aliyun;
    if (!accessKeyId || !accessKeySecret) {
      throw new Error('阿里云 AccessKey 未配置，请在 .env 中配置 ALIYUN_ACCESS_KEY_ID 和 ALIYUN_ACCESS_KEY_SECRET');
    }

    const nameStr = nickname || '匿名';
    // 联合检测：合并昵称和内容
    const textToAudit = `昵称：${nameStr}\n内容：${content}`;

    try {
      // 准备 API 参数
      const params: Record<string, string> = {
        Action: 'TextModeration',
        Version: '2022-03-02',
        Format: 'JSON',
        AccessKeyId: accessKeyId,
        SignatureMethod: 'HMAC-SHA1',
        SignatureVersion: '1.0',
        SignatureNonce: crypto.randomUUID(),
        Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''), // 格式化为 YYYY-MM-DDTHH:MM:SSZ
        RegionId: 'cn-shanghai',
        Service: 'comment_detection',
        ServiceParameters: JSON.stringify({ content: textToAudit })
      };

      // 计算 Signature
      const signature = this.calculateSignature(params, accessKeySecret);
      params.Signature = signature;

      // 构造请求 URL
      const host = endpoint || 'green-cip.cn-shanghai.aliyuncs.com';
      const url = `https://${host}/`;

      // 发送请求 (阿里云 RPC 接口可通过 POST URL 传参)
      const response = await axios.post(
        url,
        null, // 空 Body
        {
          params,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );

      const data = response.data;
      if (data && data.Data) {
        const resultData = data.Data;
        // 阿里云内容安全 v3 返回格式包含 Data: { labels: string, reason: string } 等
        if (!resultData.labels || resultData.labels === 'normal' || resultData.labels === '') {
          return { passed: true };
        } else {
          // 阿里云默认不提供触发词列表，尝试使用本地敏感词库对内容和昵称分别进行脱敏替换
          let filteredContent = content;
          let filteredNickname = nameStr;

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
            // 忽略读取错误
          }

          // 如果经过本地替换后没有任何字段变化，出于安全考虑将整体保底屏蔽
          if (filteredContent === content && filteredNickname === nameStr) {
            filteredContent = '***(内容违规已屏蔽)';
            filteredNickname = '***';
          }

          return {
            passed: false,
            reason: `阿里云审核拦截: [${resultData.labels}] - 原因: ${resultData.reason || '涉嫌违规'}`,
            filteredContent,
            filteredNickname,
            filteredText: filteredContent // 向下兼容旧字段
          };
        }
      }

      return {
        passed: false,
        reason: '阿里云审核返回数据解析异常'
      };
    } catch (error: any) {
      console.error('阿里云自签名文本审核请求异常:', error.response?.data || error.message || error);
      const errMsg = error.response?.data?.Message || error.message || '未知错误';
      // 抛出错误以触发 AuditManager 的本地降级机制
      throw new Error(`阿里云审核服务调用失败 (${errMsg})`);
    }
  }
}

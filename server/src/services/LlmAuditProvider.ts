import axios from 'axios';
import { AuditProvider, AuditResult } from './AuditProvider';
import { config } from '../config';

export class LlmAuditProvider implements AuditProvider {
  async audit(text: string): Promise<AuditResult> {
    const { apiKey, baseUrl, model } = config.llm;
    if (!apiKey) {
      throw new Error('大模型 API Key 未配置，请在 .env 中配置 LLM_API_KEY');
    }

    try {
      const systemPrompt = `你是一个严格的留言板文本内容安全审查助手。你的任务是审查用户留言是否包含违禁或不适宜公开展示的内容。
审查范围包括但不限于：
1. 涉政、敏感政治言论或历史虚无主义。
2. 暴恐、极端主义、违法犯罪、赌博、毒品。
3. 色情、低俗、性挑逗内容。
4. 恶意辱骂、人身攻击、引战、仇恨言论。
5. 纯广告、推销垃圾信息、办证发票欺诈。

如果内容完全合规，请通过。
你必须仅返回一个 JSON 格式的对象（不要返回任何 Markdown 标记或 explanations），格式如下：
{
  "passed": true 或 false,
  "reason": "如果不通过，简短说明原因，例如：'涉嫌广告宣传'，如果通过则忽略此字段"
}`;

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请审查以下文本：\n"${text}"` }
          ],
          temperature: 0.1 // 降低温度以保证输出稳定
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        }
      );

      const choiceContent = response.data?.choices?.[0]?.message?.content;
      if (!choiceContent) {
        throw new Error('LLM 接口返回内容为空');
      }

      // 提取并解析 JSON
      let jsonStr = choiceContent.trim();
      // 兼容可能带有 markdown ```json 标记的输出
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const result = JSON.parse(jsonStr);
      
      return {
        passed: !!result.passed,
        reason: result.reason || 'AI 判定不合规'
      };
    } catch (error: any) {
      console.error('LLM 文本审核异常:', error.message || error);
      // Fallback: 如果 LLM 报错或超时，在留言板这种偏娱乐场景，可选择拦截或放行。我们默认选择拦截并提示审核失败。
      return {
        passed: false,
        reason: `AI 审核暂不可用 (${error.message || '网络超时'})`
      };
    }
  }
}

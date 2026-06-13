import axios from 'axios';
import { AuditProvider, AuditResult } from './AuditProvider';
import { config } from '../config';

export class LlmAuditProvider implements AuditProvider {
  async audit(content: string, nickname?: string): Promise<AuditResult> {
    const { apiKey, baseUrl, model } = config.llm;
    if (!apiKey) {
      throw new Error('大模型 API Key 未配置，请在 .env 中配置 LLM_API_KEY');
    }

    const nameStr = nickname || '匿名';

    try {
      const systemPrompt = `你是一个严格的留言板文本内容安全审查助手。你的任务是同时审查用户留言的“昵称”和“内容”是否包含违禁或不适宜公开展示的内容。
审查范围包括但不限于：
1. 涉政、敏感政治言论或历史虚无主义。
2. 暴恐、极端主义、违法犯罪、赌博、毒品。
3. 色情、低俗、性挑逗内容。
4. 恶意辱骂、人身攻击、引战、仇恨言论。
5. 纯广告、推销垃圾信息、办证发票欺诈。

你必须仅返回一个 JSON 格式的对象（不要返回任何 Markdown 标记或 explanations），格式如下：
{
  "passed": true 或 false,
  "reason": "如果不通过，简短说明原因，例如：'昵称包含粗俗辱骂，内容涉嫌广告'。如果通过则忽略此字段",
  "filteredNickname": "如果判定违规且昵称包含违禁内容，请提供星号化（如用***替换敏感词）后的安全昵称；如果昵称合规，请保持原样",
  "filteredContent": "如果判定违规且留言内容包含违禁内容，请提供星号化（如用***替换敏感词）后的安全留言以供展示；如果内容合规，请保持原样"
}`;

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `请审查以下留言数据：\n昵称: "${nameStr}"\n内容: "${content}"` }
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
      
      const passed = !!result.passed;
      return {
        passed,
        reason: result.reason || 'AI 判定不合规',
        filteredNickname: result.filteredNickname || (passed ? nameStr : '***'),
        filteredContent: result.filteredContent || (passed ? content : '***(内容违规已屏蔽)'),
        filteredText: result.filteredContent || (passed ? content : '***(内容违规已屏蔽)') // 向下兼容旧字段
      };
    } catch (error: any) {
      console.error('LLM 联合审核异常:', error.message || error);
      // Fallback: 如果 LLM 报错或超时，默认选择拦截并提示审核失败。
      return {
        passed: false,
        reason: `AI 审核暂不可用 (${error.message || '网络超时'})`,
        filteredNickname: '***',
        filteredContent: '***(内容违规已屏蔽)',
        filteredText: '***(内容违规已屏蔽)' // 向下兼容旧字段
      };
    }
  }
}

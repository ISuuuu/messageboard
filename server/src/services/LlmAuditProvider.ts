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

    // 1. 发起请求前的详细控制台日志
    console.log(`\n=================【大模型安全审查开始】=================`);
    console.log(`[LLM 审核] 正在发起请求 [Model: ${model}]...`);
    console.log(`[LLM 审核] 待审昵称: "${nameStr}"`);
    console.log(`[LLM 审核] 待审内容: "${content}"`);

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

      // 2. 打印大模型的原始文本返回
      console.log(`[LLM 审核] 大模型原始响应内容:\n${choiceContent.trim()}`);

      // 提取并解析 JSON
      let jsonStr = choiceContent.trim();
      // 兼容可能带有 markdown ```json 标记的输出
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const result = JSON.parse(jsonStr);
      const passed = !!result.passed;
      
      const resNickname = result.filteredNickname || (passed ? nameStr : '***');
      const resContent = result.filteredContent || (passed ? content : '***(内容违规已屏蔽)');

      // 3. 打印解析完成后的结果日志
      console.log(`[LLM 审核] 解析结果 -> 是否通过: ${passed} | 拦截原因: "${result.reason || '无'}"`);
      console.log(`[LLM 审核] 过滤结果 -> 昵称: "${resNickname}" | 内容: "${resContent}"`);
      console.log(`=================【大模型安全审查结束】=================\n`);

      return {
        passed,
        reason: result.reason || 'AI 判定不合规',
        filteredNickname: resNickname,
        filteredContent: resContent,
        filteredText: resContent // 向下兼容旧字段
      };
    } catch (error: any) {
      console.error('[LLM 审核] 发生异常:', error.message || error);
      console.log(`=================【大模型安全审查失败】=================\n`);
      // 抛出错误以激活主管理器的本地 Fallback 降级机制，防止服务不可用
      throw error;
    }
  }
}

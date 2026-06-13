export interface AuditResult {
  passed: boolean;
  reason?: string;             // 拦截原因（例如：涉政、色情、广告等）
  filteredText?: string;       // 【向下兼容】脱敏后的内容
  filteredContent?: string;    // 脱敏后的留言内容
  filteredNickname?: string;   // 脱敏后的昵称
}

export interface AuditProvider {
  audit(content: string, nickname?: string): Promise<AuditResult>;
}

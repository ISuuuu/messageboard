export interface AuditResult {
  passed: boolean;
  reason?: string;      // 拦截原因（例如：涉政、色情、广告等）
  filteredText?: string; // 脱敏后的文本（如果只做脱敏不做彻底拦截的话）
}

export interface AuditProvider {
  audit(text: string): Promise<AuditResult>;
}

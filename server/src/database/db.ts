import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from '../config';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export interface Message {
  id?: string | number;
  content: string;     // 展示内容（可能是脱敏后的）
  originalContent?: string; // 原始留言内容（带敏感词）
  nickname: string;
  color: string;
  size: number;
  createdAt: string;
  status: 'approved' | 'rejected' | 'pending';
  rejectReason?: string;
}

export async function initDatabase() {
  // 开启 SQLite 数据库
  db = await open({
    filename: config.dbPath,
    driver: sqlite3.Database
  });

  // 开启 WAL 模式以提升并发读写性能
  await db.exec('PRAGMA journal_mode = WAL;');

  // 创建 messages 表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      nickname TEXT NOT NULL,
      color TEXT NOT NULL,
      size INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      rejectReason TEXT
    )
  `);

  // 防御性数据库升级：若 originalContent 字段不存在则动态追加该列
  try {
    await db.exec('ALTER TABLE messages ADD COLUMN originalContent TEXT;');
    console.log('Database schema upgraded: added [originalContent] column.');
  } catch (err) {
    // 若字段已存在会抛错，直接捕获忽略即可
  }

  // 创建隐藏留言归档表，结构与 messages 一致
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hidden_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      nickname TEXT NOT NULL,
      color TEXT NOT NULL,
      size INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      rejectReason TEXT,
      originalContent TEXT
    )
  `);

  // 为 messages 表添加索引，加速按 status + createdAt 的查询与排序
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_messages_status_created
    ON messages (status, createdAt DESC)
  `);

  // 创建每日审核用量表，记录各类外部审核调用的每日次数
  await db.exec(`
    CREATE TABLE IF NOT EXISTS audit_usage (
      date TEXT PRIMARY KEY,
      count INTEGER DEFAULT 0
    )
  `);

  // 创建未审核仅记录留言表（超出每日审核配额时直接记录入库，不审核不公开展示）
  await db.exec(`
    CREATE TABLE IF NOT EXISTS unreviewed_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      nickname TEXT NOT NULL,
      color TEXT NOT NULL,
      size INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    )
  `);

  console.log('Database initialized successfully. WAL mode enabled.');
}

export async function getApprovedMessages(): Promise<Message[]> {
  return db.all<Message[]>(
    `SELECT id, content, nickname, color, size,
            strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt
     FROM messages
     WHERE status = ?
     ORDER BY createdAt DESC`,
    'approved'
  );
}

export async function createMessage(message: Omit<Message, 'createdAt'>): Promise<number> {
  const result = await db.run(
    `INSERT INTO messages (content, originalContent, nickname, color, size, status, rejectReason) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      message.content,
      message.originalContent || null,
      message.nickname || '匿名',
      message.color || '#ffffff',
      message.size || 1,
      message.status,
      message.rejectReason || null
    ]
  );
  return result.lastID!;
}

/**
 * 将超过 24 小时的含违禁词留言转移到 hidden_messages 表
 * 每天 0 点由定时任务调用，数据保留不删除
 */
export async function hideExpiredMessages(): Promise<number> {
  const result = await db.run(
    `INSERT INTO hidden_messages (id, content, nickname, color, size, createdAt, status, rejectReason, originalContent)
     SELECT id, content, nickname, color, size, createdAt, status, rejectReason, originalContent
     FROM messages
     WHERE rejectReason IS NOT NULL
       AND trim(rejectReason) != ''
       AND createdAt < datetime('now', '-1 day')`
  );
  const moved = result.changes ?? 0;
  if (moved > 0) {
    await db.run(
      `DELETE FROM messages
       WHERE rejectReason IS NOT NULL
         AND trim(rejectReason) != ''
         AND createdAt < datetime('now', '-1 day')`
    );
  }
  return moved;
}

/**
 * 增加并获取指定日期的审核调用次数（原子操作）
 */
export async function incrementAuditUsage(dateStr: string): Promise<number> {
  await db.run(
    `INSERT INTO audit_usage (date, count) VALUES (?, 1)
     ON CONFLICT(date) DO UPDATE SET count = count + 1`,
    dateStr
  );
  const row = await db.get<{ count: number }>(
    `SELECT count FROM audit_usage WHERE date = ?`,
    dateStr
  );
  return row?.count ?? 1;
}

/**
 * 获取指定日期的审核调用次数
 */
export async function getAuditUsage(dateStr: string): Promise<number> {
  const row = await db.get<{ count: number }>(
    `SELECT count FROM audit_usage WHERE date = ?`,
    dateStr
  );
  return row?.count ?? 0;
}

/**
 * 获取本地自然日日期字符串（YYYY-MM-DD）
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 将超出配额未审核的留言存入 unreviewed_messages 表仅作记录
 */
export async function createUnreviewedMessage(message: {
  content: string;
  nickname: string;
  color: string;
  size: number;
  reason?: string;
}): Promise<number> {
  const result = await db.run(
    `INSERT INTO unreviewed_messages (content, nickname, color, size, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [
      message.content,
      message.nickname || '匿名',
      message.color || '#ffffff',
      message.size || 1,
      message.reason || '超出每日大模型审核上限，仅记录未审核'
    ]
  );
  return result.lastID!;
}

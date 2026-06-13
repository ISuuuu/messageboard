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

  console.log('Database initialized successfully. WAL mode enabled.');
}

export async function getApprovedMessages(): Promise<Message[]> {
  return db.all<Message[]>(
    `SELECT id, content, nickname, color, size, 
            strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt 
     FROM messages 
     WHERE status = ? 
       AND (rejectReason IS NULL OR createdAt >= datetime('now', '-1 day'))
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

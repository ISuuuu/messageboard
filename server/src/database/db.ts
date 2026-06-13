import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { config } from '../config';

let db: Database<sqlite3.Database, sqlite3.Statement>;

export interface Message {
  id?: number;
  content: string;
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

  console.log('Database initialized successfully. WAL mode enabled.');
}

export async function getApprovedMessages(): Promise<Message[]> {
  return db.all<Message[]>(
    `SELECT id, content, nickname, color, size, 
            strftime('%Y-%m-%dT%H:%M:%SZ', createdAt) as createdAt, 
            status, rejectReason 
     FROM messages 
     WHERE status = ? 
     ORDER BY createdAt DESC`,
    'approved'
  );
}

export async function createMessage(message: Omit<Message, 'createdAt'>): Promise<number> {
  const result = await db.run(
    `INSERT INTO messages (content, nickname, color, size, status, rejectReason) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      message.content,
      message.nickname || '匿名',
      message.color || '#ffffff',
      message.size || 1,
      message.status,
      message.rejectReason || null
    ]
  );
  return result.lastID!;
}

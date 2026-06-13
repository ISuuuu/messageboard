import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { config } from './config';
import { initDatabase, getApprovedMessages, createMessage } from './database/db';
import { auditManager } from './services/AuditManager';

const app = express();

// 配置中间件
app.use(cors());
app.use(express.json());

function obfuscateId(id: string | number | undefined): number {
  if (id === undefined) return 0;
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  // 基于黄金置乱与位混淆算法，将自增 ID 彻底打散，生成看似随机的 8 位纯数字
  let hash = numId ^ 123456789;
  hash = Math.imul(hash, 2654435761 | 0);
  hash = hash ^ (hash >>> 16);
  hash = Math.imul(hash, 2246822519 | 0);
  hash = hash ^ (hash >>> 13);
  return (Math.abs(hash) % 90000000) + 10000000;
}

// 获取所有已通过的留言
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getApprovedMessages();
    const obfuscatedMessages = messages.map(msg => ({
      ...msg,
      id: obfuscateId(msg.id)
    }));
    res.json({
      success: true,
      data: obfuscatedMessages
    });
  } catch (error: any) {
    console.error('获取留言列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器获取留言列表失败'
    });
  }
});

// 提交新留言
app.post('/api/messages', async (req, res): Promise<any> => {
  try {
    const { content, nickname, color, size } = req.body;

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        message: '留言内容不能为空'
      });
    }

    const name = (nickname && typeof nickname === 'string' && nickname.trim() !== '') 
      ? nickname.trim() 
      : '匿名';

    // 默认提供一些赛博霓虹色彩以防前端未传
    const defaultColors = ['#ff007f', '#00f0ff', '#ffb700', '#ab00ff', '#00ff66'];
    const msgColor = (color && typeof color === 'string') 
      ? color 
      : defaultColors[Math.floor(Math.random() * defaultColors.length)];

    const msgSize = (typeof size === 'number' && size >= 1 && size <= 5) ? size : 1;

    // 1. 进行内容审核 (将内容与昵称联合发送至审核引擎)
    const auditResult = await auditManager.audit(content, name);

    // 2. 无论是否通过都允许存入数据库，但不通过时会写入脱敏后的安全内容，且保留原始文本以供追溯
    if (auditResult.passed) {
      await createMessage({
        content,
        originalContent: content, // 正常留言，展示内容和原始内容一致
        nickname: name,
        color: msgColor,
        size: msgSize,
        status: 'approved'
      });

      return res.json({
        success: true,
        message: '留言发布成功！'
      });
    } else {
      // 审核拦截但选择脱敏入库
      const safeContent = auditResult.filteredContent || auditResult.filteredText || '***(内容违规已屏蔽)';
      const safeNickname = auditResult.filteredNickname || '匿名';

      await createMessage({
        content: safeContent,      // 存入数据库的是屏蔽敏感词后的安全文本，用于 3D 展示
        originalContent: content,  // 妥善保留违规原始文本
        nickname: safeNickname,    // 存入数据库的是已脱敏的安全昵称
        color: msgColor,
        size: msgSize,
        status: 'approved',        // 标记为 approved 允许其在前端球体显示
        rejectReason: auditResult.reason || '敏感内容脱敏'
      });

      return res.json({
        success: true,
        message: '留言发布成功！'
      });
    }
  } catch (error: any) {
    console.error('提交留言错误:', error);
    return res.status(500).json({
      success: false,
      message: '服务器处理留言异常'
    });
  }
});

// 启动服务
async function startServer() {
  try {
    // 初始化 SQLite 数据库
    await initDatabase();

    app.listen(config.port, () => {
      console.log(`=========================================`);
      console.log(`  3D Message Board Server is running!    `);
      console.log(`  Local URL: http://localhost:${config.port} `);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();

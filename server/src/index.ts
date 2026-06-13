import express from 'express';
import cors from 'cors';
import { config } from './config';
import { initDatabase, getApprovedMessages, createMessage } from './database/db';
import { auditManager } from './services/AuditManager';

const app = express();

// 配置中间件
app.use(cors());
app.use(express.json());

// 获取所有已通过的留言
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getApprovedMessages();
    res.json({
      success: true,
      data: messages
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

    // 1. 进行内容审核
    const auditResult = await auditManager.audit(content);

    // 2. 根据审核结果持久化
    if (auditResult.passed) {
      await createMessage({
        content,
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
      // 审核不通过，记录到数据库备查（状态为 rejected），但接口返回 400
      await createMessage({
        content,
        nickname: name,
        color: msgColor,
        size: msgSize,
        status: 'rejected',
        rejectReason: auditResult.reason || '违规言论'
      });

      return res.status(400).json({
        success: false,
        message: `留言未通过审核：${auditResult.reason || '内容包含敏感/违规言论'}`
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

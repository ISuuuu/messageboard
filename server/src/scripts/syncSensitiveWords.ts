import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

const TEMP_DIR = path.resolve(__dirname, '../../temp_lexicon');
const TARGET_FILE = path.resolve(__dirname, '../../sensitive_words.txt');

// 备选的 Git 仓库克隆源（针对国内网络加速）
const GIT_REPOS = [
  'https://github.com/konsheng/Sensitive-lexicon.git',
  'https://kkgithub.com/konsheng/Sensitive-lexicon.git', // KKGitHub 稳定代理镜像
  'https://github.moeyy.xyz/https://github.com/konsheng/Sensitive-lexicon.git' // Moeyy 加速代理
];

// 备选的 ZIP 下载加速源
const ZIP_URLS = [
  'https://ghp.ci/https://github.com/konsheng/Sensitive-lexicon/archive/refs/heads/master.zip', // 极为稳定的加速代理
  'https://ghproxy.net/https://github.com/konsheng/Sensitive-lexicon/archive/refs/heads/master.zip',
  'https://github.com/konsheng/Sensitive-lexicon/archive/refs/heads/master.zip' // 官方原址
];

// 递归获取目录下所有 txt 文件
function getTxtFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getTxtFiles(filePath));
    } else if (file.endsWith('.txt')) {
      results.push(filePath);
    }
  }
  return results;
}

function cleanTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (e) {
      console.warn(`[清理提示] 无法完全删除临时目录: ${TEMP_DIR}，您可以稍后手动删除。`);
    }
  }
}

async function main() {
  const isForce = process.argv.includes('--force') || process.argv.includes('-f');
  if (fs.existsSync(TARGET_FILE) && !isForce) {
    console.log(`[同步] 检测到敏感词库文件已存在，跳过本次下载。`);
    console.log('💡 若需要强制更新词库，请运行: npm run sync-sensitive -- --force 或是删除该文件后重新编译。');
    process.exit(0);
  }

  console.log('=== 开始同步敏感词库 ===');
  cleanTempDir();

  let downloadSuccess = false;

  // 1. 尝试使用 git clone 各种镜像源克隆
  for (const repoUrl of GIT_REPOS) {
    try {
      console.log(`正在尝试克隆词库: ${repoUrl}`);
      execSync(`git clone --depth 1 ${repoUrl} "${TEMP_DIR}"`, { stdio: 'inherit', timeout: 30000 }); // 设置30秒超时
      downloadSuccess = true;
      break; // 成功则退出循环
    } catch (error) {
      console.warn(`克隆 ${repoUrl} 失败，尝试下一个源...`);
      cleanTempDir();
    }
  }

  // 2. 如果克隆全部失败，尝试使用 curl/wget 或 PowerShell 通过各种加速源下载 ZIP 压缩包并解压
  if (!downloadSuccess) {
    console.warn('所有 git clone 克隆源均失败，开始尝试下载 ZIP 压缩包降级方案...');
    const zipPath = path.resolve(__dirname, '../../temp.zip');
    const isWin = os.platform() === 'win32';

    for (const zipUrl of ZIP_URLS) {
      cleanTempDir();
      try {
        console.log(`正在下载压缩包: ${zipUrl}`);
        if (isWin) {
          // Windows: 使用 PowerShell 进行下载和解压，设置 45 秒超时
          execSync(`powershell -Command "Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${zipPath}'"`, { stdio: 'inherit', timeout: 45000 });
          console.log('下载完成，正在解压...');
          execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${TEMP_DIR}' -Force"`, { stdio: 'inherit' });
        } else {
          // Linux / macOS: 使用 curl 或 wget 下载，使用 unzip 解压
          try {
            execSync(`curl -L "${zipUrl}" -o "${zipPath}"`, { stdio: 'inherit', timeout: 45000 });
          } catch (curlErr) {
            execSync(`wget -O "${zipPath}" "${zipUrl}"`, { stdio: 'inherit', timeout: 45000 });
          }
          console.log('下载完成，正在解压...');
          execSync(`unzip -o "${zipPath}" -d "${TEMP_DIR}"`, { stdio: 'inherit' });
        }
        downloadSuccess = true;
        break; // 成功则退出循环
      } catch (zipError: any) {
        console.warn(`下载或解压 ${zipUrl} 失败，尝试下一个加速链接...`);
      } finally {
        if (fs.existsSync(zipPath)) {
          try {
            fs.unlinkSync(zipPath);
          } catch (_) {}
        }
      }
    }
  }

  // 3. 所有方法均宣告失败
  if (!downloadSuccess) {
    console.error('\n[错误] 所有自动获取敏感词库的手段均已失败。这通常是由于网络连接或代理不可用导致的。');
    console.error('请手动下载敏感词库压缩包：');
    console.error('👉 https://github.com/konsheng/Sensitive-lexicon/archive/refs/heads/master.zip');
    console.error('下载并解压后，请将其中的所有 .txt 敏感词合并，并保存到后端根目录下的 sensitive_words.txt 文件中。\n');
    process.exit(1);
  }

  // 4. 提取并合并词库
  try {
    console.log('正在解析敏感词文件...');
    const txtFiles = getTxtFiles(TEMP_DIR);
    console.log(`共找到 ${txtFiles.length} 个敏感词库文件。`);

    const wordSet = new Set<string>();
    
    // 排除的分类文件名关键字，这些分类误伤率极高，不适合作为留言板的硬拦截词
    const EXCLUDE_CATEGORIES = ['广告', '垃圾', '其他', '补充', '网络', '日常'];
    const MIN_LENGTH = 2; // 忽略单字（长度为1的字），避免普通词汇（如“真”、“国”）导致用户无法正常发言

    for (const filePath of txtFiles) {
      const fileName = path.basename(filePath);
      
      // 过滤掉第三方兼容格式
      if (filePath.includes('ThirdPartyCompatibleFormats')) {
        continue;
      }

      // 如果文件名包含排除关键字，则跳过
      const shouldExclude = EXCLUDE_CATEGORIES.some(keyword => fileName.includes(keyword));
      if (shouldExclude) {
        console.log(`[过滤] 跳过误伤率较高的分类文件: ${fileName}`);
        continue;
      }

      console.log(`[解析] 正在读取词库: ${fileName}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      
      for (const line of lines) {
        const trimmed = line.trim();
        // 过滤空行、注释
        if (trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('//') && !trimmed.startsWith(';')) {
          // 长度过滤
          if (trimmed.length >= MIN_LENGTH) {
            wordSet.add(trimmed);
          }
        }
      }
    }

    const allWords = Array.from(wordSet);
    console.log(`去重及优化过滤后，共获得核心敏感词: ${allWords.length} 个`);

    // 5. 写入目标文件
    fs.writeFileSync(TARGET_FILE, allWords.join('\n'), 'utf-8');
    console.log(`已成功写入目标词库文件: ${TARGET_FILE}`);

  } catch (err: any) {
    console.error('合并词库时发生错误:', err.message || err);
  } finally {
    // 6. 清理临时目录
    console.log('正在清理临时文件...');
    cleanTempDir();
    console.log('=== 同步完成 ===');
  }
}

main();

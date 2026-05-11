const { execSync } = require('child_process');

const src = '/mnt/d/软件项目/Videos/course-distribute/frontend/static';
const dst = '/mnt/d/软件项目/Videos/course-distribute/frontend/dist/dev/mp-weixin/static';

function sync() {
  try {
    // 用 cp 命令绕过 WSL /mnt/d 文件系统的 Node.js EPERM 限制
    execSync(`cp -rf "${src}/" "${dst}/"`, { stdio: 'ignore' });
    console.log('[static-sync] synced');
  } catch (e) {
    // 编译进程占用期间 cp 会静默失败，忽略即可
  }
}

// 首次同步
sync();

// 每 2 秒轮询（uni-app 编译时会清空 static，轮询确保恢复）
setInterval(sync, 2000);

console.log('[static-sync] running (cp every 2s)');

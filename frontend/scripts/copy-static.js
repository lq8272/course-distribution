#!/usr/bin/env node
/**
 * copy-static.js
 * 将 static/ 目录完整复制到 dist/dev/mp-weixin/static/
 * 使用逐文件复制，绕过 WSL/NTFS 的目录操作限制
 */
const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '../static')
const dst = path.resolve(__dirname, '../dist/dev/mp-weixin/static')

function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true })
  for (const f of fs.readdirSync(s)) {
    const sf = path.join(s, f), df = path.join(d, f)
    const st = fs.statSync(sf)
    st.isDirectory() ? copyDir(sf, df) : fs.writeFileSync(df, fs.readFileSync(sf))
  }
}

copyDir(src, dst)
console.log(`[copy-static] copied → ${dst}/tabbar/ (${fs.readdirSync(path.join(dst, 'tabbar')).length} files)`)

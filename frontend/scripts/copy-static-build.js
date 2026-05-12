#!/usr/bin/env node
/**
 * copy-static-build.js
 * 将 static/ 目录完整复制到 dist/build/mp-weixin/static/
 * 使用相对于 __dirname 的路径，兼容 CI (Ubuntu) 和本地 (WSL)
 */
const fs = require('fs')
const path = require('path')

const src = path.resolve(__dirname, '../static')
const dst = path.resolve(__dirname, '../dist/build/mp-weixin/static')

function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true })
  for (const f of fs.readdirSync(s)) {
    const sf = path.join(s, f), df = path.join(d, f)
    const st = fs.statSync(sf)
    st.isDirectory() ? copyDir(sf, df) : fs.writeFileSync(df, fs.readFileSync(sf))
  }
}

copyDir(src, dst)
console.log(`[copy-static-build] copied ${src} → ${dst}`)

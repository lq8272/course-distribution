#!/usr/bin/env node
/**
 * watch-static.js
 * 轮询监控 static 目录，检测到 tabbar 文件数异常少时，等待编译结束后复制恢复。
 */
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '../static')
const DST = path.resolve(__dirname, '../dist/dev/mp-weixin/static')
const TABBAR_DIR = path.join(DST, 'tabbar')

let restoring = false
let lastCount = 8

function restore() {
  if (restoring) return
  restoring = true
  console.log('[watch-static] restore triggered, waiting for Vite to finish...')
  
  // 等 Vite 释放文件锁后再清理复制
  setTimeout(() => {
    try {
      fs.rmSync(DST, { recursive: true, force: true })
      fs.mkdirSync(DST, { recursive: true })
      fs.cpSync(SRC, DST, { recursive: true })
      console.log('[watch-static] restored OK')
    } catch (e) {
      console.error('[watch-static] restore failed:', e.message)
    }
    restoring = false
  }, 3000)
}

// 每 2 秒检查一次
const interval = setInterval(() => {
  try {
    const files = fs.readdirSync(TABBAR_DIR)
    if (files.length < 5 && files.length !== lastCount) {
      lastCount = files.length
      console.log(`[watch-static] tabbar has ${files.length} files, waiting to restore...`)
      restore()
    } else if (files.length >= 5) {
      lastCount = files.length
    }
  } catch {}
}, 2000)

console.log(`[watch-static] polling ${TABBAR_DIR} every 2s`)

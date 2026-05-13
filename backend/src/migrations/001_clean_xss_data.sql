-- 001: 清理 XSS 测试数据 / 安全清理
-- 清理 courses 表中可能存在的 XSS payload 测试数据
-- 注意：需临时禁用外键检查（courses 被 orders 外键引用）
SET FOREIGN_KEY_CHECKS=0;
DELETE FROM courses WHERE title LIKE '%<script%' OR title LIKE '%<img%' OR title LIKE '%onerror=%' OR description LIKE '%<script%' OR description LIKE '%onerror=%';
SET FOREIGN_KEY_CHECKS=1;

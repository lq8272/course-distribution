-- ============================================================
-- 视频课程分销系统 - 种子数据
-- 数据库: course_distribute
-- ============================================================

USE course_distribute;

-- ---------------------------------------------------
-- 1. 分销等级配置（agent_levels）
-- 达人: DR, 梦想家: MXJ, 超合伙: CJHH
--
-- gift_accounts = 拿货名额（一次性分配，审核通过后写入agents.gift_accounts）
-- upgrade_referral_min: 达人→梦想家需推荐5个达人，梦想家→超级合伙人需推荐3个梦想家
-- ---------------------------------------------------
INSERT INTO agent_levels (level, name, rebate_rate, gift_accounts, upgrade_referral_min, upgrade_gift_min, sort) VALUES
  ('DR',   '达人',       0.3000, 10,  0, 0, 1),
  ('MXJ',  '梦想家',     0.5000, 100, 5, 0, 2),
  ('CJHH', '超级合伙人', 0.7000, 200, 3, 0, 3)
ON DUPLICATE KEY UPDATE name=VALUES(name), rebate_rate=VALUES(rebate_rate), gift_accounts=VALUES(gift_accounts), upgrade_referral_min=VALUES(upgrade_referral_min);

-- ---------------------------------------------------
-- 2. 全局配置（configs）
-- description 用于管理后台展示
-- ---------------------------------------------------
INSERT INTO configs (`key`, value, description) VALUES
  -- 平台
  ('platform_name',        '视频课程分销平台', '平台名称'),
  ('platform_root_user_id','1',               '平台根用户ID（固定值）'),
  -- 分销层级
  ('max_distribution_level','3',  '最大分销层级'),
  ('level1_rebate_rate',   '0.30', '一级分销返佣比例'),
  ('level2_rebate_rate',   '0.05', '二级分销返佣比例'),
  ('level3_rebate_rate',   '0.03', '三级分销返佣比例'),
  -- 推荐奖励（一次性奖励，审核通过时发放）
  ('recommend_reward',    '10.00', '推荐奖励金额（元）'),
  -- 提现
  ('min_withdraw_amount',  '100',   '最低提现额度（元）'),

  -- 订单
  ('order_timeout_minutes','30',   '订单超时关闭时间（分钟）'),
  -- 拿货配置（真实数据在 agent_level_configs 表）
  -- 申请费（成为分销商时缴纳）
  ('apply_fee_dr',   '4980',  '达人申请费（元）'),
  ('apply_fee_mxj',  '29800', '梦想家申请费（元）'),
  ('apply_fee_cjhh', '99800', '超合伙人申请费（元）')
ON DUPLICATE KEY UPDATE value=VALUES(value), description=VALUES(description);

-- ---------------------------------------------------
-- 3. 管理员账户
-- 密码: admin123（bcrypt hash，固定值保证每次 seed 结果一致）
-- ---------------------------------------------------
INSERT INTO users (openid, nickname, phone, admin_password, is_admin) VALUES
  ('admin_openid_001', '管理员', '13800138000', '$2a$10$yCr5utOblxZTjP/P9VcG1OH7VKJSCN7mLivW6YyZuTFfFYd.odIRu', 1)
ON DUPLICATE KEY UPDATE nickname=VALUES(nickname);

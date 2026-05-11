-- ============================================================
-- 视频课程分销系统 - 种子数据
-- ============================================================

USE course_distribute;

-- ============================================================
-- 1. 平台根用户（R4：初始化脚本创建）
-- 密码: admin123（bcrypt hash，无需转义）
-- ============================================================
INSERT INTO users (openid, nickname, admin_password, is_admin, status)
VALUES ('PLATFORM_ROOT', '平台管理员', '$2a$10$yCr5utOblxZTjP/P9VcG1OH7VKJSCN7mLivW6YyZuTFfFYd.odIRu', 1, 1)
ON DUPLICATE KEY UPDATE nickname = '平台管理员', admin_password = '$2a$10$yCr5utOblxZTjP/P9VcG1OH7VKJSCN7mLivW6YyZuTFfFYd.odIRu';

-- ============================================================
-- 2. 分销等级配置（R1+R4）
-- gift_accounts: 拿货名额 / upgrade_referral_min: 升级所需推荐人数
-- DR: 无需升级 / MXJ: 需推荐5个达人 / CJHH: 需推荐3个梦想家
-- ============================================================
INSERT INTO agent_levels (level, name, rebate_rate, gift_accounts, upgrade_referral_min, upgrade_gift_min, sort) VALUES
  ('DR',    '达人',       0.3000, 10,  0, 0, 1),
  ('MXJ',   '梦想家',     0.5000, 100, 5, 0, 2),
  ('CJHH',  '超级合伙人', 0.7000, 200, 3, 0, 3)
ON DUPLICATE KEY UPDATE name = VALUES(name), rebate_rate = VALUES(rebate_rate),
  gift_accounts = VALUES(gift_accounts), upgrade_referral_min = VALUES(upgrade_referral_min);

-- ============================================================
-- 3. 全局配置（configs）（T1：所有 value 加引号，类型统一 TEXT）
-- ============================================================
INSERT INTO configs (`key`, value, description) VALUES
  ('platform_name',         '视频课程分销平台',    '平台名称'),
  ('platform_root_user_id', '1',                   '平台根用户ID（固定值，不做运算）'),
  ('min_withdraw_amount',   '100',                 '最低提现额度（元）'),
  ('withdraw_fee_rate',     '0',                    '提现手续费率（0=免手续费）'),
  ('order_timeout_minutes', '30',                   '订单超时关闭时间（分钟）'),
  ('max_distribution_level','3',                    '最大分销层级'),
  ('level1_rebate_rate',    '0.3000',               '一级分销返佣比例'),
  ('level2_rebate_rate',    '0.0500',               '二级分销返佣比例'),
  ('level3_rebate_rate',    '0.0300',               '三级分销返佣比例'),
  ('recommend_reward',      '10.00',                '推荐奖励金额（元）'),
  -- 申请费
  ('apply_fee_dr',   '4980',   '达人申请费（元）'),
  ('apply_fee_mxj',  '29800',  '梦想家申请费（元）'),
  ('apply_fee_cjhh', '99800',  '超合伙申请费（元）'),
  -- 拿货配置
  ('purchase_price_dr',    '200',   '达人拿货价（元/个）'),
  ('purchase_price_mxj',  '150',   '梦想家拿货价（元/个）'),
  ('purchase_price_cjhh', '100',   '超合伙拿货价（元/个）'),
  ('min_purchase_qty_dr',   '10',   '达人最低拿货数量（个）'),
  ('min_purchase_qty_mxj', '100',   '梦想家最低拿货数量（个）'),
  ('min_purchase_qty_cjhh','200',   '超合伙最低拿货数量（个）'),
  -- 产品名称（拿货页面显示）
  ('product_name',          '视频课程', '产品名称'),
  -- 推荐奖励配置（拿货佣金的推荐奖励，key格式：referral_reward_{推荐人等级}_{购买人等级}）
  -- 达人推荐达人买（已达人已有销售佣金，不重复奖）
  ('referral_reward_dr_dr',    '0',    '达人推荐达人购买奖励（元）'),
  -- 达人推荐梦想家/超合伙购买（一次性奖励）
  ('referral_reward_dr_mxj',   '3000', '达人推荐梦想家购买奖励（元）'),
  ('referral_reward_dr_cjhh',  '3000', '达人推荐超合伙购买奖励（元）'),
  -- 梦想家推荐达人购买
  ('referral_reward_mxj_dr',   '50',  '梦想家推荐达人购买奖励（元）'),
  -- 梦想家推荐梦想家/超合伙购买
  ('referral_reward_mxj_mxj',  '10000','梦想家推荐梦想家购买奖励（元）'),
  ('referral_reward_mxj_cjhh', '10000','梦想家推荐超合伙购买奖励（元）'),
  -- 超合伙推荐达人购买
  ('referral_reward_cjhh_dr',   '70',  '超合伙推荐达人购买奖励（元）'),
  -- 超合伙推荐梦想家/超合伙购买
  ('referral_reward_cjhh_mxj',  '15000','超合伙推荐梦想家购买奖励（元）'),
  ('referral_reward_cjhh_cjhh', '40000','超合伙推荐超合伙购买奖励（元）')
ON DUPLICATE KEY UPDATE value = VALUES(value);

-- ============================================================
-- 4. 课程分类
-- ============================================================
INSERT INTO course_categories (id, name, sort, is_show) VALUES
  (1, '学习方法',   1, 1),
  (2, '清北学习方法', 2, 1),
  (3, '清北学习动力', 3, 1),
  (4, '学科学习',   4, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort = VALUES(sort);

-- ============================================================
-- 5. 示例课程数据
-- 注意：cover_image 和 video_url 需替换为实际 CDN 地址（https://tdw0wi1vp.hb-bkt.clouddn.com）
-- 为便于演示，使用 picsum.photos 公开占位图（可正常访问）
-- ============================================================
INSERT INTO courses (category_id, title, description, cover_image, price, is_free, is_show, sort) VALUES
  (1, '开场：我是如何从"听不懂"到考上清华北大的？',
      '清华学长亲授学习方法，帮你在短时间内实现成绩飞跃。',
      'https://picsum.photos/seed/course1/400/225', 499.00, 0, 1, 100),
  (1, '如何进入"心流"状态？——15分钟专注力训练',
      '掌握心流心理学原理，15分钟训练提升专注力 10 倍。',
      'https://picsum.photos/seed/course2/400/225', 499.00, 0, 1, 90)
ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), cover_image = VALUES(cover_image), price = VALUES(price);

-- ============================================================
-- 6. 管理员角色
-- ============================================================
INSERT INTO admin_roles (name, permission, description) VALUES
  ('超级管理员', '["*"]',                        '拥有所有权限'),
  ('运营管理员', '["user:view","order:*","agent:*","course:*"]', '日常运营管理'),
  ('客服',      '["service:*","order:view"]',   '仅客服和查看订单')
ON DUPLICATE KEY UPDATE permission = VALUES(permission);

-- ============================================================
-- 8. 推荐奖励配置（改用 configs 表，key 格式 referral_reward_{inviter}_{invitee}）
--    代码已统一使用 configs 表，不再依赖 referral_reward_matrix 表
-- ============================================================

-- ============================================================
-- 7. teams 自引用记录（R4：初始化时平台根用户自己引用自己）
-- ============================================================
INSERT INTO teams (user_id, parent_id, root_id)
SELECT u.id, u.id, u.id
FROM users u WHERE u.openid = 'PLATFORM_ROOT'
ON DUPLICATE KEY UPDATE root_id = VALUES(root_id);

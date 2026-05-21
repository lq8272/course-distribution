-- 爆款课程支持
-- 1. courses 表新增爆款课程字段
ALTER TABLE courses ADD COLUMN is_hot TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=爆款课程';
ALTER TABLE courses ADD COLUMN hot_commission_rate DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '爆款课佣金比例（%），直推人独享';

-- 2. commissions 表新增 HOT_SALES 类型
ALTER TABLE commissions MODIFY COLUMN type VARCHAR(20) NOT NULL DEFAULT 'SALES' COMMENT '佣金类型：SALES销售 MANAGEMEN管理奖 REFERRAL推荐奖励 HOT_SALES爆款课销售佣金';

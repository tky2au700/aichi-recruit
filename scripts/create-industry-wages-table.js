/**
 * industry_wages テーブルを作成するスクリプト
 *
 * 対象データ: 賃金構造基本統計調査 第1表
 *   タブ = 業種（産業計・C鉱業・D建設業 など）
 *   行   = 年齢階級（〜19歳・20〜24歳 ... ）× 性別（計/男/女）
 *   列   = 企業規模 × 各指標
 */

const mysql = require('mysql2/promise')

async function main() {
  const conn = await mysql.createConnection({
    host: '162.43.24.67',
    port: 3306,
    user: 'emoji_user',
    password: 'emoji-luft-700',
    database: 'recruit_db',
  })

  // dataset_groups に 'industry' カテゴリを追加（初回のみ）
  const [existing] = await conn.execute(
    "SELECT id FROM dataset_groups WHERE category = 'industry' LIMIT 1"
  )
  let groupId
  if (existing.length === 0) {
    const [res] = await conn.execute(
      `INSERT INTO dataset_groups (name, category, survey_group_name, survey_table_name, created_at, updated_at)
       VALUES (?, 'industry', '賃金構造基本統計調査', '第1表', NOW(), NOW())`,
      ['賃金構造基本統計調査／業種別・年齢階級別賃金データ']
    )
    groupId = res.insertId
    console.log('dataset_groups 作成: id =', groupId)
  } else {
    groupId = existing[0].id
    console.log('dataset_groups 既存: id =', groupId)
  }

  // industry_wages テーブル作成
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS industry_wages (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      dataset_id      INT NOT NULL,
      industry_name   VARCHAR(255) NOT NULL COMMENT '業種名（シート名）',
      sex             ENUM('計','男','女') NOT NULL DEFAULT '計',
      age_group       VARCHAR(50) NOT NULL COMMENT '年齢階級（例: 20〜24歳）',
      enterprise_size ENUM('企業規模計','1000人以上','100〜999人','10〜99人') NOT NULL DEFAULT '企業規模計',
      age             DECIMAL(5,1) DEFAULT NULL COMMENT '平均年齢',
      tenure_years    DECIMAL(5,1) DEFAULT NULL COMMENT '平均勤続年数',
      scheduled_hours DECIMAL(6,1) DEFAULT NULL COMMENT '所定内労働時間',
      overtime_hours  DECIMAL(6,1) DEFAULT NULL COMMENT '超過労働時間',
      monthly_wage    DECIMAL(10,1) DEFAULT NULL COMMENT 'きまって支給する現金給与額（千円）',
      scheduled_wage  DECIMAL(10,1) DEFAULT NULL COMMENT '所定内給与額（千円）',
      annual_bonus    DECIMAL(10,1) DEFAULT NULL COMMENT '年間賞与その他特別給与額（千円）',
      workers         INT DEFAULT NULL COMMENT '労働者数（十人）',
      annual_income   DECIMAL(10,1) DEFAULT NULL COMMENT '推定年収（千円）',
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dataset  (dataset_id),
      INDEX idx_industry (industry_name),
      INDEX idx_sex_size (sex, enterprise_size)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `)
  console.log('industry_wages テーブル: OK')

  await conn.end()
  console.log('完了 / dataset_group_id =', groupId)
}

main().catch(e => { console.error(e.message); process.exit(1) })

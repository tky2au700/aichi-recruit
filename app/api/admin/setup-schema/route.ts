import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST() {
  const results: string[] = []

  try {
    // 1. dataset_groups（親）テーブル
    await query(`
      CREATE TABLE IF NOT EXISTS dataset_groups (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        name            VARCHAR(255) NOT NULL COMMENT '調査名',
        category        VARCHAR(100) NOT NULL DEFAULT 'occupation',
        source_type     VARCHAR(20)  NOT NULL DEFAULT 'mhlw' COMMENT 'mhlw=厚生労働省 / estat=e-Stat / other',
        source_name     VARCHAR(255) COMMENT 'データソース名（自由記述）',
        sex_label_mode  VARCHAR(20)  NOT NULL DEFAULT 'cell_combined'
                          COMMENT 'cell_combined=性別+職種が同一セル / separate_row=性別が独立行',
        data_start_row  INT NOT NULL DEFAULT 10 COMMENT 'CSVデータ開始行（0-indexed）',
        name_col_index  INT NOT NULL DEFAULT 1  COMMENT '職種名列インデックス',
        size1_col_start INT NOT NULL DEFAULT 3  COMMENT '企業規模計 開始列',
        size2_col_start INT NOT NULL DEFAULT 11 COMMENT '1000人以上 開始列',
        size3_col_start INT NOT NULL DEFAULT 19 COMMENT '100～999人 開始列',
        size4_col_start INT NOT NULL DEFAULT 27 COMMENT '10～99人 開始列',
        parse_notes     TEXT COMMENT 'パースルールメモ・特記事項',
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    results.push('dataset_groups: OK')

    // 2. datasets（子: 調査年ごと）テーブル
    await query(`
      CREATE TABLE IF NOT EXISTS datasets (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        group_id     INT NOT NULL,
        survey_year  INT NOT NULL COMMENT '調査年',
        published_at DATE         COMMENT '公表日',
        source_url   TEXT         COMMENT '元ファイルURL',
        record_count INT DEFAULT 0,
        imported_at  DATETIME,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES dataset_groups(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    results.push('datasets: OK')

    // 3. occupation_wages テーブル
    await query(`
      CREATE TABLE IF NOT EXISTS occupation_wages (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        dataset_id       INT NOT NULL,
        occupation_name  VARCHAR(255) NOT NULL,
        sex              ENUM('計','男','女') NOT NULL DEFAULT '計',
        enterprise_size  VARCHAR(50) NOT NULL DEFAULT '企業規模計',
        age              DECIMAL(5,1),
        tenure_years     DECIMAL(5,1),
        scheduled_hours  DECIMAL(6,1),
        overtime_hours   DECIMAL(6,1),
        monthly_wage     DECIMAL(10,1),
        scheduled_wage   DECIMAL(10,1),
        annual_bonus     DECIMAL(10,1),
        workers          INT,
        annual_income    DECIMAL(10,1),
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_dataset (dataset_id),
        INDEX idx_occupation (occupation_name),
        INDEX idx_sex (sex),
        INDEX idx_size (enterprise_size),
        FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)
    results.push('occupation_wages: OK')

    // --- マイグレーション: dataset_groups に新列がなければ追加 ---
    try {
      const existingCols = await query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'dataset_groups'
         AND COLUMN_NAME IN ('source_type','sex_label_mode')`
      ) as any[]
      const existing = existingCols.map((c: any) => c.COLUMN_NAME)
      if (!existing.includes('source_type')) {
        await query(`ALTER TABLE dataset_groups ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'mhlw' AFTER category`)
        results.push('migration: dataset_groups.source_type 追加')
      }
      if (!existing.includes('sex_label_mode')) {
        await query(`ALTER TABLE dataset_groups ADD COLUMN sex_label_mode VARCHAR(20) NOT NULL DEFAULT 'cell_combined' AFTER source_name`)
        results.push('migration: dataset_groups.sex_label_mode 追加')
      }
    } catch (altErr: any) {
      results.push(`migration(ALTER): ${altErr.message}`)
    }

    // --- マイグレーション: 旧スキーマ(datasetsにname/category列がある)からの移行 ---
    try {
      const oldCols = await query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'datasets'
         AND COLUMN_NAME IN ('name','category','source_name','group_id')`
      ) as any[]
      const colNames = oldCols.map((c: any) => c.COLUMN_NAME)

      if (colNames.includes('name') && !colNames.includes('group_id')) {
        // group_id列を追加
        await query(`ALTER TABLE datasets ADD COLUMN group_id INT AFTER id`)

        // 旧datasetsの各行からdataset_groupsを自動生成
        const oldDs = await query(`SELECT * FROM datasets`) as any[]
        for (const ds of oldDs) {
          const ins = await query(
            `INSERT INTO dataset_groups
               (name, category, source_name, data_start_row, name_col_index,
                size1_col_start, size2_col_start, size3_col_start, size4_col_start)
             VALUES (?, ?, ?, 10, 1, 3, 11, 19, 27)`,
            [ds.name ?? `データセット${ds.id}`, ds.category ?? 'occupation', ds.source_name ?? null]
          ) as any
          await query(`UPDATE datasets SET group_id = ? WHERE id = ?`, [ins.insertId, ds.id])
        }

        // 旧列を削除
        for (const col of ['name', 'category', 'source_name']) {
          if (colNames.includes(col)) {
            await query(`ALTER TABLE datasets DROP COLUMN \`${col}\``)
          }
        }
        // NOT NULL & FK付与
        await query(`ALTER TABLE datasets MODIFY COLUMN group_id INT NOT NULL`)
        try {
          await query(`ALTER TABLE datasets ADD CONSTRAINT fk_ds_group FOREIGN KEY (group_id) REFERENCES dataset_groups(id) ON DELETE CASCADE`)
        } catch { /* 既に存在する場合は無視 */ }

        results.push('migration: 旧スキーマから移行完了')
      }
    } catch (migErr: any) {
      results.push(`migration: ${migErr.message}`)
    }

    return NextResponse.json({ success: true, message: 'スキーマ初期化完了', results })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: 'スキーマ初期化失敗', error: error.message, results },
      { status: 500 }
    )
  }
}

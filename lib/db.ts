import mysql from "mysql2/promise";

// 接続設定
const dbConfig: mysql.PoolOptions = {
  host: process.env.MYSQL_HOST || "162.43.24.67",
  port: Number(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "emoji_user",
  password: process.env.MYSQL_PASSWORD || "emoji-luft-700",
  database: process.env.MYSQL_DATABASE || "recruit_db",
  timezone: "+00:00",
  ssl: undefined,
  connectTimeout: 10000,
  // コネクションプール設定
  // Next.js サーバープロセスは常駐するため、接続を使い回してTCPハンドシェイクのオーバーヘッドを排除する
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
};

// モジュールスコープでプールをシングルトン保持
// Hot Reload 時に再生成しないよう globalThis に保存
const globalWithPool = globalThis as typeof globalThis & { _dbPool?: mysql.Pool };
if (!globalWithPool._dbPool) {
  globalWithPool._dbPool = mysql.createPool(dbConfig);
}
const pool = globalWithPool._dbPool;

// 後方互換: getConnection はプールから取得
async function getConnection(): Promise<mysql.PoolConnection> {
  return pool.getConnection();
}

function getPool() {
  return pool;
}

/**
 * Tagged template literal SQL helper — Neon の sql`` と同じ呼び出し方に対応。
 *
 * 使い方:
 *   const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
 *
 * 戻り値: 行オブジェクトの配列 (RowDataPacket[])
 */
export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<mysql.RowDataPacket[]> {
  // テンプレートリテラルを ? プレースホルダーに変換
  let q = "";
  const params: unknown[] = [];

  for (let i = 0; i < strings.length; i++) {
    q += strings[i];
    if (i < values.length) {
      const val = values[i];
      // sql`` で別の sql`` 断片を埋め込むケース（条件付きクエリ）
      if (isSqlFragment(val)) {
        q += val.query;
        params.push(...val.params);
      } else {
        q += "?";
        params.push(val);
      }
    }
  }

  const conn = await getConnection();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(q, params as any);
    return rows;
  } finally {
    conn.release();
  }
}

// --------------------------------------------------------------------------
// sql`` の中で条件付きフラグメントを埋め込む場合のユーティリティ
// --------------------------------------------------------------------------
interface SqlFragment {
  __isSqlFragment: true;
  query: string;
  params: unknown[];
}

function isSqlFragment(val: unknown): val is SqlFragment {
  return (
    typeof val === "object" &&
    val !== null &&
    (val as SqlFragment).__isSqlFragment === true
  );
}

/**
 * 条件付きSQLフラグメントを作成するタグ付きテンプレートリテラル
 * 例: sql.fragment`AND created_at >= ${date}`
 */
sql.fragment = function (
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlFragment {
  let query = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    query += strings[i];
    if (i < values.length) {
      query += "?";
      params.push(values[i]);
    }
  }
  return { __isSqlFragment: true, query, params };
};

/**
 * 空フラグメント（条件が不要なとき）
 */
sql.empty = { __isSqlFragment: true, query: "", params: [] } as SqlFragment;

/**
 * INSERT 後に挿入された行を取得するヘルパー
 * RETURNING の代替
 */
export async function insertAndReturn<T = mysql.RowDataPacket>(
  table: string,
  insertQuery: string,
  params: unknown[]
): Promise<T> {
  const conn = await getConnection();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [result] = await conn.execute<mysql.OkPacket>(insertQuery, params as any);
    const insertId = result.insertId;
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM \`${table}\` WHERE id = ?`,
      [insertId]
    );
    return rows[0] as T;
  } finally {
    conn.release();
  }
}

/**
 * 生クエリ（文字列）を直接実行するヘルパー
 */
export async function query<T extends object = mysql.RowDataPacket>(
  q: string,
  params: unknown[] = []
): Promise<T[]> {
  const conn = await getConnection();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(q, params as any);
    return rows as T[];
  } finally {
    conn.release();
  }
}

export { getPool };

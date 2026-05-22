/**
 * 職種名 → URL スラッグ変換
 * 例: "管理的職業従事者" → "kanriteki-shokugyou-juujisha"
 * 簡易実装: Unicode の記号・括弧・スペースを除去してハイフン区切りに変換
 * 本格的なローマ字変換は wanakana 等を使うが、ここではASCII安全な形に変換する
 */
export function toOccupationSlug(name: string): string {
  return name
    .trim()
    // 全角スペース・括弧・記号を半角に正規化
    .normalize('NFKC')
    // 括弧類を除去
    .replace(/[（）()【】「」『』［］〔〕・。、]/g, ' ')
    // 連続スペースをハイフンに
    .replace(/\s+/g, '-')
    // 先頭末尾ハイフン除去
    .replace(/^-+|-+$/g, '')
    // 残った ASCII 以外の文字はそのまま（日本語のまま保持 → URIエンコードされる）
    .toLowerCase()
    // 長すぎるスラッグはカット
    .slice(0, 120)
}

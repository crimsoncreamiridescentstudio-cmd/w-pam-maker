import { useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  GitFork,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export type TipCategory = "start" | "dimension" | "connect" | "protect" | "export";

type Tip = {
  id: string;
  category: TipCategory;
  title: string;
  summary: string;
  body: string;
  keywords?: string;
};

const categories: Array<{
  id: TipCategory;
  label: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  { id: "start", label: "はじめに", description: "世界と項目をつくる", icon: Sparkles },
  { id: "dimension", label: "Dimension", description: "別の姿を保つ", icon: GitFork },
  { id: "connect", label: "つながり・整理", description: "関係や検索を使う", icon: Link2 },
  { id: "protect", label: "保存・バックアップ", description: "世界を安全に守る", icon: ShieldCheck },
  { id: "export", label: "書き出し・画像", description: "世界を持ち出す", icon: Download },
];

export const tips: Tip[] = [
  {
    id: "create-world",
    category: "start",
    title: "最初の世界をつくる",
    summary: "世界の本棚で「新しい世界」を選び、まず名前だけ決めれば始められます。",
    body: "概要や画像はあとから追加できます。最初から全部を埋める必要はありません。作成した世界は本棚からいつでも開けます。",
    keywords: "ワールド 新規作成 本棚",
  },
  {
    id: "create-item",
    category: "start",
    title: "キャラクターや場所を追加する",
    summary: "世界を開き、分類タブから追加したい項目を選びます。",
    body: "キャラクター・場所・組織・設定／記事・作品・用語を登録できます。「正式名称」と「表示名・通称」を分けると、設定上の本名を保ったまま読みやすい名前で表示できます。編集後は「保存する」を押してください。",
    keywords: "項目 登場人物 キャラ 用語 正式名称 通称 保存",
  },
  {
    id: "entity-template-use",
    category: "start",
    title: "Entity項目テンプレートを使う",
    summary: "Entity編集画面で、種類に合った内蔵・自作テンプレートをカスタム項目へ反映できます。",
    body: "キャラクターなら物語・日常・戦闘・口調などの内蔵テンプレートを選べます。「追加」は入力済み項目を残し、「置き換え」は確認後に現在のカスタム項目を入れ替えます。テンプレートから入るのは項目名だけなので、内容はキャラクターごとに自由に書けます。",
    keywords: "キャラシート ひな形 テンプレ 追加 置き換え カスタム項目",
  },
  {
    id: "entity-template-create",
    category: "start",
    title: "自分用のEntityテンプレートをつくる",
    summary: "設定の「自作テンプレートを管理」で、よく使う項目セットを保存できます。",
    body: "テンプレート名と対象Entityを選び、項目を追加して上下ボタンで順番を整えます。保存後は端末内のすべての世界で再利用でき、あとから編集・削除も可能です。テンプレートを削除しても、すでにEntityへ反映した項目や入力内容は消えません。JSONバックアップには自作テンプレートも含まれます。",
    keywords: "自作 作成 編集 保存 並べ替え 削除 全世界 バックアップ",
  },
  {
    id: "reference-link",
    category: "start",
    title: "文章から別の項目へつなぐ",
    summary: "文章に [[項目名]] と書くと、タップできる参照になります。",
    body: "表示する文字を変える場合は [[項目名|表示文字]] と書きます。たとえば [[王都アステラ|王都]] のように使えます。登録済み項目の名前と一致すると、概要をすぐ開けます。",
    keywords: "内部リンク 特別な文字 参照 概要",
  },
  {
    id: "dimension-basics",
    category: "dimension",
    title: "Dimensionってなに？",
    summary: "同じ世界を、世界線・時期・章・公開範囲などの条件で見分ける仕組みです。",
    body: "たとえば「BACKSIDE」「10年後」「ネタバレあり」を独立した軸として組み合わせられます。過去の状態を保存するSnapshotとは別物です。",
    keywords: "ディメンション 世界線 時系列 章 ネタバレ スナップショット",
  },
  {
    id: "dimension-edit",
    category: "dimension",
    title: "このDimensionだけ設定を変える",
    summary: "項目詳細の「このDimensionで編集」から、その条件だけの姿を登録できます。",
    body: "変更した情報だけが基本データに重なり、未変更の情報は基本データから引き継がれます。基本データそのものを直したい場合は「基本データを編集」を使います。",
    keywords: "差分 基本データ 継承 別の姿 編集",
  },
  {
    id: "dimension-visibility",
    category: "dimension",
    title: "特定のDimensionにだけ登場させる",
    summary: "「この条件の掲載指定」で、その項目を掲載／非掲載にできます。",
    body: "非掲載にすると、その条件の通常一覧・検索・関連・相関図からも除外されます。項目自体を削除する操作ではないため、別のDimensionや基本データには残ります。",
    keywords: "限定キャラ 存在 非表示 非掲載 登場",
  },
  {
    id: "dimension-move",
    category: "dimension",
    title: "別の姿を移動・複製する",
    summary: "登録済みのDimension差分は、別の条件へ移動または複製できます。",
    body: "項目のID・画像・関連・履歴と基本データは維持されます。移動前に、元の条件を非掲載にするか、基本データを引き継ぐ状態へ戻すかも選べます。",
    keywords: "移す コピー 差分 所属 ID",
  },
  {
    id: "relations",
    category: "connect",
    title: "項目どうしの関係を登録する",
    summary: "相手・関係名・向き・補足を登録すると、関係一覧と相関図へ反映されます。",
    body: "キャラクター詳細からも、そのキャラクターを起点・相手にした関係を編集できます。Dimensionを選択中なら、関係名や掲載状態もその条件だけ変更できます。",
    keywords: "相関図 キャラクター 関係性 矢印 敵対 友人 所属",
  },
  {
    id: "organize",
    category: "connect",
    title: "増えた設定を整理する",
    summary: "「整理・探索」には検索、関係・相関図、グループ、年表、階層、散策があります。",
    body: "主人公組や第一章はグループへ、出来事は年表へ、場所や組織の親子関係は階層へ登録できます。迷った時は複合検索やランダム散策から世界へ入り直せます。",
    keywords: "コレクション タイムライン お気に入り ピン留め ランダム",
  },
  {
    id: "save-snapshot",
    category: "protect",
    title: "「保存」と「ここまでを記録」の違い",
    summary: "保存は現在の編集内容、記録は世界全体の節目を残す操作です。",
    body: "記録には自動の日時番号が付き、「1.21」「第三稿」など好きなバージョン名も付けられます。履歴では2地点の比較、過去版の閲覧・復元ができます。",
    keywords: "Version バージョン 履歴 比較 復元 Snapshot",
  },
  {
    id: "json-backup",
    category: "protect",
    title: "世界を失わないためのJSONバックアップ",
    summary: "JSONには画像・履歴・作者用メモを含めて、世界を復元できる形で保存します。",
    body: "W-Pamのデータはこのブラウザ・端末内にあります。サイトデータ削除や端末故障に備え、設定から定期的にJSONを書き出し、「ファイル」など端末外の場所にも保管してください。PNG・PDFは復元用バックアップにはなりません。",
    keywords: "データ消失 iPhone IndexedDB 原本 ファイル JSON 書き出し",
  },
  {
    id: "import-trash",
    category: "protect",
    title: "バックアップを読み込む・ごみ箱を使う",
    summary: "読み込みは「別の世界として追加」が標準。同じIDだけを上書きすることもできます。",
    body: "上書き時は置換前の世界が安全コピーとしてごみ箱へ残ります。バックアップ時点でごみ箱にあった世界は、ごみ箱へ読み込まれます。「完全に削除」は取り消せないため、不要だと確認できた世界だけに使ってください。",
    keywords: "インポート 重複 上書き 復元 削除 安全コピー",
  },
  {
    id: "export",
    category: "export",
    title: "PNG・PDFでパンフレットを持ち出す",
    summary: "「書き出し」で内容とテンプレートを選び、プレビューしてから保存できます。",
    body: "個別項目だけの出力も可能です。作者用メモはPNG・PDFに含まれません。iPhoneでは保存後に「ファイル」アプリも確認してください。",
    keywords: "画像 共有 印刷 ダウンロード 作者メモ",
  },
  {
    id: "images",
    category: "export",
    title: "画像の見える位置を整える",
    summary: "各項目に最大4枚を登録し、表紙画像と表示位置を選べます。",
    body: "顔や見せたい部分が中央に来るよう、横位置・縦位置を調整できます。大きな画像は端末内保存向けに縮小されます。HEICを読み込めない場合はJPEGやPNGへ変換してください。",
    keywords: "サムネイル 表紙 トリミング 位置調整 HEIC",
  },
  {
    id: "offline",
    category: "export",
    title: "ホーム画面やオフラインで使う",
    summary: "オフライン準備完了後は、通信できない時も端末内の世界を編集できます。",
    body: "iPhone／iPadではSafariの共有メニューから「ホーム画面に追加」できます。初回のアプリ取得と更新にはネット接続が必要です。利用前に機内モードでも開けるか試しておくと安心です。",
    keywords: "PWA Safari iPad インストール ネットなし",
  },
];

export function filterTips(query: string, category: TipCategory | "all" = "all") {
  const normalized = query.trim().toLocaleLowerCase("ja-JP");
  return tips.filter((tip) => {
    if (category !== "all" && tip.category !== category) return false;
    if (!normalized) return true;
    return [tip.title, tip.summary, tip.body, tip.keywords]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ja-JP")
      .includes(normalized);
  });
}

export function TipsContent() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TipCategory | "all">("all");
  const visibleTips = useMemo(() => filterTips(query, category), [query, category]);

  return (
    <div className="tips-page">
      <div className="tips-intro">
        <BookOpen aria-hidden="true" />
        <div>
          <p className="eyebrow">WORLD TRAVEL HANDBOOK</p>
          <h3>やりたいことから探せます</h3>
          <p>W-Pamで迷った時に開く、小さな旅の手引きです。</p>
        </div>
      </div>

      <label className="tips-search">
        <span><Search aria-hidden="true" /> Tipsを検索</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="例：Dimension、バックアップ、相関図"
        />
      </label>

      <nav className="tips-categories" aria-label="Tipsの分類">
        <button type="button" aria-pressed={category === "all"} onClick={() => setCategory("all")}>すべて</button>
        {categories.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>
            <Icon aria-hidden="true" />{label}
          </button>
        ))}
      </nav>

      <p className="tips-count" role="status">{visibleTips.length}件のTips</p>
      {visibleTips.length ? (
        <div className="tips-groups">
          {categories.map(({ id, label, description, icon: Icon }) => {
            const group = visibleTips.filter((tip) => tip.category === id);
            if (!group.length) return null;
            return (
              <section key={id} className="tips-group" aria-labelledby={`tips-${id}`}>
                <div className="tips-group-heading">
                  <Icon aria-hidden="true" />
                  <div><h3 id={`tips-${id}`}>{label}</h3><small>{description}</small></div>
                </div>
                <div className="tips-list">
                  {group.map((tip) => (
                    <details key={tip.id} id={`tip-${tip.id}`} open={Boolean(query.trim())}>
                      <summary><span>{tip.title}</span><small>{tip.summary}</small></summary>
                      <p>{tip.body}</p>
                    </details>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="tips-empty">
          <Search aria-hidden="true" />
          <h3>一致するTipsがありません</h3>
          <p>短い言葉にするか、「すべて」を選んで探してみてください。</p>
        </div>
      )}

      <p className="tips-safety"><ShieldCheck aria-hidden="true" /><span><strong>大切な世界を守るために：</strong>W-Pamだけを唯一の保管場所にせず、定期的にJSONバックアップを書き出してください。</span></p>
    </div>
  );
}

import React, {
  useState,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  Map,
  Plus,
  Settings2,
  BookOpen,
  Users,
  MapPin,
  Building2,
  ScrollText,
  Images,
  Camera,
  History,
  Download,
  Upload,
  PencilLine,
  Copy,
  Trash2,
  ChevronLeft,
  X,
  Check,
  HelpCircle,
  Archive,
  GitCompareArrows,
  WifiOff,
  ImagePlus,
} from "lucide-react";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/aoboshi-one/latin-400.css";
import "@fontsource/kaisei-opti/500.css";
import "@fontsource/kaisei-opti/700.css";
import "@fontsource/zen-kaku-gothic-antique/500.css";
import "@fontsource/zen-kaku-gothic-antique/700.css";
import "./style.css";
import {
  blank,
  kinds,
  labels,
  fields,
  recordSchema,
  entitySchema,
  snapshot,
  diff,
  duplicateWorld,
  stamp,
  type State,
  type Kind,
  type RecordData,
  type Entity,
  type World,
  type Content,
  type Settings,
} from "./model";
import {
  readState,
  mutate,
  asset,
  prepareImage,
  backup,
  parseBackup,
  importedCopy,
  download,
  type ImageAsset,
} from "./db";
import { renderPages, savePNG, savePDF, type ExportOptions } from "./export";

const icons = {
  character: Users,
  location: MapPin,
  organization: Building2,
  lore: ScrollText,
  work: Images,
};
const ErrorContext = createContext("");
const B = ({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className={primary ? "button primary" : "button"}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);
function Photo({ id, thumb = false }: { id: string; thumb?: boolean }) {
  const [url, setURL] = useState("");
  useEffect(() => {
    let alive = true;
    let u = "";
    asset(id).then((a) => {
      if (a && alive) {
        u = URL.createObjectURL(thumb ? a.thumbnail : a.blob);
        setURL(u);
      }
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id, thumb]);
  return url ? (
    <img src={url} alt="登録された画像" loading="lazy" />
  ) : (
    <div className="image-placeholder">
      <Images aria-hidden="true" />
      <span>画像</span>
    </div>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(ErrorContext);
  const titleId = React.useId();
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={wide ? "wide" : ""}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="閉じる"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}
function EntryEditor({
  record,
  kind,
  onSave,
  close,
  busy,
}: {
  record: RecordData;
  kind?: Kind;
  onSave: (r: RecordData, assets: ImageAsset[]) => Promise<void>;
  close: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState({ ...record });
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [error, setError] = useState("");
  const [converting, setConverting] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  const quit = () => {
    if (
      !busy &&
      !converting &&
      (!dirty || confirm("編集中の入力を破棄して閉じますか？"))
    )
      close();
  };
  const keys = [
    "name",
    ...(kind === "character" ? ["reading"] : []),
    "catchphrase",
    "summary",
    "description",
    ...(!kind ? ["genre"] : []),
    ...(kind === "character" ? ["affiliation", "species", "age"] : []),
    ...(kind === "location" || kind === "organization"
      ? ["area", "members"]
      : []),
    ...(kind === "work" ? ["category", "url", "date"] : []),
    "tags",
    "memo",
  ];
  return (
    <Modal
      title={kind ? `${labels[kind]}を編集` : "世界を編集"}
      close={quit}
      wide
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave(recordSchema.parse(draft), assets);
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存できませんでした");
          }
        }}
      >
        <p className="muted">
          名前だけでも始められます。入力は「保存する」で端末に保存されます。
        </p>
        <fieldset disabled={busy || converting}>
          <div className="form-grid">
            {keys.map((key) => (
              <label
                className={
                  ["summary", "description", "memo"].includes(key) ? "full" : ""
                }
                key={key}
              >
                {fields[key]}
                {key === "name" ? " *" : ""}
                {["summary", "description", "memo"].includes(key) ? (
                  <textarea
                    rows={key === "description" ? 6 : 3}
                    maxLength={50000}
                    value={String(draft[key as keyof RecordData])}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft({ ...draft, [key]: e.target.value });
                    }}
                  />
                ) : (
                  <input
                    required={key === "name"}
                    maxLength={
                      key === "name" ? 100 : key === "url" ? 3000 : 5000
                    }
                    type={
                      key === "url" ? "url" : key === "date" ? "date" : "text"
                    }
                    value={String(draft[key as keyof RecordData])}
                    onChange={(e) => {
                      setDirty(true);
                      setDraft({ ...draft, [key]: e.target.value });
                    }}
                  />
                )}
              </label>
            ))}
          </div>
          <label className="upload">
            <ImagePlus />
            画像を追加（最大4枚・1枚20MBまで）
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              multiple
              disabled={draft.imageIds.length >= 4}
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length + draft.imageIds.length > 4) {
                  setError("画像は4枚までです");
                  return;
                }
                setConverting(true);
                setError("");
                try {
                  const added = [];
                  for (const file of files)
                    added.push(await prepareImage(file));
                  setAssets([...assets, ...added]);
                  setDraft({
                    ...draft,
                    imageIds: [...draft.imageIds, ...added.map((a) => a.id)],
                  });
                  setDirty(true);
                } catch (e) {
                  setError(String(e));
                } finally {
                  setConverting(false);
                }
              }}
            />
          </label>
          <p className="muted">
            先頭画像が表紙です。長辺1600pxに縮小します。アニメ画像は静止画になります。原本は別途保管してください。
          </p>
          <div className="image-strip">
            {draft.imageIds.map((id, i) => (
              <div key={id}>
                {assets.find((a) => a.id === id) ? (
                  <PendingPhoto
                    blob={assets.find((a) => a.id === id)!.thumbnail}
                  />
                ) : (
                  <Photo id={id} thumb />
                )}
                <B
                  onClick={() => {
                    const ids = [...draft.imageIds];
                    ids.splice(i, 1);
                    ids.unshift(id);
                    setDraft({ ...draft, imageIds: ids });
                    setDirty(true);
                  }}
                >
                  表紙に
                </B>
                <B
                  onClick={() => {
                    setDraft({
                      ...draft,
                      imageIds: draft.imageIds.filter((x) => x !== id),
                    });
                    setDirty(true);
                  }}
                >
                  外す
                </B>
              </div>
            ))}
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions sticky-actions">
          <B onClick={quit} disabled={busy || converting}>
            キャンセル
          </B>
          <button className="button primary" disabled={busy || converting}>
            {busy || converting ? "処理中…" : "保存する"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PendingPhoto({ blob }: { blob: Blob }) {
  const [url, setURL] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setURL(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return <img src={url} alt="追加予定の画像" />;
}
function Details({ r }: { r: RecordData }) {
  return (
    <>
      <div className="gallery">
        {r.imageIds.map((id) => (
          <Photo key={id} id={id} />
        ))}
      </div>
      {r.catchphrase && <p className="catchphrase">{r.catchphrase}</p>}
      <dl>
        {Object.entries(fields)
          .filter(([k]) => !["name", "catchphrase", "memo"].includes(k))
          .map(([k, label]) =>
            r[k as keyof RecordData] ? (
              <React.Fragment key={k}>
                <dt>{label}</dt>
                <dd>
                  {k === "url" ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.url}
                    </a>
                  ) : (
                    String(r[k as keyof RecordData])
                  )}
                </dd>
              </React.Fragment>
            ) : null,
          )}
      </dl>
      {r.memo && (
        <details className="private-note">
          <summary>作者用メモ（画像・PDFには含みません）</summary>
          <p>{r.memo}</p>
        </details>
      )}
    </>
  );
}
const steps = [
  [
    "ようこそ、W-Pamへ",
    "白紙からつくる創作世界観光パンフ。ログインなしで始められます。データはこのブラウザ・端末だけに保存されます。",
  ],
  [
    "世界をつくる",
    "「新しい世界」から名前を決めましょう。世界一覧から、いつでもパンフレットを開けます。",
  ],
  [
    "登場人物や場所を追加",
    "キャラクター・場所・組織・設定・作品を分類して登録できます。編集後は「保存する」を押してください。",
  ],
  [
    "ここまでを記録",
    "大切な節目で世界全体を記録。日時番号は自動、1.21や第三稿などのバージョン名は自由です。",
  ],
  [
    "変化を見つめる",
    "履歴で2地点を比較できます。過去版を眺めたり復元したりできます。復元前の状態も安全記録として残します。",
  ],
  [
    "パンフレットを持ち出す",
    "書き出しで内容を選び、プレビュー後にPNG・PDFを保存できます。作者用メモは出力されません。",
  ],
  [
    "世界を守る",
    "JSONは画像・履歴も含む復元用バックアップです。PDFは復元には使えません。端末故障やサイトデータ削除に備え、JSONを「ファイル」などに保管してください。設定からこの案内を再表示できます。",
  ],
];
function Tutorial({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  return (
    <Modal title="はじめてのW-Pam" close={close}>
      <div className="tutorial">
        <span className="eyebrow">
          GUIDE {step + 1} / {steps.length}
        </span>
        <BookOpen size={56} />
        <h3>{steps[step][0]}</h3>
        <p>{steps[step][1]}</p>
        <div className="actions">
          <B onClick={close}>スキップ</B>
          {step > 0 && <B onClick={() => setStep(step - 1)}>戻る</B>}
          <B
            primary
            onClick={() =>
              step === steps.length - 1 ? close() : setStep(step + 1)
            }
          >
            {step === steps.length - 1 ? "始める" : "次へ"}
          </B>
        </div>
      </div>
    </Modal>
  );
}
function ExportDialog({
  content,
  close,
}: {
  content: Content;
  close: () => void;
}) {
  const [options, setOptions] = useState<ExportOptions>({
    kinds: [...kinds],
    logo: true,
    separate: true,
    width: 794,
  });
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const boxEl = box.current;
    if (boxEl && pages[index]) boxEl.replaceChildren(pages[index]);
  }, [pages, index]);
  const change = (o: ExportOptions) => {
    setOptions(o);
    setPages([]);
    setIndex(0);
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="パンフレットを書き出す" close={() => !busy && close()} wide>
      <p>
        作者用メモは含みません。長文は自動改ページします。PDFは見た目優先の画像形式です（文字検索・選択はできません）。
      </p>
      <fieldset disabled={busy}>
        <div className="checks">
          {kinds.map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={options.kinds.includes(k)}
                onChange={(e) =>
                  change({
                    ...options,
                    kinds: e.target.checked
                      ? [...options.kinds, k]
                      : options.kinds.filter((x) => x !== k),
                  })
                }
              />
              {labels[k]}
            </label>
          ))}
        </div>
        <div className="checks">
          <label>
            <input
              type="checkbox"
              checked={options.logo}
              onChange={(e) => change({ ...options, logo: e.target.checked })}
            />
            W-Pamロゴ
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.separate}
              onChange={(e) =>
                change({ ...options, separate: e.target.checked })
              }
            />
            項目ごとに改ページ
          </label>
        </div>
        <label>
          解像度
          <select
            value={options.width}
            onChange={(e) =>
              change({ ...options, width: Number(e.target.value) })
            }
          >
            <option value={794}>標準（幅794px）</option>
            <option value={1191}>高解像度（幅1191px）</option>
          </select>
        </label>
        <div className="actions">
          <B
            primary
            onClick={() =>
              run(async () => {
                setPages(await renderPages(content, options));
                setIndex(0);
              })
            }
          >
            プレビューを作成
          </B>
        </div>
      </fieldset>
      {busy && <p role="status">書き出しを準備しています…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pages.length > 0 && (
        <>
          <div className="actions">
            <B
              disabled={index === 0 || busy}
              onClick={() => setIndex(index - 1)}
            >
              前
            </B>
            <span>
              {index + 1} / {pages.length}ページ
            </span>
            <B
              disabled={index === pages.length - 1 || busy}
              onClick={() => setIndex(index + 1)}
            >
              次
            </B>
          </div>
          <div className="export-preview" ref={box} />
          <div className="actions">
            <B
              disabled={busy}
              onClick={() => run(() => savePNG(pages, `W-Pam-${stamp()}`))}
            >
              PNG保存{pages.length > 1 ? "（ZIP）" : ""}
            </B>
            <B
              primary
              disabled={busy}
              onClick={() => run(() => savePDF(pages, `W-Pam-${stamp()}`))}
            >
              PDF保存
            </B>
          </div>
          <p className="muted">
            iPhoneではダウンロード後に「ファイル」アプリも確認してください。
          </p>
        </>
      )}
    </Modal>
  );
}
type ModalState =
  | { type: "settings" | "tutorial" | "history" | "snapshot" }
  | { type: "export"; content?: Content }
  | {
      type: "editor";
      record: RecordData;
      kind?: Kind;
      isNew: boolean;
      revision: number;
    }
  | { type: "detail"; record: Entity }
  | { type: "import"; worlds: World[]; assets: ImageAsset[] };
function App() {
  const [state, setState] = useState<State>();
  const [worldId, setWorldId] = useState("");
  const [tab, setTab] = useState<Kind | "overview">("overview");
  const [modal, setModal] = useState<ModalState>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [preview, setPreview] = useState<Content>();
  const [usage, setUsage] = useState("");
  const [update, setUpdate] = useState<() => Promise<void>>();
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    readState()
      .then((s) => {
        setState(s);
        if (!s.settings.tutorial) setModal({ type: "tutorial" });
      })
      .catch(() =>
        setError(
          "端末内保存を開けません。プライベートブラウズでない通常のブラウザで再度開いてください。",
        ),
      );
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    const s = state.settings;
    document.documentElement.style.setProperty("--font-scale", String(s.font));
    document.documentElement.style.setProperty("--space", String(s.density));
    document.documentElement.dataset.theme = s.theme;
  }, [state?.settings]);
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const updater = registerSW({
        onNeedRefresh() {
          setUpdate(() => () => updater(true));
        },
        onOfflineReady() {
          setNotice("オフラインで使う準備ができました");
        },
        onRegisterError() {
          setNotice(
            "オフライン準備に失敗しました。オンラインで再起動してください。",
          );
        },
      });
    }
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  const selected = state?.worlds.find((w) => w.content.world.id === worldId);
  const content = preview || selected?.content;
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "処理に失敗しました");
    } finally {
      setBusy(false);
    }
  };
  const save = async (
    fn: (s: State) => void,
    assets: ImageAsset[] = [],
    revision = state!.revision,
  ) => {
    const next = await mutate(revision, fn, assets);
    setState(next);
  };
  const close = () => setModal(undefined);
  const openWorld = (id: string) => {
    setWorldId(id);
    setTab("overview");
    setPreview(undefined);
  };
  const edit = (record: RecordData, kind?: Kind, isNew = false) =>
    setModal({
      type: "editor",
      record,
      kind,
      isNew,
      revision: state!.revision,
    });
  const backupDownload = async (worlds = state!.worlds) => {
    const b = await backup(worlds);
    const blob = new Blob([JSON.stringify(b)], { type: "application/json" });
    if (blob.size > 100 * 1024 * 1024)
      throw new Error("100MBを超えます。世界ごとに書き出してください。");
    download(blob, `W-Pam-backup-${stamp()}.json`);
    await save((s) => {
      s.settings.lastBackup = new Date().toISOString();
    });
    setNotice(
      "バックアップを書き出しました。端末のファイル保存先を確認してください。",
    );
  };
  if (!state)
    return (
      <main className="shell">
        <h1>W-Pam</h1>
        <p role="status">{error || "世界の本棚を開いています…"}</p>
      </main>
    );
  return (
    <ErrorContext.Provider value={error}>
      <>
        <header className="app-header">
          <button className="brand" onClick={() => openWorld("")}>
            <span className="brand-mark">
              <Map />
            </span>
            <span>
              <strong>W-Pam</strong>
              <small>ワールドパンフレットメーカー（仮）</small>
            </span>
          </button>
          <div className="actions">
            <span className="preview-tag">PREVIEW 0.1</span>
            <button
              className="icon-button"
              aria-label="チュートリアル"
              onClick={() => setModal({ type: "tutorial" })}
            >
              <HelpCircle />
            </button>
            <button
              className="icon-button"
              aria-label="設定"
              onClick={() => {
                setModal({ type: "settings" });
                navigator.storage
                  ?.estimate()
                  .then((e) =>
                    setUsage(
                      `${((e.usage || 0) / 1048576).toFixed(1)} MB / 約${((e.quota || 0) / 1048576).toFixed(0)} MB`,
                    ),
                  )
                  .catch(() =>
                    setUsage("容量情報はこの環境では取得できません"),
                  );
              }}
            >
              <Settings2 />
            </button>
          </div>
        </header>
        <main className="shell">
          {offline && (
            <p className="banner">
              <WifiOff />
              オフラインで作業中・端末内に保存します
            </p>
          )}
          {update && (
            <div className="banner">
              更新版があります。入力を保存してから更新してください。
              <B disabled={!!modal || busy} onClick={() => run(update)}>
                更新する
              </B>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
              <B onClick={() => run(async () => setState(await readState()))}>
                最新状態を読み直す
              </B>
            </div>
          )}
          {!content ? (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">YOUR WORLD COLLECTION</span>
                  <h1>世界の本棚</h1>
                  <p>白紙からつくる、創作世界観光パンフ。</p>
                </div>
                <div className="actions">
                  <B onClick={() => fileRef.current?.click()}>
                    <Upload />
                    読み込む
                  </B>
                  <B primary onClick={() => edit(blank(""), undefined, true)}>
                    <Plus />
                    新しい世界
                  </B>
                </div>
              </div>
              <div className="world-grid">
                {state.worlds
                  .filter((w) => !w.trashed)
                  .map((w, i) => (
                    <article className="world-card" key={w.content.world.id}>
                      <button
                        className="world-open"
                        onClick={() => openWorld(w.content.world.id)}
                      >
                        <div className="world-art">
                          {w.content.world.imageIds[0] ? (
                            <Photo id={w.content.world.imageIds[0]} thumb />
                          ) : (
                            <>
                              <Map size={52} />
                              <span>
                                WORLD {String(i + 1).padStart(2, "0")}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="card-body">
                          <span className="eyebrow">
                            {w.content.world.genre || "WORLD PAMPHLET"}
                          </span>
                          <h2>{w.content.world.name}</h2>
                          <p>
                            {w.content.world.catchphrase ||
                              "まだ見ぬ物語を、この一冊に。"}
                          </p>
                          <small>
                            {w.content.entities.length}項目 ·{" "}
                            {w.snapshots.length}個の記録
                          </small>
                        </div>
                      </button>
                      <div className="card-actions">
                        <B
                          onClick={() =>
                            run(async () => {
                              const c = duplicateWorld(w);
                              await save((s) => s.worlds.push(c));
                              openWorld(c.content.world.id);
                            })
                          }
                        >
                          <Copy />
                          複製
                        </B>
                        <B
                          onClick={() =>
                            run(async () => {
                              if (
                                confirm(
                                  "世界をごみ箱へ移動しますか？設定から戻せます。",
                                )
                              )
                                await save((s) => {
                                  s.worlds.find(
                                    (x) =>
                                      x.content.world.id === w.content.world.id,
                                  )!.trashed = true;
                                });
                            })
                          }
                        >
                          <Trash2 />
                          ごみ箱へ
                        </B>
                      </div>
                    </article>
                  ))}
                <button
                  className="new-world"
                  onClick={() => edit(blank(), undefined, true)}
                >
                  <Plus size={34} />
                  <h2>次の世界をひらこう</h2>
                  <p>名前ひとつから、始められます。</p>
                </button>
              </div>
              <div className="backup-banner">
                <Archive />
                <div>
                  <strong>大切な世界に、もうひとつの保存先を。</strong>
                  <p>
                    端末故障・サイトデータ削除に備え、画像と履歴を含むJSONを保管してください。
                  </p>
                </div>
                <B
                  disabled={busy || !state.worlds.length}
                  onClick={() => run(() => backupDownload())}
                >
                  全世界をバックアップ
                </B>
              </div>
            </>
          ) : (
            <>
              <nav className="breadcrumb">
                <B onClick={() => openWorld("")}>
                  <ChevronLeft />
                  世界の本棚
                </B>
                <span>{content.world.name}</span>
              </nav>
              {preview && (
                <div className="banner">
                  過去版の閲覧中です。編集はできません。
                  <B onClick={() => setPreview(undefined)}>現在の世界に戻る</B>
                </div>
              )}
              <section className="world-cover">
                <div>
                  <span className="eyebrow">WORLD PAMPHLET</span>
                  <h1>{content.world.name}</h1>
                  <p className="catchphrase">
                    {content.world.catchphrase || "この世界へ、ようこそ。"}
                  </p>
                  <div className="tags">
                    {content.world.tags
                      .split(/[,、]/)
                      .filter(Boolean)
                      .map((t, i) => (
                        <span key={i}>{t}</span>
                      ))}
                  </div>
                  <div className="actions">
                    {!preview && (
                      <>
                        <B primary onClick={() => edit(content.world)}>
                          <PencilLine />
                          世界を編集
                        </B>
                        <B onClick={() => setModal({ type: "snapshot" })}>
                          <Camera />
                          ここまでを記録
                        </B>
                      </>
                    )}
                    <B onClick={() => setModal({ type: "export" })}>
                      <Download />
                      書き出す
                    </B>
                  </div>
                </div>
                {content.world.imageIds[0] && (
                  <div className="cover-photo">
                    <Photo id={content.world.imageIds[0]} />
                  </div>
                )}
              </section>
              <nav className="tabs" aria-label="世界の分類">
                {(["overview", ...kinds] as const).map((k) => {
                  const Icon = k === "overview" ? BookOpen : icons[k];
                  return (
                    <button
                      key={k}
                      aria-current={tab === k ? "page" : undefined}
                      onClick={() => setTab(k)}
                    >
                      <Icon />
                      {k === "overview" ? "世界について" : labels[k]}
                      {k !== "overview" && (
                        <small>
                          {content.entities.filter((e) => e.kind === k).length}
                        </small>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="content-grid">
                <section className="paper">
                  <div className="section-heading">
                    <h2>
                      {tab === "overview" ? "この世界について" : labels[tab]}
                    </h2>
                    {tab !== "overview" && !preview && (
                      <B primary onClick={() => edit(blank(), tab, true)}>
                        <Plus />
                        追加
                      </B>
                    )}
                  </div>
                  {tab === "overview" ? (
                    <Details
                      r={{
                        ...content.world,
                        imageIds: content.world.imageIds.slice(1),
                      }}
                    />
                  ) : (
                    <div className="entity-grid">
                      {content.entities
                        .filter((e) => e.kind === tab)
                        .map((e) => {
                          const Icon = icons[e.kind];
                          return (
                            <button
                              className="entity-card"
                              key={e.id}
                              onClick={() =>
                                setModal({ type: "detail", record: e })
                              }
                            >
                              <div className="entity-photo">
                                {e.imageIds[0] ? (
                                  <Photo id={e.imageIds[0]} thumb />
                                ) : (
                                  <Icon size={36} />
                                )}
                              </div>
                              <div className="card-body">
                                <span className="eyebrow">
                                  {labels[e.kind]}
                                </span>
                                <h3>{e.name}</h3>
                                <p>
                                  {e.catchphrase ||
                                    e.summary.slice(0, 100) ||
                                    "紹介を追加してみましょう。"}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      {!content.entities.some((e) => e.kind === tab) && (
                        <p className="empty">
                          まだ登録されていません。名前から少しずつ育てましょう。
                        </p>
                      )}
                    </div>
                  )}
                </section>
                <aside>
                  <section className="paper">
                    <h2>世界の記録</h2>
                    <p className="muted">
                      編集内容の保存と、節目の記録は別です。
                    </p>
                    <B onClick={() => setModal({ type: "history" })}>
                      <History />
                      履歴・差分を見る
                    </B>
                    {selected!.snapshots
                      .slice(-3)
                      .reverse()
                      .map((s) => (
                        <div className="timeline-item" key={s.id}>
                          <strong>{s.version || s.number}</strong>
                          <p>{s.title}</p>
                          <small>{s.number}</small>
                        </div>
                      ))}
                  </section>
                  <section className="paper">
                    <h2>持ち歩くために</h2>
                    <p>JSONには画像・履歴・作者用メモも含まれます。</p>
                    <B
                      disabled={busy}
                      onClick={() => run(() => backupDownload([selected!]))}
                    >
                      <Download />
                      この世界のJSON
                    </B>
                  </section>
                </aside>
              </div>
            </>
          )}
          <footer>
            W-Pam Preview ·
            データはこの端末内に保存されます。同期・オンライン公開は行いません。
          </footer>
        </main>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              run(async () => {
                const b = await parseBackup(file);
                setModal({ type: "import", ...b });
              });
          }}
        />
        {modal?.type === "editor" && (
          <EntryEditor
            key={modal.record.id}
            record={modal.record}
            kind={modal.kind}
            busy={busy}
            close={close}
            onSave={async (r, assets) => {
              setBusy(true);
              try {
                await save(
                  (s) => {
                    const now = new Date().toISOString();
                    r.updatedAt = now;
                    if (!modal.kind) {
                      if (modal.isNew)
                        s.worlds.push({
                          content: { world: r, entities: [] },
                          snapshots: [],
                          trashed: false,
                        });
                      else
                        s.worlds.find(
                          (w) => w.content.world.id === r.id,
                        )!.content.world = r;
                    } else {
                      const w = s.worlds.find(
                        (w) => w.content.world.id === worldId,
                      )!;
                      const e = entitySchema.parse({
                        ...r,
                        kind: modal.kind,
                        worldId,
                      });
                      if (modal.isNew) w.content.entities.push(e);
                      else
                        w.content.entities = w.content.entities.map((x) =>
                          x.id === r.id ? e : x,
                        );
                      w.content.world.updatedAt = now;
                    }
                  },
                  assets,
                  modal.revision,
                );
                if (!modal.kind) openWorld(r.id);
                close();
                setNotice("端末に保存しました");
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        {modal?.type === "detail" && (
          <Modal title={modal.record.name} close={close} wide>
            <Details r={modal.record} />
            <B
              onClick={() =>
                setModal({
                  type: "export",
                  content: { world: modal.record, entities: [] },
                })
              }
            >
              <Download />
              この項目を書き出す
            </B>
            {!preview && (
              <div className="actions">
                <B
                  primary
                  onClick={() => edit(modal.record, modal.record.kind)}
                >
                  <PencilLine />
                  編集
                </B>
                <B
                  onClick={() =>
                    run(async () => {
                      if (
                        confirm(
                          "この項目を削除しますか？削除前の世界を自動記録します。",
                        )
                      ) {
                        await save((s) => {
                          const w = s.worlds.find(
                            (w) => w.content.world.id === worldId,
                          )!;
                          w.snapshots.push(
                            snapshot(w.content, "", "項目削除前の安全記録"),
                          );
                          w.content.entities = w.content.entities.filter(
                            (e) => e.id !== modal.record.id,
                          );
                          w.content.world.updatedAt = new Date().toISOString();
                        });
                        close();
                      }
                    })
                  }
                >
                  <Trash2 />
                  削除
                </B>
              </div>
            )}
          </Modal>
        )}
        {modal?.type === "snapshot" && (
          <Modal title="ここまでを記録" close={() => !busy && close()}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  await save((s) => {
                    const w = s.worlds.find(
                      (w) => w.content.world.id === worldId,
                    )!;
                    w.snapshots.push(
                      snapshot(
                        w.content,
                        String(f.get("version")),
                        String(f.get("title")) || "ここまでを記録",
                        String(f.get("note")),
                      ),
                    );
                  });
                  close();
                  setNotice("世界の節目を記録しました");
                });
              }}
            >
              <p>
                日時番号は端末の現地時刻で自動生成されます。同じ秒の記録も内部IDで区別します。
              </p>
              <label>
                バージョン名（任意）
                <input
                  name="version"
                  placeholder="1.21 / 第三稿"
                  maxLength={100}
                />
              </label>
              <label>
                更新タイトル
                <input name="title" maxLength={200} />
              </label>
              <label>
                更新メモ
                <textarea name="note" maxLength={50000} />
              </label>
              <button className="button primary" disabled={busy}>
                記録する
              </button>
            </form>
          </Modal>
        )}
        {modal?.type === "history" && selected && (
          <HistoryDialog
            world={selected}
            close={close}
            busy={busy}
            preview={(c) => {
              setPreview(c);
              setTab("overview");
              close();
            }}
            restore={(id) =>
              run(async () => {
                if (
                  !confirm(
                    "この版を現在の世界へ復元しますか？復元直前の世界も記録します。",
                  )
                )
                  return;
                await save((s) => {
                  const w = s.worlds.find(
                    (w) => w.content.world.id === worldId,
                  )!;
                  const target = w.snapshots.find((x) => x.id === id)!;
                  w.snapshots.push(snapshot(w.content, "", "復元前の安全記録"));
                  w.content = structuredClone(target.content);
                  w.content.world.updatedAt = new Date().toISOString();
                });
                setPreview(undefined);
                close();
                setNotice("復元しました。復元前の版も履歴に残っています。");
              })
            }
          />
        )}
        {modal?.type === "export" && content && (
          <ExportDialog content={modal.content || content} close={close} />
        )}
        {modal?.type === "tutorial" && (
          <Tutorial
            close={() =>
              run(async () => {
                await save((s) => {
                  s.settings.tutorial = 1;
                });
                close();
              })
            }
          />
        )}
        {modal?.type === "import" && (
          <Modal title="バックアップを読み込む" close={() => !busy && close()}>
            <p>
              {modal.worlds.length}世界・{modal.assets.length}
              画像を確認しました。
            </p>
            <ul>
              {modal.worlds.map((w) => (
                <li key={w.content.world.id}>
                  {w.content.world.name}（{w.snapshots.length}記録）
                </li>
              ))}
            </ul>
            <p>
              「別の世界として追加」が標準です。「同じIDを置換」では、置換前の世界を安全コピーとして本棚へ残します。既存の別世界は削除しません。
            </p>
            <div className="actions">
              {[false, true].map((replace) => (
                <B
                  key={String(replace)}
                  disabled={busy}
                  primary={!replace}
                  onClick={() =>
                    run(async () => {
                      if (
                        replace &&
                        !confirm(
                          "同じIDの世界を置換しますか？置換前の安全コピーを本棚に残します。",
                        )
                      )
                        return;
                      await save((s) => {
                        for (const w of modal.worlds) {
                          const i = s.worlds.findIndex(
                            (x) => x.content.world.id === w.content.world.id,
                          );
                          if (replace && i >= 0) {
                            const safety = importedCopy(s.worlds[i]);
                            safety.content.world.name +=
                              "（読み込み前の安全コピー）";
                            s.worlds.push(safety);
                            s.worlds[i] = w;
                          } else s.worlds.push(importedCopy(w));
                        }
                      }, modal.assets);
                      close();
                      openWorld("");
                      setNotice("読み込みました");
                    })
                  }
                >
                  {replace ? "同じIDを置換" : "別の世界として追加"}
                </B>
              ))}
            </div>
          </Modal>
        )}
        {modal?.type === "settings" && (
          <Modal title="設定とバックアップ" close={close}>
            <div className="form-grid">
              <label>
                文字サイズ
                <select
                  value={state.settings.font}
                  onChange={(e) =>
                    run(() =>
                      save((s) => {
                        s.settings.font = Number(e.target.value);
                      }),
                    )
                  }
                >
                  {[
                    [0.9, "小"],
                    [1, "標準"],
                    [1.12, "大"],
                    [1.25, "特大"],
                  ].map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                UIの余白
                <select
                  value={state.settings.density}
                  onChange={(e) =>
                    run(() =>
                      save((s) => {
                        s.settings.density = Number(e.target.value);
                      }),
                    )
                  }
                >
                  {[
                    [0.85, "コンパクト"],
                    [1, "標準"],
                    [1.2, "ゆったり"],
                  ].map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                外観
                <select
                  value={state.settings.theme}
                  onChange={(e) =>
                    run(() =>
                      save((s) => {
                        s.settings.theme = e.target.value as Settings["theme"];
                      }),
                    )
                  }
                >
                  <option value="light">明るい紙</option>
                  <option value="dark">夜の紙</option>
                  <option value="system">端末に合わせる</option>
                </select>
              </label>
            </div>
            <p className="muted">
              小さくしても操作ボタンのタップ領域は確保します。
            </p>
            <h3>端末内保存</h3>
            <p>{usage || "容量の目安を取得しています…"}</p>
            <p>
              最後のJSON書き出し：
              {state.settings.lastBackup
                ? new Date(state.settings.lastBackup).toLocaleString()
                : "まだありません"}
            </p>
            <div className="actions">
              <B disabled={busy} onClick={() => run(() => backupDownload())}>
                <Download />
                全世界のJSON
              </B>
              <B onClick={() => fileRef.current?.click()}>
                <Upload />
                JSONを読み込む
              </B>
              <B
                onClick={() =>
                  run(async () => {
                    const kept = await navigator.storage?.persist?.();
                    setNotice(
                      kept
                        ? "保存領域の保護が許可されました。バックアップも必要です。"
                        : "保存領域の保護は許可されませんでした。JSONで保管してください。",
                    );
                  })
                }
              >
                保存領域の保護をリクエスト
              </B>
            </div>
            <p className="notice">
              ブラウザのデータ削除や端末故障で失われる可能性があります。画像・PDFは復元用ではありません。
            </p>
            <h3>PWAとして使う</h3>
            <p>
              初回はオンラインで開いてください。iPhone／iPadはSafariの共有メニューから「ホーム画面に追加」。オフライン準備の完了後に機内モードでも試してください。
            </p>
            <B onClick={() => setModal({ type: "tutorial" })}>
              <HelpCircle />
              チュートリアルをもう一度
            </B>
            <h3>ごみ箱</h3>
            {state.worlds
              .filter((w) => w.trashed)
              .map((w) => (
                <div className="actions" key={w.content.world.id}>
                  <span>{w.content.world.name}</span>
                  <B
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        save((s) => {
                          s.worlds.find(
                            (x) => x.content.world.id === w.content.world.id,
                          )!.trashed = false;
                        }),
                      )
                    }
                  >
                    本棚に戻す
                  </B>
                </div>
              ))}
            {!state.worlds.some((w) => w.trashed) && (
              <p className="muted">ごみ箱は空です。</p>
            )}
            <h3>このプレビューについて</h3>
            <p>
              入力・画像・履歴はサーバー送信しません。ログイン・SNS・同期・AI機能はありません。サイト配信元では通常のアクセスログが記録される場合があります。自分が利用する権利を持つ画像を登録してください。
            </p>
          </Modal>
        )}
        {busy && (
          <div className="busy" role="status">
            処理中…
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
      </>
    </ErrorContext.Provider>
  );
}
function HistoryDialog({
  world,
  close,
  preview,
  restore,
  busy,
}: {
  world: World;
  close: () => void;
  preview: (c: Content) => void;
  restore: (id: string) => void;
  busy: boolean;
}) {
  const [left, setLeft] = useState(world.snapshots.at(-1)?.id || "current");
  const [right, setRight] = useState("current");
  const resolve = (id: string) =>
    id === "current"
      ? world.content
      : world.snapshots.find((s) => s.id === id)!.content;
  const changes = diff(resolve(left), resolve(right));
  const options = (
    <>
      <option value="current">現在の編集内容</option>
      {[...world.snapshots].reverse().map((s) => (
        <option key={s.id} value={s.id}>
          {s.version || s.number} · {s.title} · {s.id.slice(0, 6)}
        </option>
      ))}
    </>
  );
  return (
    <Modal title="履歴と差分" close={close} wide>
      <p>
        比較は左（変更前）から右（変更後）。日時だけでなく内容を比較します。
      </p>
      <div className="form-grid">
        <label>
          変更前
          <select value={left} onChange={(e) => setLeft(e.target.value)}>
            {options}
          </select>
        </label>
        <label>
          変更後
          <select value={right} onChange={(e) => setRight(e.target.value)}>
            {options}
          </select>
        </label>
      </div>
      <h3>
        <GitCompareArrows /> {changes.length}か所の違い
      </h3>
      <div className="diff-list">
        {changes.map((d, i) => (
          <article key={i} className="diff">
            <h4>
              {d.type} · {d.name} / {d.field}
            </h4>
            <div className="diff-values">
              <div>
                <small>変更前</small>
                <pre>{d.before || "（なし）"}</pre>
              </div>
              <div>
                <small>変更後</small>
                <pre>{d.after || "（なし）"}</pre>
              </div>
            </div>
          </article>
        ))}
        {!changes.length && <p>内容に違いはありません。</p>}
      </div>
      <h3>保存した地点</h3>
      {[...world.snapshots].reverse().map((s) => (
        <article className="history-row" key={s.id}>
          <span className="version">{s.version || s.number}</span>
          <h4>{s.title}</h4>
          <small>
            {s.number} · {new Date(s.createdAt).toLocaleString()} ·{" "}
            {s.id.slice(0, 6)}
          </small>
          <p>{s.note}</p>
          <div className="actions">
            <B onClick={() => preview(s.content)}>この版を眺める</B>
            <B disabled={busy} onClick={() => restore(s.id)}>
              この版へ復元
            </B>
          </div>
        </article>
      ))}
      {!world.snapshots.length && (
        <p>「ここまでを記録」で最初の地点を残しましょう。</p>
      )}
    </Modal>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

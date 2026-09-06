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
  Map as MapIcon,
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
  ChevronUp,
  ChevronDown,
  X,
  Check,
  HelpCircle,
  Archive,
  GitCompareArrows,
  WifiOff,
  ImagePlus,
  Link2,
  Move,
  Tag,
  Wrench,
  Star,
  Pin,
  GitFork,
  Network,
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
  shownName,
  relationDisplayLabel,
  referenceParts,
  uuid,
  type State,
  type Kind,
  type RecordData,
  type Entity,
  type Relation,
  type World,
  type Content,
  type Settings,
  type ImagePosition,
} from "./model";
import {
  readState,
  mutate,
  asset,
  prepareImage,
  backup,
  parseBackup,
  applyWorldImports,
  permanentlyDeleteWorld,
  download,
  type ImageAsset,
} from "./db";
import { orderEntities, renderPages, savePNG, savePDF, type ExportOptions } from "./export";
import { WorkspaceTools } from "./workspace";
import { TipsContent } from "./tips";
import { FolderManager, FolderMembership, DimensionPanel, ItemDimensionPanel, OverrideEditor, confirmDimensionLeave } from "./dimension-ui";
import { resolveContent, resolveRecord, validSelection, mergeFolderImports, dimensionLabel } from "./dimensions";
import { type DimensionSelection, type WorldFolder } from "./model";

const icons = {
  character: Users,
  location: MapPin,
  organization: Building2,
  lore: ScrollText,
  work: Images,
  term: Tag,
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
function Photo({
  id,
  thumb = false,
  position,
}: {
  id: string;
  thumb?: boolean;
  position?: ImagePosition;
}) {
  const [url, setURL] = useState("");
  useEffect(() => {
    let alive = true;
    let u = "";
    asset(id, thumb).then((a) => {
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
    <img
      src={url}
      alt="登録された画像"
      loading="lazy"
      style={{ objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }}
    />
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
function CharacterRelationsEditor({
  recordId,
  candidates,
  relations,
  onChange,
}: {
  recordId: string;
  candidates: Entity[];
  relations: Relation[];
  onChange: (relations: Relation[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [addOther, setAddOther] = useState("");
  const [addOrientation, setAddOrientation] = useState<"outgoing" | "incoming" | "mutual">("outgoing");
  const [addType, setAddType] = useState("");
  const [addNote, setAddNote] = useState("");
  const [editing, setEditing] = useState<{
    id: string;
    other: string;
    orientation: "outgoing" | "incoming" | "mutual";
    type: string;
    note: string;
  }>();
  const candidateMap = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const availableCandidates = candidates.filter((candidate) => candidate.id !== recordId);
  const related = relations.filter((relation) => relation.from === recordId || relation.to === recordId);
  const q = query.trim().toLocaleLowerCase();
  const matches = (relation: Relation) => {
    if (!q) return true;
    const otherId = relation.from === recordId ? relation.to : relation.from;
    const other = candidateMap.get(otherId);
    return [relation.type, relation.note, other && shownName(other)]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase().includes(q));
  };
  const outgoing = related.filter((relation) => (relation.direction === "mutual" || relation.from === recordId) && matches(relation));
  const incoming = related.filter((relation) => (relation.direction === "mutual" || relation.to === recordId) && matches(relation));
  const orientationOf = (relation: Relation): "outgoing" | "incoming" | "mutual" =>
    relation.direction === "mutual" ? "mutual" : relation.from === recordId ? "outgoing" : "incoming";
  const otherIdOf = (relation: Relation) => relation.from === recordId ? relation.to : relation.from;
  const beginEdit = (relation: Relation) => setEditing({
    id: relation.id,
    other: otherIdOf(relation),
    orientation: orientationOf(relation),
    type: relation.type,
    note: relation.note,
  });
  const saveEdit = () => {
    if (!editing?.other || !editing.type.trim()) return;
    const now = new Date().toISOString();
    onChange(relations.map((relation) => relation.id !== editing.id ? relation : {
      ...relation,
      from: editing.orientation === "incoming" ? editing.other : recordId,
      to: editing.orientation === "incoming" ? recordId : editing.other,
      direction: editing.orientation === "mutual" ? "mutual" : "directed",
      type: editing.type,
      note: editing.note,
      updatedAt: now,
    }));
    setEditing(undefined);
  };
  const addRelation = () => {
    if (!addOther || !addType.trim()) return;
    const now = new Date().toISOString();
    onChange([...relations, {
      id: uuid(),
      from: addOrientation === "incoming" ? addOther : recordId,
      to: addOrientation === "incoming" ? recordId : addOther,
      direction: addOrientation === "mutual" ? "mutual" : "directed",
      type: addType,
      note: addNote,
      createdAt: now,
      updatedAt: now,
    }]);
    setAddOther("");
    setAddOrientation("outgoing");
    setAddType("");
    setAddNote("");
  };
  const row = (relation: Relation, perspective: "outgoing" | "incoming") => {
    const other = candidateMap.get(otherIdOf(relation));
    if (!other) return null;
    if (editing?.id === relation.id) {
      return <div key={`${perspective}-${relation.id}`} className="character-relation-edit">
        <label>相手<select value={editing.other} onChange={(event) => setEditing({ ...editing, other: event.target.value })}>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{shownName(candidate)}（{labels[candidate.kind]}）</option>)}</select></label>
        <label>関係の向き<select value={editing.orientation} onChange={(event) => setEditing({ ...editing, orientation: event.target.value as "outgoing" | "incoming" | "mutual" })}><option value="outgoing">このキャラ → 相手</option><option value="incoming">相手 → このキャラ</option><option value="mutual">このキャラ ↔ 相手</option></select></label>
        <label>関係名<input required maxLength={80} value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value })} /><small>表示時は先頭20文字を10文字×2行に整えます。</small></label>
        <label className="full">補足メモ<textarea rows={2} maxLength={50000} value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} /></label>
        <div className="actions full"><B onClick={() => setEditing(undefined)}>キャンセル</B><B primary disabled={!editing.other || !editing.type.trim()} onClick={saveEdit}>変更を反映</B></div>
      </div>;
    }
    const arrow = relation.direction === "mutual" ? "↔" : perspective === "outgoing" ? "→" : "←";
    return <div className="character-relation-row" key={`${perspective}-${relation.id}`}>
      <div><strong title={relation.type}>{relationDisplayLabel(relation.type)}</strong><span>{arrow} {shownName(other)}</span>{relation.note && <small>{relation.note}</small>}</div>
      <div className="relation-actions"><button type="button" className="icon-button" aria-label="関係を編集" onClick={() => beginEdit(relation)}><PencilLine /></button><button type="button" className="icon-button" aria-label="関係を削除" onClick={() => onChange(relations.filter((item) => item.id !== relation.id))}><Trash2 /></button></div>
    </div>;
  };

  return <fieldset className="character-relations-editor">
    <legend><Network /> 関係</legend>
    <p className="muted">このキャラクターを起点・相手にした関係をここでまとめて編集できます。相関図と同じ関係データへ保存されます。</p>
    <div className="compact-form character-relation-add">
      <label>相手<select required value={addOther} onChange={(event) => setAddOther(event.target.value)}><option value="" disabled>選択</option>{availableCandidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{shownName(candidate)}（{labels[candidate.kind]}）</option>)}</select></label>
      <label>関係の向き<select value={addOrientation} onChange={(event) => setAddOrientation(event.target.value as "outgoing" | "incoming" | "mutual")}><option value="outgoing">このキャラ → 相手</option><option value="incoming">相手 → このキャラ</option><option value="mutual">このキャラ ↔ 相手</option></select></label>
      <label>関係名<input required maxLength={80} value={addType} onChange={(event) => setAddType(event.target.value)} placeholder="親友／ライバル／片思い…" /><small>表示時は先頭20文字を10文字×2行に整えます。</small></label>
      <label className="full">補足メモ<textarea rows={2} maxLength={50000} value={addNote} onChange={(event) => setAddNote(event.target.value)} /></label>
      <B primary disabled={!addOther || !addType.trim()} onClick={addRelation}><Plus />関係を追加</B>
    </div>
    <label className="relation-search">関係を検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="キャラ名・関係名・メモ" /></label>
    <p className="muted">このキャラクターに関係する登録：{related.length}件。50件以上でも検索・折りたたみで扱えます。</p>
    <div className="character-relation-columns">
      <details open>
        <summary>向けている関係（{outgoing.length}）</summary>
        <div className="character-relation-list">{outgoing.map((relation) => row(relation, "outgoing"))}{!outgoing.length && <p className="empty">該当する関係はありません。</p>}</div>
      </details>
      <details open>
        <summary>向けられている関係（{incoming.length}）</summary>
        <div className="character-relation-list">{incoming.map((relation) => row(relation, "incoming"))}{!incoming.length && <p className="empty">該当する関係はありません。</p>}</div>
      </details>
    </div>
  </fieldset>;
}

function EntryEditor({
  record,
  kind,
  onSave,
  close,
  busy,
  relatedCandidates,
  relations,
  dimensionNotice,
}: {
  dimensionNotice?: string;
  record: RecordData;
  kind?: Kind;
  onSave: (r: RecordData, assets: ImageAsset[], relations: Relation[]) => Promise<void>;
  close: () => void;
  busy: boolean;
  relatedCandidates: Entity[];
  relations: Relation[];
}) {
  const [draft, setDraft] = useState({ ...record });
  const [relationDrafts, setRelationDrafts] = useState<Relation[]>(() => structuredClone(relations));
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
    "displayName",
    ...(kind === "character" ? ["reading"] : []),
    ...(kind === "term" ? [] : ["catchphrase"]),
    "summary",
    ...(kind === "term" ? [] : ["description"]),
    ...(!kind ? ["genre"] : []),
    ...(kind === "character" ? ["affiliation", "species", "age"] : []),
    ...(kind === "location" || kind === "organization"
      ? ["area", "members"]
      : []),
    ...(kind === "work" ? ["category", "url", "date"] : []),
    ...(kind === "character" ? ["dialogueSamples"] : []),
    "tags",
    "memo",
  ];
  return (
    <Modal
      title={kind ? `${labels[kind]}を編集` : "世界を編集"}
      close={quit}
      wide
    >
      {dimensionNotice && <p className="banner">{dimensionNotice}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave(recordSchema.parse(draft), assets, relationDrafts);
          } catch (e) {
            setError(e instanceof Error ? e.message : "保存できませんでした");
          }
        }}
      >
        <p className="muted">
          名前だけでも始められます。入力は「保存する」で端末に保存されます。
        </p>
        <fieldset disabled={busy || converting}>
          {kind === "character" && (
            <label>
              入力テンプレート
              <select
                defaultValue=""
                onChange={(event) => {
                  const templates: Record<string, { label: string; value: string }[]> = {
                    story: [
                      { label: "役割", value: "" },
                      { label: "目的", value: "" },
                      { label: "葛藤", value: "" },
                      { label: "秘密", value: "" },
                    ],
                    game: [
                      { label: "クラス・役職", value: "" },
                      { label: "能力", value: "" },
                      { label: "装備", value: "" },
                      { label: "戦い方", value: "" },
                    ],
                    profile: [
                      { label: "好きなもの", value: "" },
                      { label: "苦手なもの", value: "" },
                      { label: "得意なこと", value: "" },
                      { label: "大切なもの", value: "" },
                    ],
                  };
                  if (!event.target.value) return;
                  setDraft({ ...draft, customFields: [...draft.customFields, ...templates[event.target.value].map((field) => ({ ...field, id: crypto.randomUUID() }))].slice(0, 30) });
                  setDirty(true);
                  event.target.value = "";
                }}
              >
                <option value="">選ぶとカスタム項目へ追加</option>
                <option value="story">物語キャラクター</option>
                <option value="game">ゲーム・戦闘</option>
                <option value="profile">日常プロフィール</option>
              </select>
            </label>
          )}
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
                      ["name", "displayName"].includes(key)
                        ? 100
                        : key === "url"
                          ? 3000
                          : 5000
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
          {!!kind && relatedCandidates.some((candidate) => candidate.id !== draft.id && (kind === "location" || kind === "organization" ? candidate.kind === kind : true)) && (
            <label>
              親項目・上位階層
              <select value={draft.parentId} onChange={(event) => { setDraft({ ...draft, parentId: event.target.value }); setDirty(true); }}>
                <option value="">指定なし</option>
                {relatedCandidates.filter((candidate) => candidate.id !== draft.id && candidate.kind === kind).map((candidate) => <option key={candidate.id} value={candidate.id}>{shownName(candidate)}</option>)}
              </select>
            </label>
          )}
          <fieldset className="custom-fields">
            <legend>カスタム項目</legend>
            {draft.customFields.map((field, index) => (
              <div className="custom-field-row" key={field.id}>
                <input aria-label="項目名" value={field.label} maxLength={80} onChange={(event) => { const customFields = [...draft.customFields]; customFields[index] = { ...field, label: event.target.value }; setDraft({ ...draft, customFields }); setDirty(true); }} />
                <textarea aria-label="内容" rows={2} value={field.value} onChange={(event) => { const customFields = [...draft.customFields]; customFields[index] = { ...field, value: event.target.value }; setDraft({ ...draft, customFields }); setDirty(true); }} />
                <B onClick={() => { setDraft({ ...draft, customFields: draft.customFields.filter((item) => item.id !== field.id) }); setDirty(true); }}>削除</B>
              </div>
            ))}
            {draft.customFields.length < 30 && <B onClick={() => { setDraft({ ...draft, customFields: [...draft.customFields, { id: crypto.randomUUID(), label: "新しい項目", value: "" }] }); setDirty(true); }}><Plus />項目を追加</B>}
          </fieldset>
          {relatedCandidates.some((candidate) => candidate.id !== draft.id) && (
            <fieldset className="related-picker">
              <legend>
                <Link2 /> 関連項目
              </legend>
              <p className="muted">
                この項目と一緒に見てほしい人物・場所・組織などを選べます。
              </p>
              <div className="related-options">
                {relatedCandidates
                  .filter((candidate) => candidate.id !== draft.id)
                  .map((candidate) => (
                    <label key={candidate.id}>
                      <input
                        type="checkbox"
                        checked={draft.relatedIds.includes(candidate.id)}
                        onChange={(event) => {
                          setDirty(true);
                          setDraft({
                            ...draft,
                            relatedIds: event.target.checked
                              ? [...draft.relatedIds, candidate.id]
                              : draft.relatedIds.filter(
                                  (id) => id !== candidate.id,
                                ),
                          });
                        }}
                      />
                      <span>
                        {shownName(candidate)}
                        <small>{labels[candidate.kind]}</small>
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>
          )}
          {kind === "character" && relatedCandidates.some((candidate) => candidate.id !== draft.id) && (
            <CharacterRelationsEditor
              recordId={draft.id}
              candidates={relatedCandidates}
              relations={relationDrafts}
              onChange={(next) => { setRelationDrafts(next); setDirty(true); }}
            />
          )}
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
              <div className="image-position-card" key={id}>
                {assets.find((a) => a.id === id) ? (
                  <PendingPhoto
                    blob={assets.find((a) => a.id === id)!.thumbnail}
                    position={draft.imagePositions[id]}
                  />
                ) : (
                  <Photo id={id} thumb position={draft.imagePositions[id]} />
                )}
                <fieldset className="position-controls">
                  <legend>
                    <Move /> 表示位置
                  </legend>
                  {(
                    [
                      ["x", "左右"],
                      ["y", "上下"],
                    ] as const
                  ).map(([axis, label]) => (
                    <label key={axis}>
                      <span>{label}</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={draft.imagePositions[id]?.[axis] ?? 50}
                        onChange={(event) => {
                          setDirty(true);
                          setDraft({
                            ...draft,
                            imagePositions: {
                              ...draft.imagePositions,
                              [id]: {
                                x: draft.imagePositions[id]?.x ?? 50,
                                y: draft.imagePositions[id]?.y ?? 50,
                                [axis]: Number(event.target.value),
                              },
                            },
                          });
                        }}
                      />
                    </label>
                  ))}
                </fieldset>
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
                    const imagePositions = { ...draft.imagePositions };
                    delete imagePositions[id];
                    setDraft({
                      ...draft,
                      imageIds: draft.imageIds.filter((x) => x !== id),
                      imagePositions,
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
function PendingPhoto({
  blob,
  position,
}: {
  blob: Blob;
  position?: ImagePosition;
}) {
  const [url, setURL] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setURL(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <img
      src={url}
      alt="追加予定の画像"
      style={{ objectPosition: `${position?.x ?? 50}% ${position?.y ?? 50}%` }}
    />
  );
}
function RichText({
  text,
  content,
  openReference,
}: {
  text: string;
  content?: Content;
  openReference?: (record: Entity) => void;
}) {
  return referenceParts(text).map((part, index) => {
    if (!part.query || !content || !openReference) return part.raw;
    const matches = content.entities.filter(
      (entity) =>
        entity.name === part.query || entity.displayName === part.query,
    );
    if (matches.length !== 1)
      return (
        <span className="inline-reference unresolved" key={index}>
          {part.raw}
        </span>
      );
    return (
      <button
        type="button"
        className="inline-reference"
        key={index}
        onClick={() => openReference(matches[0])}
        title={`${shownName(matches[0])}の概要を表示`}
      >
        {part.label}
      </button>
    );
  });
}
const plainReferencedText = (text: string) =>
  referenceParts(text)
    .map((part) => part.label || part.raw)
    .join("");
function Details({
  r,
  content,
  openReference,
}: {
  r: RecordData;
  content?: Content;
  openReference?: (record: Entity) => void;
}) {
  const related = content?.entities.filter(
    (entity) =>
      r.relatedIds.includes(entity.id) || entity.relatedIds.includes(r.id),
  );
  const relations = content?.relations.filter(
    (relation) => relation.from === r.id || relation.to === r.id,
  );
  const parent = content?.entities.find((entity) => entity.id === r.parentId);
  const children = content?.entities.filter((entity) => entity.parentId === r.id);
  return (
    <>
      <div className="gallery">
        {r.imageIds.map((id) => (
          <Photo key={id} id={id} position={r.imagePositions[id]} />
        ))}
      </div>
      {r.catchphrase && (
        <p className="catchphrase rich-text">
          <RichText
            text={r.catchphrase}
            content={content}
            openReference={openReference}
          />
        </p>
      )}
      <dl>
        {r.displayName && (
          <>
            <dt>正式名称</dt>
            <dd>{r.name}</dd>
          </>
        )}
        {Object.entries(fields)
          .filter(
            ([k]) =>
              !["name", "displayName", "catchphrase", "memo"].includes(k),
          )
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
                    <RichText
                      text={String(r[k as keyof RecordData])}
                      content={content}
                      openReference={openReference}
                    />
                  )}
                </dd>
              </React.Fragment>
            ) : null,
          )}
      </dl>
      {r.customFields.map((field) => field.value ? (
        <dl key={field.id}>
          <dt>{field.label}</dt>
          <dd><RichText text={field.value} content={content} openReference={openReference} /></dd>
        </dl>
      ) : null)}
      {(parent || !!children?.length) && (
        <section className="related-section">
          <h3><GitFork /> 階層</h3>
          <div className="related-cards">
            {parent && <button type="button" onClick={() => openReference?.(parent)}><span>親：{shownName(parent)}</span><small>{labels[parent.kind]}</small></button>}
            {children?.map((entity) => <button type="button" key={entity.id} onClick={() => openReference?.(entity)}><span>子：{shownName(entity)}</span><small>{labels[entity.kind]}</small></button>)}
          </div>
        </section>
      )}
      {!!relations?.length && (
        <section className="related-section">
          <h3><Network /> 登録した関係性</h3>
          <div className="relation-nav">
            {relations.map((relation) => {
              const outgoing = relation.from === r.id;
              const other = content?.entities.find((entity) => entity.id === (outgoing ? relation.to : relation.from));
              return other ? <button type="button" key={relation.id} onClick={() => openReference?.(other)}><strong title={relation.type}>{relationDisplayLabel(relation.type)}</strong><span>{relation.direction === "mutual" ? "↔" : outgoing ? "→" : "←"}</span>{shownName(other)}{relation.note && <small>{relation.note}</small>}</button> : null;
            })}
          </div>
        </section>
      )}
      {!!related?.length && (
        <section className="related-section">
          <h3>
            <Link2 /> 関連項目
          </h3>
          <div className="related-cards">
            {related.map((entity) => (
              <button
                type="button"
                key={entity.id}
                onClick={() => openReference?.(entity)}
              >
                <span>{shownName(entity)}</span>
                <small>{labels[entity.kind]}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      {r.memo && (
        <details className="private-note">
          <summary>作者用メモ（画像・PDFには含みません）</summary>
          <p>{r.memo}</p>
        </details>
      )}
    </>
  );
}

function RecordHistory({ world, record }: { world: World; record: Entity }) {
  const points = [
    ...world.snapshots.map((item) => ({ label: item.version || item.number, date: item.createdAt, content: item.content })),
    { label: "現在", date: world.content.world.updatedAt, content: world.content },
  ];
  const changes = points.flatMap((point, index) => {
    const current = point.content.entities.find((entity) => entity.id === record.id);
    const before = index ? points[index - 1].content.entities.find((entity) => entity.id === record.id) : undefined;
    if (!current && !before) return [];
    if (!before && current) return [{ ...point, summary: "項目を追加" }];
    if (before && !current) return [{ ...point, summary: "項目を削除" }];
    const changed = Object.entries(fields).filter(([key]) => JSON.stringify(before?.[key as keyof Entity]) !== JSON.stringify(current?.[key as keyof Entity])).map(([, label]) => label);
    if (JSON.stringify(before?.overrides) !== JSON.stringify(current?.overrides)) changed.push("Dimension差分");
    if (JSON.stringify(before?.customFields) !== JSON.stringify(current?.customFields)) changed.push("カスタム項目");
    if (JSON.stringify(before?.relatedIds) !== JSON.stringify(current?.relatedIds)) changed.push("関連項目");
    return changed.length ? [{ ...point, summary: changed.join("・") }] : [];
  }).reverse();
  return (
    <details className="record-history">
      <summary><History /> この項目の変更履歴（{changes.length}件）</summary>
      {changes.map((item, index) => <div key={`${item.label}-${index}`}><strong>{item.label}</strong><span>{item.summary}</span><small>{new Date(item.date).toLocaleString()}</small></div>)}
      {!changes.length && <p className="muted">節目を記録すると、この項目の変化を追えます。</p>}
    </details>
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
    "キャラクター・場所・組織・設定・作品を分類して登録できます。正式名称とは別に表示名・通称も付けられます。編集後は「保存する」を押してください。",
  ],
  [
    "世界をつなげる",
    "関連項目を選ぶと、項目同士を行き来できます。文章に [[項目名]] または [[項目名|表示文字]] と書くと、タップで概要を開けます。",
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
  type DialogOptions = ExportOptions & {
    entityIds: string[];
    entityOrder: string[];
    order: NonNullable<ExportOptions["order"]>;
    template: NonNullable<ExportOptions["template"]>;
  };
  const [options, setOptions] = useState<DialogOptions>({
    kinds: [...kinds],
    entityIds: content.entities.map((entity) => entity.id),
    entityOrder: content.entities.map((entity) => entity.id),
    order: "kind",
    template: "encyclopedia",
    logo: true,
    separate: true,
    width: 794,
  });
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draggedId, setDraggedId] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const boxEl = box.current;
    if (boxEl && pages[index]) boxEl.replaceChildren(pages[index]);
  }, [pages, index]);
  const change = (o: DialogOptions) => {
    setOptions(o);
    setPages([]);
    setIndex(0);
  };
  const orderedChoices = orderEntities(content.entities, options.order, options.entityOrder);
  const moveEntity = (id: string, offset: -1 | 1) => {
    const order = [...options.entityOrder];
    const index = order.indexOf(id);
    const nextIndex = index + offset;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    change({ ...options, order: "manual", entityOrder: order });
  };
  const dropEntity = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return setDraggedId("");
    const order = options.entityOrder.filter((id) => id !== draggedId);
    const targetIndex = order.indexOf(targetId);
    order.splice(targetIndex < 0 ? order.length : targetIndex, 0, draggedId);
    setDraggedId("");
    change({ ...options, order: "manual", entityOrder: order });
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
        <label>
          出力テンプレート
          <select value={options.template} onChange={(e) => change({ ...options, template: e.target.value as DialogOptions["template"] })}>
            <option value="encyclopedia">図鑑</option>
            <option value="character">キャラシート</option>
            <option value="tourism">観光パンフ</option>
            <option value="setting">世界設定資料集</option>
          </select>
        </label>
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
        <label>
          パンフレットの出力順
          <select value={options.order} onChange={(e) => change({ ...options, order: e.target.value as DialogOptions["order"] })}>
            <option value="kind">種類ごと（キャラ→場所→組織→設定・記事→作品→用語）</option>
            <option value="registration">登録順</option>
            <option value="name">名前順</option>
            <option value="manual">手動で並べ替え</option>
          </select>
        </label>
        {!!content.entities.length && <details className="export-selection">
          <summary>出力する項目を個別に選ぶ（{options.entityIds.length}/{content.entities.length}）</summary>
          <div className="checks export-select-all">
            <label><input type="checkbox" checked={options.entityIds.length === content.entities.length} onChange={(e) => change({ ...options, entityIds: e.target.checked ? content.entities.map((entity) => entity.id) : [] })} />すべて</label>
          </div>
          <div className="export-order-list">
            {orderedChoices.map((entity, index) => (
              <div className="export-order-row" key={entity.id} draggable={options.order === "manual"} onDragStart={() => setDraggedId(entity.id)} onDragEnd={() => setDraggedId("")} onDragOver={(event) => event.preventDefault()} onDrop={() => dropEntity(entity.id)}>
                {options.order === "manual" && <Move aria-hidden="true" />}
                <label>
                  <input type="checkbox" checked={options.entityIds.includes(entity.id)} onChange={(event) => change({ ...options, entityIds: event.target.checked ? [...options.entityIds, entity.id] : options.entityIds.filter((id) => id !== entity.id) })} />
                  <span>{shownName(entity)} <small>· {labels[entity.kind]}</small></span>
                </label>
                {options.order === "manual" && <span className="export-order-actions">
                  <button type="button" className="icon-button" aria-label={`${shownName(entity)}を上へ`} disabled={index === 0} onClick={() => moveEntity(entity.id, -1)}><ChevronUp /></button>
                  <button type="button" className="icon-button" aria-label={`${shownName(entity)}を下へ`} disabled={index === orderedChoices.length - 1} onClick={() => moveEntity(entity.id, 1)}><ChevronDown /></button>
                </span>}
              </div>
            ))}
          </div>
        </details>}
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
  | { type: "settings" | "tutorial" | "tips" | "history" | "snapshot" }
  | { type: "export"; content?: Content }
  | {
      type: "editor";
      record: RecordData;
      kind?: Kind;
      isNew: boolean;
      revision: number;
    }
  | { type: "detail" | "reference"; record: Entity }
  | { type: "relation-dimension"; id: string }
  | { type: "import"; worlds: World[]; worldFolders: WorldFolder[]; assets: ImageAsset[] };
function App() {
  const [state, setState] = useState<State>();
  const [worldId, setWorldId] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [dimensionSelection, setDimensionSelection] = useState<DimensionSelection>({});
  const [tab, setTab] = useState<Kind | "overview" | "tools">("overview");
  const [storedModal, setModal] = useState<ModalState>();
  const [showHidden, setShowHidden] = useState(false);
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
  const folder = state?.worldFolders.find(f => f.id === selected?.folderId);
  const activeSelection = validSelection(folder, dimensionSelection);
  const dimensionActive = Object.keys(activeSelection).length > 0;
  const baseContent = preview || selected?.content;
  const content = baseContent ? resolveContent(baseContent, activeSelection) : undefined;
  const modal = storedModal && (storedModal.type === "detail" || storedModal.type === "reference") ? {...storedModal, record: content?.entities.find(e => e.id === storedModal.record.id) || resolveRecord(baseContent?.entities.find(e => e.id === storedModal.record.id) || storedModal.record, activeSelection)} : storedModal;
  const importCollisionCount = modal?.type === "import"
    ? modal.worlds.filter((w) =>
        state?.worlds.some(
          (current) => current.content.world.id === w.content.world.id,
        ),
      ).length
    : 0;
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
  const close = () => {if(confirmDimensionLeave()) setModal(undefined);};
  const openWorld = (id: string) => {
    setWorldId(id);
    setDimensionSelection({});
    setTab("overview");
    setPreview(undefined);
  };
  const edit = (record: RecordData, kind?: Kind, isNew = false) =>
    {if(!confirmDimensionLeave()) return; setModal({
      type: "editor",
      record: isNew ? record : structuredClone([selected?.content.world, ...(selected?.content.entities || [])].find(r => r?.id === record.id) || record),
      kind,
      isNew,
      revision: state!.revision,
    });};
  const backupDownload = async (worlds = state!.worlds) => {
    const b = await backup(worlds, state!.worldFolders);
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
              <MapIcon />
            </span>
            <span>
              <strong>W-Pam</strong>
              <small>ワールドパンフレットメーカー（仮）</small>
            </span>
          </button>
          <div className="actions">
            <span className="preview-tag">PREVIEW 0.3</span>
            <button
              className="button header-tips"
              aria-label="Tips・使い方を開く"
              onClick={() => setModal({ type: "tips" })}
            >
              <HelpCircle />
              <span>Tips・使い方</span>
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
              <FolderManager state={state} save={save} filter={folderFilter} setFilter={setFolderFilter} />
              <div className="world-grid">
                {state.worlds
                  .filter((w) => !w.trashed && (!folderFilter || (folderFilter === "unfiled" ? !w.folderId : w.folderId === folderFilter)))
                  .map((w, i) => (
                    <article className="world-card" key={w.content.world.id}>
                      <button
                        className="world-open"
                        onClick={() => openWorld(w.content.world.id)}
                      >
                        <div className="world-art">
                          {w.content.world.imageIds[0] ? (
                            <Photo
                              id={w.content.world.imageIds[0]}
                              thumb
                              position={
                                w.content.world.imagePositions[
                                  w.content.world.imageIds[0]
                                ]
                              }
                            />
                          ) : (
                            <>
                              <MapIcon size={52} />
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
                          <h2>{shownName(w.content.world)}</h2>
                          <p>
                            {plainReferencedText(w.content.world.catchphrase) ||
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
                <span>{shownName(content.world)}</span>
              </nav>
              {selected && !preview && <FolderMembership state={state} world={selected} save={save} />}
              {selected && folder && <DimensionPanel key={worldId + ":" + folder.id} state={state} world={selected} folder={folder} selection={activeSelection} changeSelection={setDimensionSelection} save={save} readonly={!!preview} />}
              {dimensionActive && !preview && <details className="dimension-box"><summary>非掲載の項目を探す（作者用）</summary><label><input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />非掲載の項目を表示</label>{showHidden && <div className="actions">{baseContent?.entities.filter(e => !content.entities.some(v => v.id === e.id)).map(e => <B key={e.id} onClick={() => setModal({type:"detail", record:e})}>{shownName(e)} · 非掲載</B>)}</div>}</details>}
              {preview && (
                <div className="banner">
                  過去版の閲覧中です。編集はできません。
                  <B onClick={() => setPreview(undefined)}>現在の世界に戻る</B>
                </div>
              )}
              <section className="world-cover">
                <div>
                  <span className="eyebrow">WORLD PAMPHLET</span>
                  <h1>{shownName(content.world)}</h1>
                  <p className="catchphrase">
                    {content.world.catchphrase ? (
                      <RichText
                        text={content.world.catchphrase}
                        content={content}
                        openReference={(record) =>
                          setModal({ type: "reference", record })
                        }
                      />
                    ) : (
                      "この世界へ、ようこそ。"
                    )}
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
                          基本データを編集
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
                    <Photo
                      id={content.world.imageIds[0]}
                      position={
                        content.world.imagePositions[content.world.imageIds[0]]
                      }
                    />
                  </div>
                )}
              </section>
              <nav className="tabs" aria-label="世界の分類">
                {(["overview", "tools", ...kinds] as const).map((k) => {
                  const Icon = k === "overview" ? BookOpen : k === "tools" ? Wrench : icons[k];
                  return (
                    <button
                      key={k}
                      aria-current={tab === k ? "page" : undefined}
                      onClick={() => setTab(k)}
                    >
                      <Icon />
                      {k === "overview" ? "世界について" : k === "tools" ? "整理・探索" : labels[k]}
                      {k !== "overview" && k !== "tools" && (
                        <small>
                          {content.entities.filter((e) => e.kind === k).length}
                        </small>
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className={tab === "tools" ? "content-grid tools-active" : "content-grid"}>
                <section className="paper">
                  <div className="section-heading">
                    <h2>
                      {tab === "overview" ? "この世界について" : tab === "tools" ? "世界を整理し、つなぎ、歩く" : labels[tab]}
                    </h2>
                    {tab !== "overview" && tab !== "tools" && !preview && (
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
                      content={content}
                      openReference={(record) =>
                        setModal({ type: "reference", record })
                      }
                    />
                  ) : tab === "tools" ? (
                    <WorkspaceTools
                      content={content}
                      readonly={!!preview || dimensionActive}
                      onDimensionRelation={!preview && folder ? id => setModal({type:"relation-dimension", id}) : undefined}
                      onOpen={(record) => setModal({ type: "detail", record })}
                      onMutate={async (change) => {
                        await save((s) => {
                          const world = s.worlds.find((item) => item.content.world.id === worldId)!;
                          change(world.content);
                          world.content.world.updatedAt = new Date().toISOString();
                        });
                        setNotice("端末に保存しました");
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
                                  <Photo
                                    id={e.imageIds[0]}
                                    thumb
                                    position={e.imagePositions[e.imageIds[0]]}
                                  />
                                ) : (
                                  <Icon size={36} />
                                )}
                              </div>
                              <div className="card-body">
                                <span className="eyebrow">
                                  {labels[e.kind]}
                                </span>
                                <h3>{shownName(e)}</h3>
                                <p>
                                  {plainReferencedText(
                                    e.catchphrase || e.summary.slice(0, 100),
                                  ) || "紹介を追加してみましょう。"}
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
                {tab !== "tools" && <aside>
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
                </aside>}
              </div>
            </>
          )}
          <footer>
            W-Pam Preview 0.5 ·
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
            dimensionNotice={dimensionActive ? "基本データを編集中です。この条件だけの姿を変更したい場合は、閉じて項目詳細の「このDimensionで編集」、または上部の「項目・関係の別の姿を編集」を使ってください。" : undefined}
            kind={modal.kind}
            busy={busy}
            relatedCandidates={selected?.content.entities || []}
            relations={modal.kind === "character" ? selected?.content.relations || [] : []}
            close={close}
            onSave={async (r, assets, relationDrafts) => {
              setBusy(true);
              try {
                await save(
                  (s) => {
                    const now = new Date().toISOString();
                    r.updatedAt = now;
                    if (!modal.kind) {
                      if (modal.isNew)
                        s.worlds.push({
                          content: { world: r, entities: [], relations: [], collections: [], events: [] },
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
                      if (modal.kind === "character") w.content.relations = relationDrafts;
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
          <Modal title={shownName(modal.record)} close={close} wide>
            {selected && folder && !preview && <ItemDimensionPanel key={modal.record.id} state={state} world={selected} folder={folder} recordId={modal.record.id} selection={activeSelection} changeSelection={setDimensionSelection} save={save} />}
            {preview && <p className="banner">過去の記録：{folder ? dimensionLabel(folder, activeSelection) : "基本データ"}（閲覧のみ）</p>}
            <Details
              r={modal.record}
              content={content}
              openReference={(record) =>
                setModal({ type: "reference", record })
              }
            />
            {selected && <RecordHistory world={selected} record={modal.record} />}
            {selected && folder && !preview && <details className="dimension-box"><summary>この項目の関係を別の姿にする</summary><p>非掲載の関係も含みます。相手の項目が非掲載なら、関係を掲載にしても通常表示されません。</p><div className="actions">{selected.content.relations.filter(r => r.from === modal.record.id || r.to === modal.record.id).map(r => <B key={r.id} onClick={() => setModal({type:"relation-dimension", id:r.id})}>{r.type} · {shownName(selected.content.entities.find(e => e.id === (r.from === modal.record.id ? r.to : r.from))!)}</B>)}</div></details>}
            <B
              onClick={() =>
                setModal({
                  type: "export",
                  content: { world: modal.record, entities: [], relations: [], collections: [], events: [] },
                })
              }
            >
              <Download />
              この項目を書き出す
            </B>
            {!preview && (
              <div className="actions">
                <B onClick={() => run(async () => {
                  const nextValue = !modal.record.favorite;
                  await save((s) => {
                    const entity = s.worlds.find((w) => w.content.world.id === worldId)!.content.entities.find((e) => e.id === modal.record.id)!;
                    entity.favorite = nextValue;
                    entity.updatedAt = new Date().toISOString();
                  });
                  setModal({ type: "detail", record: { ...modal.record, favorite: nextValue, updatedAt: new Date().toISOString() } });
                })}><Star />{modal.record.favorite ? "お気に入り解除" : "お気に入り"}</B>
                <B onClick={() => run(async () => {
                  const nextValue = !modal.record.pinned;
                  await save((s) => {
                    const entity = s.worlds.find((w) => w.content.world.id === worldId)!.content.entities.find((e) => e.id === modal.record.id)!;
                    entity.pinned = nextValue;
                    entity.updatedAt = new Date().toISOString();
                  });
                  setModal({ type: "detail", record: { ...modal.record, pinned: nextValue, updatedAt: new Date().toISOString() } });
                })}><Pin />{modal.record.pinned ? "ピンを外す" : "ピン留め"}</B>
                <B
                  primary
                  onClick={() => edit(modal.record, modal.record.kind)}
                >
                  <PencilLine />
                  基本データを編集
                </B>
                <B
                  onClick={() =>
                    run(async () => {
                      if (
                        confirm(
                          "基本項目を全Dimensionから削除します。関連する関係も削除します。この条件だけ外す場合はキャンセルして掲載状態を変更してください。削除前の世界は自動記録します。続けますか？",
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
                          for (const record of [
                            w.content.world,
                            ...w.content.entities,
                          ])
                            record.relatedIds = record.relatedIds.filter(
                              (id) => id !== modal.record.id,
                            );
                          for (const entity of w.content.entities)
                            if (entity.parentId === modal.record.id) entity.parentId = "";
                          w.content.relations = w.content.relations.filter((relation) => relation.from !== modal.record.id && relation.to !== modal.record.id);
                          for (const collection of w.content.collections)
                            collection.entityIds = collection.entityIds.filter((id) => id !== modal.record.id);
                          for (const event of w.content.events)
                            event.entityIds = event.entityIds.filter((id) => id !== modal.record.id);
                          w.content.world.updatedAt = new Date().toISOString();
                        });
                        close();
                      }
                    })
                  }
                >
                  <Trash2 />
                  全Dimensionから削除
                </B>
              </div>
            )}
          </Modal>
        )}
        {modal?.type === "relation-dimension" && selected && folder && !preview && <Modal title="関係の別の姿" close={close} wide><OverrideEditor key={modal.id + ":" + state.revision} world={selected} folder={folder} selection={activeSelection} revision={state.revision} save={save} target={"relation:" + modal.id} changeTarget={() => {}} fixedTarget /></Modal>}
        {modal?.type === "reference" && (
          <Modal title="関連項目の概要" close={close}>
            <div className="reference-preview">
              <span className="eyebrow">{labels[modal.record.kind]}</span>
              <h2>{shownName(modal.record)}</h2>
              {modal.record.displayName && (
                <p className="muted">正式名称：{modal.record.name}</p>
              )}
              {modal.record.imageIds[0] && (
                <div className="reference-photo">
                  <Photo
                    id={modal.record.imageIds[0]}
                    thumb
                    position={
                      modal.record.imagePositions[modal.record.imageIds[0]]
                    }
                  />
                </div>
              )}
              <p>
                {modal.record.catchphrase || modal.record.summary ? (
                  <RichText
                    text={modal.record.catchphrase || modal.record.summary}
                    content={content}
                    openReference={(record) =>
                      setModal({ type: "reference", record })
                    }
                  />
                ) : (
                  "概要はまだ登録されていません。"
                )}
              </p>
              <B
                primary
                onClick={() =>
                  setModal({ type: "detail", record: modal.record })
                }
              >
                詳細を見る
              </B>
            </div>
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
        {modal?.type === "tips" && (
          <Modal title="Tips・使い方" close={close} wide>
            <TipsContent />
          </Modal>
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
                  {shownName(w.content.world)}（{w.snapshots.length}記録）
                </li>
              ))}
            </ul>
            <p>
              「別の世界として追加」が標準です。バックアップ時点でごみ箱にあった世界は、ごみ箱へ読み込みます。
            </p>
            <p>
              同じ世界の重複：{importCollisionCount}件。「バックアップで上書き」では同じIDの現在データを置き換え、置換前の状態は安全コピーとしてごみ箱へ残します。
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
                          "バックアップの内容で同じIDの世界を上書きしますか？置換前の安全コピーはごみ箱に残します。",
                        )
                      )
                        return;
                      await save((s) => {
                        const worlds = mergeFolderImports(
                          s,
                          modal.worldFolders,
                          modal.worlds,
                        );
                        applyWorldImports(
                          s,
                          worlds,
                          replace ? "replace" : "copy",
                        );
                      }, modal.assets);
                      close();
                      openWorld("");
                      setNotice("読み込みました");
                    })
                  }
                >
                  {replace ? "バックアップで同じIDを上書き" : "別の世界として追加"}
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
                  onChange={(e) => {
                    const font = Number(e.currentTarget.value);
                    run(() =>
                      save((s) => {
                        s.settings.font = font;
                      }),
                    );
                  }}
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
                  onChange={(e) => {
                    const density = Number(e.currentTarget.value);
                    run(() =>
                      save((s) => {
                        s.settings.density = density;
                      }),
                    );
                  }}
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
                  onChange={(e) => {
                    const theme = e.currentTarget.value as Settings["theme"];
                    run(() =>
                      save((s) => {
                        s.settings.theme = theme;
                      }),
                    );
                  }}
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
                  <span>{shownName(w.content.world)}</span>
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
                  <B
                    disabled={busy}
                    onClick={() => {
                      if (
                        !confirm(
                          `「${shownName(w.content.world)}」を完全に削除しますか？この操作は取り消せません。必要なら先にバックアップを書き出してください。`,
                        )
                      )
                        return;
                      run(async () => {
                        const next = await permanentlyDeleteWorld(
                          state.revision,
                          w.content.world.id,
                        );
                        setState(next);
                        if (worldId === w.content.world.id) openWorld("");
                        setNotice("ごみ箱から完全に削除しました");
                      });
                    }}
                  >
                    <Trash2 />
                    完全に削除
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

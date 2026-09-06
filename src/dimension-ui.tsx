import React, { useEffect, useState } from "react";
import { Folder, Plus, PencilLine, Trash2 } from "lucide-react";
import {
  fields,
  shownName,
  uuid,
  worldFolderSchema,
  recordOverrideSchema,
  relationOverrideSchema,
  snapshot,
  type State,
  type World,
  type WorldFolder,
  type DimensionSelection,
} from "./model";
import {
  allOverrides,
  assignFolder,
  conditionKey,
  deleteFolder,
  usageCount,
  validSelection,
  resolveRecord,
  transferOverride,
  dimensionLabel,
  type Override,
} from "./dimensions";

type Save = (change: (state: State) => void) => Promise<void>;
export const confirmDimensionLeave = () => !document.querySelector('.dimension-editor[data-unsaved="true"]') || confirm("別の姿に未保存の入力があります。破棄して移動しますか？");
const Button = ({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    className="button"
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </button>
);

export function FolderManager({
  state,
  save,
  filter,
  setFilter,
}: {
  state: State;
  save: Save;
  filter: string;
  setFilter: (value: string) => void;
}) {
  const [draft, setDraft] = useState<WorldFolder>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const execute = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };
  const start = (folder?: WorldFolder) => {
    const now = new Date().toISOString();
    setDraft(
      folder
        ? structuredClone(folder)
        : {
            id: uuid(),
            name: "新しい世界フォルダ",
            description: "",
            dimensionAxes: [],
            createdAt: now,
            updatedAt: now,
          },
    );
    setRevision(state.revision);
    setError("");
  };
  const modifyAxis = (
    index: number,
    change: (axis: WorldFolder["dimensionAxes"][number]) => void,
  ) => {
    const next = structuredClone(draft!);
    change(next.dimensionAxes[index]);
    setDraft(next);
  };
  return (
    <section className="dimension-box" aria-label="世界フォルダ管理">
      <div className="actions">
        <Folder />
        <strong>世界フォルダ</strong>
        <Button onClick={() => start()} disabled={busy}>
          <Plus />
          新規作成
        </Button>
      </div>
      <label>
        本棚の表示
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">すべてのパンフレット</option>
          <option value="unfiled">未所属</option>
          {state.worldFolders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className="folder-list">
        {state.worldFolders.map((f) => (
          <article key={f.id}>
            <div>
              <strong>{f.name}</strong>
              <small>
                {
                  state.worlds.filter((w) => !w.trashed && w.folderId === f.id)
                    .length
                }
                冊 · {f.dimensionAxes.length}軸
              </small>
              <p>{f.description}</p>
            </div>
            <div className="actions">
              <Button onClick={() => start(f)} disabled={busy}>
                <PencilLine />
                編集
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void execute(async () => {
                    if (
                      !confirm(
                        `「${f.name}」を削除しますか？パンフレットは未所属へ戻ります。差分・履歴は退避して保持され、所属設定から元のフォルダを復元できます。`,
                      )
                    )
                      return;
                    await save((s) => deleteFolder(s, f.id));
                    if (filter === f.id) setFilter("");
                    if (draft?.id === f.id) setDraft(undefined);
                  })
                }
              >
                <Trash2 />
                削除
              </Button>
            </div>
          </article>
        ))}
      </div>
      {draft && (
        <fieldset className="dimension-editor" disabled={busy}>
          <legend>世界フォルダの編集</legend>
          <label>
            名前
            <input
              maxLength={100}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            説明
            <textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          {draft.dimensionAxes.map((axis, i) => (
            <fieldset key={axis.id}>
              <legend>Dimension軸 {i + 1}</legend>
              <label>
                軸名
                <input
                  maxLength={100}
                  value={axis.name}
                  onChange={(e) =>
                    modifyAxis(i, (a) => {
                      a.name = e.target.value;
                    })
                  }
                />
              </label>
              {axis.options.map((option, j) => {
                const uses = usageCount(state, axis.id, option.id);
                return (
                  <div className="dimension-option" key={option.id}>
                    <label>
                      選択肢 {j + 1}
                      <input
                        maxLength={100}
                        value={option.name}
                        onChange={(e) =>
                          modifyAxis(i, (a) => {
                            a.options[j].name = e.target.value;
                          })
                        }
                      />
                    </label>
                    <Button
                      disabled={!!uses || axis.options.length === 1}
                      onClick={() =>
                        modifyAxis(i, (a) => {
                          a.options.splice(j, 1);
                        })
                      }
                    >
                      削除
                    </Button>
                    {!!uses && <small>使用中 {uses}件（履歴含む）</small>}
                  </div>
                );
              })}
              <div className="actions">
                <Button
                  disabled={axis.options.length >= 100}
                  onClick={() =>
                    modifyAxis(i, (a) => {
                      a.options.push({
                        id: uuid(),
                        name: `選択肢${a.options.length + 1}`,
                      });
                    })
                  }
                >
                  選択肢を追加
                </Button>
                <Button
                  disabled={!!usageCount(state, axis.id)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      dimensionAxes: draft.dimensionAxes.filter(
                        (a) => a.id !== axis.id,
                      ),
                    })
                  }
                >
                  軸を削除
                </Button>
                {!!usageCount(state, axis.id) && (
                  <small>
                    使用中 {usageCount(state, axis.id)}件（履歴含む）
                  </small>
                )}
              </div>
            </fieldset>
          ))}
          <div className="actions">
            <Button
              disabled={draft.dimensionAxes.length >= 20}
              onClick={() =>
                setDraft({
                  ...draft,
                  dimensionAxes: [
                    ...draft.dimensionAxes,
                    {
                      id: uuid(),
                      name: "新しい軸",
                      options: [{ id: uuid(), name: "選択肢1" }],
                    },
                  ],
                })
              }
            >
              軸を追加
            </Button>
            <Button
              onClick={() =>
                void execute(async () => {
                  const parsed = worldFolderSchema.parse({
                    ...draft,
                    updatedAt: new Date().toISOString(),
                  });
                  await save((s) => {
                    if (s.revision !== revision)
                      throw new Error(
                        "編集開始後にデータが更新されました。編集を開き直してください。",
                      );
                    const index = s.worldFolders.findIndex(
                      (f) => f.id === parsed.id,
                    );
                    if (index < 0) s.worldFolders.push(parsed);
                    else s.worldFolders[index] = parsed;
                  });
                  setDraft(undefined);
                })
              }
            >
              保存
            </Button>
            <Button onClick={() => setDraft(undefined)}>キャンセル</Button>
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="dimension-error">
          {error}
        </p>
      )}
    </section>
  );
}

export function FolderMembership({
  state,
  world,
  save,
}: {
  state: State;
  world: World;
  save: Save;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (change: (s: State, w: World) => void) => {
    setBusy(true);
    setError("");
    try {
      await save((s) =>
        change(
          s,
          s.worlds.find((w) => w.content.world.id === world.content.world.id)!,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="dimension-membership">
      <label>
        所属する世界フォルダ
        <select
          disabled={busy}
          value={world.folderId || ""}
          onChange={(e) => {
            const id = e.target.value;
            void act((s, w) => assignFolder(s, w, id || undefined));
          }}
        >
          <option value="">未所属</option>
          {state.worldFolders.map((f) => (
            <option value={f.id} key={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      {!world.folderId && world.dimensionArchive && (
        <>
          <p className="muted">
            退避したDimension差分は保持されています。元のフォルダを復元すると再び使えます。
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void act((s, w) => {
                const archive = w.dimensionArchive!;
                const existing = s.worldFolders.find(
                  (f) => f.id === archive.id,
                );
                const restored = !existing
                  ? { ...archive }
                  : { ...archive, id: uuid(), name: archive.name + "（復元）" };
                s.worldFolders.push(restored);
                assignFolder(s, w, restored.id);
              })
            }
          >
            元のフォルダを復元
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="dimension-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DimensionSelect({
  folder,
  value,
  change,
}: {
  folder: WorldFolder;
  value: DimensionSelection;
  change: (s: DimensionSelection) => void;
}) {
  return (
    <div className="dimension-selects">
      {folder.dimensionAxes.map((axis) => (
        <label key={axis.id}>
          {axis.name}
          <select
            value={value[axis.id] || ""}
            onChange={(e) => {
              const next = { ...value };
              if (e.target.value) next[axis.id] = e.target.value;
              else delete next[axis.id];
              change(next);
            }}
          >
            <option value="">指定なし（基本を継承）</option>
            {axis.options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function DimensionPanel({
  state,
  world,
  folder,
  selection,
  changeSelection,
  save,
  readonly,
}: {
  state: State;
  world: World;
  folder: WorldFolder;
  selection: DimensionSelection;
  changeSelection: (s: DimensionSelection) => void;
  save: Save;
  readonly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState("record:" + world.content.world.id);
  return (
    <section className="dimension-box" aria-label="Dimension">
      <div className="actions">
        <strong>Dimension · {folder.name}</strong>
        <Button onClick={() => changeSelection({})}>基本データに戻す</Button>
        {!readonly && (
          <Button onClick={() => {if(!editing || confirmDimensionLeave()) setEditing(!editing);}}>
            {editing ? "姿の編集を閉じる" : "項目・関係の別の姿を編集"}
          </Button>
        )}
      </div>
      <details><summary>表示条件：{dimensionLabel(folder, selection)}</summary><DimensionSelect
        folder={folder}
        value={selection}
        change={changeSelection}
      /></details>
      {!folder.dimensionAxes.length && (
        <p>本棚の「世界フォルダ → 編集」でDimension軸を追加できます。</p>
      )}
      {!!Object.keys(selection).length && (
        <p className="muted">
          表示・検索・相関図・画像／PDF出力に選択を反映中。通常の編集は基本データを編集します。関係・年表・グループの基本編集は「基本データに戻す」から。
        </p>
      )}
      {editing && !readonly && (
        <OverrideEditor
          key={world.content.world.id + ":" + folder.id + ":" + state.revision}
          world={world}
          folder={folder}
          selection={selection}
          revision={state.revision}
          save={save}
          target={[world.content.world, ...world.content.entities].some(r => target === "record:" + r.id) || world.content.relations.some(r => target === "relation:" + r.id) ? target : "record:" + world.content.world.id}
          changeTarget={setTarget}
        />
      )}
    </section>
  );
}

export function OverrideEditor({
  world,
  folder,
  selection,
  revision,
  save,
  target,
  changeTarget,
  fixedTarget = false,
}: {
  world: World;
  folder: WorldFolder;
  selection: DimensionSelection;
  revision: number;
  save: Save;
  target: string;
  changeTarget: (value: string) => void;
  fixedTarget?: boolean;
}) {
  const records = [world.content.world, ...world.content.entities];
  const [conditions, setConditions] = useState<DimensionSelection>({
    ...selection,
  });
  const initialRecord = target.startsWith("relation:") ? world.content.relations.find(r => "relation:" + r.id === target) : records.find(r => "record:" + r.id === target);
  const initialOverride = initialRecord?.overrides?.find(o => conditionKey(o.conditions) === conditionKey(Object.entries(selection).map(([axisId, optionId]) => ({axisId, optionId}))));
  const [editingId, setEditingId] = useState(initialOverride?.id || "");
  const [patch, setPatch] = useState<Record<string, unknown>>(structuredClone(initialOverride?.patch || {}));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [transfer, setTransfer] = useState<Override>();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if(dirty) {event.preventDefault(); event.returnValue = "";} };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const isRelation = target.startsWith("relation:");
  const id = target.slice(target.indexOf(":") + 1);
  const record = isRelation
    ? world.content.relations.find((r) => r.id === id)!
    : records.find((r) => r.id === id)!;
  const overrides: Override[] = record?.overrides || [];
  const conditionsList = Object.entries(validSelection(folder, conditions)).map(
    ([axisId, optionId]) => ({ axisId, optionId }),
  );
  const same = overrides.find(
    (o) => conditionKey(o.conditions) === conditionKey(conditionsList),
  );
  const fieldLabels: Record<string, string> = isRelation
    ? { type: "関係名", direction: "方向", note: "補足メモ", visible: "掲載" }
    : {
        ...fields,
        customFields: "追加項目",
        ...(id === world.content.world.id ? {} : { visible: "掲載" }),
      };
  const update = (key: string, value: unknown) =>
    {setDirty(true); setPatch((p) => ({ ...p, [key]: value }));};
  const reset = () => {
    setDirty(false);
    setEditingId("");
    setPatch({});
    setError("");
  };
  const load = (o: Override) => {
    setDirty(false);
    setConditions(
      Object.fromEntries(o.conditions.map((c) => [c.axisId, c.optionId])),
    );
    setEditingId(o.id);
    setPatch(structuredClone(o.patch));
    setError("");
  };
  const label = (o: Override) =>
    o.conditions
      .map((c) => {
        const a = folder.dimensionAxes.find((a) => a.id === c.axisId);
        return `${a?.name || "不明な軸"}=${a?.options.find((v) => v.id === c.optionId)?.name || "不明な値"}`;
      })
      .join(" ＋ ");
  const commit = async (remove?: string) => {
    setError("");
    setBusy(true);
    try {
      let parsed: Override | undefined;
      if (!remove) {
        if (!Object.keys(patch).length)
          throw new Error("差分にする項目を1つ以上選択してください。");
        if (same && same.id !== editingId)
          throw new Error(
            "同じ条件の差分があります。「既存差分を編集」から開いてください。",
          );
        parsed = (
          isRelation ? relationOverrideSchema : recordOverrideSchema
        ).parse({ id: editingId || uuid(), conditions: conditionsList, patch });
      }
      await save((s) => {
        if (s.revision !== revision)
          throw new Error(
            "編集中にデータが更新されました。差分編集を開き直してください。",
          );
        const w = s.worlds.find(
          (w) => w.content.world.id === world.content.world.id,
        )!;
        const targetRecord = isRelation
          ? w.content.relations.find((r) => r.id === id)!
          : [w.content.world, ...w.content.entities].find((r) => r.id === id)!;
        w.snapshots.push(snapshot(w.content, "", remove ? "別の姿を削除する前の安全記録" : "別の姿を編集する前の安全記録"));
        const next: Override[] = (targetRecord.overrides || []).filter(
          (o) => o.id !== (remove || parsed!.id),
        );
        // Updating keeps the original position so equal-specificity tie order is stable.
        if (parsed) {
          const index = (targetRecord.overrides || []).findIndex(
            (o) => o.id === parsed!.id,
          );
          next.splice(index < 0 ? next.length : index, 0, parsed);
        }
        if (isRelation)
          w.content.relations.find((r) => r.id === id)!.overrides =
            relationOverrideSchema.array().parse(next);
        else
          [w.content.world, ...w.content.entities].find(
            (r) => r.id === id,
          )!.overrides = recordOverrideSchema.array().parse(next);
        targetRecord.updatedAt = new Date().toISOString();
        w.content.world.updatedAt = targetRecord.updatedAt;
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };
  const conflicts = overrides.filter(
    (o) =>
      o.id !== editingId &&
      o.conditions.length === conditionsList.length &&
      o.conditions.every(
        (c) => !conditions[c.axisId] || conditions[c.axisId] === c.optionId,
      ) &&
      Object.keys(o.patch).some((k) => k in patch),
  );
  const candidate: Override = {id: editingId || "preview", conditions: conditionsList, patch};
  const candidateOverrides = overrides.map(o => o.id === editingId ? candidate : o);
  if(!editingId) candidateOverrides.push(candidate);
  const projected = resolveRecord({...record, overrides: candidateOverrides}, conditions) as unknown as Record<string, unknown>;
  const formatValue = (value: unknown) => value === undefined ? "指定なし" : value === "" ? "（空欄）" : typeof value === "boolean" ? value ? "掲載" : "非掲載" : typeof value === "string" ? value : JSON.stringify(value);
  return (
    <fieldset className="dimension-editor" disabled={busy} data-unsaved={dirty ? "true" : undefined}>
      <legend>{fixedTarget ? `${isRelation ? "関係" : shownName(record as never)}の別の姿` : "別の姿を編集"}</legend>
      {!fixedTarget && <label>対象を探す<input value={search} onChange={e => setSearch(e.target.value)} placeholder="名前・関係名" /></label>}
      {!fixedTarget && <label>
        対象（非掲載の項目も選べます）
        <select
          value={target}
          onChange={(e) => {
            if(Object.keys(patch).length && !confirm("未保存の入力を破棄して対象を切り替えますか？")) return;
            changeTarget(e.target.value);
            reset();
            const nextRecord = e.target.value.startsWith("relation:") ? world.content.relations.find(r => "relation:" + r.id === e.target.value) : records.find(r => "record:" + r.id === e.target.value);
            const existing = nextRecord?.overrides?.find(o => conditionKey(o.conditions) === conditionKey(conditionsList));
            if(existing) load(existing);
          }}
        >
          <optgroup label="パンフレット・項目">
            {records.filter(r => "record:" + r.id === target || shownName(r).includes(search)).map((r) => (
              <option key={r.id} value={"record:" + r.id}>
                {shownName(r)}
              </option>
            ))}
          </optgroup>
          <optgroup label="関係">
            {world.content.relations.filter(r => "relation:" + r.id === target || (r.type + records.filter(e => e.id === r.from || e.id === r.to).map(shownName).join(" ")).includes(search)).map((r) => (
              <option key={r.id} value={"relation:" + r.id}>
                {shownName(records.find((e) => e.id === r.from)!)} →{" "}
                {shownName(records.find((e) => e.id === r.to)!)}：{r.type}
              </option>
            ))}
          </optgroup>
        </select>
      </label>}
      <p>
        条件を選び、変更する項目だけチェックします。未チェックの項目は基本データや一致する別の差分を継承します。
      </p>
      <DimensionSelect
        folder={folder}
        value={conditions}
        change={value => {
          if (Object.keys(patch).length && !confirm("編集中の入力を離れて条件を切り替えますか？未保存の入力は破棄されます。")) return;
          setConditions(value);
          const existing = overrides.find(o => conditionKey(o.conditions) === conditionKey(Object.entries(value).map(([axisId, optionId]) => ({axisId, optionId}))));
          if (existing) load(existing); else reset();
        }}
      />
      {same && same.id !== editingId && (
        <Button onClick={() => load(same)}>既存差分を編集</Button>
      )}
      <div className="dimension-fields">
        {Object.entries(fieldLabels).map(([key, name]) => (
          <div className="dimension-field" key={key}>
            <label className="dimension-check">
              <input
                type="checkbox"
                checked={key in patch}
                onChange={(e) => {
                  if (e.target.checked)
                    update(
                      key,
                      key === "visible"
                        ? true
                        : ((resolveRecord(record, conditions) as unknown as Record<string, unknown>)[
                            key
                          ] ?? ""),
                    );
                  else
                    {setDirty(true); setPatch((p) => {
                      const next = { ...p };
                      delete next[key];
                      return next;
                    });}
                }}
              />
              {name}を変更
            </label>
            {key in patch &&
              (key === "visible" ? (
                <select
                  aria-label={name}
                  value={String(patch[key])}
                  onChange={(e) => update(key, e.target.value === "true")}
                >
                  <option value="true">掲載する</option>
                  <option value="false">掲載しない</option>
                </select>
              ) : key === "direction" ? (
                <select
                  aria-label={name}
                  value={String(patch[key])}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="directed">方向あり</option>
                  <option value="mutual">相互</option>
                </select>
              ) : key === "customFields" ? (
                <CustomFields
                  value={
                    patch[key] as { id: string; label: string; value: string }[]
                  }
                  change={(v) => update(key, v)}
                />
              ) : (
                <textarea
                  aria-label={name}
                  rows={key === "description" || key === "summary" ? 4 : 2}
                  value={String(patch[key])}
                  onChange={(e) => update(key, e.target.value)}
                />
              ))}
          </div>
        ))}
      </div>
      {!!conflicts.length && (
        <p role="status">
          同じ条件数で同じ項目を変更する差分が{conflicts.length}
          件あります。同時一致では保存順が後の差分を採用します。組合せ専用の、より具体的な差分を作ると確実です。
        </p>
      )}
      <section className="dimension-summary" aria-label="保存前の確認">
        <strong>保存先：{dimensionLabel(folder, conditions)}</strong>
        <p>基本データ・ID・画像・関連先は変更しません。変更前の世界を自動記録します。</p>
        {Object.keys(patch).map(key => <p key={key}>{fieldLabels[key] || key}：{key === "visible" ? (patch[key] ? "掲載する" : "掲載しない（関係・相関図・通常検索からも除外）") : JSON.stringify(patch[key]) || "空欄"}</p>)}
        <small>未チェックは継承、チェックした空欄は「この条件では空欄」です。より具体的な条件の姿が重なると、そちらが優先されます。</small>
        {!!Object.keys(patch).length && <table className="dimension-result"><thead><tr><th>項目</th><th>基本</th><th>保存後のこの条件</th></tr></thead><tbody>{Object.keys(patch).map(key => <tr key={key}><th>{fieldLabels[key] || key}</th><td>{formatValue(key === "visible" ? true : (record as unknown as Record<string, unknown>)[key])}</td><td>{formatValue(projected[key])}</td></tr>)}</tbody></table>}
      </section>
      <div className="actions">
        <Button
          disabled={
            !conditionsList.length ||
            !Object.keys(patch).length ||
            (!!same && same.id !== editingId)
          }
          onClick={() => void commit()}
        >
          {editingId ? "差分を更新" : "差分を保存"}
        </Button>
        <Button onClick={() => {if(!dirty || confirm("未保存の入力を破棄しますか？")) reset();}}>入力をリセット</Button>
      </div>
      {error && (
        <p role="alert" className="dimension-error">
          {error}
        </p>
      )}
      <h3>登録済み差分（{overrides.length}件）</h3>
      {transfer && <TransferForm key={transfer.id} world={world} folder={folder} target={target} source={transfer} revision={revision} save={save} close={() => setTransfer(undefined)} />}
      {overrides.map((o) => (
        <article className="dimension-saved" key={o.id}>
          <strong>{label(o)}</strong>
          <small>
            {Object.keys(o.patch)
              .map((k) => fieldLabels[k] || k)
              .join("・")}
          </small>
          <div className="actions">
            <Button onClick={() => load(o)}>編集</Button>
            <Button onClick={() => setTransfer(o)}>移動／複製</Button>
            <Button
              onClick={() => {
                if (
                  confirm(
                    "この差分を削除しますか？基本データは変わりません。履歴内の差分は保持されます。",
                  )
                )
                  void commit(o.id);
              }}
            >
              削除
            </Button>
          </div>
        </article>
      ))}
      {!overrides.length && (
        <p className="muted">
          まだ差分はありません。基本データはそのまま使えます。
        </p>
      )}
    </fieldset>
  );
}
function TransferForm({world, folder, target, source, revision, save, close}: {world: World; folder: WorldFolder; target: string; source: Override; revision: number; save: Save; close: () => void}) {
  const [destination, setDestination] = useState<DimensionSelection>({});
  const [mode, setMode] = useState<"move" | "copy">("copy");
  const [hide, setHide] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isRelation = target.startsWith("relation:");
  const id = target.slice(target.indexOf(":") + 1);
  const record = isRelation ? world.content.relations.find(r => r.id === id)! : [world.content.world, ...world.content.entities].find(r => r.id === id)!;
  const conditions = Object.entries(validSelection(folder, destination)).map(([axisId, optionId]) => ({axisId, optionId}));
  let problem = "";
  let result: Record<string, unknown> | undefined;
  try { const overrides = transferOverride(record.overrides || [], source.id, conditions, mode, hide); result = resolveRecord({...record, overrides}, destination) as unknown as Record<string, unknown>; } catch(e) { problem = (e as Error).message; }
  return <fieldset disabled={busy} className="dimension-transfer"><legend>別のDimensionへ移動／複製</legend>
    <p>元：{dimensionLabel(folder, Object.fromEntries(source.conditions.map(c => [c.axisId, c.optionId])))}</p>
    <label>扱い<select value={mode} onChange={e => setMode(e.target.value as "copy" | "move")}><option value="copy">複製：元の姿を残す</option><option value="move">移動：この差分の適用先を変える</option></select></label>
    <DimensionSelect folder={folder} value={destination} change={setDestination} />
    {mode === "move" && id !== world.content.world.id && <label className="dimension-check"><input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)} />元の条件では非掲載にする</label>}
    <div className="dimension-summary"><strong>変更の確認</strong><p>先：{dimensionLabel(folder, destination)}</p><p>基本項目・ID・画像・関連・履歴は残します。選んだ差分だけが対象で、他の組合せ差分は移動しません。</p><p>{mode === "copy" ? "元の姿はそのまま残ります。" : hide ? "元の条件に非掲載を指定します。つながる関係も通常表示から除外されます。" : "元の条件では基本データや他の一致する姿を継承します。"}</p><p>掲載状態も選んだ差分の内容を引き継ぎます。より具体的な姿がある場合、移動後の表示はそちらが優先されます。</p></div>
    {result && <details open><summary>移動先での結果</summary>{Object.keys(source.patch).map(key => <p key={key}>{fields[key] || ({visible:"掲載",type:"関係名",direction:"方向",note:"補足",customFields:"追加項目"} as Record<string,string>)[key] || key}：{key === "visible" ? (result.visible === false ? "非掲載" : "掲載") : result[key] === "" ? "（空欄）" : typeof result[key] === "string" ? String(result[key]) : JSON.stringify(result[key])}</p>)}</details>}
    {problem && <p role="status">{problem}</p>}{error && <p role="alert">{error}</p>}
    <div className="actions"><Button onClick={close}>閉じる</Button><Button disabled={!!problem} onClick={async () => {
      setBusy(true); setError("");
      try { await save(s => {
        if(s.revision !== revision) throw new Error("データが更新されました。開き直してください。");
        const w = s.worlds.find(w => w.content.world.id === world.content.world.id)!;
        const r = isRelation ? w.content.relations.find(r => r.id === id)! : [w.content.world, ...w.content.entities].find(r => r.id === id)!;
        const next = transferOverride(r.overrides || [], source.id, conditions, mode, mode === "move" && hide && id !== w.content.world.id);
        w.snapshots.push(snapshot(w.content, "", "Dimension移動・複製前の安全記録"));
        if(isRelation) w.content.relations.find(r => r.id === id)!.overrides = relationOverrideSchema.array().parse(next);
        else [w.content.world, ...w.content.entities].find(r => r.id === id)!.overrides = recordOverrideSchema.array().parse(next);
        r.updatedAt = w.content.world.updatedAt = new Date().toISOString();
      }); close(); } catch(e) { setError((e as Error).message); } finally {setBusy(false);}
    }}>確認して{mode === "copy" ? "複製" : "移動"}</Button></div>
  </fieldset>;
}

export function ItemDimensionPanel({state, world, folder, recordId, selection, changeSelection, save, readonly = false}: {state: State; world: World; folder: WorldFolder; recordId: string; selection: DimensionSelection; changeSelection: (s: DimensionSelection) => void; save: Save; readonly?: boolean}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const base = [world.content.world, ...world.content.entities].find(r => r.id === recordId)!;
  const current = resolveRecord(base, selection);
  const conditions = Object.entries(selection).map(([axisId, optionId]) => ({axisId, optionId}));
  const exact = base.overrides?.find(o => conditionKey(o.conditions) === conditionKey(conditions));
  const applicable = (base.overrides || []).filter(o => o.conditions.every(c => selection[c.axisId] === c.optionId)).sort((a,b) => a.conditions.length - b.conditions.length);
  const setVisibility = async (value: string) => {
    setBusy(true); setError("");
    try { await save(s => {
      if(s.revision !== state.revision) throw new Error("データが更新されました。開き直してください。");
      const w = s.worlds.find(w => w.content.world.id === world.content.world.id)!;
      const r = w.content.entities.find(r => r.id === recordId)!;
      w.snapshots.push(snapshot(w.content, "", "掲載変更前の安全記録"));
      const list = structuredClone(r.overrides || []);
      const old = list.find(o => conditionKey(o.conditions) === conditionKey(conditions));
      const patch = {...old?.patch};
      if(value === "inherit") delete patch.visible; else patch.visible = value === "true";
      if(old) old.patch = patch; else if(Object.keys(patch).length) list.push(recordOverrideSchema.parse({id: uuid(), conditions, patch}));
      r.overrides = list.filter(o => Object.keys(o.patch).length);
      r.updatedAt = w.content.world.updatedAt = new Date().toISOString();
    }); } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  };
  return <section className="dimension-box item-dimension" aria-label="この項目のDimension">
    <strong>表示中：{dimensionLabel(folder, selection)}</strong>
    <p>{current.visible === false ? "この条件では非掲載です。作者用の確認として開いています。" : "この条件での姿を表示しています。"}</p>
    <details><summary>別の条件で見る／基本データへ戻る</summary><DimensionSelect folder={folder} value={selection} change={s => {if(editing && !confirm("未保存の入力を閉じて表示条件を切り替えますか？")) return; setEditing(false); changeSelection(s);}} /></details>
    {!readonly && <>
      <div className="actions"><Button onClick={() => {if(!editing || confirmDimensionLeave()) setEditing(!editing);}}>{editing ? "姿の編集を閉じる" : conditions.length ? "このDimensionで編集" : "別の姿を作る／管理"}</Button></div>
      {!!conditions.length && recordId !== world.content.world.id && <label>この条件の掲載指定<select disabled={busy} value={exact?.patch.visible === undefined ? "inherit" : String(exact.patch.visible)} onChange={e => {const value = e.target.value; if(confirm("この条件の掲載指定を変更します。非掲載なら関係・相関図・通常検索からも除外します。基本データは残り、変更前を自動記録します。保存しますか？")) void setVisibility(value);}}><option value="inherit">指定なし：基本や他の姿を継承</option><option value="true">掲載する</option><option value="false">掲載しない</option></select></label>}
    </>}
    {error && <p role="alert">{error}</p>}
    <details><summary>情報の由来・登録した姿（{base.overrides?.length || 0}件）</summary><p>基本：{shownName(base)}</p>{applicable.length ? applicable.map(o => <p key={o.id}>{dimensionLabel(folder, Object.fromEntries(o.conditions.map(c => [c.axisId, c.optionId])))}：{Object.keys(o.patch).map(k => fields[k as keyof typeof fields] || (k === "visible" ? "掲載" : "追加項目")).join("・")}</p>) : <p>現在の表示には差分が適用されていません。</p>}<small>上から順に重なり、後にある指定が優先されます。編集画面の登録済み一覧から移動／複製できます。</small></details>
    {editing && !readonly && <OverrideEditor key={recordId + ":" + state.revision} world={world} folder={folder} selection={selection} revision={state.revision} save={save} target={"record:" + recordId} changeTarget={() => {}} fixedTarget />}
  </section>;
}

function CustomFields({
  value,
  change,
}: {
  value: { id: string; label: string; value: string }[];
  change: (value: { id: string; label: string; value: string }[]) => void;
}) {
  return (
    <div>
      <p className="muted">
        この条件で使う追加項目の一覧です。一覧全体を差し替えます。
      </p>
      {value.map((f, i) => (
        <div key={f.id}>
          <label>
            項目名
            <input
              value={f.label}
              onChange={(e) =>
                change(
                  value.map((v, j) =>
                    i === j ? { ...v, label: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <label>
            内容
            <textarea
              value={f.value}
              onChange={(e) =>
                change(
                  value.map((v, j) =>
                    i === j ? { ...v, value: e.target.value } : v,
                  ),
                )
              }
            />
          </label>
          <Button onClick={() => change(value.filter((_, j) => i !== j))}>
            項目を除く
          </Button>
        </div>
      ))}
      <Button
        disabled={value.length >= 30}
        onClick={() =>
          change([...value, { id: uuid(), label: "追加項目", value: "" }])
        }
      >
        項目を追加
      </Button>
    </div>
  );
}

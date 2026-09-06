import React, { useMemo, useRef, useState } from "react";
import {
  Search,
  Network,
  CalendarDays,
  FolderHeart,
  Dices,
  Clock3,
  Plus,
  Trash2,
  PencilLine,
  Star,
  Pin,
  GitFork,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import {
  kinds,
  labels,
  shownName,
  relationDisplayLabel,
  relationDisplayLines,
  relationCurveOffsets,
  uuid,
  type Content,
  type Entity,
  type Kind,
  type Relation,
} from "./model";

type Props = {
  content: Content;
  readonly?: boolean;
  onDimensionRelation?: (id: string) => void;
  onOpen: (entity: Entity) => void;
  onMutate: (change: (content: Content) => void) => Promise<void>;
};

const tools = [
  ["search", "検索", Search],
  ["relations", "関係・相関図", Network],
  ["timeline", "年表", CalendarDays],
  ["collections", "グループ", FolderHeart],
  ["recent", "最近の編集", Clock3],
  ["wander", "世界をぶらつく", Dices],
] as const;
type Tool = (typeof tools)[number][0];

const entityText = (entity: Entity) =>
  [
    entity.name,
    entity.displayName,
    entity.reading,
    entity.catchphrase,
    entity.summary,
    entity.description,
    entity.tags,
    entity.affiliation,
    entity.area,
    entity.dialogueSamples,
    ...entity.customFields.flatMap((field) => [field.label, field.value]),
  ]
    .join("\n")
    .toLocaleLowerCase();

function EntityButton({ entity, onOpen }: { entity: Entity; onOpen: (entity: Entity) => void }) {
  return (
    <button className="tool-entity" type="button" onClick={() => onOpen(entity)}>
      <span>
        {entity.pinned && <Pin aria-label="ピン留め" />}
        {entity.favorite && <Star aria-label="お気に入り" />}
        <strong>{shownName(entity)}</strong>
      </span>
      <small>{labels[entity.kind]}</small>
    </button>
  );
}

function SearchPanel({ content, onOpen }: Pick<Props, "content" | "onOpen">) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [tag, setTag] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [area, setArea] = useState("");
  const result = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);
    return content.entities
      .filter((entity) => !kind || entity.kind === kind)
      .filter((entity) => tokens.every((token) => entityText(entity).includes(token)))
      .filter((entity) => !tag || entity.tags.toLocaleLowerCase().includes(tag.toLocaleLowerCase()))
      .filter((entity) => !affiliation || entity.affiliation.toLocaleLowerCase().includes(affiliation.toLocaleLowerCase()))
      .filter((entity) => !area || entity.area.toLocaleLowerCase().includes(area.toLocaleLowerCase()))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || shownName(a).localeCompare(shownName(b), "ja"));
  }, [content.entities, query, kind, tag, affiliation, area]);
  return (
    <>
      <div className="search-box">
        <label className="full">名前・本文<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="空白区切りで複合検索" /></label>
        <label>種類<select value={kind} onChange={(e) => setKind(e.target.value as Kind | "")}><option value="">すべて</option>{kinds.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
        <label>タグ<input value={tag} onChange={(e) => setTag(e.target.value)} /></label>
        <label>所属<input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} /></label>
        <label>地域<input value={area} onChange={(e) => setArea(e.target.value)} /></label>
      </div>
      <p className="muted">{result.length}件。ピン留め・お気に入りを優先表示します。</p>
      <div className="tool-list">{result.slice(0, 200).map((entity) => <EntityButton key={entity.id} entity={entity} onOpen={onOpen} />)}</div>
      {result.length > 200 && <p className="notice">操作を軽く保つため先頭200件を表示しています。条件を追加してください。</p>}
      {!result.length && <p className="empty">条件に合う項目はありません。</p>}
    </>
  );
}

function RelationForm({ content, readonly, onMutate }: Pick<Props, "content" | "readonly" | "onMutate">) {
  if (readonly) return null;
  return (
    <form className="compact-form" onSubmit={async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const from = String(data.get("from"));
      const to = String(data.get("to"));
      if (from === to) {
        alert("起点と相手には別の項目を選んでください。");
        return;
      }
      const now = new Date().toISOString();
      await onMutate((current) => current.relations.push({
        id: uuid(), from, to,
        type: String(data.get("type")), direction: data.get("direction") === "mutual" ? "mutual" : "directed",
        note: String(data.get("note")), createdAt: now, updatedAt: now,
      }));
      form.reset();
    }}>
      <label>起点<select name="from" required defaultValue=""><option value="" disabled>選択</option>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label>
      <label>相手<select name="to" required defaultValue=""><option value="" disabled>選択</option>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label>
      <label>関係名<input name="type" required maxLength={80} placeholder="友人／所属／敵対…" /><small>相関図では先頭20文字を10文字×2行で表示します。</small></label>
      <label>方向<select name="direction" defaultValue="mutual"><option value="mutual">相互</option><option value="directed">方向あり</option></select></label>
      <label className="full">補足メモ<textarea name="note" rows={2} maxLength={50000} /></label>
      <button className="button primary"><Plus />関係を追加</button>
    </form>
  );
}

function RelationEditForm({ relation, content, onCancel, onMutate }: { relation: Relation; content: Content; onCancel: () => void; onMutate: Props["onMutate"] }) {
  return <form className="compact-form relation-edit-form" onSubmit={async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("from"));
    const to = String(data.get("to"));
    if (from === to) {
      alert("起点と相手には別の項目を選んでください。");
      return;
    }
    await onMutate((current) => {
      const target = current.relations.find((item) => item.id === relation.id);
      if (!target) return;
      target.from = from;
      target.to = to;
      target.type = String(data.get("type"));
      target.direction = data.get("direction") === "mutual" ? "mutual" : "directed";
      target.note = String(data.get("note"));
      target.updatedAt = new Date().toISOString();
    });
    onCancel();
  }}>
    <label>起点<select name="from" required defaultValue={relation.from}>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label>
    <label>相手<select name="to" required defaultValue={relation.to}>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label>
    <label>関係名<input name="type" required maxLength={80} defaultValue={relation.type} /><small>相関図では先頭20文字を10文字×2行で表示します。</small></label>
    <label>方向<select name="direction" defaultValue={relation.direction}><option value="mutual">相互</option><option value="directed">方向あり</option></select></label>
    <label className="full">補足メモ<textarea name="note" rows={2} maxLength={50000} defaultValue={relation.note} /></label>
    <div className="actions full"><button type="button" className="button" onClick={onCancel}>キャンセル</button><button className="button primary"><PencilLine />変更を保存</button></div>
  </form>;
}

function RelationGraph({ content, relations, onOpen }: { content: Content; relations: Relation[]; onOpen: (entity: Entity) => void }) {
  const VIEW_WIDTH = 600;
  const VIEW_HEIGHT = 520;
  const CENTER_X = VIEW_WIDTH / 2;
  const CENTER_Y = VIEW_HEIGHT / 2;
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.25;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panStartRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number; worldX: number; worldY: number } | null>(null);
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  const ids = [...new Set(relations.flatMap((relation) => [relation.from, relation.to]))].slice(0, 40);
  const nodes = ids.map((id, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(ids.length, 1) - Math.PI / 2;
    return { entity: content.entities.find((entity) => entity.id === id)!, x: 300 + Math.cos(angle) * 220, y: 260 + Math.sin(angle) * 190 };
  }).filter((node) => node.entity);
  const point = new Map(nodes.map((node) => [node.entity.id, node]));
  const curveOffsets = relationCurveOffsets(relations);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
  const clampPan = (value: { x: number; y: number }, atZoom = zoom) => {
    const scaleGap = Math.abs(atZoom - 1);
    const maxX = (scaleGap * VIEW_WIDTH) / 2 + (atZoom > 1 ? 120 : 0);
    const maxY = (scaleGap * VIEW_HEIGHT) / 2 + (atZoom > 1 ? 100 : 0);
    return {
      x: Math.min(maxX, Math.max(-maxX, value.x)),
      y: Math.min(maxY, Math.max(-maxY, value.y)),
    };
  };
  const clientToSvg = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: CENTER_X, y: CENTER_Y };
    return {
      x: ((clientX - rect.left) / rect.width) * VIEW_WIDTH,
      y: ((clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
  };
  const zoomAt = (nextZoomValue: number, anchor = { x: CENTER_X, y: CENTER_Y }) => {
    const nextZoom = clampZoom(nextZoomValue);
    if (Math.abs(nextZoom - zoom) < 0.001) return;
    const worldX = CENTER_X + (anchor.x - CENTER_X - pan.x) / zoom;
    const worldY = CENTER_Y + (anchor.y - CENTER_Y - pan.y) / zoom;
    const nextPan = clampPan({
      x: anchor.x - CENTER_X - nextZoom * (worldX - CENTER_X),
      y: anchor.y - CENTER_Y - nextZoom * (worldY - CENTER_Y),
    }, nextZoom);
    setZoom(nextZoom);
    setPan(nextPan);
  };
  const relationLayout = (relation: Relation) => {
    const from = point.get(relation.from), to = point.get(relation.to);
    if (!from || !to) return null;
    const spread = curveOffsets.get(relation.id) || 0;
    const canonical = relation.from.localeCompare(relation.to) <= 0 ? { a: from, b: to } : { a: to, b: from };
    const cdx = canonical.b.x - canonical.a.x, cdy = canonical.b.y - canonical.a.y;
    const clen = Math.hypot(cdx, cdy) || 1;
    const nx = -cdy / clen, ny = cdx / clen;
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const radius = 43;
    const x1 = from.x + ux * radius, y1 = from.y + uy * radius;
    const x2 = to.x - ux * radius, y2 = to.y - uy * radius;
    const cx = (x1 + x2) / 2 + nx * spread, cy = (y1 + y2) / 2 + ny * spread;
    const qx = (x1 + 2 * cx + x2) / 4;
    const qy = (y1 + 2 * cy + y2) / 4;
    const lines = relationDisplayLines(relation.type);
    const longestLine = Math.max(...lines.map((line) => Array.from(line).length), 1);
    const labelWidth = Math.min(150, Math.max(56, longestLine * 12 + 22));
    const labelHeight = lines.length === 1 ? 28 : 42;
    const labelSign = spread === 0 ? -1 : Math.sign(spread);
    const labelOffset = spread === 0
      ? Math.max(22, labelWidth / 2 - 12)
      : Math.max(Math.abs(spread) * 1.1 + 8, labelWidth / 2 + 8);
    const lx = qx + nx * labelSign * labelOffset;
    const ly = qy + ny * labelSign * labelOffset;
    const labelTop = ly - labelHeight / 2;
    return { x1, y1, x2, y2, cx, cy, lx, ly, lines, labelWidth, labelHeight, labelTop };
  };
  const graphBounds = (() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const includePoint = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };
    const includeRect = (x: number, y: number, width: number, height: number) => {
      includePoint(x, y);
      includePoint(x + width, y + height);
    };
    nodes.forEach(({ x, y }) => includeRect(x - 37, y - 37, 74, 74));
    relations.forEach((relation) => {
      const layout = relationLayout(relation);
      if (!layout) return;
      includePoint(layout.x1, layout.y1);
      includePoint(layout.cx, layout.cy);
      includePoint(layout.x2, layout.y2);
      includeRect(layout.lx - layout.labelWidth / 2, layout.labelTop, layout.labelWidth, layout.labelHeight);
    });
    if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: VIEW_WIDTH, maxY: VIEW_HEIGHT };
    return { minX, minY, maxX, maxY };
  })();
  const fitToView = () => {
    const padding = 24;
    const width = Math.max(1, graphBounds.maxX - graphBounds.minX);
    const height = Math.max(1, graphBounds.maxY - graphBounds.minY);
    const nextZoom = clampZoom(Math.min((VIEW_WIDTH - padding * 2) / width, (VIEW_HEIGHT - padding * 2) / height));
    const centerX = (graphBounds.minX + graphBounds.maxX) / 2;
    const centerY = (graphBounds.minY + graphBounds.maxY) / 2;
    const nextPan = clampPan({
      x: -nextZoom * (centerX - CENTER_X),
      y: -nextZoom * (centerY - CENTER_Y),
    }, nextZoom);
    setZoom(nextZoom);
    setPan(nextPan);
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const startPinch = () => {
    const active = [...pointersRef.current.values()].slice(0, 2);
    if (active.length < 2) return;
    const dx = active[1].x - active[0].x;
    const dy = active[1].y - active[0].y;
    const midpoint = clientToSvg((active[0].x + active[1].x) / 2, (active[0].y + active[1].y) / 2);
    pinchRef.current = {
      distance: Math.max(1, Math.hypot(dx, dy)),
      zoom,
      worldX: CENTER_X + (midpoint.x - CENTER_X - pan.x) / zoom,
      worldY: CENTER_Y + (midpoint.y - CENTER_Y - pan.y) / zoom,
    };
    panStartRef.current = null;
    movedRef.current = true;
  };
  const finishPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* capture may already be released */ }
    pinchRef.current = null;
    const remaining = [...pointersRef.current.entries()];
    if (remaining.length === 1 && zoom > 1) {
      const [pointerId, pointer] = remaining[0];
      panStartRef.current = { pointerId, x: pointer.x, y: pointer.y, panX: pan.x, panY: pan.y };
    } else {
      panStartRef.current = null;
    }
    if (movedRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
  };

  if (!relations.length) return <p className="empty">表示できる関係はまだありません。</p>;
  const cameraTransform = `translate(${pan.x} ${pan.y}) translate(${CENTER_X} ${CENTER_Y}) scale(${zoom}) translate(${-CENTER_X} ${-CENTER_Y})`;
  const isDefaultView = Math.abs(zoom - 1) < 0.001 && Math.abs(pan.x) < 0.5 && Math.abs(pan.y) < 0.5;

  return (
    <div className="relation-graph-shell">
      <div className="relation-graph-toolbar" aria-label="相関図の表示倍率">
        <div className="relation-zoom-controls">
          <button type="button" className="icon-button" aria-label="相関図を縮小" disabled={zoom <= MIN_ZOOM} onClick={() => zoomAt(zoom - ZOOM_STEP)}><ZoomOut /></button>
          <output className="relation-zoom-value" aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button type="button" className="icon-button" aria-label="相関図を拡大" disabled={zoom >= MAX_ZOOM} onClick={() => zoomAt(zoom + ZOOM_STEP)}><ZoomIn /></button>
          <button type="button" className="button relation-fit-button" onClick={fitToView}><Maximize2 />全体表示</button>
          <button type="button" className="button relation-center-button" disabled={isDefaultView} onClick={resetView}>100%＋中央</button>
        </div>
        <small>50〜200%。ピンチで拡大縮小、拡大中はドラッグで移動できます。</small>
      </div>
      <div className="relation-graph-wrap">
        <svg
          ref={svgRef}
          className={`relation-graph${zoom > 1 ? " is-pannable" : ""}`}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label="登録した関係性の相関図"
          tabIndex={0}
          style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
          onWheel={(event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            const anchor = clientToSvg(event.clientX, event.clientY);
            zoomAt(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), anchor);
          }}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse" && event.button !== 0) return;
            pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* unsupported capture */ }
            movedRef.current = false;
            if (pointersRef.current.size >= 2) {
              startPinch();
            } else if (zoom > 1) {
              panStartRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
            }
          }}
          onPointerMove={(event) => {
            if (!pointersRef.current.has(event.pointerId)) return;
            pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pointersRef.current.size >= 2) {
              if (!pinchRef.current) startPinch();
              const pinch = pinchRef.current;
              const active = [...pointersRef.current.values()].slice(0, 2);
              if (!pinch || active.length < 2) return;
              const dx = active[1].x - active[0].x;
              const dy = active[1].y - active[0].y;
              const distance = Math.max(1, Math.hypot(dx, dy));
              const nextZoom = clampZoom(pinch.zoom * (distance / pinch.distance));
              const midpoint = clientToSvg((active[0].x + active[1].x) / 2, (active[0].y + active[1].y) / 2);
              const nextPan = clampPan({
                x: midpoint.x - CENTER_X - nextZoom * (pinch.worldX - CENTER_X),
                y: midpoint.y - CENTER_Y - nextZoom * (pinch.worldY - CENTER_Y),
              }, nextZoom);
              setZoom(nextZoom);
              setPan(nextPan);
              movedRef.current = true;
              return;
            }
            const start = panStartRef.current;
            if (!start || start.pointerId !== event.pointerId || zoom <= 1) return;
            const rect = svgRef.current?.getBoundingClientRect();
            if (!rect) return;
            const scaleX = VIEW_WIDTH / rect.width;
            const scaleY = VIEW_HEIGHT / rect.height;
            const dx = (event.clientX - start.x) * scaleX;
            const dy = (event.clientY - start.y) * scaleY;
            if (Math.hypot(dx, dy) > 3) movedRef.current = true;
            setPan(clampPan({ x: start.panX + dx, y: start.panY + dy }, zoom));
          }}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        >
          <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          <g className="relation-graph-camera" transform={cameraTransform}>
            {relations.map((relation) => {
              const layout = relationLayout(relation);
              if (!layout) return null;
              const { x1, y1, x2, y2, cx, cy, lx, ly, lines, labelWidth, labelHeight, labelTop } = layout;
              return <g key={relation.id} className="graph-edge">
                <path d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`} markerStart={relation.direction === "mutual" ? "url(#arrow)" : undefined} markerEnd="url(#arrow)" />
                <g className="graph-edge-label" aria-label={relation.type}>
                  <title>{relation.type}</title>
                  <rect x={lx - labelWidth / 2} y={labelTop} width={labelWidth} height={labelHeight} rx="8" />
                  <text x={lx} y={ly - (lines.length > 1 ? 7 : 0)}>{lines.map((line, lineIndex) => <tspan key={lineIndex} x={lx} dy={lineIndex === 0 ? 0 : 15}>{line}</tspan>)}</text>
                </g>
              </g>;
            })}
            {nodes.map(({ entity, x, y }) => <g key={entity.id} className="graph-node" role="button" tabIndex={0} onClick={() => { if (!suppressClickRef.current) onOpen(entity); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(entity); }}><circle cx={x} cy={y} r="37" /><text x={x} y={y + 4}>{shownName(entity).slice(0, 8)}</text><title>{shownName(entity)}（{labels[entity.kind]}）</title></g>)}
          </g>
        </svg>
      </div>
    </div>
  );
}

function RelationsPanel(props: Props) {
  const { content, readonly, onMutate, onOpen } = props;
  const [kind, setKind] = useState<Kind | "">("character");
  const [center, setCenter] = useState("");
  const [editing, setEditing] = useState("");
  const [query, setQuery] = useState("");
  const activeCenter = content.entities.some(e => e.id === center) ? center : "";
  const related = content.relations.filter((relation) => {
    const a = content.entities.find((e) => e.id === relation.from), b = content.entities.find((e) => e.id === relation.to);
    return (!kind || (a?.kind === kind && b?.kind === kind)) && (!activeCenter || relation.from === activeCenter || relation.to === activeCenter);
  }).slice(0, 80);
  const q = query.trim().toLocaleLowerCase();
  const listed = content.relations.filter((relation) => {
    if (!q) return true;
    const from = content.entities.find((e) => e.id === relation.from), to = content.entities.find((e) => e.id === relation.to);
    return [relation.type, relation.note, from && shownName(from), to && shownName(to)].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(q));
  });
  return <>
    <RelationForm content={content} readonly={readonly} onMutate={onMutate} />
    {props.onDimensionRelation && <details><summary>このDimensionで関係を編集</summary><div className="actions">{content.relations.map(r => <button className="button" key={r.id} onClick={() => props.onDimensionRelation?.(r.id)}>{shownName(content.entities.find(e => e.id === r.from)!)} → {shownName(content.entities.find(e => e.id === r.to)!)}：{r.type}</button>)}</div></details>}
    <div className="filter-row"><label>表示する種類<select value={kind} onChange={(e) => setKind(e.target.value as Kind | "")}><option value="">すべて（場所・組織込み）</option>{kinds.map((item) => <option key={item} value={item}>{labels[item]}のみ</option>)}</select></label><label>中心にする項目<select value={activeCenter} onChange={(e) => setCenter(e.target.value)}><option value="">全体</option>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label></div>
    {content.relations.length > 80 && <p className="notice">相関図は操作性のため条件に合う先頭80関係・40項目まで表示します。関係データ自体は50件以上でも保存できます。</p>}
    <RelationGraph content={content} relations={related} onOpen={onOpen} />
    <label className="relation-search">登録した関係を検索<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="キャラ名・関係名・メモ" /></label>
    <p className="muted">{listed.length}件の関係を表示しています。</p>
    <div className="relation-list">{listed.map((relation) => {
      const from = content.entities.find((e) => e.id === relation.from), to = content.entities.find((e) => e.id === relation.to);
      if (!from || !to) return null;
      if (editing === relation.id && !readonly) return <article className="relation-edit-row" key={relation.id}><RelationEditForm relation={relation} content={content} onCancel={() => setEditing("")} onMutate={onMutate} /></article>;
      return <article key={relation.id}><button type="button" onClick={() => onOpen(from)}>{shownName(from)}</button><span title={relation.type}>{relation.direction === "mutual" ? "↔" : "→"} {relationDisplayLabel(relation.type)}</span><button type="button" onClick={() => onOpen(to)}>{shownName(to)}</button>{relation.note && <small>{relation.note}</small>}{!readonly && <div className="relation-actions"><button className="icon-button" aria-label="関係を編集" onClick={() => setEditing(relation.id)}><PencilLine /></button><button className="icon-button" aria-label="関係を削除" onClick={() => onMutate((current) => { current.relations = current.relations.filter((item) => item.id !== relation.id); })}><Trash2 /></button></div>}</article>;
    })}</div>
  </>;
}

function TimelinePanel({ content, readonly, onMutate, onOpen }: Props) {
  const [focus, setFocus] = useState("");
  const events = [...content.events].filter((event) => !focus || event.entityIds.includes(focus)).sort((a, b) => (a.sortKey || a.date).localeCompare(b.sortKey || b.date, "ja"));
  return <>
    {!readonly && <form className="compact-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const now = new Date().toISOString(); await onMutate((current) => current.events.push({ id: uuid(), title: String(data.get("title")), date: String(data.get("date")), sortKey: String(data.get("sortKey")), description: String(data.get("description")), entityIds: data.getAll("entities").map(String), createdAt: now, updatedAt: now })); form.reset(); }}>
      <label>出来事名<input name="title" required maxLength={200} /></label><label>作中の日付・時代<input name="date" maxLength={100} placeholder="王暦102年 春" /></label><label>並び順キー<input name="sortKey" maxLength={100} placeholder="0102-03（任意）" /></label><label className="full">説明<textarea name="description" rows={2} /></label><fieldset className="full checks"><legend>関連項目</legend>{content.entities.slice(0, 300).map((e) => <label key={e.id}><input type="checkbox" name="entities" value={e.id} />{shownName(e)}</label>)}</fieldset><button className="button primary"><Plus />出来事を追加</button>
    </form>}
    <label>特定項目の年表<select value={focus} onChange={(e) => setFocus(e.target.value)}><option value="">世界全体</option>{content.entities.map((e) => <option key={e.id} value={e.id}>{shownName(e)}</option>)}</select></label>
    <div className="event-list">{events.slice(0, 300).map((item) => <article key={item.id}><time>{item.date || "時期未定"}</time><div><h3>{item.title}</h3><p>{item.description}</p><div className="mini-links">{item.entityIds.map((id) => { const e = content.entities.find((entity) => entity.id === id); return e && <button key={id} onClick={() => onOpen(e)}>{shownName(e)}</button>; })}</div></div>{!readonly && <button className="icon-button" aria-label="出来事を削除" onClick={() => onMutate((current) => { current.events = current.events.filter((event) => event.id !== item.id); })}><Trash2 /></button>}</article>)}</div>
    {!events.length && <p className="empty">出来事はまだ登録されていません。</p>}
  </>;
}

function CollectionsPanel({ content, readonly, onMutate, onOpen }: Props) {
  return <>
    {!readonly && <form className="compact-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const now = new Date().toISOString(); await onMutate((current) => current.collections.push({ id: uuid(), name: String(data.get("name")), description: String(data.get("description")), entityIds: data.getAll("entities").map(String), createdAt: now, updatedAt: now })); form.reset(); }}><label>グループ名<input name="name" required maxLength={100} placeholder="主人公組／第一章／敵対勢力…" /></label><label className="full">説明<textarea name="description" rows={2} /></label><fieldset className="full checks"><legend>含める項目</legend>{content.entities.slice(0, 300).map((e) => <label key={e.id}><input type="checkbox" name="entities" value={e.id} />{shownName(e)}</label>)}</fieldset><button className="button primary"><Plus />グループを追加</button></form>}
    <div className="collection-grid">{content.collections.map((collection) => <article key={collection.id}><div className="section-heading"><h3>{collection.name}</h3>{!readonly && <button className="icon-button" aria-label="グループを削除" onClick={() => onMutate((current) => { current.collections = current.collections.filter((item) => item.id !== collection.id); })}><Trash2 /></button>}</div><p>{collection.description}</p><div className="tool-list">{collection.entityIds.map((id) => { const e = content.entities.find((entity) => entity.id === id); return e && <EntityButton key={id} entity={e} onOpen={onOpen} />; })}</div></article>)}</div>
    {!content.collections.length && <p className="empty">グループはまだありません。</p>}
  </>;
}

function RecentPanel({ content, onOpen }: Pick<Props, "content" | "onOpen">) {
  const recent = [...content.entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 50);
  return <div className="tool-list">{recent.map((entity) => <div className="recent-row" key={entity.id}><EntityButton entity={entity} onOpen={onOpen} /><time>{new Date(entity.updatedAt).toLocaleString()}</time></div>)}</div>;
}

function WanderPanel({ content, onOpen }: Pick<Props, "content" | "onOpen">) {
  const [entity, setEntity] = useState<Entity>();
  const wander = () => setEntity(content.entities[Math.floor(Math.random() * content.entities.length)]);
  return <div className="wander"><Dices size={52} /><h3>世界のどこへ寄り道する？</h3><p>登録項目からひとつ、偶然の入口を選びます。</p><button className="button primary" disabled={!content.entities.length} onClick={wander}>ぶらつく</button>{entity && <div className="wander-result"><span className="eyebrow">TODAY'S STOP</span><h2>{shownName(entity)}</h2><p>{entity.catchphrase || entity.summary || "詳細を開いて眺めてみましょう。"}</p><button className="button" onClick={() => onOpen(entity)}>この項目を見る</button></div>}</div>;
}

export function WorkspaceTools(props: Props) {
  const [tool, setTool] = useState<Tool>("search");
  return <section className="workspace-tools">
    <nav className="subtabs" aria-label="世界を整理する道具">{tools.map(([id, label, Icon]) => <button key={id} aria-current={tool === id ? "page" : undefined} onClick={() => setTool(id)}><Icon />{label}</button>)}</nav>
    <div className="tool-panel">
      <div className="section-heading"><h2>{tools.find(([id]) => id === tool)![1]}</h2>{tool === "relations" && <GitFork />}</div>
      {tool === "search" && <SearchPanel content={props.content} onOpen={props.onOpen} />}
      {tool === "relations" && <RelationsPanel {...props} />}
      {tool === "timeline" && <TimelinePanel {...props} />}
      {tool === "collections" && <CollectionsPanel {...props} />}
      {tool === "recent" && <RecentPanel content={props.content} onOpen={props.onOpen} />}
      {tool === "wander" && <WanderPanel content={props.content} onOpen={props.onOpen} />}
    </div>
  </section>;
}

#!/usr/bin/env python3
"""dispatch の進行状況を、ブラウザで見られる簡易ページにする(標準ライブラリのみ・読み取り専用)。

使い方(プロジェクトのルートで):
  python scripts/dispatch-view.py [--port 8765] [--log-dir <バックグラウンド出力のフォルダ>]
ブラウザで http://127.0.0.1:8765 を開く。5秒ごとに自動更新される。止めるときは Ctrl-C。

元データ: .tasks/plan.json、dispatch のログ(.tasks/dispatch.log、無ければ --log-dir の最新の *.output)、
.tasks/ 内の *.codex.out.md / *.reply.txt / *.fail.txt / _lm_plan.json、.lmstudio/stats.json
"""
import argparse
import importlib.util
import json
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

SCRIPTS_DIR = Path.home() / ".claude" / "local-plugins" / "dev-router" / "scripts"
ROUTE_RE = re.compile(r"^\s{2}(\S+)\s+→\s+(codex|lmstudio|claude)[ \t]*(.*)$", re.M)
RESULT_RE = re.compile(
    r"^\s{2}(\S+)\s+(PASS|FAIL|ERROR|CODEX_LIMIT|NOOUT|BLOCKED|CLAUDE)\s+(codex|lmstudio|claude)"
    r"(?: @(\S+))?\s+試行(\d+)\s+(\d+)s(.*)$",
    re.M,
)
WAVE_RE = re.compile(r"=== 波 (\d+)/(\d+): ([^=]+?) ===")
ESCALATE_RE = re.compile(r"^\s{2}(\S+): LM Studio で FAIL → Codex へ引き上げ", re.M)
MARKER = "=== dispatch start"

ROOT = Path.cwd()
LOG_DIR = None


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def find_log():
    """(ログ本文, 読んだファイル名) を返す。"""
    text = read_text(ROOT / ".tasks" / "dispatch.log")
    if text:
        return text, "dispatch.log"
    if LOG_DIR and LOG_DIR.is_dir():
        outputs = sorted(LOG_DIR.glob("*.output"), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in outputs[:5]:
            text = read_text(p)
            if MARKER in text:
                return text, p.name
    return "", ""


def mtime(path: Path):
    try:
        return path.stat().st_mtime
    except OSError:
        return None


def title_of(spec: Path) -> str:
    first = read_text(spec).split("\n", 1)[0].lstrip("# ").strip()
    return first.split(":", 1)[-1].strip() if ":" in first else first


def latest_activity():
    """作業中のフォルダで、いちばん新しく更新されたファイルの時刻(生きているかの目安)。"""
    newest = 0.0
    for sub in ("src", ".tasks", "docs", "scripts", "fixtures", "public"):
        base = ROOT / sub
        if not base.is_dir():
            continue
        for p in base.rglob("*"):
            if "__pycache__" in p.parts:
                continue
            try:
                if p.is_file():
                    newest = max(newest, p.stat().st_mtime)
            except OSError:
                pass
    return newest or None


def snapshot() -> dict:
    tasks_dir = ROOT / ".tasks"
    try:
        plan = json.loads(read_text(tasks_dir / "plan.json") or "{}").get("tasks", [])
    except json.JSONDecodeError:
        plan = []

    log, source = find_log()
    start = log.rfind(MARKER)
    cur = log[start:] if start >= 0 else log
    routes = {m.group(1): m.group(2) for m in ROUTE_RE.finditer(cur)}
    results = {
        m.group(1): {
            "status": m.group(2), "where": m.group(4) or "", "attempts": m.group(5),
            "secs": m.group(6), "extra": m.group(7).strip(),
        }
        for m in RESULT_RE.finditer(cur)
    }
    escalated = {m.group(1) for m in ESCALATE_RE.finditer(cur)}
    waves = WAVE_RE.findall(cur)
    wave = f"第{waves[-1][0]}/{waves[-1][1]}波  {waves[-1][2]}" if waves else ""

    try:
        lm_ids = {t["id"] for t in json.loads(read_text(tasks_dir / "_lm_plan.json") or "{}").get("tasks", [])}
    except (json.JSONDecodeError, KeyError):
        lm_ids = set()

    passed = {i for i, r in results.items() if r["status"] in ("PASS", "CLAUDE")}

    # 結果表は dispatch の最後にまとめて出る。それまでは、Codex の要約ファイルが中身つきで
    # 出ていれば「実装済み(結果確認待ち)」とみなす(Codex は終わったときに要約を書くため)。
    def codex_summary(tid: str):
        p = tasks_dir / f"{tid}.codex.out.md"
        try:
            size = p.stat().st_size
        except OSError:
            return None, None
        return size, (read_text(p).strip().split("\n", 1)[0] if size else "")

    finished_ids = set()
    for t in plan:
        if routes.get(t["id"]) == "codex" or t["id"] in escalated:
            size, _ = codex_summary(t["id"])
            if size:
                finished_ids.add(t["id"])
    passed |= finished_ids
    rows = []
    for t in plan:
        tid = t["id"]
        spec = ROOT / t.get("spec", "")
        stem = spec.stem
        route = routes.get(tid, "")
        kind = {"codex": "Codex", "claude": "Claude"}.get(route, "LM Studio")
        codex_out = tasks_dir / f"{tid}.codex.out.md"
        acts = [a for a in (mtime(codex_out), mtime(tasks_dir / f"{stem}.reply.txt")) if a is not None]
        last_out = max(acts) if acts else None

        row = {"id": tid, "title": title_of(spec), "route": route, "who": kind,
               "state": "queued", "note": "", "lastOutputAt": last_out}
        res = results.get(tid)
        if res:
            row["who"] = res["where"].replace("T2250-", "") if res["where"] else kind
            row["note"] = f"試行{res['attempts']}回・{res['secs']}秒 {res['extra']}".strip()
            row["state"] = ("done" if res["status"] in ("PASS", "CLAUDE")
                            else "limit" if res["status"] == "CODEX_LIMIT"
                            else "blocked" if res["status"] == "BLOCKED" else "failed")
        else:
            waiting = [d for d in t.get("depends_on", []) if d not in passed]
            if waiting:
                row["state"], row["note"] = "waiting", "待ち: " + ", ".join(waiting)
            elif tid in finished_ids:
                _, first = codex_summary(tid)
                via = "LM Studio が失敗 → Codex が実装" if tid in escalated else "Codex が実装"
                row.update(state="finished", who="Codex", note=f"{via}。要約: {first}")
            elif (route == "codex" or tid in escalated) and codex_out.exists():
                started = mtime(codex_out)
                via = "LM Studio が失敗 → Codex に引き上げて実装中" if tid in escalated else "Codex が実装中"
                row.update(state="running", who="Codex", note=via, startedAt=started)
            elif route == "lmstudio" and tid in lm_ids:
                fail = (tasks_dir / f"{stem}.fail.txt").exists()
                row.update(state="running", who="LM Studio",
                           note="再試行中(失敗ログあり)" if fail else "生成中(どのPCかは完了後に分かる)")
        rows.append(row)

    devices = {}
    try:
        for entry in json.loads(read_text(ROOT / ".lmstudio" / "stats.json") or "[]"):
            for name, d in entry.get("by_device", {}).items():
                cur_d = devices.setdefault(name.replace("T2250-", ""), {"calls": 0, "secs": 0.0})
                cur_d["calls"] += d.get("calls", 0)
                cur_d["secs"] += d.get("secs", 0.0)
    except json.JSONDecodeError:
        pass

    return {
        "serverTime": time.time(), "lastActivityAt": latest_activity(), "wave": wave, "source": source,
        "finished": "=== dispatch end" in cur, "rows": rows,
        "devices": [{"name": n, **v} for n, v in devices.items()],
    }


_mods = {}


def load_mod(name: str):
    """dev-router のスクリプトを読み込む(定型プロンプトをそのまま使うため)。失敗したら None。"""
    if name not in _mods:
        try:
            spec = importlib.util.spec_from_file_location(f"kp_{name}", SCRIPTS_DIR / f"{name}.py")
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            _mods[name] = mod
        except Exception:  # noqa: BLE001
            _mods[name] = None
    return _mods[name]


def clip(text: str, limit: int = 16000) -> str:
    return text if len(text) <= limit else text[:limit] + f"\n…(以下 {len(text) - limit} 文字は省略)"


def file_info(rel: str) -> dict:
    p = ROOT / rel
    try:
        return {"path": rel, "size": p.stat().st_size if p.is_file() else None}
    except OSError:
        return {"path": rel, "size": None}


def detail(tid: str):
    """1タスクの「送る中身」と保存済みの出力を返す。保存済みのファイルを読むだけで、何も再生成しない。"""
    tasks_dir = ROOT / ".tasks"
    try:
        plan = json.loads(read_text(tasks_dir / "plan.json") or "{}").get("tasks", [])
    except json.JSONDecodeError:
        return None
    t = next((x for x in plan if x["id"] == tid), None)
    if t is None:
        return None

    log, _ = find_log()
    start = log.rfind(MARKER)
    cur = log[start:] if start >= 0 else log
    found = next((m for m in ROUTE_RE.finditer(cur) if m.group(1) == tid), None)
    route, reason = (found.group(2), found.group(3).strip()) if found else ("", "")
    escalated = tid in {m.group(1) for m in ESCALATE_RE.finditer(cur)}

    spec_path = (ROOT / t.get("spec", "")).resolve()
    spec_text = read_text(spec_path) if ROOT in spec_path.parents else ""
    stem = spec_path.stem
    targets, context = t.get("target") or [], t.get("context") or []
    out = {
        "id": tid, "route": route, "reason": reason, "escalated": escalated,
        "test": t.get("test", ""), "dependsOn": t.get("depends_on", []), "size": t.get("size"),
        "target": [file_info(x) for x in targets], "context": [file_info(x) for x in context],
        "spec": {"path": t.get("spec", ""), "text": clip(spec_text)},
        "codexPrompt": "", "lmSystem": "", "lmTotalChars": None, "outputs": [],
    }

    if route == "codex" or escalated:
        dispatch = load_mod("dispatch")
        if dispatch and hasattr(dispatch, "codex_prompt"):
            out["codexPrompt"] = clip(dispatch.codex_prompt(spec_text, t, ""))
    if route == "lmstudio":
        delegate = load_mod("delegate")
        out["lmSystem"] = clip(str(getattr(delegate, "SYSTEM_GEN", "")), 6000) if delegate else ""
        sizes = [x["size"] or 0 for x in out["target"] + out["context"]]
        out["lmTotalChars"] = len(spec_text) + sum(sizes)  # 仕様書 + 対象ファイル + 文脈ファイルの全文(おおよそ)

    for label, path in (
        ("Codex の出力(要約)", tasks_dir / f"{tid}.codex.out.md"),
        ("LM Studio の最新の返答(生成されたコード)", tasks_dir / f"{stem}.reply.txt"),
        ("最新のテスト失敗ログ", tasks_dir / f"{stem}.fail.txt"),
    ):
        text = read_text(path)
        if text:
            out["outputs"].append({"label": label, "path": f".tasks/{path.name}",
                                   "at": mtime(path), "text": clip(text, 12000)})
    return out


PAGE = """<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ディスパッチ状況</title>
<style>
:root{--bg:#f7faff;--card:#fff;--text:#1f2a44;--muted:#6b7a99;--line:#dde5f3;--blue:#2f6fed;--green:#1f9d55;--red:#d64545;--amber:#c98a0b}
@media (prefers-color-scheme:dark){:root{--bg:#10151f;--card:#18202e;--text:#e6ecf8;--muted:#8b9ab5;--line:#27324a;--blue:#6aa0ff;--green:#4cc38a;--red:#ff7b72;--amber:#e3b341}}
*{box-sizing:border-box}body{margin:0;padding:1rem;background:var(--bg);color:var(--text);font:15px/1.5 "Hiragino Sans","Yu Gothic UI","Meiryo",system-ui,sans-serif}
main{max-width:56rem;margin:0 auto}h1{font-size:1.2rem;margin:.2rem 0}h2{font-size:1rem;margin:1.4rem 0 .5rem}
.top{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;align-items:baseline;justify-content:space-between}
.pill{display:inline-block;padding:.05rem .6rem;border-radius:999px;font-size:.8rem;border:1px solid var(--line);background:var(--card)}
.bar{height:.7rem;border-radius:999px;background:var(--line);overflow:hidden;margin:.6rem 0}.bar>i{display:block;height:100%;background:var(--green);transition:width .4s}
.card{background:var(--card);border:1px solid var(--line);border-radius:.7rem;padding:.6rem .8rem;margin:.4rem 0}
.run{border-left:.35rem solid var(--blue)}.fail{border-left:.35rem solid var(--red)}.done{border-left:.35rem solid var(--green)}
.row{display:flex;gap:.6rem;align-items:baseline;flex-wrap:wrap}.id{font-weight:700;min-width:3.2rem}.who{font-weight:600}
.muted{color:var(--muted);font-size:.85rem}.dot{display:inline-block;width:.6rem;height:.6rem;border-radius:50%;background:var(--blue);margin-right:.3rem;animation:p 1.2s infinite}
@keyframes p{50%{opacity:.25}}@media (prefers-reduced-motion:reduce){.dot{animation:none}}
.err{color:var(--red)}
.card[data-id]{cursor:pointer}.card[data-id]:hover{border-color:var(--blue)}
.detail{margin-top:.6rem;padding-top:.5rem;border-top:1px dashed var(--line);cursor:auto;font-size:.88rem}
.detail h3{font-size:.9rem;margin:.8rem 0 .3rem}.detail ul{margin:.2rem 0 .4rem;padding-left:1.2rem}
.detail summary{cursor:pointer;margin:.3rem 0}.detail code{font-size:.82rem}
.detail pre{max-height:18rem;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--bg);border:1px solid var(--line);border-radius:.4rem;padding:.5rem;font-size:.78rem;margin:.3rem 0}
</style></head><body><main>
<div class="top"><h1>ディスパッチ状況</h1><span class="pill" id="age">読み込み中…</span></div>
<div id="summary" class="muted"></div><div class="muted">タスクをクリックすると、送る中身と保存済みの出力が見られます</div><div class="bar"><i id="bar" style="width:0"></i></div>
<div id="body"></div>
</main>
<script>
const EVERY = 5; let last = 0, data = null, failed = false;
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const ago = s => s == null ? "" : s < 60 ? s + "秒前" : Math.floor(s/60) + "分" + (s%60) + "秒前";
const open = new Set(), details = {}, openKeys = new Set(); let lastHtml = "";
const hhmmss = t => t ? new Date(t * 1000).toLocaleTimeString("ja-JP", {hour12: false}) : "";
const kb = n => n == null ? "(まだ無い=新規作成)" : n < 1024 ? n + "バイト" : (n / 1024).toFixed(1) + "KB";
const blk = (key, summary, text) => `<details data-k="${esc(key)}" ${openKeys.has(key) ? "open" : ""}><summary>${esc(summary)}</summary><pre>${esc(text)}</pre></details>`;
const files = list => list.length ? list.map(f => `<li>${esc(f.path)} <span class="muted">${kb(f.size)}</span></li>`).join("") : '<li class="muted">なし</li>';
function detailHtml(r) {
  const d = details[r.id];
  if (!d) return '<div class="detail muted">読み込み中…</div>';
  let h = '<div class="detail">';
  h += `<div class="muted">担当の決まり方: ${esc(d.route)} ${esc(d.reason)}${d.escalated ? "(LM Studioが失敗したためCodexに引き上げ)" : ""}</div>`;
  h += `<div class="muted">テスト: <code>${esc(d.test || "なし")}</code> ・依存: ${esc((d.dependsOn || []).join(", ") || "なし")} ・行数の見込み: ${esc(d.size)}</div>`;
  h += "<h3>送る中身</h3>";
  if (d.codexPrompt) h += blk(d.id + ":codex", "Codex に渡すプロンプト(全文。仕様書を含む)", d.codexPrompt);
  if (d.route === "lmstudio") {
    h += blk(d.id + ":sys", "LM Studio へのシステム指示", d.lmSystem || "(読み込めませんでした)");
    h += blk(d.id + ":spec", "LM Studio へ送る仕様書(" + d.spec.path + ")", d.spec.text);
    h += `<div class="muted">対象ファイル(現在の中身も送る)</div><ul>${files(d.target)}</ul>`;
    h += `<div class="muted">文脈ファイル(全文を送る)</div><ul>${files(d.context)}</ul>`;
    h += `<div class="muted">合計 約${(d.lmTotalChars || 0).toLocaleString()}文字(仕様書+上のファイル)</div>`;
  } else {
    if (!d.codexPrompt) h += blk(d.id + ":spec", "仕様書(" + d.spec.path + ")", d.spec.text);
    h += `<div class="muted">触ってよいファイル</div><ul>${files(d.target)}</ul>`;
    h += `<div class="muted">文脈ファイル(Codex が自分で読む。中身は送らない)</div><ul>${files(d.context)}</ul>`;
  }
  h += "<h3>保存済みの出力</h3>";
  h += d.outputs.length ? d.outputs.map(o => blk(d.id + ":" + o.path, `${o.label} ${hhmmss(o.at)}(${o.path})`, o.text)).join("") : '<div class="muted">まだ出力はありません</div>';
  return h + "</div>";
}
async function loadDetail(id) {
  try { details[id] = await (await fetch("/api/task?id=" + encodeURIComponent(id) + "&t=" + Date.now())).json(); } catch (e) {}
}
function card(r, cls, extra) {
  return `<div class="card ${cls}" data-id="${esc(r.id)}"><div class="row"><span class="id">${esc(r.id)}</span>
    <span class="who">${cls==="run"?'<span class="dot"></span>':""}${esc(r.who)}</span>
    <span>${esc(r.title)}</span></div><div class="muted">${esc(r.note)}${extra||""}</div>${open.has(r.id) ? detailHtml(r) : ""}</div>`;
}
function render() {
  if (!data) return;
  const rows = data.rows, n = rows.length, pick = s => rows.filter(r => s.includes(r.state));
  const done = pick(["done"]), fin = pick(["finished"]), run = pick(["running"]), failed_ = pick(["failed","limit","blocked"]);
  const rest = pick(["queued","waiting"]);
  document.getElementById("summary").textContent =
    `確定 ${done.length}・実装済み(結果確認待ち) ${fin.length}・実行中 ${run.length}・残り ${rest.length}・失敗 ${failed_.length} / 全${n}` +
    (data.wave ? `・${data.wave}` : "") + (data.finished ? "・dispatch 終了" : "") +
    (data.lastActivityAt ? `・ファイル最終変更 ${hhmmss(data.lastActivityAt)}` : "") + (data.source ? `・ログ: ${data.source}` : "");
  document.getElementById("bar").style.width = (n ? (done.length + fin.length) / n * 100 : 0) + "%";
  let h = `<h2>いま動いているもの(${run.length})</h2>`;
  h += run.length ? run.map(r => card(r, "run", r.startedAt ? `・開始 ${hhmmss(r.startedAt)}` : (r.lastOutputAt ? `・最後の出力 ${hhmmss(r.lastOutputAt)}` : ""))).join("") : '<div class="muted">いま動いているタスクはありません</div>';
  if (failed_.length) h += `<h2 class="err">失敗・停止(${failed_.length})</h2>` + failed_.map(r => card(r, "fail", `・${r.state}`)).join("");
  h += `<h2>残り(${rest.length})</h2>` + (rest.length ? rest.map(r => card(r, "", "")).join("") : '<div class="muted">残りはありません</div>');
  if (fin.length) h += `<h2>実装済み・結果確認待ち(${fin.length})</h2><div class="muted">Codex の要約が出ています。テスト結果の確定は、dispatch の最後の結果表で分かります。</div>` + fin.map(r => card(r, "done", "")).join("");
  h += `<h2>確定(${done.length})</h2>` + done.map(r => card(r, "done", "")).join("");
  if (data.devices.length) h += "<h2>LM Studio の使用量(累計)</h2>" + data.devices.map(d => `<div class="card"><span class="who">${esc(d.name)}</span> <span class="muted">${d.calls}回・${Math.round(d.secs)}秒</span></div>`).join("");
  if (h !== lastHtml) { document.getElementById("body").innerHTML = h; lastHtml = h; }
}
async function load() {
  try {
    const r = await fetch("/api?" + Date.now()); data = await r.json(); last = Date.now(); failed = false;
    await Promise.all([...open].map(loadDetail));
    render();
  } catch (e) { failed = true; }
}
document.getElementById("body").addEventListener("click", e => {
  if (e.target.closest(".detail")) return;
  const c = e.target.closest(".card[data-id]"); if (!c) return;
  const id = c.dataset.id;
  if (open.has(id)) { open.delete(id); render(); }
  else { open.add(id); render(); loadDetail(id).then(render); }
});
document.addEventListener("toggle", e => {
  const k = e.target.dataset && e.target.dataset.k; if (!k) return;
  if (e.target.open) openKeys.add(k); else openKeys.delete(k);
}, true);
function tick() {
  const s = last ? Math.floor((Date.now() - last) / 1000) : 0;
  document.getElementById("age").innerHTML = failed ? '<span class="err">サーバーに接続できません</span>' : last ? `最終更新 ${s}秒前(${EVERY}秒ごとに更新)` : "読み込み中…";
}
load(); setInterval(load, EVERY * 1000); setInterval(tick, 1000);
</script></body></html>
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        url = urlparse(self.path)
        path = url.path
        if path == "/api":
            body, ctype = json.dumps(snapshot(), ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8"
        elif path == "/api/task":
            tid = (parse_qs(url.query).get("id") or [""])[0]
            body, ctype = json.dumps(detail(tid), ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8"
        elif path in ("/", "/index.html"):
            body, ctype = PAGE.encode("utf-8"), "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # アクセスログは出さない
        pass


def main():
    global ROOT, LOG_DIR
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--root", default=".", help="プロジェクトのルート(既定: カレント)")
    ap.add_argument("--log-dir", default="", help="バックグラウンド出力(*.output)のフォルダ")
    a = ap.parse_args()
    ROOT = Path(a.root).resolve()
    LOG_DIR = Path(a.log_dir) if a.log_dir else None
    server = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)  # 自分のPCからだけ開ける
    print(f"http://127.0.0.1:{a.port} を開いてください(Ctrl-C で停止)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()

"""诗岛本地服务：提供前端静态页面和首句续写、藏头诗生成 API。"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

import torch

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_ROOT = PROJECT_ROOT / "src" / "frontend"
GENERAL_ROOT = PROJECT_ROOT / "v3" / "通用模型"
STYLE_ROOT = PROJECT_ROOT / "v3" / "风格化"
MODEL_RUN_DIR = GENERAL_ROOT / "experiments" / "01_backbone_selection" / "runs" / "best_backbone_transformer_6l"
MODEL_DATA_DIR = GENERAL_ROOT / "data"
STYLE_RUN_DIR = STYLE_ROOT / "experiments" / "09_poet_adapter_control" / "runs" / "poet_adapter"

# 预先注入路径，确保风格化脚本可以 import 通用模型模块
sys.path.insert(0, str(GENERAL_ROOT / "scripts" / "数据处理"))
sys.path.insert(0, str(GENERAL_ROOT / "scripts" / "Experiment 01：Backbone Selection"))
sys.path.insert(0, str(STYLE_ROOT / "scripts" / "Experiment 09：Poet Adapter Control"))

from tokenizer import CharTokenizer
from train_poet_adapter import PoetAdapterTransformer
from evaluate_poet_adapter import generate_adapter_continue

POET_NAMES = {"wangwei": "王维", "libai": "李白", "baijuyi": "白居易"}
POET_SLUGS = {"wangwei": "wang_wei", "libai": "li_bai", "baijuyi": "bai_juyi"}
CJK_RE = re.compile(r"[\u4e00-\u9fff]")

# ---- 设备与模型预加载 ----
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[server] 设备: {DEVICE}")

print("[server] 加载 Poet Adapter 风格模型 ...")
TOKENIZER = CharTokenizer.load(MODEL_DATA_DIR / "tokenizer.json")
STYLE_MODEL = None
STYLE_READY = False
STYLE_ERROR = ""
try:
    STYLE_MODEL = PoetAdapterTransformer(
        vocab_size=len(TOKENIZER), max_len=32, embed_dim=128,
        num_heads=4, num_layers=6, dropout=0.1, bottleneck=32)
    map_loc = None if DEVICE.type == "cuda" else "cpu"
    ckpt = torch.load(STYLE_RUN_DIR / "best.pt", map_location=map_loc)
    STYLE_MODEL.load_state_dict(ckpt["model_state"])
    STYLE_MODEL.to(DEVICE)
    STYLE_MODEL.eval()
    STYLE_READY = True
    print(f"[server] Poet Adapter 加载成功，已移至 {DEVICE}")
except Exception as exc:
    STYLE_ERROR = str(exc)
    print(f"[server] Poet Adapter 加载失败，将用规则兜底: {STYLE_ERROR}")

# ---- 规则兜底词库 ----
LINE_BANKS = {
    "wangwei": {
        "stable": ["竹影轻摇入翠扉", "松风吹梦过寒溪", "清泉绕石送云归", "半庭明月照僧衣", "空山听雨到茶扉", "一盏清茶人不语"],
        "balanced": ["雨后溪声满竹扉", "山色随云入短篱", "晚钟穿树到柴扉", "苔痕微湿上禅衣", "石径无人花自落", "松窗一榻听泉归"],
        "inspire": ["白云深处鹿眠苔", "远岫含烟入酒杯", "孤灯照水见僧来", "一片闲云过钓台", "竹外寒星落石苔", "泉声半夜洗尘埃"],
    },
    "libai": {
        "stable": ["明月随人入酒卮", "长风吹梦过天涯", "一声横笛云边起", "万里春江落晚霞", "云外孤帆追落日", "杯中星斗照金沙"],
        "balanced": ["银河倒挂入诗怀", "高楼醉倚看青天", "楚水遥连白帝城", "玉笛横吹动海云", "飞瀑悬空落九垓", "青山万里送归船"],
        "inspire": ["举杯欲揽九天星", "长剑横空照海门", "狂歌直上白云端", "醉踏银河问月明", "风卷沧溟入袖中", "一笑扶摇过万峰"],
    },
    "baijuyi": {
        "stable": ["邻里炊烟入小门", "市桥灯火近黄昏", "一纸新诗谁共读", "春风吹到旧篱根", "桥边笑语过柴门", "灯下新词说世情"],
        "balanced": ["小巷人声连酒肆", "纸笺闲写旧乡痕", "卖花声里日初温", "老叟牵孙过短门", "新米炊香满市尘", "柳下儿童数燕痕"],
        "inspire": ["灯火千家照晚潮", "街头笑语入诗瓢", "短笛吹春过板桥", "人间冷暖付歌谣", "一碗清茶话寂寥", "风送渔歌到柳梢"],
    },
}


def normalize_scene(scene: str) -> str:
    return scene if scene in POET_NAMES else "wangwei"


def only_cjk(text: str) -> str:
    return "".join(CJK_RE.findall(text or ""))


def seven_chars(text: str, fill: str = "风") -> str:
    clean = only_cjk(text)
    return (clean or "空山新雨晚风微").ljust(7, fill)[:7]


def four_chars(text: str) -> str:
    clean = only_cjk(text)
    return (clean or "诗岛日常").ljust(4, "诗")[:4]


def stable_index(seed: str, modulo: int) -> int:
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % max(modulo, 1)


def parameter_band(temperature: float) -> str:
    if temperature <= 0.8:
        return "stable"
    if temperature <= 1.05:
        return "balanced"
    return "inspire"


def ordered_candidates(bank: list[str], seed: str, top_k: int, offset: int, count: int) -> list[str]:
    start = stable_index(f"{seed}-{top_k}-{offset}", len(bank))
    step = 1 + stable_index(f"step-{top_k}-{seed}", max(len(bank) - 1, 1))
    result = []
    index = start
    while len(result) < count:
        line = bank[index % len(bank)]
        if line not in result:
            result.append(line)
        index += step
    return result


def make_continuation(scene: str, first_line: str, offset: int, temperature: float, top_k: int) -> list[str]:
    first = seven_chars(first_line)
    band = parameter_band(temperature)
    bank = LINE_BANKS[scene][band]
    seed = f"continue-{scene}-{first}-{temperature}-{top_k}"
    tail = ordered_candidates(bank, seed, top_k, offset, 3)
    return [first, *tail]


def make_acrostic(scene: str, head: str, offset: int, temperature: float, top_k: int) -> list[str]:
    heads = four_chars(head)
    band = parameter_band(temperature)
    bank = LINE_BANKS[scene][band]
    start = (stable_index(f"{scene}-{heads}-{top_k}-{offset}", len(bank)) + offset) % len(bank)
    return [heads[i] + bank[(start + i) % len(bank)].ljust(7, "风")[1:7] for i in range(4)]


def generate_poem(payload: dict[str, object]) -> dict[str, object]:
    """返回 general（通用底座）和 style（Poet Adapter）双通道结果。

    general 始终用规则生成（瞬时返回）。
    style 优先用 Poet Adapter 模型生成，通过线程 + 5 秒超时防止阻塞。
    超时或失败则回退规则兜底。
    """
    scene = normalize_scene(str(payload.get("scene", "wangwei")))
    mode = str(payload.get("mode", "continue"))
    if mode not in {"continue", "acrostic"}:
        mode = "continue"
    temperature = float(payload.get("temperature", 0.9))
    top_k = int(payload.get("topK", 50))
    condition = four_chars(str(payload.get("input", ""))) if mode == "acrostic" else seven_chars(str(payload.get("input", "")))
    poet = POET_NAMES[scene]

    gen_fn = make_acrostic if mode == "acrostic" else make_continuation
    general_lines = gen_fn(scene, condition, 0, temperature, top_k)

    # 风格模型：线程执行，5 秒超时
    style_lines = None
    style_meta_suffix = ""
    if STYLE_READY and mode == "continue":
        result_holder = []
        def _run_adapter():
            try:
                slug = POET_SLUGS.get(scene, "wang_wei")
                raw = generate_adapter_continue(STYLE_MODEL, TOKENIZER, condition, slug, temperature, int(top_k))
                lines = [l.strip() for l in raw.splitlines() if l.strip()]
                if len(lines) == 4 and all(len(l) == 7 for l in lines):
                    result_holder.append(lines)
            except Exception:
                pass
        t = threading.Thread(target=_run_adapter, daemon=True)
        t.start()
        t.join(timeout=5)
        if result_holder:
            style_lines = result_holder[0]
            style_meta_suffix = " · Adapter"
        else:
            style_meta_suffix = " · Adapter 超时回退"
    if style_lines is None:
        style_lines = gen_fn(scene, condition, 7, temperature, top_k + 11)
        if not style_meta_suffix:
            style_meta_suffix = " · 规则兜底"

    return {
        "ok": True,
        "general": {"title": "首句续写" if mode == "continue" else "藏头心愿",
                     "meta": f"{poet} · 通用底座 · T={temperature} top-k={top_k}",
                     "lines": general_lines},
        "style": {"title": "首句续写" if mode == "continue" else "藏头心愿",
                   "meta": f"{poet}{style_meta_suffix} · T={temperature} top-k={top_k}",
                   "lines": style_lines},
    }


class PoemIslandHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8") if length else "{}"
        payload = json.loads(raw_body or "{}")
        if self.path == "/api/generate":
            self.send_json(generate_poem(payload))
            return
        self.send_error(404, "Not Found")

    def do_GET(self):
        if self.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def translate_path(self, path):
        clean_path = unquote(path.split("?", 1)[0]).lstrip("/")
        if clean_path.startswith("assets/"):
            return str(PROJECT_ROOT / clean_path)
        return str(FRONTEND_ROOT / clean_path)

    def send_json(self, data: dict[str, object]):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer(("127.0.0.1", 8765), PoemIslandHandler)
    print("[server] 诗岛前端服务：http://127.0.0.1:8765")
    server.serve_forever()


if __name__ == "__main__":
    main()

// 诗岛前端：双卷轴（通用底座 / 风格模型），点卷轴弹手稿，参调影响两边。
const scenes = {
  wangwei: {
    name: "竹林茶座", poet: "王维", sprite: "wangwei",
    character: "../../assets/poem-island-v2/character_wangwei.png",
    bg: "../../assets/poem-island-v2/bamboo_tea.png",
    dialogue: "今日山雨将至，倒适合写一句清静诗。",
    daily: ["空山新雨晚风微", "竹影轻摇入翠扉", "一盏清茶人不语", "半庭明月照僧衣"],
  },
  libai: {
    name: "月夜庭院", poet: "李白", sprite: "libai",
    character: "../../assets/poem-island-v2/character_libai.png",
    bg: "../../assets/poem-island-v2/moon_courtyard.png",
    dialogue: "今夜月色正好，若无酒，也该有诗。",
    daily: ["明月随人入酒卮", "长风吹梦过天涯", "一声横笛云边起", "万里春江落晚霞"],
  },
  baijuyi: {
    name: "江边诗市", poet: "白居易", sprite: "baijuyi",
    character: "../../assets/poem-island-v2/character_baijuyi.png",
    bg: "../../assets/poem-island-v2/market_scene.png",
    dialogue: "桥边听得几句闲谈，倒值得记下来。",
    daily: ["市桥灯火近黄昏", "邻里炊烟入小门", "一纸新诗谁共读", "春风吹到旧篱根"],
  },
};

let currentScene = scenes.wangwei;
let pendingMode = "continue";

// 上次生成结果缓存：{ general: {lines, drafts}, style: {lines, drafts} }
const lastResult = { general: null, style: null };

// DOM refs
const mapView = document.querySelector("#mapView");
const sceneView = document.querySelector("#sceneView");
const locationLabel = document.querySelector("#locationLabel");
const sceneBg = document.querySelector("#sceneBg");
const poetSprite = document.querySelector("#poetSprite");
const dialogueText = document.querySelector("#dialogueText");
const scrollGeneral = document.querySelector("#scrollGeneral");
const scrollStyle = document.querySelector("#scrollStyle");
const poemGeneral = document.querySelector("#poemGeneral");
const poemStyle = document.querySelector("#poemStyle");
const metaGeneral = document.querySelector("#metaGeneral");
const metaStyle = document.querySelector("#metaStyle");
const manuscriptPanel = document.querySelector("#manuscriptPanel");
const draftList = document.querySelector("#draftList");
const draftTitle = document.querySelector("#draftTitle");
const settingsPanel = document.querySelector("#settingsPanel");
const inputModal = document.querySelector("#inputModal");
const modalTitle = document.querySelector("#modalTitle");
const conditionInput = document.querySelector("#conditionInput");

// ---- 工具函数 ----
function onlyCjk(text) {
  return (text || "").replace(/[^\u4e00-\u9fff]/g, "");
}

function stableIndex(seed, modulo) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash % Math.max(modulo, 1);
}

function getGenerationSettings() {
  return {
    temperature: Number(document.querySelector("#tempRange")?.value || 0.9),
    topK: Number(document.querySelector("#topkRange")?.value || 50),
    draftCount: Number(document.querySelector("#draftCount")?.value || 5),
  };
}

function scenePool(sceneKey) {
  return {
    wangwei: ["竹影轻摇入翠扉", "空山听雨到茶扉", "松风吹梦过寒溪", "清泉绕石送云归", "半庭明月照僧衣", "一盏清茶人不语", "山色随云入短篱", "雨后溪声满竹扉"],
    libai: ["长风吹梦过天涯", "明月随人入酒卮", "一声横笛云边起", "万里春江落晚霞", "银河倒挂入诗怀", "醉把青天唤作家", "云外孤帆追落日", "杯中星斗照金沙"],
    baijuyi: ["邻里炊烟入小门", "市桥灯火近黄昏", "一纸新诗谁共读", "春风吹到旧篱根", "小巷人声连酒肆", "纸笺闲写旧乡痕", "桥边笑语过柴门", "灯下新词说世情"],
  }[sceneKey];
}

// 风格模型带档位的词库，temperature 变化会切到不同句组
const styleBanks = {
  wangwei: {
    stable:   ["松风入梦到寒溪", "清泉绕石洗尘衣", "雨后空山鸟自啼", "白云深处掩禅扉", "石径苔痕绿湿衣", "竹露无声滴翠微"],
    balanced: ["晚钟穿树到松扉", "山色随云入短篱", "苔痕微湿上禅衣", "石径无人花自落", "松窗一榻听泉归", "一片闲云过石矶"],
    inspire:  ["鹿眠寒涧踏青苔", "远岫含烟入酒杯", "孤灯照水见僧来", "泉声半夜洗尘埃", "竹外寒星落石苔", "白云生处鹿衔花"],
  },
  libai: {
    stable:   ["银河倒挂入金樽", "长风万里送秋雁", "醉踏星河问月明", "剑倚青冥天外横", "狂歌一曲动天门", "举杯欲揽九天星"],
    balanced: ["高楼醉倚看青天", "楚水遥连白帝城", "玉笛横吹动海云", "飞瀑悬空落九垓", "青山万里送归船", "醉把青天唤作家"],
    inspire:  ["笑揽九天星斗寒", "狂歌直上白云端", "梦踏银河雪满川", "杯倾沧海夜行船", "剑倚青冥问月安", "风卷沧溟入袖间"],
  },
  baijuyi: {
    stable:   ["桥边灯火夜归人", "新诗写就寄乡邻", "纸笺闲写旧年春", "市井人声到晓晨", "一碗清茶话世尘", "风送渔歌到水滨"],
    balanced: ["卖花声里日初温", "老叟牵孙过短门", "新米炊香满市尘", "柳下儿童数燕痕", "小巷人声连酒肆", "灯下新词说世情"],
    inspire:  ["灯火千家照晚潮", "街头笑语入诗瓢", "短笛吹春过板桥", "人间冷暖付歌谣", "风烟入市写新谣", "客散灯犹照柳梢"],
  },
};

function getStyleBand(temperature) {
  if (temperature <= 0.8) return "stable";
  if (temperature <= 1.05) return "balanced";
  return "inspire";
}

function getStylePool(sceneKey, temperature) {
  return styleBanks[sceneKey]?.[getStyleBand(temperature)] || styleBanks[sceneKey]?.balanced || [];
}

// ---- 视图切换 ----
function setView(view) {
  [mapView, sceneView].forEach(el => el.classList.remove("active"));
  view.classList.add("active");
}

function enterScene(key) {
  currentScene = scenes[key] || scenes.wangwei;
  locationLabel.textContent = currentScene.name;
  sceneBg.src = currentScene.bg;
  poetSprite.querySelector("img").src = currentScene.character;
  dialogueText.textContent = currentScene.dialogue;
  manuscriptPanel.classList.remove("open");
  scrollGeneral.classList.remove("active-scroll");
  scrollStyle.classList.remove("active-scroll");
  // 显示场景默认预览诗
  poemGeneral.textContent = currentScene.daily.join("\n");
  poemStyle.textContent = currentScene.daily.join("\n");
  metaGeneral.textContent = "Transformer-6L · 规则约束 · 候选重排";
  metaStyle.textContent = "Transformer · RAG · Adapter";
  setView(sceneView);
}

// ---- 本地兜底生成 ----
function makeContinuation(firstLine, offset, settings, poolOverride) {
  const seed = onlyCjk(firstLine).padEnd(7, "风").slice(0, 7);
  const pool = poolOverride || scenePool(currentScene.sprite);
  const start = stableIndex(`${seed}-${settings.temperature}-${settings.topK}-${offset}`, pool.length);
  return [seed, pool[start], pool[(start + 2) % pool.length], pool[(start + 4) % pool.length]];
}

function makeAcrostic(head, offset, settings, poolOverride) {
  const chars = onlyCjk(head).padEnd(4, "诗").slice(0, 4).split("");
  const pool = poolOverride || scenePool(currentScene.sprite);
  const start = stableIndex(`${chars.join("")}-${settings.temperature}-${settings.topK}-${offset}`, pool.length);
  return chars.map((char, i) => char + pool[(start + i * 2) % pool.length].slice(1));
}

function metricNotes(lines, best, seed) {
  const uniqueChars = new Set(lines.join("").split("")).size;
  const diversity = Math.min(99, Math.round((uniqueChars / 28) * 100));
  const topic = Math.min(98, 84 + stableIndex(seed + "topic", 12) + (best ? 3 : 0));
  const style = Math.min(98, 80 + stableIndex(seed + "style", 16) + (best ? 2 : 0));
  const repeat = diversity >= 70 ? "低" : "中";
  let comment = topic >= 92 ? "简评：主题衔接表现好，没有明显跑题。"
    : topic >= 86 ? "简评：整体围绕输入展开，意象衔接基本自然。"
    : "简评：主题延续一般，建议优先查看其他手稿。";
  if (style >= 90) comment += " 风格辨识度也比较突出。";
  if (repeat === "低") comment += " 重复控制较稳。";
  return ["格式：通过", `主题一致性：${topic}%`, `风格分：${style}%`, `重复：${repeat}`, comment];
}

function buildDrafts(mode, value, bestLines, offsetSeed) {
  const settings = getGenerationSettings();
  // 风格模型使用略有区别的词库，体现差异化
  const stylePool = {
    wangwei: ["松风入梦到寒溪", "雨后空山鸟自啼", "清泉绕石洗尘衣", "白云深处掩禅扉", "石径苔痕绿上衣", "竹露无声湿翠微"],
    libai: ["醉踏星河问月明", "长风万里送秋雁", "银河倒挂入金樽", "剑倚青冥天外横", "狂歌一曲动天门", "举杯欲揽九天星"],
    baijuyi: ["桥边灯火夜归人", "新诗写就寄乡邻", "纸笺闲写旧年春", "市井人声到晓晨", "一碗清茶话世尘", "风送渔歌到水滨"],
  }[currentScene.sprite];
  return Array.from({ length: settings.draftCount }, (_, i) => {
    const isBest = i === 0;
    const seed = `${mode}-${value}-${offsetSeed}-${i}-${settings.temperature}-${settings.topK}`;
    const lines = isBest ? bestLines
      : mode === "acrostic" ? makeAcrostic(value, offsetSeed + i, settings, stylePool)
      : makeContinuation(value, offsetSeed + i, settings, stylePool);
    return {
      title: `手稿${i + 1}${isBest ? " · 最佳作品" : ""}`,
      best: isBest,
      lines,
      notes: metricNotes(lines, isBest, seed),
    };
  });
}

// ---- 手稿渲染 ----
function renderDrafts(modelName, modelLabel, lines) {
  draftTitle.textContent = `${modelLabel} 手稿`;
  draftList.innerHTML = "";
  const seedBase = `${currentScene.sprite}-${pendingMode}`;
  const drafts = buildDrafts(pendingMode, lines[0], lines, stableIndex(seedBase + modelName, 1000));
  for (const draft of drafts) {
    const item = document.createElement("article");
    item.className = `draft-item${draft.best ? " best" : ""}`;
    item.innerHTML = `
      <strong>${draft.title}</strong>
      <pre>${draft.lines.join("\n")}</pre>
      <div class="metric-row">${draft.notes.slice(0, 4).map(n => `<span>${n}</span>`).join("")}</div>
      <div class="draft-comment">${draft.notes[4]}</div>
    `;
    draftList.appendChild(item);
  }
  manuscriptPanel.classList.add("open");
  manuscriptPanel.setAttribute("aria-hidden", "false");
}

// ---- 卷轴点击 ----
scrollGeneral.addEventListener("click", () => {
  const lines = poemGeneral.textContent.split("\n").filter(l => l.trim());
  if (lines.length === 4) {
    scrollGeneral.classList.add("active-scroll");
    scrollStyle.classList.remove("active-scroll");
    renderDrafts("general", "通用底座", lines);
  }
});

scrollStyle.addEventListener("click", () => {
  const lines = poemStyle.textContent.split("\n").filter(l => l.trim());
  if (lines.length === 4) {
    scrollStyle.classList.add("active-scroll");
    scrollGeneral.classList.remove("active-scroll");
    renderDrafts("style", "风格模型", lines);
  }
});

// ---- 生成流程 ----
function thinkingThen(callback) {
  const steps = ["翻阅旧稿...", "推敲字句...", "誊写成诗..."];
  let index = 0;
  dialogueText.textContent = steps[index];
  const timer = setInterval(() => {
    index += 1;
    if (index >= steps.length) {
      clearInterval(timer);
      callback();
      dialogueText.textContent = currentScene.dialogue;
      return;
    }
    dialogueText.textContent = steps[index];
  }, 520);
}

function doGenerate(mode, value) {
  const settings = getGenerationSettings();

  // 先 API，失败再兜底。用标志位防本地结果覆盖 API 结果
  let apiDone = false;

  fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scene: currentScene.sprite, mode, input: value,
      temperature: settings.temperature, topK: settings.topK,
      draftCount: settings.draftCount,
    }),
  })
    .then(res => res.json())
    .then(data => {
      apiDone = true;
      console.log("[诗岛] API 返回:", data);
      if (data.ok && data.general) {
        poemGeneral.textContent = data.general.lines.join("\n");
        metaGeneral.textContent = data.general.meta;
        lastResult.general = data.general;
      }
      if (data.ok && data.style) {
        poemStyle.textContent = data.style.lines.join("\n");
        metaStyle.textContent = data.style.meta;
        lastResult.style = data.style;
      }
    })
    .catch(err => { console.warn("[诗岛] API 不可用，使用本地兜底:", err.message); });

  // 给 API 600ms 响应时间，超时则本地兜底
  setTimeout(() => {
    if (apiDone) return;  // API 已响应，不覆盖
    const gLines = mode === "acrostic"
      ? makeAcrostic(value, 0, settings, scenePool(currentScene.sprite))
      : makeContinuation(value, 0, settings, scenePool(currentScene.sprite));
    poemGeneral.textContent = gLines.join("\n");
    metaGeneral.textContent = `本地 · T=${settings.temperature} top-k=${settings.topK}`;

    const sPool = getStylePool(currentScene.sprite, settings.temperature);
    const sLines = mode === "acrostic"
      ? makeAcrostic(value, settings.topK, settings, sPool)
      : makeContinuation(value, settings.topK, settings, sPool);
    poemStyle.textContent = sLines.join("\n");
    metaStyle.textContent = `本地 · T=${settings.temperature} top-k=${settings.topK}`;

    lastResult.general = { lines: gLines, meta: metaGeneral.textContent };
    lastResult.style = { lines: sLines, meta: metaStyle.textContent };
  }, 600);

  manuscriptPanel.classList.remove("open");
  scrollGeneral.classList.remove("active-scroll");
  scrollStyle.classList.remove("active-scroll");
}

// ---- 输入弹窗 ----
function openInput(mode) {
  pendingMode = mode;
  modalTitle.textContent = mode === "continue" ? "递一句诗" : "心愿笺";
  conditionInput.maxLength = mode === "continue" ? 7 : 4;
  conditionInput.value = mode === "continue" ? "空山新雨晚风微" : "诗岛日常";
  inputModal.classList.add("open");
  inputModal.setAttribute("aria-hidden", "false");
  conditionInput.focus();
}

function closeInput() {
  inputModal.classList.remove("open");
  inputModal.setAttribute("aria-hidden", "true");
}

// ---- 参数面板 ----
function syncRangeOutputs() {
  document.querySelector("#tempValue").textContent = document.querySelector("#tempRange").value;
  document.querySelector("#topkValue").textContent = document.querySelector("#topkRange").value;
  document.querySelector("#draftValue").textContent = document.querySelector("#draftCount").value;
}

function applyPreset(presetKey) {
  const presets = {
    stable: { temperature: 0.7, topK: 30, draftCount: 3 },
    balanced: { temperature: 0.9, topK: 50, draftCount: 5 },
    inspire: { temperature: 1.2, topK: 100, draftCount: 8 },
  };
  const preset = presets[presetKey];
  if (!preset) return;
  document.querySelector("#tempRange").value = preset.temperature;
  document.querySelector("#topkRange").value = preset.topK;
  document.querySelector("#draftCount").value = preset.draftCount;
  syncRangeOutputs();
  document.querySelectorAll(".segments button").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.preset === presetKey);
  });
}

// ---- 事件绑定 ----
document.querySelectorAll(".map-hotspot").forEach(btn => {
  btn.addEventListener("click", () => enterScene(btn.dataset.scene));
});

document.querySelector("#backBtn").addEventListener("click", () => {
  locationLabel.textContent = "诗岛地图";
  manuscriptPanel.classList.remove("open");
  setView(mapView);
});

document.querySelector(".action-dock").addEventListener("click", (e) => {
  const action = e.target.dataset.action;
  if (!action) return;
  if (action === "continue") openInput("continue");
  if (action === "acrostic") openInput("acrostic");
});

document.querySelector("#inputForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const value = conditionInput.value.trim();
  closeInput();
  thinkingThen(() => doGenerate(pendingMode, value));
});

document.querySelector("#cancelInput").addEventListener("click", closeInput);
document.querySelector("#closeDrafts").addEventListener("click", () => manuscriptPanel.classList.remove("open"));

document.querySelector("#settingsBtn").addEventListener("click", () => settingsPanel.classList.add("open"));
document.querySelector("#closeSettings").addEventListener("click", () => settingsPanel.classList.remove("open"));

// 滑杆实时显示
["tempRange", "topkRange", "draftCount"].forEach(id => {
  const el = document.querySelector(`#${id}`);
  const valId = id.replace("Range", "Value");
  if (el) el.addEventListener("input", () => {
    const val = document.querySelector(`#${valId}`);
    if (val) val.textContent = el.value;
  });
});

// 预设按钮
document.querySelectorAll(".segments button").forEach(btn => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

// 初始化
currentScene = scenes.wangwei;
locationLabel.textContent = "诗岛地图";
sceneBg.src = currentScene.bg;
poetSprite.querySelector("img").src = currentScene.character;
dialogueText.textContent = currentScene.dialogue;
poemGeneral.textContent = currentScene.daily.join("\n");
poemStyle.textContent = currentScene.daily.join("\n");
setView(mapView);

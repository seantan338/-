/* ============================================================
   灵感板 · 内容灵感收集 APP
   纯前端，数据保存在浏览器 localStorage，无需后端。
   ============================================================ */

// ---------- 分类定义 ----------
const CATEGORIES = [
  { id: "all",     label: "全部灵感", emoji: "🗂️", color: "#5b6cff" },
  { id: "title",   label: "好标题",   emoji: "✍️", color: "#5b6cff" },
  { id: "topic",   label: "好选题",   emoji: "🎯", color: "#10b981" },
  { id: "example", label: "好例子",   emoji: "🌟", color: "#f59e0b" },
  { id: "hook",    label: "好钩子",   emoji: "🪝", color: "#ec4899" },
  { id: "data",    label: "好数据",   emoji: "📊", color: "#8b5cf6" },
];

// 用于卡片/选择器的可见类型（不含「全部」）
const TYPES = CATEGORIES.filter((c) => c.id !== "all");

const STORAGE_KEY = "inspiration-board-items-v1";

// ---------- 状态 ----------
let items = load();
let activeCategory = "all";
let activeTag = null;
let searchQuery = "";
let editingId = null;          // 正在编辑的条目 id；null 表示新增
let draftTags = [];            // 弹窗中的标签草稿
let draftType = "title";       // 弹窗中选中的类型

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const categoryNav = $("#categoryNav");
const cardGrid = $("#cardGrid");
const tagFilter = $("#tagFilter");
const emptyState = $("#emptyState");
const currentTitle = $("#currentTitle");
const viewCount = $("#viewCount");
const totalCount = $("#totalCount");
const searchInput = $("#searchInput");

const modalOverlay = $("#modalOverlay");
const modalTitle = $("#modalTitle");
const contentInput = $("#contentInput");
const sourceInput = $("#sourceInput");
const tagInput = $("#tagInput");
const tagChips = $("#tagChips");
const typePicker = $("#typePicker");

// ============================================================
//  存储
// ============================================================
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("读取本地数据失败", e);
  }
  return seed();
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("保存失败", e);
  }
}

// 首次使用的示例数据，便于直观感受
function seed() {
  const now = Date.now();
  return [
    {
      id: uid(), type: "title",
      content: "我把工资全存进了这个 App，3 个月后发生了什么",
      tags: ["理财", "悬念"], source: "对标账号 · 钱袋子",
      createdAt: now - 1000 * 60 * 60 * 5,
    },
    {
      id: uid(), type: "topic",
      content: "年轻人开始反向消费：为什么大家不爱买大牌了？",
      tags: ["消费趋势", "Z世代"], source: "",
      createdAt: now - 1000 * 60 * 60 * 28,
    },
    {
      id: uid(), type: "hook",
      content: "如果你也总是 3 分钟热度，这条一定要看到最后。",
      tags: ["开头钩子", "情绪"], source: "",
      createdAt: now - 1000 * 60 * 60 * 50,
    },
    {
      id: uid(), type: "data",
      content: "数据显示：带数字的标题点击率平均高出 36%。",
      tags: ["标题技巧"], source: "https://example.com/report",
      createdAt: now - 1000 * 60 * 60 * 73,
    },
  ];
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
//  渲染
// ============================================================
function typeMeta(id) {
  return TYPES.find((t) => t.id === id) || TYPES[0];
}

function renderNav() {
  categoryNav.innerHTML = "";
  CATEGORIES.forEach((cat) => {
    const count =
      cat.id === "all"
        ? items.length
        : items.filter((i) => i.type === cat.id).length;
    const btn = document.createElement("button");
    btn.className = "nav-item" + (cat.id === activeCategory ? " active" : "");
    btn.innerHTML = `
      <span class="nav-emoji">${cat.emoji}</span>
      <span class="nav-label">${cat.label}</span>
      <span class="nav-count">${count}</span>`;
    btn.addEventListener("click", () => {
      activeCategory = cat.id;
      activeTag = null;
      render();
    });
    categoryNav.appendChild(btn);
  });
  totalCount.textContent = items.length;
}

// 当前分类 + 搜索过滤后的条目（标签筛选条基于此集合生成）
function categoryFiltered() {
  return items.filter((i) => {
    if (activeCategory !== "all" && i.type !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inContent = i.content.toLowerCase().includes(q);
      const inTags = i.tags.some((t) => t.toLowerCase().includes(q));
      const inSource = (i.source || "").toLowerCase().includes(q);
      if (!inContent && !inTags && !inSource) return false;
    }
    return true;
  });
}

function renderTagFilter(base) {
  const tagSet = new Map();
  base.forEach((i) => i.tags.forEach((t) => tagSet.set(t, (tagSet.get(t) || 0) + 1)));
  tagFilter.innerHTML = "";
  if (tagSet.size === 0) return;

  const all = document.createElement("button");
  all.className = "filter-chip" + (activeTag === null ? " active" : "");
  all.textContent = "全部标签";
  all.addEventListener("click", () => { activeTag = null; render(); });
  tagFilter.appendChild(all);

  [...tagSet.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, n]) => {
      const chip = document.createElement("button");
      chip.className = "filter-chip" + (activeTag === tag ? " active" : "");
      chip.textContent = `${tag} · ${n}`;
      chip.addEventListener("click", () => {
        activeTag = activeTag === tag ? null : tag;
        render();
      });
      tagFilter.appendChild(chip);
    });
}

function renderCards(list) {
  cardGrid.innerHTML = "";
  list
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach((item) => cardGrid.appendChild(buildCard(item)));
}

function buildCard(item) {
  const meta = typeMeta(item.type);
  const card = document.createElement("article");
  card.className = "card";

  const tagsHtml = item.tags
    .map((t) => `<span class="card-tag">#${escapeHtml(t)}</span>`)
    .join("");

  const sourceHtml = item.source
    ? isUrl(item.source)
      ? `<a href="${escapeAttr(item.source)}" target="_blank" rel="noopener">🔗 来源</a>`
      : `📌 ${escapeHtml(item.source)}`
    : "";

  card.innerHTML = `
    <div class="card-top">
      <span class="card-type" style="background:${meta.color}1a;color:${meta.color}">
        ${meta.emoji} ${meta.label}
      </span>
      <div class="card-actions">
        <button class="icon-btn" title="复制" data-act="copy">⧉</button>
        <button class="icon-btn" title="编辑" data-act="edit">✎</button>
        <button class="icon-btn danger" title="删除" data-act="del">🗑</button>
      </div>
    </div>
    <div class="card-content">${escapeHtml(item.content)}</div>
    ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ""}
    <div class="card-foot">
      <span class="card-source">${sourceHtml}</span>
      <span class="card-date">${formatDate(item.createdAt)}</span>
    </div>`;

  card.querySelector('[data-act="copy"]').addEventListener("click", () => {
    copyText(item.content);
  });
  card.querySelector('[data-act="edit"]').addEventListener("click", () => {
    openModal(item.id);
  });
  card.querySelector('[data-act="del"]').addEventListener("click", () => {
    if (confirm("确定删除这条灵感？")) {
      items = items.filter((i) => i.id !== item.id);
      save();
      render();
      showToast("已删除");
    }
  });
  return card;
}

function render() {
  renderNav();
  const base = categoryFiltered();
  renderTagFilter(base);

  let list = base;
  if (activeTag) list = list.filter((i) => i.tags.includes(activeTag));

  const cat = CATEGORIES.find((c) => c.id === activeCategory);
  currentTitle.textContent = cat ? cat.label : "全部灵感";
  viewCount.textContent = list.length;

  const isEmpty = list.length === 0;
  cardGrid.hidden = isEmpty;
  emptyState.hidden = !isEmpty;
  if (!isEmpty) renderCards(list);
}

// ============================================================
//  弹窗（添加 / 编辑）
// ============================================================
function renderTypePicker() {
  typePicker.innerHTML = "";
  TYPES.forEach((t) => {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "type-option" + (t.id === draftType ? " selected" : "");
    opt.innerHTML = `${t.emoji} ${t.label}`;
    opt.addEventListener("click", () => {
      draftType = t.id;
      renderTypePicker();
    });
    typePicker.appendChild(opt);
  });
}

function renderDraftTags() {
  tagChips.innerHTML = "";
  draftTags.forEach((tag, idx) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `#${escapeHtml(tag)} <button type="button" aria-label="移除">✕</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      draftTags.splice(idx, 1);
      renderDraftTags();
    });
    tagChips.appendChild(chip);
  });
}

function commitTagInput() {
  const parts = tagInput.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  parts.forEach((p) => {
    if (!draftTags.includes(p)) draftTags.push(p);
  });
  tagInput.value = "";
  renderDraftTags();
}

function openModal(id = null) {
  editingId = id;
  if (id) {
    const item = items.find((i) => i.id === id);
    modalTitle.textContent = "编辑灵感";
    contentInput.value = item.content;
    sourceInput.value = item.source || "";
    draftTags = [...item.tags];
    draftType = item.type;
  } else {
    modalTitle.textContent = "添加灵感";
    contentInput.value = "";
    sourceInput.value = "";
    draftTags = [];
    // 默认用当前所在分类（「全部」时回退到好标题）
    draftType = activeCategory !== "all" ? activeCategory : "title";
  }
  tagInput.value = "";
  renderTypePicker();
  renderDraftTags();
  modalOverlay.hidden = false;
  setTimeout(() => contentInput.focus(), 50);
}

function closeModal() {
  modalOverlay.hidden = true;
  editingId = null;
}

function saveItem() {
  commitTagInput(); // 收尾未提交的标签输入
  const content = contentInput.value.trim();
  if (!content) {
    showToast("内容不能为空");
    contentInput.focus();
    return;
  }
  const source = sourceInput.value.trim();

  if (editingId) {
    const item = items.find((i) => i.id === editingId);
    item.content = content;
    item.tags = [...draftTags];
    item.type = draftType;
    item.source = source;
    item.updatedAt = Date.now();
    showToast("已更新");
  } else {
    items.push({
      id: uid(),
      type: draftType,
      content,
      tags: [...draftTags],
      source,
      createdAt: Date.now(),
    });
    showToast("已保存 ✨");
  }
  save();
  closeModal();
  render();
}

// ============================================================
//  工具
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

function isUrl(str) { return /^https?:\/\//i.test(str.trim()); }

function formatDate(ts) {
  const d = new Date(ts);
  const diff = Date.now() - ts;
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "刚刚";
  if (diff < hr) return Math.floor(diff / min) + " 分钟前";
  if (diff < day) return Math.floor(diff / hr) + " 小时前";
  if (diff < 7 * day) return Math.floor(diff / day) + " 天前";
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function copyText(text) {
  const done = () => showToast("已复制到剪贴板");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (e) {}
  document.body.removeChild(ta);
}

let toastTimer = null;
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
}

// ============================================================
//  事件绑定
// ============================================================
$("#addBtn").addEventListener("click", () => openModal());
$("#emptyAddBtn").addEventListener("click", () => openModal());
$("#modalClose").addEventListener("click", closeModal);
$("#cancelBtn").addEventListener("click", closeModal);
$("#saveBtn").addEventListener("click", saveItem);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

tagInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "," || e.key === "，") {
    e.preventDefault();
    commitTagInput();
  } else if (e.key === "Backspace" && tagInput.value === "" && draftTags.length) {
    draftTags.pop();
    renderDraftTags();
  }
});
tagInput.addEventListener("blur", commitTagInput);

searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim();
  activeTag = null;
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.hidden) closeModal();
  // Cmd/Ctrl + Enter 在弹窗中快速保存
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !modalOverlay.hidden) {
    saveItem();
  }
  // 按 "n" 快速新增（不在输入框时）
  if (e.key === "n" && modalOverlay.hidden &&
      !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    openModal();
  }
});

// ---------- 启动 ----------
render();

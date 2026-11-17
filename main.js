/* amaimelon-custom-emoji - built with esbuild */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CustomEmojiPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_language = require("@codemirror/language");
var DEFAULT_SETTINGS = {
  emojiFolder: "emoji",
  emojiSizeEm: 1.4,
  aliases: {
    smile: ["\u7B11\u9854", "\u306B\u3053\u306B\u3053", "\u3046\u308C\u3057\u3044"],
    laugh: ["\u5927\u7B11\u3044", "\u308F\u3089\u3046"],
    sleepy: ["\u304A\u3084\u3059\u307F", "\u306D\u3080\u3044"],
    surprise: ["\u9A5A\u304D", "\u3073\u3063\u304F\u308A"],
    thinking: ["\u8003\u3048\u4E2D", "\u3046\u30FC\u3093"],
    shy: ["\u7167\u308C", "\u306F\u305A\u304B\u3057\u3044"],
    sorry: ["\u3054\u3081\u3093", "\u56F0\u3063\u305F"],
    sulk: ["\u3080\u3063", "\u3059\u306D\u308B", "\u62D7\u306D"],
    ok: ["\u4E86\u89E3", "\u30AA\u30C3\u30B1\u30FC", "\u6210\u529F"],
    sad: ["\u60B2\u3057\u3044", "\u3057\u3087\u3093\u307C\u308A", "\u6B8B\u5FF5"]
  }
};
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "apng",
  "avif",
  "bmp"
]);
var SHORTCODE_RE = /:([^\s:]{1,64}):/g;
var CustomEmojiPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.emojiMap = /* @__PURE__ */ new Map();
  }
  async onload() {
    await this.loadSettings();
    this.applyEmojiSize();
    this.refreshEmojiMap();
    this.registerEvent(
      this.app.vault.on("create", (f) => this.maybeRefresh(f.path))
    );
    this.registerEvent(
      this.app.vault.on("delete", (f) => this.maybeRefresh(f.path))
    );
    this.registerEvent(
      this.app.vault.on("rename", (f, oldPath) => {
        this.maybeRefresh(f.path);
        this.maybeRefresh(oldPath);
      })
    );
    this.registerEditorSuggest(new EmojiEditorSuggest(this));
    this.registerMarkdownPostProcessor((el) => this.processReadingView(el));
    this.registerEditorExtension(buildEmojiViewPlugin(this));
    this.addCommand({
      id: "insert-custom-emoji",
      name: "\u30AB\u30B9\u30BF\u30E0\u7D75\u6587\u5B57\u3092\u633F\u5165",
      editorCallback: (editor) => {
        new EmojiPickModal(this, editor).open();
      }
    });
    this.addCommand({
      id: "rescan-custom-emoji",
      name: "\u30AB\u30B9\u30BF\u30E0\u7D75\u6587\u5B57\u3092\u518D\u8AAD\u307F\u8FBC\u307F",
      callback: () => {
        this.refreshEmojiMap();
        new import_obsidian.Notice(`\u30AB\u30B9\u30BF\u30E0\u7D75\u6587\u5B57\u3092 ${this.emojiMap.size} \u4EF6\u8AAD\u307F\u8FBC\u307F\u307E\u3057\u305F`);
      }
    });
    this.addSettingTab(new CustomEmojiSettingTab(this.app, this));
  }
  async loadSettings() {
    var _a;
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data != null ? data : {});
    this.settings.aliases = Object.assign(
      {},
      DEFAULT_SETTINGS.aliases,
      (_a = data == null ? void 0 : data.aliases) != null ? _a : {}
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  applyEmojiSize() {
    document.body.style.setProperty(
      "--amaimelon-emoji-size",
      `${this.settings.emojiSizeEm}em`
    );
  }
  folderPath() {
    return this.settings.emojiFolder.replace(/^\/+|\/+$/g, "");
  }
  maybeRefresh(path) {
    const folder = this.folderPath();
    if (path === folder || path.startsWith(folder + "/")) {
      this.refreshEmojiMap();
    }
  }
  refreshEmojiMap() {
    const folder = this.folderPath();
    this.emojiMap.clear();
    for (const file of this.app.vault.getFiles()) {
      if (!file.path.startsWith(folder + "/")) continue;
      if (!IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) continue;
      if (!this.emojiMap.has(file.basename)) {
        this.emojiMap.set(file.basename, file);
      }
    }
  }
  resourcePath(name) {
    const file = this.emojiMap.get(name);
    return file ? this.app.vault.getResourcePath(file) : null;
  }
  searchEmoji(query) {
    var _a;
    const q = query.trim().toLowerCase();
    const entries = [...this.emojiMap.entries()].map(
      ([name, file]) => ({ name, file })
    );
    if (!q) return entries.sort((a, b) => a.name.localeCompare(b.name));
    const scored = [];
    for (const e of entries) {
      const name = e.name.toLowerCase();
      const aliases = ((_a = this.settings.aliases[e.name]) != null ? _a : []).map(
        (a) => a.toLowerCase()
      );
      let score = -1;
      if (name === q) score = 0;
      else if (name.startsWith(q)) score = 1;
      else if (name.includes(q)) score = 2;
      else if (aliases.some((a) => a.startsWith(q))) score = 3;
      else if (aliases.some((a) => a.includes(q))) score = 4;
      if (score >= 0) scored.push({ e, score });
    }
    scored.sort(
      (a, b) => a.score - b.score || a.e.name.localeCompare(b.e.name)
    );
    return scored.map((s) => s.e);
  }
  /* ---------------- リーディングビュー ---------------- */
  processReadingView(el) {
    if (this.emojiMap.size === 0) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        var _a;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("code, pre, a")) return NodeFilter.FILTER_REJECT;
        const value = (_a = node.nodeValue) != null ? _a : "";
        return value.includes(":") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    let current;
    while (current = walker.nextNode()) textNodes.push(current);
    for (const node of textNodes) this.replaceTextNode(node);
  }
  replaceTextNode(node) {
    var _a;
    const text = (_a = node.nodeValue) != null ? _a : "";
    SHORTCODE_RE.lastIndex = 0;
    let match;
    let lastIndex = 0;
    let fragment = null;
    while ((match = SHORTCODE_RE.exec(text)) !== null) {
      const src = this.resourcePath(match[1]);
      if (!src) continue;
      if (!fragment) fragment = document.createDocumentFragment();
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );
      }
      const span = document.createElement("span");
      span.className = "amaimelon-emoji";
      span.style.backgroundImage = `url("${src.replace(/"/g, "%22")}")`;
      span.title = match[0];
      span.setAttribute("role", "img");
      span.setAttribute("aria-label", match[0]);
      fragment.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
    if (fragment) {
      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.replaceWith(fragment);
    }
  }
};
var EmojiWidget = class extends import_view.WidgetType {
  constructor(emojiName, src) {
    super();
    this.emojiName = emojiName;
    this.src = src;
  }
  eq(other) {
    return other.emojiName === this.emojiName && other.src === this.src;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "amaimelon-emoji";
    span.style.backgroundImage = `url("${this.src.replace(/"/g, "%22")}")`;
    span.title = `:${this.emojiName}:`;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", `:${this.emojiName}:`);
    return span;
  }
  ignoreEvent() {
    return false;
  }
};
function buildEmojiViewPlugin(plugin) {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = import_view.Decoration.none;
        this.decorations = this.build(view);
      }
      update(update) {
        this.decorations = this.build(update.view);
      }
      build(view) {
        if (plugin.emojiMap.size === 0) return import_view.Decoration.none;
        if (!view.dom.closest(".is-live-preview")) return import_view.Decoration.none;
        const builder = new import_state.RangeSetBuilder();
        const tree = (0, import_language.syntaxTree)(view.state);
        const selectionRanges = view.state.selection.ranges;
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          SHORTCODE_RE.lastIndex = 0;
          let m;
          while ((m = SHORTCODE_RE.exec(text)) !== null) {
            const src = plugin.resourcePath(m[1]);
            if (!src) continue;
            const start = from + m.index;
            const end = start + m[0].length;
            if (selectionRanges.some((r) => r.from <= end && r.to >= start)) {
              continue;
            }
            try {
              const node = tree.resolveInner(start, 1);
              if (node && node.type.name.toLowerCase().includes("code")) {
                continue;
              }
            } catch (e) {
            }
            builder.add(
              start,
              end,
              import_view.Decoration.replace({
                widget: new EmojiWidget(m[1], src),
                inclusive: false
              })
            );
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}
var EmojiEditorSuggest = class extends import_obsidian.EditorSuggest {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }
  onTrigger(cursor, editor, _file) {
    if (this.plugin.emojiMap.size === 0) return null;
    const line = editor.getLine(cursor.line);
    const before = line.substring(0, cursor.ch);
    const match = before.match(/[:：]([^\s:：]{0,32})$/);
    if (!match) return null;
    const query = match[1];
    const colonPos = cursor.ch - query.length - 1;
    if (colonPos > 0) {
      const prev = before[colonPos - 1];
      if (/[0-9A-Za-z]/.test(prev)) return null;
      if (prev === ":") {
        const upto = before.slice(0, colonPos);
        if (!/:([^\s:：]{1,64}):$/.test(upto)) return null;
      }
    }
    return {
      start: { line: cursor.line, ch: colonPos },
      end: cursor,
      query
    };
  }
  getSuggestions(context) {
    return this.plugin.searchEmoji(context.query).slice(0, 24);
  }
  renderSuggestion(item, el) {
    el.classList.add("amaimelon-emoji-suggest-item");
    const img = el.createEl("img", { cls: "amaimelon-emoji-suggest-img" });
    img.src = this.plugin.app.vault.getResourcePath(item.file);
    img.alt = item.name;
    el.createSpan({ cls: "amaimelon-emoji-suggest-name", text: `:${item.name}:` });
    const aliases = this.plugin.settings.aliases[item.name];
    if (aliases && aliases.length > 0) {
      el.createSpan({
        cls: "amaimelon-emoji-suggest-alias",
        text: aliases.join(" ")
      });
    }
  }
  selectSuggestion(item, _evt) {
    const context = this.context;
    if (!context) return;
    context.editor.replaceRange(
      `:${item.name}:`,
      context.start,
      context.end
    );
  }
};
var EmojiPickModal = class extends import_obsidian.FuzzySuggestModal {
  constructor(plugin, editor) {
    super(plugin.app);
    this.plugin = plugin;
    this.editor = editor;
    this.setPlaceholder("\u7D75\u6587\u5B57\u3092\u691C\u7D22\u2026\uFF08\u540D\u524D\u30FB\u30AD\u30FC\u30EF\u30FC\u30C9\uFF09");
  }
  getItems() {
    return [...this.plugin.emojiMap.entries()].map(([name, file]) => ({
      name,
      file
    }));
  }
  getItemText(item) {
    var _a;
    const aliases = (_a = this.plugin.settings.aliases[item.name]) != null ? _a : [];
    return `${item.name} ${aliases.join(" ")}`;
  }
  renderSuggestion(match, el) {
    el.classList.add("amaimelon-emoji-suggest-item");
    const img = el.createEl("img", { cls: "amaimelon-emoji-suggest-img" });
    img.src = this.plugin.app.vault.getResourcePath(match.item.file);
    img.alt = match.item.name;
    el.createSpan({
      cls: "amaimelon-emoji-suggest-name",
      text: `:${match.item.name}:`
    });
  }
  onChooseItem(item) {
    this.editor.replaceSelection(`:${item.name}:`);
  }
};
var CustomEmojiSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u30AB\u30B9\u30BF\u30E0\u7D75\u6587\u5B57" });
    containerEl.createEl("p", {
      text: `\u7D75\u6587\u5B57\u30D5\u30A9\u30EB\u30C0\u306B\u753B\u50CF\u30D5\u30A1\u30A4\u30EB\u3092\u5165\u308C\u308B\u3060\u3051\u3067\u3001:\u540D\u524D: \u3067\u4F7F\u3048\u308B\u3088\u3046\u306B\u306A\u308A\u307E\u3059\uFF08\u30D5\u30A1\u30A4\u30EB\u540D\u304C\u7D75\u6587\u5B57\u540D\u306B\u306A\u308A\u307E\u3059\uFF09\u3002\u73FE\u5728 ${this.plugin.emojiMap.size} \u4EF6\u306E\u7D75\u6587\u5B57\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059\u3002`
    });
    new import_obsidian.Setting(containerEl).setName("\u7D75\u6587\u5B57\u30D5\u30A9\u30EB\u30C0").setDesc("\u4FDD\u7BA1\u5EAB\u306E\u4E2D\u306E\u30D5\u30A9\u30EB\u30C0\u540D\uFF08\u3053\u306E\u30D5\u30A9\u30EB\u30C0\u76F4\u4E0B\u306E\u753B\u50CF\u304C\u7D75\u6587\u5B57\u306B\u306A\u308A\u307E\u3059\uFF09").addText(
      (text) => text.setPlaceholder("emoji").setValue(this.plugin.settings.emojiFolder).onChange(async (value) => {
        this.plugin.settings.emojiFolder = value.trim() || "emoji";
        await this.plugin.saveSettings();
        this.plugin.refreshEmojiMap();
      })
    );
    new import_obsidian.Setting(containerEl).setName("\u7D75\u6587\u5B57\u306E\u5927\u304D\u3055").setDesc("\u6587\u5B57\u306B\u5BFE\u3059\u308B\u7D75\u6587\u5B57\u306E\u9AD8\u3055\uFF08em\uFF09").addSlider(
      (slider) => slider.setLimits(0.8, 2.5, 0.1).setValue(this.plugin.settings.emojiSizeEm).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.emojiSizeEm = value;
        await this.plugin.saveSettings();
        this.plugin.applyEmojiSize();
      })
    );
    containerEl.createEl("h3", { text: "\u30AD\u30FC\u30EF\u30FC\u30C9\uFF08\u5225\u540D\uFF09" });
    containerEl.createEl("p", {
      text: "\u7D75\u6587\u5B57\u3054\u3068\u306B\u691C\u7D22\u7528\u306E\u30AD\u30FC\u30EF\u30FC\u30C9\u3092\u4ED8\u3051\u3089\u308C\u307E\u3059\u3002\u30AB\u30F3\u30DE\u533A\u5207\u308A\u3067\u5165\u529B\u3059\u308B\u3068\u3001\u300C:\u300D\u3092\u6253\u3063\u305F\u3068\u304D\u306E\u5019\u88DC\u691C\u7D22\u3067\u30D2\u30C3\u30C8\u3059\u308B\u3088\u3046\u306B\u306A\u308A\u307E\u3059\u3002"
    });
    const names = [...this.plugin.emojiMap.keys()].sort(
      (a, b) => a.localeCompare(b)
    );
    for (const name of names) {
      const file = this.plugin.emojiMap.get(name);
      if (!file) continue;
      const setting = new import_obsidian.Setting(containerEl).setName(`:${name}:`);
      const img = document.createElement("img");
      img.src = this.app.vault.getResourcePath(file);
      img.className = "amaimelon-emoji-setting-img";
      img.alt = name;
      setting.nameEl.prepend(img);
      setting.addText((text) => {
        var _a;
        text.setPlaceholder("\u4F8B: \u7B11\u9854, \u306B\u3053\u306B\u3053").setValue(((_a = this.plugin.settings.aliases[name]) != null ? _a : []).join(", ")).onChange(async (value) => {
          const list = value.split(/[,、]/).map((s) => s.trim()).filter((s) => s.length > 0);
          if (list.length > 0) {
            this.plugin.settings.aliases[name] = list;
          } else {
            delete this.plugin.settings.aliases[name];
          }
          await this.plugin.saveSettings();
        });
      });
    }
  }
};

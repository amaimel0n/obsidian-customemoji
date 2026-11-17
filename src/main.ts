import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  FuzzyMatch,
  FuzzySuggestModal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/* ------------------------------------------------------------------ */
/* 設定                                                                */
/* ------------------------------------------------------------------ */

interface CustomEmojiSettings {
  emojiFolder: string;
  emojiSizeEm: number;
  aliases: Record<string, string[]>;
}

const DEFAULT_SETTINGS: CustomEmojiSettings = {
  emojiFolder: "emoji",
  emojiSizeEm: 1.4,
  aliases: {
    smile: ["笑顔", "にこにこ", "うれしい"],
    laugh: ["大笑い", "わらう"],
    sleepy: ["おやすみ", "ねむい"],
    surprise: ["驚き", "びっくり"],
    thinking: ["考え中", "うーん"],
    shy: ["照れ", "はずかしい"],
    sorry: ["ごめん", "困った"],
    sulk: ["むっ", "すねる", "拗ね"],
    ok: ["了解", "オッケー", "成功"],
    sad: ["悲しい", "しょんぼり", "残念"],
  },
};

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "apng",
  "avif",
  "bmp",
]);

/* :名前: の形。名前側は空白とコロンを含まない最大64文字 */
const SHORTCODE_RE = /:([^\s:]{1,64}):/g;

interface EmojiEntry {
  name: string;
  file: TFile;
}

/* ------------------------------------------------------------------ */
/* プラグイン本体                                                       */
/* ------------------------------------------------------------------ */

export default class CustomEmojiPlugin extends Plugin {
  settings: CustomEmojiSettings;
  emojiMap = new Map<string, TFile>();

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
      name: "カスタム絵文字を挿入",
      editorCallback: (editor) => {
        new EmojiPickModal(this, editor).open();
      },
    });
    this.addCommand({
      id: "rescan-custom-emoji",
      name: "カスタム絵文字を再読み込み",
      callback: () => {
        this.refreshEmojiMap();
        new Notice(`カスタム絵文字を ${this.emojiMap.size} 件読み込みました`);
      },
    });

    this.addSettingTab(new CustomEmojiSettingTab(this.app, this));
  }

  async loadSettings() {
    const data = (await this.loadData()) as Partial<CustomEmojiSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data ?? {});
    this.settings.aliases = Object.assign(
      {},
      DEFAULT_SETTINGS.aliases,
      data?.aliases ?? {}
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

  folderPath(): string {
    return this.settings.emojiFolder.replace(/^\/+|\/+$/g, "");
  }

  maybeRefresh(path: string) {
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

  resourcePath(name: string): string | null {
    const file = this.emojiMap.get(name);
    return file ? this.app.vault.getResourcePath(file) : null;
  }

  searchEmoji(query: string): EmojiEntry[] {
    const q = query.trim().toLowerCase();
    const entries: EmojiEntry[] = [...this.emojiMap.entries()].map(
      ([name, file]) => ({ name, file })
    );
    if (!q) return entries.sort((a, b) => a.name.localeCompare(b.name));
    const scored: { e: EmojiEntry; score: number }[] = [];
    for (const e of entries) {
      const name = e.name.toLowerCase();
      const aliases = (this.settings.aliases[e.name] ?? []).map((a) =>
        a.toLowerCase()
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

  processReadingView(el: HTMLElement) {
    if (this.emojiMap.size === 0) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("code, pre, a")) return NodeFilter.FILTER_REJECT;
        const value = node.nodeValue ?? "";
        return value.includes(":")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    const textNodes: Text[] = [];
    let current: Node | null;
    while ((current = walker.nextNode())) textNodes.push(current as Text);
    for (const node of textNodes) this.replaceTextNode(node);
  }

  private replaceTextNode(node: Text) {
    const text = node.nodeValue ?? "";
    SHORTCODE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    let fragment: DocumentFragment | null = null;
    while ((match = SHORTCODE_RE.exec(text)) !== null) {
      const src = this.resourcePath(match[1]);
      if (!src) continue;
      if (!fragment) fragment = document.createDocumentFragment();
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index))
        );
      }
      /* imgタグだとテーマや他のプラグインの「画像」用スタイルを拾って
         ブロック画像みたいな見た目になってしまうため、背景画像のspanで描く */
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
}

/* ------------------------------------------------------------------ */
/* ライブプレビュー（CodeMirror 6）                                    */
/* ------------------------------------------------------------------ */

class EmojiWidget extends WidgetType {
  constructor(private emojiName: string, private src: string) {
    super();
  }
  eq(other: EmojiWidget): boolean {
    return other.emojiName === this.emojiName && other.src === this.src;
  }
  toDOM(): HTMLElement {
    /* リーディングビューと同じく背景画像spanで描く。
       imgだとテーマ等の画像用スタイルを拾ってブロック画像化してしまうため */
    const span = document.createElement("span");
    span.className = "amaimelon-emoji";
    span.style.backgroundImage = `url("${this.src.replace(/"/g, "%22")}")`;
    span.title = `:${this.emojiName}:`;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", `:${this.emojiName}:`);
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

function buildEmojiViewPlugin(plugin: CustomEmojiPlugin) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        this.decorations = this.build(update.view);
      }

      build(view: EditorView): DecorationSet {
        if (plugin.emojiMap.size === 0) return Decoration.none;
        /* ライブプレビューのときだけ画像に置き換える。
           ソースモードでは :名前: の文字のまま見せる */
        if (!view.dom.closest(".is-live-preview")) return Decoration.none;
        const builder = new RangeSetBuilder<Decoration>();
        const tree = syntaxTree(view.state);
        const selectionRanges = view.state.selection.ranges;
        for (const { from, to } of view.visibleRanges) {
          const text = view.state.doc.sliceString(from, to);
          SHORTCODE_RE.lastIndex = 0;
          let m: RegExpExecArray | null;
          while ((m = SHORTCODE_RE.exec(text)) !== null) {
            const src = plugin.resourcePath(m[1]);
            if (!src) continue;
            const start = from + m.index;
            const end = start + m[0].length;
            /* カーソルが重なっている箇所は編集できるよう、そのままにする */
            if (
              selectionRanges.some((r) => r.from <= end && r.to >= start)
            ) {
              continue;
            }
            /* コードの中は置き換えない */
            try {
              const node = tree.resolveInner(start, 1);
              if (node && node.type.name.toLowerCase().includes("code")) {
                continue;
              }
            } catch {
              /* 構文ツリーが未完成なときはそのまま置き換える */
            }
            builder.add(
              start,
              end,
              Decoration.replace({
                widget: new EmojiWidget(m[1], src),
                inclusive: false,
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

/* ------------------------------------------------------------------ */
/* 「:」入力時の候補ポップアップ                                        */
/* ------------------------------------------------------------------ */

class EmojiEditorSuggest extends EditorSuggest<EmojiEntry> {
  constructor(private plugin: CustomEmojiPlugin) {
    super(plugin.app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null
  ): EditorSuggestTriggerInfo | null {
    if (this.plugin.emojiMap.size === 0) return null;
    const line = editor.getLine(cursor.line);
    const before = line.substring(0, cursor.ch);
    /* 行末にある ':' または '：' を起点にする。クエリは空白とコロンを含まない最大32文字 */
    const match = before.match(/[:：]([^\s:：]{0,32})$/);
    if (!match) return null;
    const query = match[1];
    const colonPos = cursor.ch - query.length - 1;
    if (colonPos > 0) {
      const prev = before[colonPos - 1];
      /* 時刻（12:30）や URL（http:）や英単語の直後では出さない。
         日本語の文字や句読点の直後では出す */
      if (/[0-9A-Za-z]/.test(prev)) return null;
      if (prev === ":") {
        /* 絵文字を続けて打つ場合（:smile: の直後）だけ許可し、
           Dataview の key:: value のような書き方では出さない */
        const upto = before.slice(0, colonPos);
        if (!/:([^\s:：]{1,64}):$/.test(upto)) return null;
      }
    }
    return {
      start: { line: cursor.line, ch: colonPos },
      end: cursor,
      query,
    };
  }

  getSuggestions(context: EditorSuggestContext): EmojiEntry[] {
    return this.plugin.searchEmoji(context.query).slice(0, 24);
  }

  renderSuggestion(item: EmojiEntry, el: HTMLElement) {
    el.classList.add("amaimelon-emoji-suggest-item");
    const img = el.createEl("img", { cls: "amaimelon-emoji-suggest-img" });
    img.src = this.plugin.app.vault.getResourcePath(item.file);
    img.alt = item.name;
    el.createSpan({ cls: "amaimelon-emoji-suggest-name", text: `:${item.name}:` });
    const aliases = this.plugin.settings.aliases[item.name];
    if (aliases && aliases.length > 0) {
      el.createSpan({
        cls: "amaimelon-emoji-suggest-alias",
        text: aliases.join(" "),
      });
    }
  }

  selectSuggestion(item: EmojiEntry, _evt: MouseEvent | KeyboardEvent) {
    const context = this.context;
    if (!context) return;
    context.editor.replaceRange(
      `:${item.name}:`,
      context.start,
      context.end
    );
  }
}

/* ------------------------------------------------------------------ */
/* コマンド用：検索して選ぶモーダル                                     */
/* ------------------------------------------------------------------ */

class EmojiPickModal extends FuzzySuggestModal<EmojiEntry> {
  constructor(private plugin: CustomEmojiPlugin, private editor: Editor) {
    super(plugin.app);
    this.setPlaceholder("絵文字を検索…（名前・キーワード）");
  }

  getItems(): EmojiEntry[] {
    return [...this.plugin.emojiMap.entries()].map(([name, file]) => ({
      name,
      file,
    }));
  }

  getItemText(item: EmojiEntry): string {
    const aliases = this.plugin.settings.aliases[item.name] ?? [];
    return `${item.name} ${aliases.join(" ")}`;
  }

  renderSuggestion(match: FuzzyMatch<EmojiEntry>, el: HTMLElement) {
    el.classList.add("amaimelon-emoji-suggest-item");
    const img = el.createEl("img", { cls: "amaimelon-emoji-suggest-img" });
    img.src = this.plugin.app.vault.getResourcePath(match.item.file);
    img.alt = match.item.name;
    el.createSpan({
      cls: "amaimelon-emoji-suggest-name",
      text: `:${match.item.name}:`,
    });
  }

  onChooseItem(item: EmojiEntry) {
    this.editor.replaceSelection(`:${item.name}:`);
  }
}

/* ------------------------------------------------------------------ */
/* 設定タブ                                                            */
/* ------------------------------------------------------------------ */

class CustomEmojiSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CustomEmojiPlugin) {
    super(app, plugin);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "カスタム絵文字" });
    containerEl.createEl("p", {
      text: `絵文字フォルダに画像ファイルを入れるだけで、:名前: で使えるようになります（ファイル名が絵文字名になります）。現在 ${this.plugin.emojiMap.size} 件の絵文字が登録されています。`,
    });

    new Setting(containerEl)
      .setName("絵文字フォルダ")
      .setDesc("保管庫の中のフォルダ名（このフォルダ直下の画像が絵文字になります）")
      .addText((text) =>
        text
          .setPlaceholder("emoji")
          .setValue(this.plugin.settings.emojiFolder)
          .onChange(async (value) => {
            this.plugin.settings.emojiFolder = value.trim() || "emoji";
            await this.plugin.saveSettings();
            this.plugin.refreshEmojiMap();
          })
      );

    new Setting(containerEl)
      .setName("絵文字の大きさ")
      .setDesc("文字に対する絵文字の高さ（em）")
      .addSlider((slider) =>
        slider
          .setLimits(0.8, 2.5, 0.1)
          .setValue(this.plugin.settings.emojiSizeEm)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.emojiSizeEm = value;
            await this.plugin.saveSettings();
            this.plugin.applyEmojiSize();
          })
      );

    containerEl.createEl("h3", { text: "キーワード（別名）" });
    containerEl.createEl("p", {
      text: "絵文字ごとに検索用のキーワードを付けられます。カンマ区切りで入力すると、「:」を打ったときの候補検索でヒットするようになります。",
    });

    const names = [...this.plugin.emojiMap.keys()].sort((a, b) =>
      a.localeCompare(b)
    );
    for (const name of names) {
      const file = this.plugin.emojiMap.get(name);
      if (!file) continue;
      const setting = new Setting(containerEl).setName(`:${name}:`);
      const img = document.createElement("img");
      img.src = this.app.vault.getResourcePath(file);
      img.className = "amaimelon-emoji-setting-img";
      img.alt = name;
      setting.nameEl.prepend(img);
      setting.addText((text) => {
        text
          .setPlaceholder("例: 笑顔, にこにこ")
          .setValue((this.plugin.settings.aliases[name] ?? []).join(", "))
          .onChange(async (value) => {
            const list = value
              .split(/[,、]/)
              .map((s) => s.trim())
              .filter((s) => s.length > 0);
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
}

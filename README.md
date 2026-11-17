# カスタム絵文字（Misskey風） / Custom Emoji (Misskey-style)

Obsidian で Misskey のようなカスタム絵文字が使えるプラグインです。

フォルダに画像ファイルを入れるだけで、そのファイル名が絵文字名として自動で登録されます。ノートに `:名前:` と書くと絵文字として表示され、本文には短いショートコードだけが残るので、ソースモードでも読みやすいままです。

An Obsidian plugin for Misskey-style custom emoji. Drop image files into a folder — each file name becomes an emoji name automatically. Write `:name:` in a note and it renders as the emoji, while the source keeps only the shortcode, so Source mode stays clean and readable.

## 特徴 / Features

- **入れるだけ登録** — 専用フォルダに画像を入れるだけで自動登録。ファイルの追加・削除・名前変更にも自動で追随します
- **`:` で候補ポップアップ** — `:` を打つとサムネイル付きの候補が出て、絵文字名とキーワード（別名）で検索できます。日本語の文章の直後に打っても候補が出ます（時刻 `12:30` や URL の直後では出ません）
- **ノートには `:名前:` だけ** — 画像タグが本文に埋め込まれないので、改行や見た目が崩れません
- **ライブプレビュー／リーディングビューの両対応**
- **対応形式** — png / jpg / jpeg / gif / webp / svg / bmp / avif / apng（アニメーション GIF・APNG もそのまま動きます）

- **Zero setup** — images dropped into the emoji folder are registered automatically, including later additions, deletions, and renames
- **Suggestion popup** — typing `:` opens a thumbnail popup, searchable by emoji name and custom keywords (aliases). It also triggers right after Japanese text, but not after times like `12:30` or URLs
- **Shortcodes only in your notes** — no long image tags are embedded, so line breaks and layout never break
- **Works in both Live Preview and Reading view**

## 使い方 / Usage

1. プラグインを有効にします
2. 設定で「絵文字フォルダ」を指定します（初期値は保管庫直下の `emoji` フォルダ）
3. そのフォルダに画像ファイルを入れます（例: `smile.png`）
4. ノートに `:smile:` と書くと絵文字として表示されます

1. Enable the plugin
2. Choose your emoji folder in the settings (default: an `emoji` folder at the vault root)
3. Put image files in that folder (e.g. `smile.png`)
4. Write `:smile:` in a note — it renders as the emoji

### 設定 / Settings

- **絵文字フォルダ** — 絵文字画像を置くフォルダ（保管庫内のパス）
- **絵文字の大きさ** — 文字に対する絵文字の高さ（em）
- **キーワード（別名）** — 絵文字ごとに検索用キーワードをカンマ区切りで付けられます（例: `:100yen:` に「お金、コイン」など）

コマンドパレットから「カスタム絵文字を挿入」（検索モーダル）と「カスタム絵文字を再読み込み」も使えます。

## インストール / Installation

コミュニティプラグインへの登録が完了するまでは、手動インストールが可能です。

1. GitHub の Release から `main.js`、`manifest.json`、`styles.css` をダウンロード
2. 保管庫の `.obsidian/plugins/hamu-custom-emoji/` フォルダに入れる
3. Obsidian の設定 → コミュニティプラグインで「カスタム絵文字（Misskey風）」を ON にする

Until it is listed in the community plugins, manual installation is available: download `main.js`, `manifest.json`, and `styles.css` from the GitHub Release, place them in `.obsidian/plugins/hamu-custom-emoji/` in your vault, and enable the plugin under Settings → Community plugins.

## ライセンス / License

MIT License

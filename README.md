# VSCode Edit Logger

VSCodeの編集ログをMarkdown形式で収集する拡張機能です。開発者のコード編集プロセスを記録し、後学習用のデータセットを作成することを目的としています。

## 機能

- **編集イベント収集**: 文書の開始、変更、選択イベントを自動収集
- **デバウンス機能**: 1200msのアイドル時間後に編集セッションを保存
- **Markdown形式保存**: Zeta形式と互換性のある構造で保存
- **秘匿情報マスキング**: APIキーやパスワードなどを自動的にマスキング
- **柔軟な設定**: 収集対象/除外ファイルの設定が可能

## インストール

1. このリポジトリをクローン
2. `npm install` で依存パッケージをインストール
3. `npm run compile` でTypeScriptをコンパイル
4. VSCodeでこのフォルダを開き、F5キーでデバッグモードを起動

## 使用方法

1. コマンドパレットを開き（Ctrl+Shift+P）、`Edit Logger: ログ収集を開始/停止` を実行
2. または、サイドバーの「Edit Logger」パネルから操作できます
3. 対象ファイルを編集すると、自動的に編集ログが保存されます

### アクティビティバー機能

拡張機能を有効にすると、アクティビティバー（左端のアイコンバー）にEdit Loggerアイコンが表示されます：

1. アクティビティバーのEdit Loggerアイコンをクリック
2. サイドパネルにGUIが表示されます：

- **ステータス表示**: 現在のログ収集状態を表示
- **操作ボタン**: ログ収集の開始/停止
- **統計情報**: アクティブセッション数、保存済みセッション数
- **設定表示**: 現在の設定値
- **操作メニュー**: データセットフォルダを開く、更新ボタン

パネルのタイトルバーには以下のボタンがあります：
- 🔄 更新ボタン: パネルの情報を更新
- 📂 フォルダを開くボタン: データセット保存先フォルダを開く

## 設定

VSCodeの設定で以下のオプションを変更できます：

- `editLogger.datasetRoot`: データセットの保存先ルートディレクトリ（デフォルト: `dataset`）
- `editLogger.debounceMs`: 編集イベントのデバウンス時間（デフォルト: `1200`ms）
- `editLogger.contextLines`: diffのコンテキスト行数（デフォルト: `20`）
- `editLogger.includePatterns`: 収集対象のファイルパターン
- `editLogger.excludePatterns`: 収集除外のファイルパターン
- `editLogger.enableMasking`: 秘匿情報のマスキングを有効にする（デフォルト: `true`）
- `editLogger.maskPatterns`: マスキング対象のパターン（正規表現）

## 出力形式

各編集セッションは以下のMarkdown形式で保存されます：

```markdown
---
timestamp: 2024-01-01T12:00:00.000Z
source_file: /path/to/file.js
event_count: 3
duration_ms: 1500
---

## events

- 0ms: insert at line 10
- 500ms: replace at line 15
- 1000ms: delete at line 20

## input

```
// 編集前のコード
function hello() {
    console.log("Hello");
}
```

## output

```
// 編集後のコード
function hello() {
    console.log("Hello World");
}
```

## assertions

- カーソル位置: 15:25
- 編集イベント数: 3
- 編集時間: 1500ms
```

## セキュリティ

- すべてのデータはローカルに保存されます
- 外部への送信は行いません
- 秘匿情報は自動的にマスキングされます
- デフォルトで機密情報を含む可能性のあるファイルは除外されます

## 開発

```bash
# 依存パッケージのインストール
npm install

# コンパイル
npm run compile

# ウォッチモードでコンパイル
npm run watch

# リント
npm run lint
```

## ライセンス

MIT
# VSCode Edit Logger

VSCodeの編集操作を記録し、AI学習用データセットとして保存するVisual Studio Code拡張機能です。

## 機能

- **編集ログの記録**: テキストの入力、削除、置換操作を自動的に記録
- **マスキング機能**: APIキーやパスワードなどの機密情報を自動的にマスキング
- **ファイルフィルタリング**: 記録対象のファイルをパターンで指定可能
- **コンテキスト保存**: 指定したファイル（package.json等）をコンテキスト情報として保存
- **サイドバー表示**: 拡張機能の状態や統計情報をサイドバーで表示
- **デバウンス処理**: 連続した編集操作をまとめて記録

## インストール方法

1. このリポジトリをクローン
2. VSCodeで開く
3. `F5`キーを押してデバッグ実行
4. 拡張開発ホストが起動したら、`Ctrl+Shift+P`でコマンドパレットを開き、「Edit Logger: ログ収集を開始/停止」を実行

## 設定

VSCodeの設定（settings.json）から以下の設定を変更できます：

```json
{
  "editLogger.datasetRoot": "dataset",
  "editLogger.includePatterns": [],
  "editLogger.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/venv/**"
  ],
  "editLogger.enableMasking": true,
  "editLogger.maskPatterns": [
    "api[_-]?key",
    "secret[_-]?key",
    "password",
    "token",
    "auth[_-]?token",
    "bearer[_-]?token",
    "access[_-]?token",
    "refresh[_-]?token"
  ],
  "editLogger.historySize": 5,
  "editLogger.debounceMs": 1000,
  "editLogger.contextFiles": []
}
```

### 設定項目の説明

- **datasetRoot**: データセットの保存先ディレクトリ（デフォルト: `dataset`）
- **includePatterns**: 記録対象のファイルパターン（空の場合は除外パターンに該当しないすべてのテキストファイルを対象）
- **excludePatterns**: 記録除外のファイルパターン
- **enableMasking**: 機密情報のマスキングを有効化（デフォルト: true）
- **maskPatterns**: マスキング対象の正規表現パターン
- **historySize**: 記録する過去のイベント数（デフォルト: 5）
- **debounceMs**: 編集操作のデバウンス時間（ミリ秒、デフォルト: 1000）
- **contextFiles**: コンテキストとして保存するファイル名のリスト

## 使用方法

### 基本的な使い方

1. コマンドパレット（`Ctrl+Shift+P`）から「Edit Logger: ログ収集を開始/停止」を選択
2. 通常通りコーディングを行う
3. 編集操作が自動的に記録される

### サイドバーの機能

- **ステータス表示**: 現在の記録状態（有効/無効）
- **収集開始/停止**: ログ記録のオン/オフ切り替え
- **統計情報**: 保存済みイベント数の表示
- **設定確認**: 現在の設定値の表示
- **データセットフォルダを開く**: 保存先フォルダを開く
- **コンテキストファイルを設定**: コンテキストとして保存するファイルを指定

### 出力形式

データセットは以下のJSON形式で保存されます：

```json
{
  "fileContent": "ファイルの内容",
  "fileContentWithLines": "行番号付きのファイル内容",
  "context": {
    "package.json": "コンテキストファイルの内容",
    "README.md": "コンテキストファイルの内容"
  },
  "history": [
    {
      "timestamp": 1640995200000,
      "eventType": "text_input",
      "eventText": "入力されたテキスト",
      "fileName": "example.js",
      "lineNumbers": {
        "start": 10,
        "end": 15,
        "current": 12
      },
      "hunks": "unified diff形式の変更内容"
    }
  ]
}
```

## 開発

### プロジェクトの構成

```
src/
├── extension.ts          # 拡張機能のエントリーポイント
├── EditLogger.ts         # メインのロジック
├── sidebarProvider.ts    # サイドバーのUI
├── config/               # 設定管理
│   ├── ConfigManager.ts
│   └── ConfigHandler.ts
├── events/               # イベント管理
│   └── EventManager.ts
├── types.ts              # 型定義
├── constants.ts          # 定数
├── errors.ts             # エラー定義
└── utils/                # ユーティリティ
    ├── FileUtils.ts
    ├── DiffUtils.ts
    ├── JsonExporter.ts
    ├── MaskingUtils.ts
    ├── ErrorHandler.ts
    └── EventHistory.ts
```

### ビルドと実行

```bash
# コンパイル
npm run compile

# ウォッチモードでコンパイル
npm run watch

# リント
npm run lint
```

## ライセンス

MIT
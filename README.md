# VSCode Edit Logger

VSCodeの編集操作を記録し、LLMの学習用データを生成するツール

## 概要

このリポジトリは2つの主要コンポーネントで構成されています：

1. **VSCode拡張機能** (`vscode-extension/`) - VSCode内の編集操作を記録
2. **Pythonトレーニングスクリプト** (`python-training/`) - 記録されたデータからLLM学習用データセットを構築

## ディレクトリ構成

```
vscode-edit-logger/
├── vscode-extension/     # VSCode拡張機能
│   ├── src/              # 拡張機能のソースコード
│   ├── dataset/          # 記録されたログデータ
│   ├── dataset_example/  # データセットの例
│   └── resources/        # リソースファイル
└── dataset/      
    └── README.md        # 詳細な説明
```

## インストールと使用方法

### VSCode拡張機能

1. `vscode-extension/` ディレクトリに移動
2. `npm install` で依存パッケージをインストール
3. F5キーでデバッグ実行

### Pythonトレーニングスクリプト

1. `python-training/` ディレクトリに移動
2. `pip install -r requirements.txt` で依存パッケージをインストール
3. `python main.py` で実行

## 詳細

各コンポーネントの詳細については、各ディレクトリのREADME.mdを参照してください。
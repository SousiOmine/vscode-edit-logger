import json
import argparse
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
try:
    import tomllib  # Python 3.11+
except ImportError:
    try:
        import tomli as tomllib  # fallback
    except ImportError:
        tomllib = None
try:
    import tomli_w
except ImportError:
    tomli_w = None

SYSTEM_PROMPT = """
あなたは、ユーザーの操作するエディタの次の編集を予測する「Next Edit Prediction Model」です。
エディタでは現在、`{0}`というファイルが開かれています。

開かれている`{0}`と、ユーザーが過去に行った編集履歴を提供します。次に行われる編集を予測してください。

編集内容の予測は、以下の形式で回答してください。
以下のdiffフォーマットで編集内容を記述してください。

例えば、UserControlを10行目で閉じる手前にStackPanelとTextBlockを追加すると予測した場合、以下のようになります。
-   9:
-  10: </UserControl>
-  11:
+   9:     <StackPanel>
+  10:         <TextBlock Text="{Binding KariText}"/>
+  11:     </StackPanel>
+  12: </UserControl>
+  13:

17行目のKariTextをpropertyInfo.IdentifierとpropertyInfo.Typeを連結するよう編集すると予測した場合、以下のようになります。
-  17:         KariText = propertyInfo.Identifier;
-  18:     }
-  19:
-  20: }
+  17:         KariText = propertyInfo.Identifier + propertyInfo.Type;
+  18:     }
+  19:
+  20: }
""".replace("{", "{{").replace("}", "}}").replace("{{0}}", "{0}")


class DiffGenerator:
    """diff形式の文字列を生成するクラス"""
    
    @staticmethod
    def hunks_to_diff(hunks: List[Dict[str, Any]], line_numbers: Optional[Dict[str, int]] = None) -> str:
        """hunksをdiff形式の文字列に変換（行番号付き）"""
        diff_lines = []
        for hunk in hunks:
            old_start = hunk.get("old_start", 1)
            new_start = hunk.get("new_start", 1)
            
            actual_old_start, actual_new_start = DiffGenerator._calculate_line_positions(
                old_start, new_start, line_numbers
            )
            
            # ヘッダー情報を追加
            # diff_lines.append(f"@@ -{actual_old_start},? +{actual_new_start},? @@\n")
            
            # 行の処理
            old_line_num = actual_old_start
            new_line_num = actual_new_start
            prev_op = None
            
            for line in hunk["lines"]:
                line_output, old_line_num, new_line_num, prev_op = DiffGenerator._process_line(
                    line, old_line_num, new_line_num, prev_op
                )
                if line_output:
                    diff_lines.append(line_output)
        
        return "".join(diff_lines)
    
    @staticmethod
    def _calculate_line_positions(old_start: int, new_start: int, 
                                line_numbers: Optional[Dict[str, int]]) -> Tuple[int, int]:
        """実際のファイル内の行位置を計算"""
        if line_numbers:
            actual_old_start = line_numbers["start"] + old_start - 1
            actual_new_start = line_numbers["start"] + new_start - 1
            return actual_old_start, actual_new_start
        return old_start, new_start
    
    @staticmethod
    def _process_line(line: Dict[str, Any], old_line_num: int, new_line_num: int, 
                     prev_op: Optional[str]) -> Tuple[Optional[str], int, int, Optional[str]]:
        """個別の行を処理してdiff出力を生成"""
        op = line["op"]
        text = line["text"]
        
        # 改行文字を削除
        text = text.rstrip('\r\n')
        
        if op == "delete":
            output = f"-{old_line_num:4d}: {text}\n"
            if prev_op == "insert":
                output = "\n" + output
            return output, old_line_num + 1, new_line_num, "delete"
        elif op == "insert":
            output = f"+{new_line_num:4d}: {text}\n"
            if prev_op == "delete":
                output = "\n" + output
            return output, old_line_num, new_line_num + 1, "insert"
        elif op == "context":
            return f" {old_line_num:4d}: {text}\n", old_line_num + 1, new_line_num + 1, "context"
        
        return None, old_line_num, new_line_num, prev_op


class ChatMLFormatter:
    """ChatML形式のデータをフォーマットするクラス"""
    
    @staticmethod
    def format_readable(conversations: List[Dict[str, Any]]) -> str:
        """ChatML形式のデータを読みやすい形式に変換"""
        output_lines = []
        
        for i, conv in enumerate(conversations, 1):
            output_lines.append(f"=== 会話 {i} ===\n")
            
            for msg in conv["messages"]:
                role = msg["role"]
                content = msg["content"]
                
                if role == "system":
                    output_lines.append(f"[システム]")
                    output_lines.append(content)
                elif role == "user":
                    output_lines.append(f"\n[ユーザー]")
                    output_lines.append(content)
                elif role == "assistant":
                    output_lines.append(f"\n[アシスタント]")
                    output_lines.append(content)
            
            output_lines.append("\n" + "="*50 + "\n")
        
        return "\n".join(output_lines)


class LogProcessor:
    """ログファイルを処理してChatML形式のデータセットを生成するクラス"""
    
    def __init__(self, debug: bool = False):
        self.debug = debug
    
    def process_log_file(self, log_file_path: Path) -> List[Dict[str, Any]]:
        """ログファイルを処理してChatML形式のデータセットを生成"""
        data = self._load_json_file(log_file_path)
        file_histories = self._group_by_file(data)
        all_entries = self._sort_entries_by_timestamp(file_histories)
        
        if not all_entries:
            return []
        
        return self._generate_conversation(all_entries, data)
    
    def _load_json_file(self, file_path: Path) -> Dict[str, Any]:
        """JSONファイルを読み込む"""
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def _group_by_file(self, data: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        """ファイルごとに編集履歴をグループ化"""
        file_histories = {}
        
        for entry in data.get("history", []):
            file_name = entry.get("fileName", "")
            if not file_name or not entry.get("hunks"):
                continue
                
            if file_name not in file_histories:
                file_histories[file_name] = []
            file_histories[file_name].append(entry)
        
        return file_histories
    
    def _sort_entries_by_timestamp(self, file_histories: Dict[str, List[Dict[str, Any]]]) -> List[Tuple[str, Dict[str, Any]]]:
        """全編集履歴をタイムスタンプ順にソート"""
        all_entries = []
        for file_name, entries in file_histories.items():
            for entry in entries:
                all_entries.append((file_name, entry))
        
        return sorted(all_entries, key=lambda x: x[1]["timestamp"])
    
    def _generate_conversation(self, all_entries: List[Tuple[str, Dict[str, Any]]], log_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """会話例を生成"""
        conversations = []
        
        # userとassistantのコンテンツを生成
        user_content = self._generate_user_content(all_entries[:-1], log_data)
        assistant_content = self._generate_assistant_content(all_entries[-1])
        
        # 会話例を作成
        conversation = {
            "messages": [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT.format(all_entries[-1][0])
                },
                {
                    "role": "user",
                    "content": user_content
                },
                {
                    "role": "assistant",
                    "content": assistant_content
                }
            ]
        }
        conversations.append(conversation)
        
        return conversations
    
    def _generate_user_content(self, entries: List[Tuple[str, Dict[str, Any]]], log_data: Dict[str, Any]) -> str:
        """ユーザーメッセージのコンテンツを生成"""
        content = ""
        
        # fileContentを先頭に追加（diff形式に統一）
        if "fileContent" in log_data:
            content += "現在開かれているファイルの内容:\n"
            content += self._format_file_content_as_diff(log_data["fileContent"])
            content += "\n\n"
        
        content += "以下が、直近でユーザーがエディタ上で行った変更です。\n\n"
        
        for i, (file_name, entry) in enumerate(entries):
            if self.debug:
                print(f"User編集履歴 {i+1}: ファイル={file_name}, タイムスタンプ={entry['timestamp']}")
            
            content += f"<edit file=\"{file_name}\">\n"
            line_numbers = entry.get("lineNumbers")
            for hunk_idx, hunk in enumerate(entry["hunks"], 1):
                content += DiffGenerator.hunks_to_diff([hunk], line_numbers)
            content += "\n</edit>\n"
        
        return content
    
    def _generate_assistant_content(self, latest_entry: Tuple[str, Dict[str, Any]]) -> str:
        """アシスタントメッセージのコンテンツを生成"""
        latest_file_name, latest_entry_data = latest_entry
        
        if self.debug:
            print(f"Assistant編集履歴: ファイル={latest_file_name}, タイムスタンプ={latest_entry_data['timestamp']}")
        
        content = ""
        # content += f"<edit file=\"{latest_file_name}\">\n"
        line_numbers = latest_entry_data.get("lineNumbers")
        
        for hunk_idx, hunk in enumerate(latest_entry_data["hunks"], 1):
            content += DiffGenerator.hunks_to_diff([hunk], line_numbers)
        
        # content += "\n</edit>\n"
        return content
    
    def _format_file_content_as_diff(self, file_content: str) -> str:
        """ファイル内容をdiff形式（行番号付き）に変換"""
        lines = file_content.splitlines()
        diff_lines = []
        
        for i, line in enumerate(lines, 1):
            # コンテキスト行としてフォーマット（スペースで始まり、行番号付き）
            diff_lines.append(f" {i:4d}: {line}")
        
        return "\n".join(diff_lines)


class OutputWriter:
    """出力形式ごとにデータを書き込むクラス"""
    
    @staticmethod
    def write_json(conversations: List[Dict[str, Any]], output_path: Path) -> None:
        """JSON形式で出力"""
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(conversations, f, ensure_ascii=False, indent=2)
    
    @staticmethod
    def write_readable(conversations: List[Dict[str, Any]], output_path: Path) -> None:
        """可読性の高い形式で出力"""
        readable_content = ChatMLFormatter.format_readable(conversations)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(readable_content)
    
    @staticmethod
    def write_toml(conversations: List[Dict[str, Any]], output_path: Path) -> None:
        """TOML形式で出力"""
        if tomli_w is None:
            print("エラー: TOML出力には 'tomli-w' パッケージが必要です。'pip install tomli-w' でインストールしてください。", file=sys.stderr)
            sys.exit(1)
        
        with open(output_path, "w", encoding="utf-8") as f:
            OutputWriter._write_toml_content(f, conversations)
    
    @staticmethod
    def _write_toml_content(file_handle, conversations: List[Dict[str, Any]]) -> None:
        """TOML形式のコンテンツを書き込む"""
        file_handle.write("[[conversations]]\n\n")
        
        for i, conv in enumerate(conversations):
            if i > 0:
                file_handle.write("\n")
            
            for msg in conv["messages"]:
                file_handle.write('[[conversations.messages]]\n')
                file_handle.write(f'role = "{msg["role"]}"\n')
                
                content = msg["content"]
                if "\n" in content:
                    # 複数行文字列として書き込み
                    file_handle.write('content = """\n')
                    file_handle.write(content)
                    file_handle.write('"""\n')
                else:
                    # エスケープが必要な文字を処理
                    escaped_content = content.replace('"', '\\"')
                    file_handle.write(f'content = "{escaped_content}"\n')
                
                file_handle.write("\n")


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="VSCode拡張のログファイルからChatML形式のデータセットを生成")
    parser.add_argument("log_file", help="入力ログファイルのパス")
    parser.add_argument("--debug", action="store_true", help="デバッグ情報を出力")
    parser.add_argument("--readable", action="store_true", help="可読性の高い形式で出力")
    parser.add_argument("--toml", action="store_true", help="TOML形式で出力")
    args = parser.parse_args()
    
    # 入力ファイルの存在確認
    log_file_path = Path(args.log_file)
    if not log_file_path.exists():
        print(f"エラー: ファイルが見つかりません: {log_file_path}", file=sys.stderr)
        sys.exit(1)
    
    # データセットを生成
    processor = LogProcessor(debug=args.debug)
    conversations = processor.process_log_file(log_file_path)
    
    # 出力形式を選択して書き込み
    if args.toml:
        output_path = Path("output.toml")
        OutputWriter.write_toml(conversations, output_path)
        output_format = "TOML"
    elif args.readable:
        output_path = Path("output.txt")
        OutputWriter.write_readable(conversations, output_path)
        output_format = "可読性の高いテキスト形式"
    else:
        output_path = Path("output.json")
        OutputWriter.write_json(conversations, output_path)
        output_format = "JSON"
    
    # 結果を出力
    print(f"データセットを生成しました: {output_path}")
    print(f"生成された会話数: {len(conversations)}")
    print(f"出力形式: {output_format}")


if __name__ == "__main__":
    main()

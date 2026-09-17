# masaya — サロン経営管理サイト

自分専用のマネジメントポータル。GitHub Pagesで公開、データはSupabaseに保存。

## 公開URL

- ポータル（入口）: https://m-business-gif.github.io/masaya/
- 業務報告（毎日の時間単位ログ・TODO・メモ・スプレッドシート連携）: https://m-business-gif.github.io/masaya/report.html
- 売上ダッシュボード（サロンボードCSVの取り込み・分析）: https://m-business-gif.github.io/masaya/dashboard.html

## 構成

- ソースは `web-dashboard/` 配下（`index.html`=ポータル、`dashboard.html`=売上ダッシュボード、`report.html`=業務報告）。ビルド不要の静的ページ。
- デプロイは `.github/workflows/deploy-web-dashboard.yml`（`web-dashboard/**` への push で自動実行、GitHub Pages に公開）。
- デフォルトブランチは `claude/inventory-management-system-ENHEm`。作業ブランチ `claude/modest-edison-0xe5m2` からPRを作成し、ユーザーがマージする運用（直接pushはしない）。
- データベースはSupabase（無料枠）。テーブルは `sales_docs` / `settings_docs` / `report_docs`（いずれも `id text primary key, data jsonb, updated_at`、RLSでpublic read/insert/update許可）。
- 業務報告ページのスプレッドシート連携は、Googleスプレッドシート「山田雅也業務報告シート」（ID: `1h-bsBXx5xVKBqPKIJoG8gQahFBF9Jb4Dq27XDtbmTZ4`）の月別タブ（例: `2026/09`）と、手動の「この日を同期」ボタンでのみやり取りする。OAuthクライアントIDは `report.html` 内の `GOOGLE_CLIENT_ID` に設定済み。

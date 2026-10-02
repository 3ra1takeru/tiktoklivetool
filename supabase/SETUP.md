# リスナー情報のクラウド移行

## 初回設定

1. Supabaseにログインし、Freeプランでプロジェクトを作成します。DBパスワードは所有者が設定します。
2. SQL Editorで `listener-storage.sql` を実行します。個人データを移す前に、このアクセス制限の設定を完了してください。
3. Authentication → URL Configurationで Site URL を `https://tiktoklivetool.vercel.app` に設定し、同じURLをRedirect URLsに登録します。ローカル検証時のみ `http://localhost:5173` も追加します。
4. Project URLとPublishable keyをVercelの環境変数 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY` に設定し、再デプロイします。両方は公開接続設定です。secret/service_roleキーは使いません。初期テストにはアプリの「クラウド保存」から端末ごとの設定もできます。
5. ツールの「クラウド保存」で所有者のメールへログインメールを送り、この端末でメール内のリンクを開きます。Supabase管理画面のログインと、ツールの利用者ログインは別です。標準メール配信には宛先・送信数制限があるため、本番で利用者を増やす場合はSMTPも設定します。
6. 「クラウド保存」の表示と管理画面の読み込みを確認し、iCloudに保存済みのJSONを「リスナー管理 → バックアップを復元」で取り込みます。
7. iPadとパソコンで同じメールでログインし、登録人数、生年月日、チャット履歴が一致することを確認します。

## 保存動作

- 接続設定後のリスナー情報・チャットはSupabaseだけに保存します。旧ブラウザー保存へのフォールバックはありません。
- 既存のブラウザーデータは削除しません。クラウド設定前は従来の保存を維持します。移行前にバックアップを保存してください。
- ブラウザーに残るのは接続設定・ログイン状態・読み上げなどの設定です。リスナーのクラウドデータは画面を開いている間のメモリーだけで扱います。
- サイトを開いて接続している間のコメントを記録します。サイトを閉じている間の監視は今回の変更に含みません。
- 利用者ごとにRLSでデータを分離し、未ログインでは読むことも書くこともできません。secret/service_roleキーをブラウザーへ渡しません。
- `customer_id` は将来のLINE連携用にも使用できる固定UUIDです。表示名一致だけでTikTokとLINEの顧客を統合しません。
- Supabase無料枠の容量・休止条件があります。長期運用時は公式の最新料金を確認してください。

## 検証

- `npm run build`
- `npm run lint`
- `node tests/cloud-rls.mjs`: 正確なテーブル・ポリシーSQLをPGliteのPostgresで実行し、本人の読み書き、他アカウント隔離、未認証アクセス拒否、削除拒否を検証します。Supabase Authの認証処理はこのテストでは模擬します。
- `server/node_modules/.bin/tsx tests/cloud-storage.mjs`: Supabase SDKを模擬RESTサービスに接続し、保存・読込・重複防止・書込失敗・関係ない別端末の編集保持を検証します。
- `server/node_modules/.bin/tsx tests/listener-history.mjs`
- `server/node_modules/.bin/tsx tests/listener-backup.mjs`

実際のクラウドへの切り替え完了と判断するには、手順7の実環境確認が必要です。

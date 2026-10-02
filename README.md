# TikTok LIVE「星のカンペ」

React/Viteの画面と、Socket.IO/TikTok接続を担当するNode.jsサーバーです。

## パソコンで起動

Node.js 22.12以上を使用してください。

```sh
npm ci
npm --prefix server ci
cp .env.example .env
cp server/.env.example server/.env
npm run dev
```

Viteに表示されるURLを開きます。設定画面にサーバーURLを以前保存した場合は、`http://localhost:5001`に変更してください。鑑定には`server/.env`の`GEMINI_API_KEY`が必要です。

TikTokの表示名ではなく、プロフィールの`@ユーザーID`を入力します。プロフィールURLと`https://www.tiktok.com/@ユーザーID/live`も入力できます。中継サーバーへの接続と、TikTok LIVEへの接続は別です。

## 公開サーバーの復旧

2026年10月2日の確認では、旧標準URL `https://tiktok-live-tool-server.onrender.com`は404でした。実際に使用中の `https://tiktoklivetool.onrender.com` は正常稼働していますが、旧サーバーでは`okawa_ai`へのLIVE接続が失敗しました。更新したConnector 2.5.0では同アカウントへの接続に成功しました。画面の標準URLを実際のサーバーURLに修正しています。

1. RenderでこのGitHubリポジトリからWeb Serviceを作成または復旧します。`render.yaml`が設定のひな型です。
2. Root Directory: `server`、Build: `npm ci && npm run build`、Start: `npm start`。Node.js 22を使用します。
3. 必要な環境変数をRenderに設定します。署名サービスの認証・利用制限エラーが出る場合は`EULER_STREAM_API_KEY`を確認します。
4. サーバーの`/health`が`status: ok`を返すことを確認します。
5. Vercelに`VITE_API_URL`として稼働サーバーURLを設定して再デプロイします。ブラウザに保存したサーバーURLは環境変数より優先するため、設定画面も更新します。
6. 配信中のユーザーIDでLIVE接続し、実際のコメント・ギフト受信を確認します。

## 検証

```sh
npm run build
npm --prefix server run build
# 別ターミナルで npm --prefix server start を実行
node tests/connection-smoke.mjs
```

このテストはHTTP・Socket.IO・入力エラー・切断・模擬コメントを確認します。実際のTikTok接続成功の検証には配信中のアカウントが必要です。

```sh
node tests/live-connection.mjs https://www.tiktok.com/@okawa_ai/live
```

2026年10月2日、修正版サーバー経由で`okawa_ai`への接続と実際のコメント受信（本文・表示名・ユーザーID）に成功しました。ギフト一覧の事前取得は署名サービスのBusinessプランを要求したため無効にしています。ギフトイベント本体の名前・ダイヤ数を使用します。実際のギフト受信は未検証です。

## RenderでルームID取得に失敗する場合

通常のTikTok取得経路に失敗した場合のみ、Vercelの`/api/tiktok-room`で配信ルームIDを取得し、署名サービス経由で接続します。補助APIはTikTokの固定URLのみ参照し、ユーザーIDとルームIDの形式を検証します。TikTokの応答本文や認証情報は公開しません。RenderとVercel双方のデプロイが必要です。

```sh
node tests/live-connection.mjs https://www.tiktok.com/@okawa_ai/live --force-room-fallback
```

このテストはRenderでのルームID取得失敗を再現し、公開Vercelの補助API経由で実際のLIVE接続とコメント受信を検証します。配信中のアカウントが必要です。

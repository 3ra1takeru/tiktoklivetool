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

2026年10月2日の確認では、画面の標準URL `https://tiktok-live-tool-server.onrender.com`は404を返し、`x-render-routing: no-server`でした。別のサーバーURLを設定している場合は、そのサーバーも確認してください。

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

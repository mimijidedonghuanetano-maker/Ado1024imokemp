Ado 応援メッセージサイト（Netlify版）

元はCloudflare Workers + D1版でしたが、Netlifyにそのままアップロードすることはできません
（Cloudflare WorkersとNetlifyは実行環境が別物のため）。
そこで以下のように置き換えてあります。

- Cloudflare Workers        → Netlify Functions（netlify/functions/api.js）
- Cloudflare D1（SQL）      → Netlify Blobs（キーと値だけのデータ保存。追加登録不要、クレカ不要）
- 静的HTML配信（Worker経由） → publicフォルダをそのまま静的配信

機能・挙動（支援者数の即時反映、投稿は30分後に公開対象、管理画面での確認・削除、
管理パスワードをブラウザに置かない）はすべて元のまま動きます。
ただしNetlify Blobsは全投稿を1つのJSONとして読み書きする単純な作りのため、
同時アクセスが非常に多い場合は元のD1版より不利です。個人の応援サイト程度の
アクセス規模であれば問題ありません。

構成
- public/index.html    … 投稿ページ
- public/admin.html    … 管理画面
- netlify/functions/api.js … /api/* を処理するFunction
- netlify.toml          … 公開フォルダ・Functionフォルダ・リダイレクト設定
- package.json           … Netlify Blobsを使うための依存関係

デプロイ手順

1. Netlifyアカウントを作成（クレジットカード登録は不要）
2. このフォルダを丸ごとZIPにして、Netlifyの「Add new site」→
   「Deploy manually」の画面にドラッグ＆ドロップ
   （もしくはGitHubリポジトリにpushしてNetlify連携でもOK）
3. 管理パスワードは初期状態で "Ado1024loveforever" が設定済みなので、
   このままでも/admin.htmlにログインできる
   （変更したい場合は Site configuration → Environment variables で
   ADMIN_PASSWORD を追加・上書きし、Deploys → Trigger deploy で再デプロイする）

管理画面
https://あなたのサイト.netlify.app/admin.html

注意
- 初期パスワードはコードに直接書いてあるため、公開リポジトリ等に置く場合は
  Environment variablesで上書きすることを推奨
- Netlify Blobsは自動で有効になるため追加設定は不要
- この版ではXアカウントの本人確認はしていないため、X IDは自己申告
- Xプロフィール画像の取得は入れていない

本番前に追加推奨
- bot対策（Netlify製のTurnstile相当機能など）
- 同一X IDの短時間連投制限
- 運営向けの投稿検索・CSV出力
- 画像アイコン表示

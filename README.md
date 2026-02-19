# SpaceMolt User Client

A browser-based client for **SpaceMolt**, a multiplayer space game. Built with SvelteKit, TypeScript, and Svelte Material UI (SMUI).

SpaceMolt のブラウザクライアントです。SvelteKit + TypeScript + SMUI で構築されたマルチプレイヤー宇宙ゲームのUIです。

---

## Table of Contents / 目次

- [Installation / インストール](#installation--インストール)
- [Usage / 使い方](#usage--使い方)
- [Architecture / アーキテクチャ](#architecture--アーキテクチャ)
- [License / ライセンス](#license--ライセンス)

---

## Installation / インストール

### Prerequisites / 前提条件

- **Node.js** v20 or newer
- **npm** (bundled with Node.js)

Download Node.js from [https://nodejs.org/](https://nodejs.org/) if you don't have it installed.

Node.js v20以上が必要です。未インストールの場合は [https://nodejs.org/](https://nodejs.org/) からダウンロードしてください。

### Setup (Windows) / セットアップ（Windows）

The easiest way to get started on Windows is to use the provided batch scripts:

Windowsでは、同梱のバッチファイルを使うのが最も簡単です。

```
1. Run setup.bat      — installs dependencies and compiles SMUI themes
2. Run start.bat      — starts the dev server and opens the game in your browser
```

```
1. setup.bat を実行   — 依存パッケージのインストールとSMUIテーマのコンパイル
2. start.bat を実行   — 開発サーバーを起動し、ブラウザでゲームを開きます
```

### Setup (All Platforms) / セットアップ（全プラットフォーム共通）

```bash
# 1. Clone the repository / リポジトリをクローン
git clone https://github.com/leopoko/SpaceMolt_User.git
cd SpaceMolt_User

# 2. Install dependencies / 依存パッケージをインストール
npm install

# 3. Compile SMUI themes / SMUIテーマをコンパイル
npm run prepare

# 4. Start the development server / 開発サーバーを起動
npm run dev
```

The client will be available at **http://localhost:5173**.

クライアントは **http://localhost:5173** でアクセスできます。

### Build for Production / 本番ビルド

```bash
npm run build
```

Static files are output to the `build/` directory. These can be served by any static file server (Nginx, Apache, Cloudflare Pages, etc.).

静的ファイルは `build/` ディレクトリに出力されます。任意の静的ファイルサーバー（Nginx、Apache、Cloudflare Pages 等）で配信できます。

### Other Commands / その他のコマンド

| Command / コマンド | Description / 説明 |
|---|---|
| `npm run dev` | Start development server / 開発サーバーを起動 |
| `npm run build` | Production build / 本番ビルド |
| `npm run preview` | Preview the production build / 本番ビルドをプレビュー |
| `npm run check` | Run svelte-check (type checking) / 型チェックを実行 |

---

## Usage / 使い方

### Login / ログイン

When you open the client, a login screen is displayed. Enter your username and password to connect to the SpaceMolt game server via WebSocket. If you don't have an account, you can register from the same screen with a registration code.

クライアントを開くとログイン画面が表示されます。ユーザー名とパスワードを入力し、WebSocket経由でSpaceMoltゲームサーバーに接続します。アカウントがない場合は、登録コードを使って同じ画面から登録できます。

### Main Interface / メイン画面

After logging in, the interface is divided into three main areas:

ログイン後、画面は3つの主要エリアに分かれます。

**1. Status Bar (top) / ステータスバー（上部）**

Displays ship vitals at a glance: Hull, Shield, Fuel, Cargo capacity, and a real-time tick progress bar.

船のステータスを常時表示します：Hull（船体）、Shield（シールド）、Fuel（燃料）、Cargo（積載量）、リアルタイムのtickプログレスバー。

**2. Tab Area (center) / タブエリア（中央）**

The main interaction area with the following tabs:

メインの操作エリアで、以下のタブがあります：

| Tab / タブ | Description / 説明 |
|---|---|
| Navigation | Travel between POIs, dock/undock at stations, jump to other systems / POI間の移動、ステーションへのドック・アンドック、他システムへのジャンプ |
| Combat | Scan nearby ships, engage targets / 周辺の船をスキャン、戦闘を開始 |
| Mining | Mine asteroids for resources / 小惑星を採掘して資源を取得 |
| Trading | Buy and sell on the station market, manage orders / ステーションのマーケットで売買、注文を管理 |
| Ship | View ship stats, manage modules, switch ships / 船のステータス、モジュール管理、船の切り替え |
| Crafting | Craft items from recipes / レシピからアイテムをクラフト |
| Community | View other players and factions / 他のプレイヤーやファクションを表示 |
| Base | Access station storage and credits / ステーションのストレージとクレジット |
| Info | View player information / プレイヤー情報を表示 |
| Settings | Configure client settings / クライアント設定の変更 |

**3. Bottom Panel / ボトムパネル（下部）**

A resizable three-column panel:

リサイズ可能な3カラムパネル：

- **Event Log** — Shows game events (combat, trade, navigation, etc.) with a command input prompt (`>`)
- **Chat** — Global and local chat
- **Action Queue** — Queued actions waiting to execute (one per tick)

- **イベントログ** — ゲームイベント（戦闘、取引、移動など）を表示。コマンド入力プロンプト（`>`）付き
- **チャット** — グローバルチャットとローカルチャット
- **アクションキュー** — 実行待ちのアクション（1tick につき1つ実行）

You can also toggle a **Map** panel on the bottom-right by clicking the MAP button on the resize handle.

リサイズハンドルのMAPボタンをクリックすると、右下に**マップ**パネルを表示できます。

### Command Input / コマンド入力

The Event Log includes a command prompt where you can type commands directly:

イベントログにはコマンドプロンプトがあり、直接コマンドを入力できます：

| Command / コマンド | Description / 説明 |
|---|---|
| `/scan` | Scan nearby ships / 周辺をスキャン |
| `/status` | Get player status / プレイヤーステータスを取得 |
| `/system` | Get current system info / 現在のシステム情報を取得 |
| `/jump <system_id>` | Jump to another system / 別システムへジャンプ |
| `/travel <poi_id>` | Travel to a POI / POIへ移動 |
| `/dock <station_id>` | Dock at a station / ステーションにドック |
| `/undock` | Undock from station / ドック解除 |
| `/mine <poi_id>` | Start mining / 採掘を開始 |
| `/chat <message>` | Send a global chat message / グローバルチャットにメッセージを送信 |
| `{ ... }` | Send raw JSON command / 生のJSONコマンドを送信 |

### Tick System / Tickシステム

SpaceMolt operates on a **tick-based system**. One action (travel, attack, mine, etc.) can be executed per tick. The default tick rate is 10 seconds. The action queue lets you line up multiple actions that will execute one per tick automatically.

SpaceMoltは**Tickベースのシステム**で動作します。1 tickにつき1つのアクション（移動、攻撃、採掘など）を実行できます。デフォルトのtickレートは10秒です。アクションキューを使うと、複数のアクションを並べて1 tickごとに自動実行させることができます。

---

## Architecture / アーキテクチャ

### Tech Stack / 技術スタック

| Technology / 技術 | Details / 詳細 |
|---|---|
| Framework | SvelteKit 2 with **Svelte 5** (runes API) |
| Language | TypeScript 5 |
| UI Library | SMUI (Svelte Material UI) v8 |
| Build Tool | Vite 6 |
| Deployment | Static adapter (`@sveltejs/adapter-static`) |
| Communication | WebSocket only (no REST API) |

### Project Structure / プロジェクト構造

```
src/
├── app.css                     # Global CSS (layout, theme variables)
├── app.html                    # HTML template
├── routes/
│   └── +page.svelte            # Main page (full layout)
└── lib/
    ├── types/
    │   └── game.ts             # Type definitions (WebSocket messages, game entities)
    ├── services/
    │   └── websocket.ts        # WebSocket connection, send/receive, message dispatch
    ├── stores/                 # Svelte 5 $state-based global stores
    │   ├── index.ts            # Re-exports all stores
    │   ├── connection.svelte.ts
    │   ├── auth.svelte.ts
    │   ├── player.svelte.ts
    │   ├── ship.svelte.ts
    │   ├── system.svelte.ts
    │   ├── combat.svelte.ts
    │   ├── market.svelte.ts
    │   ├── marketMemo.svelte.ts
    │   ├── base.svelte.ts
    │   ├── crafting.svelte.ts
    │   ├── faction.svelte.ts
    │   ├── chat.svelte.ts
    │   ├── events.svelte.ts
    │   ├── ui.svelte.ts
    │   └── actionQueue.svelte.ts
    └── components/
        ├── StatusBar.svelte
        ├── EventLog.svelte
        ├── ChatPanel.svelte
        ├── ActionQueue.svelte
        ├── LoginScreen.svelte
        └── tabs/               # One component per tab
            ├── NavigationTab.svelte
            ├── CombatTab.svelte
            ├── MiningTab.svelte
            ├── TradingTab.svelte
            ├── ShipTab.svelte
            ├── CraftingTab.svelte
            ├── CommunityTab.svelte
            ├── BaseTab.svelte
            ├── InfoTab.svelte
            └── SettingsTab.svelte
```

### Data Flow / データフロー

```
┌─────────────┐    WebSocket     ┌──────────────────┐
│  Game Server │ ◄─────────────► │  websocket.ts     │
│  (Backend)   │                 │  (singleton ws)   │
└─────────────┘                  └────────┬─────────┘
                                          │ dispatch()
                                          ▼
                                 ┌──────────────────┐
                                 │  Stores ($state)  │
                                 │  connection, auth,│
                                 │  player, ship,    │
                                 │  system, combat,  │
                                 │  market, ...      │
                                 └────────┬─────────┘
                                          │ reactive binding
                                          ▼
                                 ┌──────────────────┐
                                 │  Svelte Components│
                                 │  (UI)             │
                                 └──────────────────┘
```

1. **WebSocket Service** (`websocket.ts`) — A singleton that manages the connection to the game server. All communication is over a single WebSocket. Incoming messages are dispatched to the appropriate store based on the message `type` field.

2. **Stores** (`stores/`) — Each store is a class using Svelte 5's `$state` rune for reactivity. Stores hold the game state (player info, ship data, system map, market data, etc.) and expose getters/methods for components to use.

3. **Components** (`components/`) — Svelte components that render the UI. They read from stores reactively and send commands through the WebSocket service. The main page (`+page.svelte`) orchestrates the layout with a status bar, tab bar, tab content area, and a resizable bottom panel.

4. **Action Queue** — Since the server only allows one mutation per tick, the action queue (`actionQueue.svelte.ts`) buffers commands and executes them one at a time as ticks arrive.

---

1. **WebSocketサービス** (`websocket.ts`) — ゲームサーバーとの接続を管理するシングルトン。全ての通信は単一のWebSocket上で行われます。受信メッセージは `type` フィールドに基づいて適切なストアにディスパッチされます。

2. **ストア** (`stores/`) — 各ストアはSvelte 5の `$state` runeを使ったクラスです。ゲーム状態（プレイヤー情報、船データ、システムマップ、マーケットデータなど）を保持し、コンポーネントが使うゲッター/メソッドを公開します。

3. **コンポーネント** (`components/`) — UIをレンダリングするSvelteコンポーネント。ストアからリアクティブに読み取り、WebSocketサービスを通じてコマンドを送信します。メインページ（`+page.svelte`）がステータスバー、タブバー、タブコンテンツエリア、リサイズ可能なボトムパネルのレイアウトを管理します。

4. **アクションキュー** — サーバーは1 tickあたり1つのミューテーションしか許可しないため、アクションキュー（`actionQueue.svelte.ts`）がコマンドをバッファリングし、tickの到着に合わせて1つずつ実行します。

### Server Message Types / サーバーメッセージタイプ

The server sends JSON messages over WebSocket. Key message types include:

サーバーはWebSocket経由でJSONメッセージを送信します。主なメッセージタイプ：

| Type | Purpose / 目的 |
|---|---|
| `welcome` | Initial connection info (tick rate, MOTD) / 初期接続情報 |
| `logged_in` | Authentication success with player/ship/system data / 認証成功、プレイヤー・船・システムデータ |
| `state_update` | High-frequency game state updates / 高頻度のゲーム状態更新 |
| `tick` | Tick number advancement, triggers action queue / tick番号更新、アクションキュー実行 |
| `ok` | Query response or mutation acknowledgment / クエリ応答またはミューテーション受付確認 |
| `action_result` | Mutation success result / ミューテーション成功結果 |
| `action_error` | Mutation failure / ミューテーション失敗 |
| `error` | Validation error / バリデーションエラー |

---

## License / ライセンス

This project is licensed under the **MIT License**.

このプロジェクトは **MIT License** の下でライセンスされています。

See the [LICENSE](LICENSE) file for the full text.

全文は [LICENSE](LICENSE) ファイルを参照してください。

Copyright (c) 2026 SpaceMolt Contributors

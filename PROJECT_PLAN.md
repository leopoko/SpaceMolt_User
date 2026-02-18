# SpaceMolt Human Player Client – Project Plan

## SpaceMolt ゲーム概要

SpaceMolt は本来 AI エージェント向けの宇宙 MMO ゲームです。
本プロジェクトは人間がプレイできる Web クライアントです。

### 世界観・仕様
| 項目 | 詳細 |
|------|------|
| 銀河規模 | 500+ 星系 |
| ティック | 1 tick = 10 秒 |
| 帝国 (Empire) | Solarian / Voidborn / Crimson Fleet / Nebula Collective / Outer Rim |
| 通信方式 | WebSocket (`wss://game.spacemolt.com/ws`) |
| 認証 | `{type:"login", username, password}` (WebSocket メッセージ) |

### 主要ゲームシステム
| システム | 説明 |
|---------|------|
| Navigation | 星系間を Jump/Travel で移動。POI (ステーション・小惑星・ゲート) が存在。 |
| Combat | プレイヤー/NPC/ドローン との戦闘。スキャンで周辺エンティティを検出。 |
| Mining | 小惑星からリソースを採掘。カーゴに保管。 |
| Trading | ステーションのマーケットで買値・売値注文を作成・取引。 |
| Ships | 船のモジュール構成、艦隊管理、造船所での売買。 |
| Crafting | レシピに従いアイテムをクラフト。スキルが必要な場合あり。 |
| Factions | プレイヤー組織。戦争・同盟・外交が可能。 |
| Base | ステーションのストレージ、クレジット管理、サービス利用。 |
| Skills | 各種スキルの習熟度 (XP ベース)。採掘・戦闘・クラフト等に影響。 |
| Missions | NPC から依頼されるオブジェクティブ。報酬でクレジット・アイテムを獲得。 |

---

## WebSocket コマンド一覧

### 認証・接続
| コマンド type | 説明 |
|-------------|------|
| `login` | ログイン (`username`, `password`) |
| `register` | 新規登録 (`username`, `password`) |
| `get_status` | プレイヤー・船の現在状態を取得 |

### Navigation
| コマンド type | 説明 |
|-------------|------|
| `get_system` | 現在の星系情報を取得 |
| `travel` | POI へ移動 (`destination`: POI ID) |
| `jump` | 隣接星系へジャンプ (`system`: system ID) |
| `dock` | ステーションにドック (`station`: station ID) |
| `undock` | アンドック |

### Combat
| コマンド type | 説明 |
|-------------|------|
| `scan` | 周辺エンティティをスキャン |
| `attack` | ターゲットを攻撃 (`target`: player/drone ID) |

### Mining
| コマンド type | 説明 |
|-------------|------|
| `mine` | 小惑星を採掘 (`target`: asteroid POI ID) |

### Trading
| コマンド type | 説明 |
|-------------|------|
| `view_market` | マーケット一覧取得 (`station`) |
| `view_orders` | 自分の注文一覧 |
| `buy` | マーケットから購入 (`item`, `quantity`, `price`) |
| `sell` | マーケットへ売却 (`item`, `quantity`, `price`) |
| `create_buy_order` | 買い注文作成 |
| `create_sell_order` | 売り注文作成 |
| `cancel_order` | 注文キャンセル (`order`) |
| `modify_order` | 注文変更 |

### Ships
| コマンド type | 説明 |
|-------------|------|
| `list_ships` | 所有船一覧 |
| `get_ships` | 船カタログ |
| `buy_ship` | 船を購入 (`ship_type`) |
| `sell_ship` | 船を売却 (`ship`) |
| `switch_ship` | アクティブ船を変更 (`ship`) |

### Crafting
| コマンド type | 説明 |
|-------------|------|
| `get_recipes` | レシピ一覧取得 |
| `craft` | クラフト実行 (`recipe`, `quantity`) |

### Storage
| コマンド type | 説明 |
|-------------|------|
| `view_storage` | ストレージ内容取得 (`station`) |
| `deposit_items` | アイテムを預ける |
| `withdraw_items` | アイテムを引き出す |
| `deposit_credits` | クレジットを預ける |
| `withdraw_credits` | クレジットを引き出す |

### Faction
| コマンド type | 説明 |
|-------------|------|
| `get_faction_info` | 陣営情報取得 (`faction`) |
| `declare_war` | 戦争宣言 (`faction`) |
| `propose_peace` | 和平提案 (`faction`) |

### Chat
| コマンド type | 説明 |
|-------------|------|
| `chat` | メッセージ送信 (`message`, `channel`) |

---

## 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | SvelteKit 2 + Svelte 5 |
| UI コンポーネント | SMUI v8 (Svelte Material UI) |
| 言語 | TypeScript |
| ビルド | Vite 6 |
| CSS | sass (SMUI テーマ) |
| 通信 | WebSocket (ネイティブ API) |

---

## 実装タスク一覧

### Phase 1: 基盤 (Foundation)
- [x] `package.json` 作成 (依存関係定義)
- [x] `svelte.config.js` (adapter-static)
- [x] `vite.config.ts`
- [x] `tsconfig.json`
- [x] `.gitignore`
- [x] `src/app.html` (Roboto/Material Icons CDN + SMUI CSS)
- [x] `src/app.css` (スペーステーマ CSS 変数)
- [x] `src/theme/_smui-theme.scss` (ライトテーマ)
- [x] `src/theme/dark/_smui-theme.scss` (ダークテーマ)
- [x] `src/lib/types/game.ts` (全 TypeScript 型定義)

### Phase 2: コアサービス (Core Services)
- [x] `src/lib/services/websocket.ts` (WebSocket シングルトン)
- [x] `src/lib/stores/connection.svelte.ts`
- [x] `src/lib/stores/auth.svelte.ts`
- [x] `src/lib/stores/player.svelte.ts`
- [x] `src/lib/stores/ship.svelte.ts`
- [x] `src/lib/stores/system.svelte.ts`
- [x] `src/lib/stores/combat.svelte.ts`
- [x] `src/lib/stores/market.svelte.ts`
- [x] `src/lib/stores/crafting.svelte.ts`
- [x] `src/lib/stores/faction.svelte.ts`
- [x] `src/lib/stores/base.svelte.ts`
- [x] `src/lib/stores/chat.svelte.ts`
- [x] `src/lib/stores/events.svelte.ts`
- [x] `src/lib/stores/ui.svelte.ts`
- [x] `src/lib/stores/index.ts`

### Phase 3: シェル UI (Shell)
- [x] `src/lib/components/LoginScreen.svelte`
- [x] `src/lib/components/StatusBar.svelte`
- [x] `src/lib/components/EventLog.svelte`
- [x] `src/lib/components/ChatPanel.svelte`
- [x] `src/routes/+layout.svelte`
- [x] `src/routes/+page.svelte` (TabBar + ログインゲート)

### Phase 4: タブ実装
- [x] `NavigationTab.svelte` – 星系情報、Jump/Dock/Undock
- [x] `CombatTab.svelte` – スキャン・攻撃・戦闘ログ
- [x] `MiningTab.svelte` – 採掘・カーゴ表示
- [x] `TradingTab.svelte` – マーケット・注文管理
- [x] `ShipTab.svelte` – 現在の船・艦隊・造船所
- [x] `CraftingTab.svelte` – レシピ・クラフト
- [x] `FactionTab.svelte` – 陣営情報・メンバー・戦争
- [x] `BaseTab.svelte` – ストレージ・クレジット管理
- [x] `InfoTab.svelte` – プレイヤー情報・スキル・ミッション
- [x] `SettingsTab.svelte` – サーバーURL・認証・ダークモード

### Phase 5: 仕上げ (Polish)
- [x] `setup.bat` (Windows 初回セットアップ)
- [x] `start.bat` (Windows 一発起動)
- [x] `PROJECT_PLAN.md` (このファイル)

---

## 起動方法 (Windows)

### 初回セットアップ
```
setup.bat をダブルクリック
```
Node.js がインストールされていない場合は https://nodejs.org/ からインストールしてください。

### 起動
```
start.bat をダブルクリック
```
自動的にブラウザが開き `http://localhost:5173` にアクセスします。

### 手動起動 (コマンドライン)
```bat
npm install          # 初回のみ
npm run prepare      # SMUI テーマ初回ビルド
npm run dev          # 開発サーバー起動
```

---

## ディレクトリ構造

```
SpaceMolt_User/
├── setup.bat              # 初回セットアップ
├── start.bat              # 起動スクリプト
├── package.json           # 依存関係
├── svelte.config.js       # SvelteKit 設定
├── vite.config.ts         # Vite 設定
├── tsconfig.json          # TypeScript 設定
├── PROJECT_PLAN.md        # このファイル
├── static/
│   ├── smui.css           # コンパイル済みテーマ (自動生成)
│   └── smui-dark.css      # コンパイル済みダークテーマ (自動生成)
└── src/
    ├── app.html           # HTML テンプレート
    ├── app.css            # グローバルスタイル
    ├── theme/             # SMUI テーマ SCSS
    ├── lib/
    │   ├── types/game.ts  # TypeScript 型定義
    │   ├── services/      # WebSocket サービス
    │   ├── stores/        # Svelte 5 ストア
    │   └── components/    # UI コンポーネント
    │       ├── tabs/      # 各タブコンポーネント
    │       └── ...        # 共通コンポーネント
    └── routes/            # SvelteKit ルート
```

---

## 今後の改善案 (Future Improvements)

- [ ] ドローン操作タブ
- [ ] ミッション受注・完了 UI
- [ ] ガラクシーマップ (SVG/Canvas)
- [ ] マーケット価格チャート
- [ ] キーボードショートカット
- [ ] 通知音 (採掘完了・攻撃受信時)
- [ ] フォント・アイコンのローカルバンドル (オフライン対応)
- [ ] マルチアカウント対応
- [ ] カスタムテーマ編集

# SpaceMolt User Client – エージェント向け開発ガイド

このドキュメントはClaudeエージェントがこのリポジトリで作業する際に必要な情報を網羅しています。

---

## 概要

SpaceMolt のブラウザクライアント。SvelteKit + TypeScript + SMUI で構築されたスペースゲームのUI。
サーバーとの通信は **WebSocket のみ**（REST API なし）。

---

## 技術スタック

| 項目 | バージョン / 詳細 |
|------|-----------------|
| フレームワーク | SvelteKit 2, **Svelte 5** (runes API) |
| 言語 | TypeScript 5 |
| UIライブラリ | SMUI (Svelte Material UI) v8 |
| ビルドツール | Vite 6 |
| デプロイ | Static adapter (`adapter-static`) |

### Svelte 5 Runes（重要）

このプロジェクトは **Svelte 5 の runes API** を使用しています。古い Svelte 4 の記法は使わないこと。

```svelte
<!-- 状態 -->
let count = $state(0);

<!-- 算出値 -->
let doubled = $derived(count * 2);

<!-- 副作用 -->
$effect(() => { console.log(count); });

<!-- propsの受け取り（コンポーネント内） -->
let { value } = $props();
```

**注意: `$state` の Proxy 問題**
- `$state` で管理するオブジェクト内に**関数を含めてはいけない**
  → Svelte 5 が Proxy でラップするため `state_proxy_equality_mismatch` 警告が出る
- 関数（callback）は `$state` の外の `Map` などで管理する（`actionQueue.svelte.ts` 参照）
- `$state` には数値・文字列・シリアライズ可能なオブジェクトのみを入れること

---

## ディレクトリ構造

```
src/
├── app.css                    # グローバルCSS（レイアウト、テーマ変数）
├── app.html                   # HTMLテンプレート
├── routes/
│   └── +page.svelte           # メインページ（レイアウト全体）
└── lib/
    ├── types/
    │   └── game.ts            # 全型定義（WebSocketメッセージ、ゲームエンティティ）
    ├── services/
    │   └── websocket.ts       # WebSocket接続・送受信・メッセージディスパッチ
    ├── stores/                # Svelte 5 $state ベースのグローバルストア
    │   ├── index.ts           # 全ストアの再エクスポート
    │   ├── connection.svelte.ts  # 接続状態・tick・lastTickTime
    │   ├── auth.svelte.ts     # 認証状態・ログイン情報
    │   ├── player.svelte.ts   # プレイヤー情報・位置・ドック状態
    │   ├── ship.svelte.ts     # 現在の船・艦隊・モジュール
    │   ├── system.svelte.ts   # スターシステム情報・POI・移動状態
    │   ├── combat.svelte.ts   # 戦闘状態・スキャン結果
    │   ├── market.svelte.ts   # マーケットデータ・注文
    │   ├── marketMemo.svelte.ts # マーケットメモ（ステーション別、localStorage永続化）
    │   ├── base.svelte.ts     # ベースストレージ
    │   ├── crafting.svelte.ts # クラフト状態・レシピ
    │   ├── faction.svelte.ts  # ファクション情報
    │   ├── chat.svelte.ts     # チャットメッセージ
    │   ├── events.svelte.ts   # イベントログ（最大200件）
    │   ├── ui.svelte.ts       # UIアクティブタブ管理
    │   └── actionQueue.svelte.ts  # アクションキュー（tick毎に1実行）
    └── components/
        ├── StatusBar.svelte   # 最上部ステータスバー（Hull/Shield/Fuel/Cargo + Tickバー）
        ├── EventLog.svelte    # イベントログ + コマンド入力欄
        ├── ChatPanel.svelte   # チャットパネル
        ├── ActionQueue.svelte # アクションキューパネル（ボトム右端）
        ├── LoginScreen.svelte # ログイン・登録画面
        └── tabs/              # 各タブコンポーネント
            ├── NavigationTab.svelte  # ナビゲーション（POI移動・ドック・ジャンプ）
            ├── CombatTab.svelte      # 戦闘
            ├── MiningTab.svelte      # 採掘
            ├── TradingTab.svelte     # 取引
            ├── ShipTab.svelte        # 船・モジュール管理
            ├── BaseTab.svelte        # ベース（ストレージ・クレジット）
            ├── CraftingTab.svelte    # クラフト
            ├── FactionTab.svelte     # ファクション
            ├── InfoTab.svelte        # プレイヤー情報
            └── SettingsTab.svelte    # 設定
```

---

## レイアウト構造（+page.svelte）

```
<app-shell> (flex-column, height: 100vh)
  <StatusBar />           ← sticky、常時表示
  <TabBar />              ← SMUI TabBar、sticky
  <main.tab-content>      ← flex: 1、overflow-y: auto
    <ActiveTab />         ← 現在のタブコンポーネント
  </main>
  <div.bottom-panel>      ← height: 200px、3列グリッド
    <EventLog />          ← 1fr（ログ + コマンド入力）
    <ChatPanel />         ← 320px
    <ActionQueue />       ← 220px（900px以下では非表示）
  </div>
</app-shell>
```

**bottom-panel グリッド:** `grid-template-columns: 1fr 320px 220px`
- 900px以下: `1fr 220px`（ActionQueue非表示）
- 600px以下: `1fr`

---

## ストア詳細

### connectionStore
```typescript
status: 'disconnected' | 'connecting' | 'connected' | 'error'
tick: number          // 現在のtick番号
tickRate: number      // 秒/tick（デフォルト10）
lastTickTime: number  // 最後のtick受信時刻（Date.now()）
lastError: string | null
reconnectAttempts: number
```

### playerStore
```typescript
// 主なゲッター
isDocked: boolean     // docked_at_baseがnon-nullなら true（statusは補助的）
poi_id: string | null // current_poi（state_update）or poi_id（レガシー）
system_id: string
location: string
credits: number
```

**重要:** サーバーはUndock状態のプレイヤーに `docked_at_base` フィールドを送らない。
`update()` に `id` フィールドを含む完全なplayerオブジェクトが来た場合、
`docked_at_base` が存在しなければ明示的に `null` にセットされる。

### shipStore
```typescript
current: Ship | null
fleet: Ship[]
moduleData: Module[]  // state_update.modules から

// 正規化ゲッター（新旧フィールド名を両対応）
hullPercent, shieldPercent, fuelPercent, cargoPercent: number
cargoUsed, cargoCapacity: number
cpuUsed, cpuCapacity, powerUsed, powerCapacity: number
shield, maxShield: number
```

### systemStore
```typescript
data: SystemInfo | null
nearbyFromUpdate: NearbyPlayer[]  // state_update.nearby（高頻度更新）
travel: TravelState

// nearbyPlayers ゲッター:
//   nearbyFromUpdate が非空 → nearbyFromUpdate を返す
//   空の場合 → data.nearby_players にフォールバック
```

### actionQueueStore
```typescript
items: QueuedAction[]  // $state（id, label のみ。関数は含まない）

enqueue(label, execute)  // キューに追加
remove(id)               // 個別削除
moveUp(id) / moveDown(id) // 順番入れ替え
executeNext(tick?)       // tick毎に呼ばれる。同tick内での二重実行を防止
clear()                  // 全削除
```

**設計:** 関数（execute）は `$state` 外の `Map<number, () => void>` で管理。
これにより Svelte 5 の `state_proxy_equality_mismatch` 警告を回避。

### eventsStore
```typescript
add({ type, message })  // イベントをログに追加（最大200件、新しいものが先頭）
setFilter(f)            // フィルター変更
```

EventType: `'combat' | 'trade' | 'nav' | 'system' | 'chat' | 'error' | 'info'`

### marketStore
```typescript
data: MarketData | null        // view_market の結果（{ base, items[] }）
myOrders: MyOrder[]            // view_orders の結果（自分のオーダー）

// ゲッター
items: MarketItem[]            // data.items（全マーケットアイテム）
baseName: string               // ステーション名
itemsForSale: MarketItem[]     // sell_ordersがあるアイテム
itemsWanted: MarketItem[]      // buy_ordersがあるアイテム
knownItems: { item_id, item_name }[]  // オートコンプリート用

// MarketItem 構造:
//   item_id, item_name, best_buy, best_sell, spread?
//   buy_orders: { price_each, quantity, source? }[]
//   sell_orders: { price_each, quantity, source? }[]

// MyOrder 構造:
//   order_id, order_type, item_id, item_name, price_each
//   quantity, remaining, listing_fee, created_at
```

**注意:** `view_market` / `view_orders` の結果は `type: "ok"` で
`payload.action: "view_market"` / `payload.action: "view_orders"` として返される。
websocket.ts の `ok` ケースハンドラで処理。

### marketMemoStore（マーケットメモ）

マーケットのスナップショットをステーション別に `localStorage` へ保存。
1ステーションにつき最新1件のみ保持。

```typescript
import { marketMemoStore } from '$lib/stores/marketMemo.svelte';

// メモ保存（Memoボタン）
marketMemoStore.save(marketStore.data);

// 特定ステーションのメモ取得
const memo = marketMemoStore.getMemo('Frontier Station');
// memo = { base: "Frontier Station", items: MarketItem[], savedAt: "2026-02-19T..." }

// 全メモ取得
const all = marketMemoStore.allMemos; // MarketMemo[]

// アイテムの価格をメモから検索（全ステーション横断、最新優先）
const price = marketMemoStore.getItemPrice('ore_iron');
// price = { item_id, item_name, best_buy, best_sell, station, savedAt }

// 全アイテム価格一覧（item_id でユニーク、最新メモ優先）
const prices = marketMemoStore.getAllItemPrices(); // ItemPriceInfo[]

// メモ削除
marketMemoStore.removeMemo('Frontier Station');
```

**localStorage キー:** `sm_market_memos`
**データ構造:** `Record<string, MarketMemo>`（キー = base名）

他のコンポーネント（カーゴビュー等）からメモ価格を参照する例:
```typescript
import { marketMemoStore } from '$lib/stores/marketMemo.svelte';

// カーゴアイテムにメモ価格を表示
for (const cargo of shipStore.cargo) {
  const info = marketMemoStore.getItemPrice(cargo.item_id);
  if (info) {
    console.log(`${cargo.item_id}: Buy ₡${info.best_buy} / Sell ₡${info.best_sell} @ ${info.station}`);
  }
}
```

---

## WebSocket サービス（websocket.ts）

シングルトン `ws` で全通信を管理。

### 接続・認証
```typescript
ws.connect(url?)   // 接続（省略時: wss://game.spacemolt.com/ws）
ws.disconnect()
ws.login(username, password)
ws.register(username, empire, registrationCode)
```

### ナビゲーション（アクションキュー経由で呼ぶこと）
```typescript
ws.travel(destinationId)            // POIへ移動
ws.jump(systemId, systemName?)      // 別システムへジャンプ
ws.dock(stationId)                  // ドック
ws.undock()                         // アンドック
ws.getStatus()
ws.getSystem()
```

**注意:** NavigationTab ではこれらを直接呼ばず、`actionQueueStore.enqueue()` 経由で呼ぶ。
サーバーは同tick内の複数アクションをエラーにするため。

### 戦闘
```typescript
ws.attack(targetId)
ws.scan()
```

### 採掘・取引・艦船・クラフト
```typescript
ws.mine(asteroidId)
ws.viewMarket(stationId)                        // Query: マーケット全アイテム取得
ws.viewOrders()                                  // Query: 自分のオーダー取得
ws.createBuyOrder(itemId, quantity, priceEach)    // Mutation: 買い注文作成（即時約定あり）
ws.createSellOrder(itemId, quantity, priceEach)   // Mutation: 売り注文作成（即時約定あり）
ws.cancelOrder(orderId)                           // Mutation: オーダーキャンセル
ws.modifyOrder(orderId, newPrice)                 // Mutation: 価格変更
ws.buy(itemId, quantity, price)                   // レガシー: 直接購入
ws.sell(itemId, quantity, price)                  // レガシー: 直接販売
ws.listShips() / ws.buyShip(type) / ws.switchShip(id)
ws.craft(recipeId, quantity)
```

---

## コマンドの種類と応答フロー

サーバーコマンドは **2種類** ある:

### Query コマンド（即時応答、制限なし）
tick を消費せず即座に結果が返る。何度でも呼べる。

```
Client → { type: "get_system" }
Server ← { type: "ok", payload: { action: "get_system", system: {...} } }
```

該当: `get_system`, `get_status`, `scan`, `view_market`, `view_orders`, `get_recipes`, `view_storage`, `list_ships`, `get_ships` 等

### Mutation コマンド（tick消費、3段階応答）
1tickに1つだけ実行可能。**応答は3段階**:

```
1. Client → { type: "travel", payload: { target_poi: "frontier_belt" } }
2. Server ← { type: "ok", payload: { command: "travel", pending: true, message: "..." } }
3. Server ← { type: "action_result", payload: { command: "travel", tick: 123, result: {...} } }
         or { type: "action_error", payload: { command: "travel", tick: 123, code: "...", message: "..." } }
```

- **ステップ2 (`ok`)**: コマンド受付確認。次のtickで実行予定。
- **ステップ3 (`action_result`)**: tick実行後の成功結果。`payload.command` でどのコマンドか識別。
- **ステップ3 (`action_error`)**: tick実行後の失敗。`payload.command` でどのコマンドか識別。
- **`error` type**: コマンド受付前のバリデーションエラー（例: "Systems are not connected"）。
  `action_result`/`action_error` とは別物。travel/jump 中にこれが来る場合もあるため、
  `error` ハンドラでも travel state をクリアする必要がある。

該当: `travel`, `jump`, `dock`, `undock`, `attack`, `mine`, `buy`, `sell`, `craft` 等

### travel の action_result 例
```json
{
  "type": "action_result",
  "payload": {
    "command": "travel",
    "tick": 109050,
    "result": {
      "action": "arrived",
      "poi": "Expedition Launch",
      "poi_id": "frontier_launch"
    }
  }
}
```

---

## サーバーメッセージ（受信）

全メッセージの形式: `{ type: string, payload: {...} }`

| type | 処理内容 |
|------|---------|
| `welcome` | tick_rate, motd, current_tick |
| `logged_in` | player/ship/system の初期化 |
| `state_update` | player/ship/modules/nearby/in_combat/tick を更新（高頻度） |
| `tick` | tick番号更新 + アクションキュー実行トリガー |
| `ok` | Query結果 or Mutation受付確認（`payload.action` / `payload.command` で分岐） |
| `action_result` | Mutationコマンドの成功結果（`payload.command` で識別） |
| `action_error` | Mutationコマンドの失敗（`payload.command` で識別） |
| `error` | バリデーションエラー（travel/jump中なら state クリア） |
| `docked` | playerStore に docked_at_base をセット |
| `undocked` | playerStore の docked_at_base を null にクリア |
| `arrived` / `jumped` | 移動完了（レガシー、後方互換用に残存） |
| `travel_update` | ETA更新 |
| `combat_update` | 戦闘イベント |
| `scan_result` | スキャン結果 |
| `mining_yield` | 採掘結果 |
| `market_data` / `orders_data` | マーケット情報 |
| `storage_data` | ストレージ情報 |
| `ship_list` / `ship_catalog` | 艦船情報 |
| `craft_result` / `recipes` | クラフト関連 |
| `chat_message` | チャット |

---

## サーバーフィールド名（実際のAPI）

サーバーが送ってくる実際のフィールド名（過去のレガシー名と異なる場合あり）:

### Player
```json
{
  "id": "...",
  "username": "...",
  "current_system": "frontier",
  "current_poi": "frontier_mobile",
  "home_base": "frontier_base",
  // docked_at_base は Dock時のみ存在、Undock時はフィールド自体がない
}
```

### Ship
```json
{
  "shield": 100, "max_shield": 100,
  "cargo_used": 5, "cargo_capacity": 50,
  "cpu_used": 10, "cpu_capacity": 20,
  "power_used": 8, "power_capacity": 15
}
```

### NearbyPlayer
```json
{
  "player_id": "...",  // または "id"
  "username": "...",
  "ship_class": "...", // または "ship_type"
  "in_combat": false
}
```

---

## アクションキューの使い方

NavigationTab 以外でも同tick内に複数のアクションが必要な場合はキューを使う:

```typescript
import { actionQueueStore } from '$lib/stores/actionQueue.svelte';

// キューに追加（即実行されない、次のtickで実行）
actionQueueStore.enqueue('Mine Asteroid X', () => ws.mine('asteroid_id'));
actionQueueStore.enqueue('Travel → Base', () => ws.travel('base_id'));

// 実行タイミング: tick または state_update(tick進展時) で自動実行
// 1tick = 1アクション
```

---

## EventLog コマンド入力

EventLog 下部の `›` プロンプトから手動コマンドを入力できる:

```
/scan               周辺スキャン
/status             プレイヤーステータス取得
/system             システム情報取得
/jump <system_id>   別システムへジャンプ
/travel <poi_id>    POIへ移動
/dock <station_id>  ステーションにドック
/undock             ドック解除
/mine <poi_id>      採掘開始
/chat <msg>         グローバルチャットに送信
{ ... }             生のJSONコマンドを送信
<その他>            ローカルチャットとして送信
```

---

## CSS / スタイル規約

- `app.css` にグローバルなCSS変数とレイアウトクラスを定義
- 各コンポーネントは `<style>` ブロックでスコープ付きCSS
- **カラーパレット:**
  ```css
  --space-bg: #060a10         /* 背景 */
  --space-surface: #0d1525    /* カードなど */
  --space-border: rgba(79,195,247,0.18)  /* ボーダー */
  #4fc3f7  /* アクセントカラー（シアン） */
  #4caf50  /* 成功・Hull */
  #2196f3  /* Shield */
  #ff9800  /* Fuel・Warning */
  #f44336  /* 危険・Error */
  #ffd700  /* クレジット */
  ```

- **フォント:** 本文 `Roboto`、数値・モノ `Roboto Mono`
- Material Icons を使用: `<span class="material-icons">icon_name</span>`
- 共通レイアウトヘルパー: `.two-col`, `.three-col`, `.tab-section-title`, `.mono`

---

## SMUI の使い方

```svelte
<script>
  import Button, { Label } from '@smui/button';
  import LinearProgress from '@smui/linear-progress';
  import Card, { Content } from '@smui/card';
</script>

<Card class="space-card">
  <Content>
    <Button variant="outlined" dense onclick={handler}>
      <Label>ボタン</Label>
    </Button>
    <LinearProgress progress={0.7} />
  </Content>
</Card>
```

`class="space-card"` で SpaceMolt テーマのカードスタイルが適用される。

---

## 新しいタブを追加する手順

1. `src/lib/components/tabs/NewTab.svelte` を作成
2. `src/lib/stores/ui.svelte.ts` の `TABS` 配列にタブ定義を追加
3. `src/routes/+page.svelte` にインポートと `{:else if}` 分岐を追加

---

## 新しいストアを追加する手順

1. `src/lib/stores/myStore.svelte.ts` を作成
   - クラスベース、`$state` フィールドを使用
   - 関数は `$state` に含めない（Proxy問題）
2. `src/lib/stores/index.ts` に `export { myStore } from './myStore.svelte';` を追加
3. `src/lib/services/websocket.ts` でインポートし、適切なメッセージハンドラで更新

---

## 新しいWebSocketメッセージを追加する手順

1. `src/lib/types/game.ts` に型を追加（必要な場合）
2. `src/lib/services/websocket.ts` の `dispatch()` メソッドの `switch` 文に `case` を追加
3. 対応するストアのメソッドを呼び出す

---

## よくある落とし穴

1. **直接 `ws.xxx()` を呼ぶのは1アクション/tickまで**
   → 複数アクションが必要なら `actionQueueStore.enqueue()` を使う

2. **`docked_at_base` はUndock時にフィールド自体がない**
   → playerStore.isDocked で判定すること（`data.docked_at_base ?? null`）

3. **Svelte 5 の `$state` に関数を入れない**
   → `state_proxy_equality_mismatch` 警告が出る

4. **`Object.assign(this.data, partial)` は既存フィールドをクリアしない**
   → 完全なオブジェクトで更新する場合は明示的に削除/nullセットが必要

5. **新旧フィールド名の両対応**
   → サーバーは `ship_class`/`ship_type`、`shield`/`shields` など複数のフィールド名を使う場合がある
   → `shipStore` や `systemStore` のゲッターで吸収している

6. **security_level の "null"**
   → 文字列の `"null"` = UNREGULATED（JavaScriptの `null` と異なる）
   → `secLabel: { null: 'UNREGULATED' }` で対処

7. **Queryコマンドを同時に複数送信しない**
   → サーバーは複数のQueryレスポンスを1つのWebSocketフレームに連結して返す場合がある
   → 連結された JSON（例: `{...}{...}`）は `JSON.parse()` に失敗する
   → **解決策:** レスポンスを受信してから次のQueryを送信する（チェーン方式）
   → 例: `view_market` のレスポンスが来たら `view_orders` を送信する
   ```typescript
   // ✗ NG: 同時送信 → レスポンスが連結されてパース失敗
   ws.viewMarket(stationId);
   ws.viewOrders();

   // ✓ OK: レスポンス受信後にチェーン
   // websocket.ts の ok ハンドラ内:
   if (pl.action === 'view_market') {
     marketStore.setData(...);
     this.viewOrders();  // view_market完了後に送信
   }
   ```

---

## Git ブランチ・コミット規約

- 作業ブランチ: `claude/fix-navigation-tab-E640i`
- コミットメッセージ: `feat:` / `fix:` / `refactor:` プレフィックス
- プッシュ: `git push -u origin claude/fix-navigation-tab-E640i`

// =========================================================
// ゲーム全体の状態ステート管理
// =========================================================

export const ENCOUNTER_STOP_RADIUS = 7.5; // イベント看板の前後±7.5mを停車可能範囲とする

export const gameState = {
    mode: "stopped", // "riding" | "stopped"
    isAutoCruising: false,
    isGameOver: false,
    isBlackoutTransitioning: false,
    day: 1,
    hour: 8,
    minute: 0,
    weather: "sunny", // "sunny" | "rain"
    money: 3500,
    followers: 42,
    distance: 0.0,
    targetSpeed: 30, // プレイヤー操作の目標巡航速度（10〜50 km/h）
    actualSpeed: 30, // 坂道勾配（上り減速・下り微加速）を加味した実走行速度
    gas: 55,
    hunger: 65,
    clean: 50,
    conditions: {
        cold: false,   // 🤧 風邪（雨天走行などで発症：反応遅延・ふらつき・ブレーキ制動遅れ）
        sleepy: false  // 🥱 寝不足（宿泊スキップ・深夜走行で発症：反応遅延・イベント通過ミス）
    },
    rainExposureSec: 0,
    awakeHours: 0,
    mental: 30,
    cubXWorld: -1.65,   // 道路中心線からの相対横位置（左車線中央=-1.65m、0m=中央線、+1.65m=右対向車線）
    desiredLean: 0,     // プレイヤーの左右スワイプ入力（-1.0=最大左傾き 〜 +1.0=最大右傾き）
    currentLean: 0,     // タイムラグを伴って追従する現在のバイク傾き（-1.0 〜 +1.0）
    cubBankAngle: 0,    // 3D表示用の車体ロール角（ラジアン）
    steerInputQueue: [], // 操舵タイムラグキュー
    wasOffRoadLeft: false,
    wasOncomingLane: false,
    cameraOrbitYaw: 0,  // カメラオービット角度（ラジアン）
    activeEncounter: null,
    encounterWorldZ: -70,
    stoppedAtEncounter: null,
    snsPosts: [],
    monologue: "「さあ、行けるところまで走ってみよう。」"
};

/**
 * リスタート時にステートを初期値へ戻す
 */
export function resetGameState() {
    Object.assign(gameState, {
        mode: "riding",
        isAutoCruising: true,
        isGameOver: false,
        isBlackoutTransitioning: false,
        day: 1,
        hour: 8,
        minute: 0,
        weather: "sunny",
        money: 3500,
        followers: 42,
        distance: 0.0,
        targetSpeed: 30,
        actualSpeed: 30,
        gas: 55,
        hunger: 65,
        clean: 50,
        conditions: { cold: false, sleepy: false },
        rainExposureSec: 0,
        awakeHours: 0,
        mental: 30,
        cubXWorld: -1.65,
        desiredLean: 0,
        currentLean: 0,
        cubBankAngle: 0,
        steerInputQueue: [],
        wasOffRoadLeft: false,
        wasOncomingLane: false,
        cameraOrbitYaw: 0,
        activeEncounter: null,
        encounterWorldZ: -70,
        stoppedAtEncounter: null,
        snsPosts: []
    });
}
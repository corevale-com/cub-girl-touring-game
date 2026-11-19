// =========================================================
// 道路の起伏・左右カーブ・50cc勾配速度計算
// =========================================================
import { gameState } from "./state.js";

let roadScrollOffset = 0;

export function getRoadScrollOffset() {
    return roadScrollOffset;
}

export function advanceRoadScroll(delta) {
    roadScrollOffset += delta;
}

/**
 * 道路の上下起伏（上り坂・下り坂）を計算する
 */
export function getRoadElevationAtZ(z) {
    const phase = (z - roadScrollOffset) * 0.045;
    return Math.sin(phase) * 2.4 + Math.cos(phase * 0.55) * 1.3;
}

/**
 * 道路の前後傾き（ピッチ角）を計算する（上り坂で正、下り坂で負）
 */
export function getRoadPitchAtZ(z) {
    const dz = 0.5;
    const y1 = getRoadElevationAtZ(z + dz);
    const y2 = getRoadElevationAtZ(z - dz);
    return Math.atan2(y2 - y1, dz * 2);
}

/**
 * 道路の左右カーブ中心線（Xオフセット）を計算する
 */
export function getRoadCurveXAtZ(z) {
    const phase = (z - roadScrollOffset) * 0.024;
    return Math.sin(phase) * 10.5 + Math.sin(phase * 0.43 + 1.1) * 6.5;
}

/**
 * 道路の左右カーブ接線角度（ヨー角）を計算する
 */
export function getRoadYawAtZ(z) {
    const dz = 0.6;
    const x1 = getRoadCurveXAtZ(z + dz);
    const x2 = getRoadCurveXAtZ(z - dz);
    return Math.atan2(-(x2 - x1), dz * 2);
}

/**
 * 原付50ccの非力なエンジン出力特性：上り坂で速度低下、下り坂で微加速した実速度を算出
 */
export function computeEffectiveSpeedKmh() {
    if (gameState.mode !== "riding" || gameState.isGameOver) return 0;
    if (gameState.gas <= 0) return 3;

    const pitch = getRoadPitchAtZ(0); // 正=上り坂、負=下り坂
    const base = gameState.targetSpeed;
    let slopeDelta = 0;

    if (pitch > 0) {
        slopeDelta = -Math.min(14, pitch * 78);
    } else {
        slopeDelta = Math.min(5, -pitch * 26);
    }

    const minMoving = Math.min(base, 8);
    const effective = Math.max(minMoving, Math.min(54, base + slopeDelta));
    return Math.round(effective * 10) / 10;
}
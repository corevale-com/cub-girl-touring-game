// =========================================================
// 走行エンジン・時間経過・ステータス消耗・発進/停止制御
// =========================================================
import { gameState, ENCOUNTER_STOP_RADIUS } from "./state.js";
import { getRoadPitchAtZ, computeEffectiveSpeedKmh } from "./roadMath.js";
import {
    isCubInEncounterStopZone,
    triggerRandomEncounter,
    dismissActiveEncounter,
    syncEncounterFullscreenOverlay
} from "./encounters.js";
import {
    spawn3DOncomingCar,
    spawn3DOvertakingCar,
    getOvertakingCarsCount
} from "./scene3d.js";
import {
    setMonologue,
    showToast,
    updateAllUI,
    triggerMentalGameOver
} from "./ui.js";

let drivingTimer = null;
let oncomingTimer = null;

export function advanceTime(addHours, addMinutes) {
    let totalMinutes = gameState.hour * 60 + gameState.minute + addHours * 60 + addMinutes;
    while (totalMinutes >= 24 * 60) {
        totalMinutes -= 24 * 60;
        gameState.day += 1;
    }
    gameState.hour = Math.floor(totalMinutes / 60);
    gameState.minute = totalMinutes % 60;
}

export function startJourneyFromTitle() {
    const titleModal = document.getElementById("title-screen-modal");
    if (titleModal) titleModal.classList.add("hidden");

    gameState.mode = "riding";
    gameState.targetSpeed = 30;
    gameState.actualSpeed = 30;
    gameState.isAutoCruising = true;
    setMonologue("「……風がきもちいい。操作しない時はまっすぐ進むから安心だね！」");
    updateAllUI();
    startBackgroundLoops();
}

export function startBackgroundLoops() {
    if (drivingTimer) clearInterval(drivingTimer);
    drivingTimer = setInterval(runDrivingTick, 1000);

    if (oncomingTimer) clearTimeout(oncomingTimer);
    const scheduleNextCar = () => {
        const delay = 3500 + Math.random() * 5500;
        oncomingTimer = setTimeout(() => {
            if (!gameState.isGameOver) {
                spawn3DOncomingCar();
            }
            scheduleNextCar();
        }, delay);
    };
    scheduleNextCar();
}

export function stopBySwipe() {
    if (gameState.isGameOver || gameState.mode === "stopped" || gameState.isBlackoutTransitioning) return;

    const hasCondition = gameState.conditions.cold || gameState.conditions.sleepy;
    const inZoneNow = gameState.activeEncounter && isCubInEncounterStopZone();

    if (hasCondition && inZoneNow) {
        const enc = gameState.activeEncounter;
        const ailmentName = gameState.conditions.cold && gameState.conditions.sleepy
            ? "風邪と寝不足"
            : (gameState.conditions.cold ? "風邪のボーッと感" : "寝不足の反応遅れ");

        gameState.encounterWorldZ = ENCOUNTER_STOP_RADIUS + 2.5;
        gameState.mode = "stopped";
        gameState.targetSpeed = 0;
        gameState.actualSpeed = 0;
        gameState.stoppedAtEncounter = null;
        dismissActiveEncounter();

        gameState.mental = Math.max(0, Math.round((gameState.mental - 3.0) * 100) / 100);
        setMonologue(`「あっ、${ailmentName}でブレーキがワンテンポ遅れた…！${enc.title}を通り過ぎちゃったよぉ…！」`);
        showToast(`⚠️ ${ailmentName}で制動遅れ！イベントを通過してしまった…`);
        updateAllUI();
        if (gameState.mental <= 0) {
            triggerMentalGameOver();
        }
        return;
    }

    gameState.mode = "stopped";
    gameState.targetSpeed = 0;
    gameState.actualSpeed = 0;

    if (inZoneNow) {
        const enc = gameState.activeEncounter;
        dismissActiveEncounter();
        gameState.stoppedAtEncounter = enc;
        setMonologue(`「ナイスタイミング！${enc.title}の目の前に停められたよ！」`);
        syncEncounterFullscreenOverlay();
    } else {
        gameState.stoppedAtEncounter = null;
        setMonologue("「こんな何もないところで止まっちゃった…後ろから車が来ないか怖いよぉ…」");
    }
    updateAllUI();
}

export function startRidingBySwipe(initialSpeed) {
    if (gameState.isGameOver || gameState.mode === "riding" || gameState.isBlackoutTransitioning) return;
    gameState.mode = "riding";
    gameState.targetSpeed = Math.max(5, initialSpeed);
    gameState.stoppedAtEncounter = null;
    syncEncounterFullscreenOverlay();
    setMonologue("「よし、再出発！トコトコ行こう。」");
    updateAllUI();
}

export function runDrivingTick() {
    if (gameState.isGameOver || gameState.isBlackoutTransitioning) return;

    if (gameState.mode === "stopped") {
        const isInEventOverlay = Boolean(gameState.stoppedAtEncounter);
        if (!isInEventOverlay && getOvertakingCarsCount() === 0 && Math.random() < 0.35) {
            spawn3DOvertakingCar();
        }
        return;
    }

    const isOutOfGas = gameState.gas <= 0;
    const isRain = gameState.weather === "rain";
    const effectiveKmh = isOutOfGas ? 3 : (gameState.actualSpeed || computeEffectiveSpeedKmh());
    const speedRatio = isOutOfGas ? 0.1 : (effectiveKmh / 30);

    const distGain = isOutOfGas ? 0.02 : Math.round(0.2 * speedRatio * 100) / 100;
    gameState.distance = Math.round((gameState.distance + distGain) * 100) / 100;

    advanceTime(0, 3);

    if (!isOutOfGas) {
        const throttleRatio = gameState.targetSpeed / 30;
        const pitchLoad = Math.max(0, getRoadPitchAtZ(0)) * 2.2;
        const gasBurn = 0.35 * (0.4 + 0.6 * throttleRatio * throttleRatio + pitchLoad);
        gameState.gas = Math.max(0, Math.round((gameState.gas - gasBurn) * 100) / 100);
    }
    gameState.hunger = Math.max(0, Math.round((gameState.hunger - (isOutOfGas ? 0.45 : 0.25)) * 100) / 100);
    gameState.clean = Math.max(0, Math.round((gameState.clean - (isRain ? 0.55 : 0.18)) * 100) / 100);

    if (isRain) {
        gameState.rainExposureSec += 1;
        if (!gameState.conditions.cold && gameState.rainExposureSec >= 14 && Math.random() < 0.22) {
            gameState.conditions.cold = true;
            setMonologue("「ハクション！雨に打たれすぎて【風邪】ひいちゃったかも…ハンドル操作が鈍い…」");
            showToast("🤧 状態異常【風邪】発症！反応遅延＆イベント停止ミス発生");
        }
    } else {
        gameState.rainExposureSec = Math.max(0, gameState.rainExposureSec - 0.5);
    }

    gameState.awakeHours += 3 / 60;
    if (!gameState.conditions.sleepy && (gameState.awakeHours >= 17 || (gameState.hour >= 2 && gameState.hour <= 4 && Math.random() < 0.18))) {
        gameState.conditions.sleepy = true;
        setMonologue("「ふわぁ……宿泊スキップして走り続けてたら【寝不足】で頭がボーッとする……」");
        showToast("🥱 状態異常【寝不足】発症！反応遅延＆イベント停止ミス発生");
    }

    const hasAnyCondition = gameState.conditions.cold || gameState.conditions.sleepy;

    if (gameState.cubXWorld > 0.15) {
        gameState.mental = Math.max(0, Math.round((gameState.mental - 1.8) * 100) / 100);
    } else if (gameState.cubXWorld < -3.25) {
        gameState.mental = Math.max(0, Math.round((gameState.mental - 1.1) * 100) / 100);
    } else if (isOutOfGas || gameState.hunger <= 5 || gameState.clean <= 10 || hasAnyCondition) {
        const conditionPenalty = hasAnyCondition ? 0.35 : 0;
        gameState.mental = Math.max(0, Math.round((gameState.mental - (0.55 + conditionPenalty)) * 100) / 100);
    } else {
        gameState.mental = Math.min(100, Math.round((gameState.mental + 0.12) * 100) / 100);
    }

    if (Math.random() < 0.015) {
        gameState.weather = gameState.weather === "sunny" ? "rain" : "sunny";
        if (gameState.weather === "rain") {
            setMonologue("「うわっ、雨が降ってきた……カッパ着なきゃ冷えちゃうよ。」");
        } else {
            setMonologue("「雨があがった！山の緑がキラキラしてる。」");
        }
    }

    if (!gameState.activeEncounter && Math.random() < 0.22) {
        triggerRandomEncounter();
    }

    if (effectiveKmh < 20 && getOvertakingCarsCount() === 0 && Math.random() < 0.24) {
        spawn3DOvertakingCar();
    }

    if (gameState.mental <= 0) {
        triggerMentalGameOver();
        return;
    }

    updateAllUI();
}
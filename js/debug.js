// =========================================================
// 開発者テストパネル（デバッグショートカット群）
// =========================================================
import { gameState } from "./state.js";
import { triggerRandomEncounter } from "./encounters.js";
import { spawn3DOncomingCar } from "./scene3d.js";
import { updateAllUI, showToast } from "./ui.js";

export function toggleDebugDrawer() {
    const drawer = document.getElementById("debug-drawer");
    if (drawer) drawer.classList.toggle("hidden");
}

export function initDebugControls() {
    const btnToggle = document.getElementById("btn-toggle-debug");
    const btnClose = document.getElementById("btn-close-debug");
    if (btnToggle) btnToggle.addEventListener("click", toggleDebugDrawer);
    if (btnClose) btnClose.addEventListener("click", toggleDebugDrawer);

    document.querySelectorAll("[data-debug-encounter]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const type = btn.getAttribute("data-debug-encounter");
            triggerRandomEncounter(type);
            showToast(`デバッグ: ${type} イベントを出現させました`);
        });
    });

    const bindClick = (id, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("click", fn);
    };

    bindClick("btn-debug-weather", () => {
        gameState.weather = gameState.weather === "sunny" ? "rain" : "sunny";
        updateAllUI();
        showToast(`天候を ${gameState.weather === "rain" ? "雨" : "晴れ"} に変更しました`);
    });

    bindClick("btn-debug-oncoming", () => {
        spawn3DOncomingCar();
        showToast("対向車を出現させました");
    });

    bindClick("btn-debug-money", () => {
        gameState.money += 3000;
        updateAllUI();
        showToast("所持金を +3,000円 追加しました");
    });

    bindClick("btn-debug-cold", () => {
        gameState.conditions.cold = !gameState.conditions.cold;
        updateAllUI();
        showToast(`状態異常【風邪】を ${gameState.conditions.cold ? "発症" : "解除"} しました`);
    });

    bindClick("btn-debug-sleepy", () => {
        gameState.conditions.sleepy = !gameState.conditions.sleepy;
        updateAllUI();
        showToast(`状態異常【寝不足】を ${gameState.conditions.sleepy ? "発症" : "解除"} しました`);
    });

    bindClick("btn-debug-lowgas", () => {
        gameState.gas = 1;
        updateAllUI();
        showToast("燃料を限界まで減らしました");
    });

    bindClick("btn-debug-lowmental", () => {
        gameState.mental = 2;
        updateAllUI();
        showToast("心境を限界まで減らしました");
    });
}
// =========================================================
// エントリーポイント（全体初期化・イベントバインド）
// =========================================================
import { initThreeScene, animate3DLoop, clearTrafficVehicles } from "./scene3d.js";
import { initViewportGestures } from "./controls.js";
import { startJourneyFromTitle, advanceTime } from "./driving.js";
import {
    registerEncounterTimeHelper,
    dismissActiveEncounter,
    syncEncounterFullscreenOverlay
} from "./encounters.js";
import {
    registerUiHooks,
    updateAllUI,
    openSnsModal,
    closeSnsModal,
    restartGame
} from "./ui.js";
import { initDebugControls } from "./debug.js";

function bindMainUiEvents() {
    const startBtn = document.getElementById("btn-start-journey");
    if (startBtn) startBtn.addEventListener("click", startJourneyFromTitle);

    const openSnsBtn = document.getElementById("btn-open-sns");
    if (openSnsBtn) openSnsBtn.addEventListener("click", openSnsModal);

    const closeSnsBtn = document.getElementById("btn-close-sns");
    if (closeSnsBtn) closeSnsBtn.addEventListener("click", closeSnsModal);

    const restartBtn = document.getElementById("btn-restart-game");
    if (restartBtn) restartBtn.addEventListener("click", restartGame);
}

window.addEventListener("load", () => {
    registerEncounterTimeHelper(advanceTime);
    registerUiHooks({
        onRestart: () => {
            clearTrafficVehicles();
            dismissActiveEncounter();
        },
        onSyncOverlay: syncEncounterFullscreenOverlay
    });

    bindMainUiEvents();
    initDebugControls();
    initThreeScene();
    initViewportGestures();
    updateAllUI();
    animate3DLoop();
});
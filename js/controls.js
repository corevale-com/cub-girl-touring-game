// =========================================================
// 3Dビューポート操作（1点スワイプ＝バイク傾き＆速度／2点オービット）
// =========================================================
import { gameState } from "./state.js";
import { stopBySwipe, startRidingBySwipe } from "./driving.js";
import { updateAllUI } from "./ui.js";

export function initViewportGestures() {
    const vp = document.getElementById("visual-viewport");
    if (!vp) return;

    let isDragging = false;
    let isOrbiting = false;
    let startClientX = 0;
    let startClientY = 0;
    let startSpeed = gameState.targetSpeed;
    let startOrbitX = 0;
    let startOrbitYaw = 0;

    const MIN_SPEED = 0;
    const MAX_SPEED = 50;
    const MAX_ORBIT_YAW = Math.PI * 0.55;

    vp.addEventListener("contextmenu", (e) => e.preventDefault());

    const enqueueLeanInput = (leanVal) => {
        const clampedLean = Math.max(-1.0, Math.min(1.0, leanVal));
        const hasCondition = gameState.conditions.cold || gameState.conditions.sleepy;
        const inputDelayMs = hasCondition ? 320 : 80;
        gameState.steerInputQueue.push({
            lean: clampedLean,
            applyAt: performance.now() + inputDelayMs
        });
    };

    const releaseLeanToCenter = () => {
        enqueueLeanInput(0);
    };

    const updateCub3DControl = (clientX, clientY) => {
        if (gameState.isGameOver || gameState.isBlackoutTransitioning) return;
        const vpRect = vp.getBoundingClientRect();
        if (vpRect.width <= 0 || vpRect.height <= 0) return;

        const deltaX = clientX - startClientX;
        const maxSwipeForFullLean = Math.min(vpRect.width * 0.24, 130);
        const rawLean = deltaX / maxSwipeForFullLean;
        enqueueLeanInput(rawLean);

        const deltaY = startClientY - clientY;
        const deltaSpeed = (deltaY / vpRect.height) * 65;
        const nextSpeed = Math.round(Math.max(MIN_SPEED, Math.min(MAX_SPEED, startSpeed + deltaSpeed)));

        if (nextSpeed === 0 && gameState.mode === "riding") {
            stopBySwipe();
            return;
        } else if (nextSpeed > 0 && gameState.mode === "stopped") {
            startRidingBySwipe(nextSpeed);
        }

        if (nextSpeed !== gameState.targetSpeed) {
            gameState.targetSpeed = nextSpeed;
            updateAllUI();
        }
    };

    const updateCameraOrbit = (clientX) => {
        const vpRect = vp.getBoundingClientRect();
        if (vpRect.width <= 0) return;
        const deltaX = clientX - startOrbitX;
        const deltaYaw = -(deltaX / vpRect.width) * Math.PI * 1.1;
        gameState.cameraOrbitYaw = Math.max(-MAX_ORBIT_YAW, Math.min(MAX_ORBIT_YAW, startOrbitYaw + deltaYaw));
    };

    vp.addEventListener("touchstart", (e) => {
        if (e.touches.length >= 2) {
            if (isDragging) releaseLeanToCenter();
            isDragging = false;
            isOrbiting = true;
            startOrbitX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
            startOrbitYaw = gameState.cameraOrbitYaw;
        } else if (e.touches.length === 1) {
            isOrbiting = false;
            isDragging = true;
            startClientX = e.touches[0].clientX;
            startClientY = e.touches[0].clientY;
            startSpeed = gameState.mode === "stopped" ? 0 : gameState.targetSpeed;
        }
    }, { passive: true });

    vp.addEventListener("touchmove", (e) => {
        if (isOrbiting && e.touches.length >= 2) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) * 0.5;
            updateCameraOrbit(midX);
        } else if (isDragging && e.touches.length === 1) {
            updateCub3DControl(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    vp.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) isOrbiting = false;
        if (e.touches.length === 0) {
            if (isDragging) releaseLeanToCenter();
            isDragging = false;
        }
    });

    vp.addEventListener("mousedown", (e) => {
        if (e.button === 2) {
            isOrbiting = true;
            isDragging = false;
            startOrbitX = e.clientX;
            startOrbitYaw = gameState.cameraOrbitYaw;
        } else if (e.button === 0) {
            isDragging = true;
            isOrbiting = false;
            startClientX = e.clientX;
            startClientY = e.clientY;
            startSpeed = gameState.mode === "stopped" ? 0 : gameState.targetSpeed;
        }
    });

    window.addEventListener("mousemove", (e) => {
        if (isOrbiting) {
            updateCameraOrbit(e.clientX);
        } else if (isDragging) {
            updateCub3DControl(e.clientX, e.clientY);
        }
    });

    window.addEventListener("mouseup", (e) => {
        if (e.button === 2) isOrbiting = false;
        if (e.button === 0) {
            if (isDragging) releaseLeanToCenter();
            isDragging = false;
        }
    });
}
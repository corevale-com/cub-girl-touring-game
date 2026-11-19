// =========================================================
// UI更新・吹き出し・SNS・ゲームオーバー・暗転演出
// =========================================================
import { gameState, resetGameState } from "./state.js";
import { getRoadPitchAtZ } from "./roadMath.js";

let monologueHideTimer = null;
let onRestartCallback = null;
let onOverlaySyncCallback = null;

export function registerUiHooks({ onRestart, onSyncOverlay }) {
    onRestartCallback = onRestart;
    onOverlaySyncCallback = onSyncOverlay;
}

export function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

export function setMonologue(text) {
    gameState.monologue = text;
    setText("ui-monologue", text);
    const anchor = document.getElementById("monologue-anchor");
    if (anchor) {
        anchor.classList.remove("opacity-0");
        anchor.classList.add("opacity-100");
    }
    if (monologueHideTimer) clearTimeout(monologueHideTimer);
    monologueHideTimer = setTimeout(() => {
        if (anchor) {
            anchor.classList.remove("opacity-100");
            anchor.classList.add("opacity-0");
        }
    }, 4200);
}

export function showToast(msg) {
    const toast = document.getElementById("toast-message");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove("opacity-0");
    toast.classList.add("opacity-100");
    setTimeout(() => {
        toast.classList.remove("opacity-100");
        toast.classList.add("opacity-0");
    }, 2400);
}

export function updateSpeedAndSlopeHUD(speedVal, pitchRad) {
    setText("ui-speed", speedVal);
    const speedEl = document.getElementById("ui-speed");
    const isRiding = gameState.mode === "riding";
    const isOutOfGas = gameState.gas <= 0;

    if (speedEl) {
        if (pitchRad > 0.03 && isRiding && !isOutOfGas) {
            speedEl.className = "font-retro text-lg sm:text-2xl font-bold leading-none text-sky-300";
        } else if (speedVal > 30) {
            speedEl.className = "font-retro text-lg sm:text-2xl font-bold leading-none text-rose-400";
        } else {
            speedEl.className = "font-retro text-lg sm:text-2xl font-bold leading-none text-amber-300";
        }
    }

    const gradePct = Math.round(Math.tan(pitchRad) * 100);
    const statusLabel = document.getElementById("drive-status-label");
    if (statusLabel) {
        if (isRiding) {
            if (isOutOfGas) {
                statusLabel.textContent = "移動状態: ガス欠・徒歩押し歩き (3km/h)";
                statusLabel.className = "text-xs sm:text-sm font-bold text-rose-400";
            } else if (gradePct >= 3) {
                statusLabel.textContent = `移動状態: 上り坂走行中 (${speedVal}km/h / 設定${Math.round(gameState.targetSpeed)}km/h)`;
                statusLabel.className = "text-xs sm:text-sm font-bold text-amber-300";
            } else if (gradePct <= -3) {
                statusLabel.textContent = `移動状態: 下り坂走行中 (${speedVal}km/h / 設定${Math.round(gameState.targetSpeed)}km/h)`;
                statusLabel.className = "text-xs sm:text-sm font-bold text-sky-300";
            } else {
                statusLabel.textContent = `移動状態: 自動走行中 (${speedVal}km/h)`;
                statusLabel.className = "text-xs sm:text-sm font-bold text-emerald-300";
            }
        } else {
            statusLabel.textContent = "移動状態: 路肩に停車中（上スワイプで発進）";
            statusLabel.className = "text-xs sm:text-sm font-bold text-amber-300";
        }
    }
}

export function updateAllUI() {
    setText("ui-day", `Day ${gameState.day}`);
    const hh = String(gameState.hour).padStart(2, "0");
    const mm = String(gameState.minute).padStart(2, "0");
    setText("ui-time", `${hh}:${mm}`);
    setText("ui-weather-icon", gameState.weather === "rain" ? "☔" : "☀️");
    setText("ui-money", gameState.money.toLocaleString());
    setText("ui-followers", gameState.followers);

    const isRiding = gameState.mode === "riding";
    const isOutOfGas = gameState.gas <= 0;
    const speedVal = !isRiding ? 0 : (isOutOfGas ? 3 : Math.round(gameState.actualSpeed));
    updateSpeedAndSlopeHUD(speedVal, getRoadPitchAtZ(0));

    const gasPct = Math.round(gameState.gas);
    const hungerPct = Math.round(gameState.hunger);
    const cleanPct = Math.round(gameState.clean);
    const mentalPct = Math.round(gameState.mental);

    const condCard = document.getElementById("card-condition");
    const condBar = document.getElementById("bar-condition");
    const condValEl = document.getElementById("val-condition");
    const isCold = gameState.conditions.cold;
    const isSleepy = gameState.conditions.sleepy;
    if (condCard && condBar && condValEl) {
        if (isCold && isSleepy) {
            condCard.className = "relative h-7 sm:h-8 bg-rose-950 rounded-xl overflow-hidden border border-rose-500/90 shadow-inner animate-pulse";
            condBar.className = "h-full bg-rose-600 transition-all duration-300";
            condBar.style.width = "100%";
            condValEl.textContent = "😵風邪+寝不足";
        } else if (isCold) {
            condCard.className = "relative h-7 sm:h-8 bg-cyan-950 rounded-xl overflow-hidden border border-cyan-500/90 shadow-inner";
            condBar.className = "h-full bg-cyan-600 transition-all duration-300";
            condBar.style.width = "100%";
            condValEl.textContent = "🤧風邪";
        } else if (isSleepy) {
            condCard.className = "relative h-7 sm:h-8 bg-purple-950 rounded-xl overflow-hidden border border-purple-500/90 shadow-inner";
            condBar.className = "h-full bg-purple-600 transition-all duration-300";
            condBar.style.width = "100%";
            condValEl.textContent = "🥱寝不足";
        } else {
            condCard.className = "relative h-7 sm:h-8 bg-stone-800 rounded-xl overflow-hidden border border-emerald-500/50 shadow-inner transition-colors";
            condBar.className = "h-full bg-emerald-600/85 transition-all duration-300";
            condBar.style.width = "100%";
            condValEl.textContent = "✨良好";
        }
    }

    const setBar = (id, pct) => {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    };
    setBar("bar-gas", gasPct);
    setBar("bar-hunger", hungerPct);
    setBar("bar-clean", cleanPct);
    setBar("bar-mental", mentalPct);

    // 心境低下に応じたビネット効果（周囲が暗く視野が狭まる演出）
    const vignetteEl = document.getElementById("mental-vignette-overlay");
    if (vignetteEl) {
        const clampedMental = Math.max(0, Math.min(100, gameState.mental));
        const distress = Math.max(0, (65 - clampedMental) / 65);
        const vignetteOpacity = Math.min(0.96, Math.pow(distress, 1.15) * 0.96);
        const clearRadius = Math.round(58 - distress * 38);
        const darkStart = Math.round(98 - distress * 33);
        vignetteEl.style.opacity = vignetteOpacity.toFixed(2);
        vignetteEl.style.background = `radial-gradient(circle at center, rgba(12, 10, 9, 0) ${clearRadius}%, rgba(12, 10, 9, 0.72) ${darkStart}%, rgba(9, 7, 7, 0.96) 100%)`;
    }

    // 上端余白スペースのコンパクト警告バッジ
    const alertsEl = document.getElementById("status-alerts");
    if (alertsEl) {
        const badges = [];
        if (gameState.cubXWorld > 0.15) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[11.5px] sm:text-xs font-extrabold animate-pulse whitespace-nowrap shadow">⚠️ 逆走中！対向車注意！</span>`);
        }
        if (gameState.cubXWorld < -3.25) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[11.5px] sm:text-xs font-extrabold animate-pulse whitespace-nowrap shadow">⚠️ 路肩はみ出し注意！</span>`);
        }
        if (isCold) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-cyan-800 text-cyan-100 border border-cyan-400/50 text-[11.5px] sm:text-xs font-bold whitespace-nowrap">🤧 風邪（操作遅延）</span>`);
        }
        if (isSleepy) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-purple-800 text-purple-100 border border-purple-400/50 text-[11.5px] sm:text-xs font-bold whitespace-nowrap">🥱 寝不足（操作遅延）</span>`);
        }
        if (isOutOfGas) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-600 text-white text-[11.5px] sm:text-xs font-bold whitespace-nowrap">🪫 ガス欠 3km/h</span>`);
        } else if (gasPct <= 20) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-amber-900/95 text-amber-200 border border-amber-500/40 text-[11.5px] sm:text-xs font-bold whitespace-nowrap">⛽ 燃料わずか</span>`);
        }
        if (hungerPct <= 20) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-orange-900/95 text-orange-200 border border-orange-500/40 text-[11.5px] sm:text-xs font-bold whitespace-nowrap">🍙 空腹限界</span>`);
        }
        if (mentalPct <= 20) {
            badges.push(`<span class="shrink-0 px-2.5 py-0.5 rounded-full bg-indigo-900/95 text-indigo-200 border border-indigo-400/50 text-[11.5px] sm:text-xs font-bold whitespace-nowrap">💔 心が折れそう…</span>`);
        }
        alertsEl.innerHTML = badges.join("");
    }
}

export function addSnsPost(text, likes) {
    gameState.snsPosts.unshift({
        day: gameState.day,
        time: `${String(gameState.hour).padStart(2, "0")}:${String(gameState.minute).padStart(2, "0")}`,
        text,
        likes
    });
}

export function openSnsModal() {
    const modal = document.getElementById("sns-modal");
    if (!modal) return;
    setText("modal-followers", gameState.followers);
    setText("modal-dist", `${gameState.distance.toFixed(1)} km`);
    setText("modal-posts-count", gameState.snsPosts.length);

    const feed = document.getElementById("sns-feed-list");
    if (feed) {
        feed.innerHTML = gameState.snsPosts.length === 0
            ? `<div class="text-center text-stone-400 py-6">まだ投稿がありません。絶景スポットに立ち寄って投稿してみよう！</div>`
            : gameState.snsPosts.map(p => `
                <div class="bg-white p-2.5 rounded-2xl border border-stone-200 space-y-1">
                    <div class="flex justify-between text-[12.5px] text-stone-400">
                        <span>@akari_cub50</span>
                        <span>Day ${p.day} ${p.time}</span>
                    </div>
                    <p class="text-stone-700 leading-snug">${p.text}</p>
                    <div class="text-[12.5px] text-pink-600 font-bold">♥ ${p.likes} いいね</div>
                </div>
            `).join("");
    }
    modal.classList.remove("hidden");
}

export function closeSnsModal() {
    const modal = document.getElementById("sns-modal");
    if (modal) modal.classList.add("hidden");
}

export function triggerMentalGameOver() {
    if (gameState.isGameOver) return;
    gameState.isGameOver = true;
    gameState.mode = "stopped";
    gameState.stoppedAtEncounter = null;
    if (onOverlaySyncCallback) onOverlaySyncCallback();
    setText("gameover-icon", "💔");
    setText("gameover-title", "心が折れて、旅をやめた");
    const reasonEl = document.getElementById("gameover-reason");
    if (reasonEl) {
        reasonEl.innerHTML = "「……もう無理。私、いったい何やってるんだろう……帰ろう。」<br>限界を迎えたアカリはカブのエンジンを切り、帰路につくことにした。";
    }
    showGameOverModal();
}

export function triggerCrashGameOver() {
    if (gameState.isGameOver) return;
    gameState.isGameOver = true;
    gameState.mode = "stopped";
    gameState.actualSpeed = 0;
    gameState.stoppedAtEncounter = null;
    if (onOverlaySyncCallback) onOverlaySyncCallback();

    const overlay = document.getElementById("crash-explosion-overlay");
    const flashBg = document.getElementById("crash-flash-bg");
    const graphic = document.getElementById("crash-explosion-graphic");

    if (overlay && graphic) {
        overlay.classList.remove("hidden", "bg-stone-950");
        overlay.classList.add("bg-amber-500/0");
        graphic.classList.remove("scale-150", "opacity-0");
        graphic.classList.add("scale-0", "opacity-100");

        requestAnimationFrame(() => {
            if (flashBg) {
                flashBg.classList.remove("opacity-0");
                flashBg.classList.add("opacity-90");
            }
            graphic.classList.remove("scale-0");
            graphic.classList.add("scale-150");

            setTimeout(() => {
                if (flashBg) {
                    flashBg.classList.remove("opacity-90");
                    flashBg.classList.add("opacity-0");
                }
            }, 160);
        });

        setTimeout(() => {
            overlay.classList.remove("bg-amber-500/0");
            overlay.classList.add("bg-stone-950");
            graphic.classList.add("opacity-0");
        }, 650);

        setTimeout(() => {
            overlay.classList.add("hidden");
            setText("gameover-icon", "💥");
            setText("gameover-title", "対向車と衝突してしまった！");
            const reasonEl = document.getElementById("gameover-reason");
            if (reasonEl) {
                reasonEl.innerHTML = "中央分離帯を越えた先で対向車と正面衝突！<br>スーパーカブは走行不能になり、アカリの旅はここで終わってしまった……。";
            }
            showGameOverModal();
        }, 1250);
    } else {
        setText("gameover-icon", "💥");
        setText("gameover-title", "対向車と衝突してしまった！");
        showGameOverModal();
    }
}

export function showGameOverModal() {
    setText("go-days", `Day ${gameState.day}`);
    setText("go-dist", `${gameState.distance.toFixed(1)} km`);
    setText("go-followers", gameState.followers);
    const modal = document.getElementById("gameover-modal");
    if (modal) modal.classList.remove("hidden");
}

export function restartGame() {
    resetGameState();
    if (onRestartCallback) onRestartCallback();
    if (onOverlaySyncCallback) onOverlaySyncCallback();

    const goModal = document.getElementById("gameover-modal");
    if (goModal) goModal.classList.add("hidden");

    setMonologue("「気を取り直して、もう一度走ってみよう！」");
    updateAllUI();
}
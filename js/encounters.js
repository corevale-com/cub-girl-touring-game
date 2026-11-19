// =========================================================
// ロードサイドイベント定義・停車ゾーン判定・暗転実行
// =========================================================
import { gameState, ENCOUNTER_STOP_RADIUS } from "./state.js";
import { setText, setMonologue, showToast, updateAllUI, addSnsPost } from "./ui.js";

let advanceTimeFn = null;

export function registerEncounterTimeHelper(fn) {
    advanceTimeFn = fn;
}

function advanceTimeSafe(h, m) {
    if (advanceTimeFn) advanceTimeFn(h, m);
}

export const ENCOUNTER_TEMPLATES = {
    gas: {
        type: "gas",
        icon: "⛽",
        title: "山あいのレトロ給油所",
        desc: "「お嬢ちゃん、カブで一人旅かい？気をつけてな！」",
        blackoutText: "ガソリンを給油して、ひと休み……",
        actions: [
            { label: "満タン給油 (¥650)", cost: 650, effect: () => { gameState.gas = 100; gameState.mental = Math.min(100, gameState.mental + 4); setMonologue("「満タン！あと200kmは走れそう！」"); } },
            { label: "500円分給油 (¥500)", cost: 500, effect: () => { gameState.gas = Math.min(100, gameState.gas + 65); setMonologue("「お財布と相談して500円分。よし、走ろう！」"); } }
        ]
    },
    food: {
        type: "food",
        icon: "🍜",
        title: "ドライブイン・峠の食堂",
        desc: "湯気の立つ醤油ラーメンと地元のおばちゃんの笑顔。",
        blackoutText: "温かいごはんを味わって、お腹いっぱい……",
        actions: [
            { label: "名物・峠ラーメン (¥780)", cost: 780, effect: () => {
                gameState.hunger = 100;
                gameState.mental = Math.min(100, gameState.mental + 8);
                if (gameState.conditions.cold) {
                    gameState.conditions.cold = false;
                    gameState.rainExposureSec = 0;
                    setMonologue("「はぁ〜っ、熱々の生姜醤油ラーメンで【風邪】が治った気がする！」");
                } else {
                    setMonologue("「はぁ〜っ、温かいスープが五臓六腑に染みわたる……！」");
                }
                advanceTimeSafe(0, 35);
            }},
            { label: "おにぎり2個 (¥320)", cost: 320, effect: () => { gameState.hunger = Math.min(100, gameState.hunger + 55); advanceTimeSafe(0, 15); setMonologue("「塩むすび最高。節約しつつお腹も満たされた！」"); } }
        ]
    },
    spot: {
        type: "spot",
        icon: "📸",
        title: "紀伊山地・見晴らし展望台",
        desc: "眼下にエメラルドグリーンの渓谷と山並みが広がる絶景スポット。",
        blackoutText: "カブと一緒にパシャリ！SNSに投稿中……",
        actions: [
            { label: "撮影してSNS投稿 (無料)", cost: 0, effect: () => {
                const gain = 12 + Math.floor(Math.random() * 18);
                gameState.followers += gain;
                gameState.mental = Math.min(100, gameState.mental + 12);
                advanceTimeSafe(0, 20);
                addSnsPost(`絶景の展望台に到着！総走行 ${gameState.distance.toFixed(1)}km 突破🛵✨ #原付女子 #スーパーカブ`, gain);
                setMonologue(`「わあ……すごい景色！SNSに上げたらフォロワーが${gain}人も増えた！」`);
            }}
        ]
    },
    job: {
        type: "job",
        icon: "📦",
        title: "道の駅・即日軽作業バイト募集",
        desc: "「人手が足りなくてね！2時間だけ品出し手伝ってくれない？」",
        blackoutText: "2時間しっかり働いて旅費を稼いだ！",
        actions: [
            { label: "2時間バイト (+¥2,400)", cost: 0, effect: () => {
                gameState.money += 2400;
                gameState.hunger = Math.max(0, gameState.hunger - 22);
                gameState.clean = Math.max(0, gameState.clean - 15);
                advanceTimeSafe(2, 0);
                setMonologue("「お疲れさまでした！2,400円ゲット。これでまだ旅を続けられる！」");
            }}
        ]
    },
    clean: {
        type: "clean",
        icon: "♨️",
        title: "秘湯・川湯の立ち寄り温泉",
        desc: "源泉かけ流しの露天風呂。冷えた体と汗をさっぱり流せる。",
        blackoutText: "露天風呂でぽかぽかに温まってリフレッシュ……",
        actions: [
            { label: "温泉でリフレッシュ (¥600)", cost: 600, effect: () => {
                gameState.clean = 100;
                gameState.conditions.cold = false;
                gameState.rainExposureSec = 0;
                gameState.mental = Math.min(100, gameState.mental + 14);
                advanceTimeSafe(0, 50);
                setMonologue("「ふぅ〜極楽……。芯まで温まって【風邪】も吹き飛んだ！」");
            }}
        ]
    },
    stay: {
        type: "stay",
        icon: "🛏️",
        title: "旅人歓迎の素泊まりゲストハウス・やまびこ",
        desc: "「原付旅のお嬢さん？屋根付きのバイク置き場もあるよ！」",
        blackoutText: "布団の中でぐっすり眠って、新しい朝へ……",
        actions: [
            { label: "朝までぐっすり宿泊 (¥2,200)", cost: 2200, effect: () => {
                gameState.conditions.cold = false;
                gameState.conditions.sleepy = false;
                gameState.rainExposureSec = 0;
                gameState.awakeHours = 0;
                gameState.clean = Math.min(100, gameState.clean + 45);
                gameState.mental = Math.min(100, gameState.mental + 25);
                const hoursUntilMorning = gameState.hour >= 17 ? (24 - gameState.hour + 7) : 7;
                advanceTimeSafe(hoursUntilMorning, -gameState.minute);
                setMonologue("「おはようございます！ぐっすり眠って【風邪】も【寝不足】も全快！」");
            }},
            { label: "軒下ベンチで仮眠 (無料・2時間)", cost: 0, effect: () => {
                gameState.conditions.sleepy = false;
                gameState.awakeHours = Math.max(0, gameState.awakeHours - 6);
                gameState.mental = Math.min(100, gameState.mental + 6);
                advanceTimeSafe(2, 0);
                setMonologue("「少し仮眠をとったら【寝不足】のボーッと感がマシになった！」");
            }}
        ]
    }
};

export function isCubInEncounterStopZone() {
    if (!gameState.activeEncounter) return false;
    const withinZ = Math.abs(gameState.encounterWorldZ) <= ENCOUNTER_STOP_RADIUS;
    const onLeftLaneSide = gameState.cubXWorld <= 0.25;
    return withinZ && onLeftLaneSide;
}

export function triggerRandomEncounter(forcedType = null) {
    const pool = ["gas", "food", "spot", "job", "clean"];
    if (gameState.hour >= 17 && gameState.hour <= 23) {
        pool.push("stay", "stay");
    }
    if (gameState.gas < 30) pool.push("gas", "gas");
    if (gameState.hunger < 35) pool.push("food", "food");
    if (gameState.money < 1200) pool.push("job", "job");

    const chosenKey = forcedType || pool[Math.floor(Math.random() * pool.length)];
    const template = ENCOUNTER_TEMPLATES[chosenKey];
    if (!template) return;

    gameState.activeEncounter = template;
    gameState.encounterWorldZ = -78;
    const iconEl = document.getElementById("disc-icon");
    if (iconEl) iconEl.textContent = template.icon;

    setMonologue(`「あ、前方に${template.title}がある！寄っていこうかな？」`);
}

export function dismissActiveEncounter() {
    gameState.activeEncounter = null;
    const badge = document.getElementById("discovery-badge-container");
    if (badge) badge.classList.add("hidden");
}

function getBestAffordableAction(enc) {
    if (!enc || !enc.actions || enc.actions.length === 0) return null;
    return enc.actions.find(act => gameState.money >= act.cost) || null;
}

let expandedEncounterType = null;

export function syncEncounterFullscreenOverlay() {
    let overlay = document.getElementById("encounter-fullscreen-overlay");
    if (!overlay) {
        const frame = document.getElementById("mobile-frame");
        if (!frame) return;
        overlay = document.createElement("div");
        overlay.id = "encounter-fullscreen-overlay";
        overlay.className = "hidden absolute inset-0 bg-stone-950/80 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center transition-all duration-300 opacity-0 scale-90";
        overlay.style.zIndex = "35";
        overlay.innerHTML = `
            <div class="w-full max-w-md flex flex-col items-center space-y-5">
                <div class="relative flex items-center justify-center">
                    <div class="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full bg-amber-400/25 animate-ping"></div>
                    <div class="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-amber-50 to-white border-4 border-amber-400 shadow-2xl flex items-center justify-center text-7xl sm:text-8xl">
                        <span id="efo-icon">⛽</span>
                    </div>
                </div>
                <div class="bg-stone-900/90 border border-amber-400/40 rounded-3xl px-5 py-4 shadow-xl space-y-1.5 w-full">
                    <div class="text-[13.5px] font-extrabold tracking-widest text-amber-300 uppercase">STOPPED AT SPOT!</div>
                    <h3 id="efo-title" class="text-lg sm:text-xl font-extrabold text-white">スポット名</h3>
                    <p id="efo-desc" class="text-xs sm:text-sm text-stone-300 leading-relaxed">説明文</p>
                    <div id="efo-plan-badge" class="inline-block mt-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold">
                        内容
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 w-full">
                    <button id="efo-decline-btn" type="button" class="py-3.5 px-4 rounded-2xl bg-stone-800 hover:bg-stone-700 active:scale-95 border border-stone-600 text-stone-200 font-extrabold text-sm shadow-lg transition cursor-pointer">
                        ✕ やめる（再出発）
                    </button>
                    <button id="efo-confirm-btn" type="button" class="py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-stone-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 transition cursor-pointer">
                        🛵 イベント実行
                    </button>
                </div>
            </div>
        `;
        frame.appendChild(overlay);

        const declineBtn = document.getElementById("efo-decline-btn");
        const confirmBtn = document.getElementById("efo-confirm-btn");
        if (declineBtn) declineBtn.addEventListener("click", declineExpandedEncounter);
        if (confirmBtn) confirmBtn.addEventListener("click", confirmExpandedEncounter);
    }

    const shouldShow = !gameState.isGameOver && gameState.mode === "stopped" && Boolean(gameState.stoppedAtEncounter);
    if (shouldShow) {
        const enc = gameState.stoppedAtEncounter;
        const affordableAct = getBestAffordableAction(enc);
        const fallbackAct = enc.actions[0];
        const confirmBtn = document.getElementById("efo-confirm-btn");
        const planBadge = document.getElementById("efo-plan-badge");

        if (expandedEncounterType !== enc.type) {
            expandedEncounterType = enc.type;
            setText("efo-icon", enc.icon);
            setText("efo-title", enc.title);
            setText("efo-desc", enc.desc);
        }

        if (affordableAct) {
            if (planBadge) {
                planBadge.textContent = `内容: ${affordableAct.label}`;
                planBadge.className = "inline-block mt-1 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold";
            }
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.textContent = "🛵 イベント実行";
                confirmBtn.className = "py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-stone-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 transition cursor-pointer";
            }
        } else {
            if (planBadge) {
                planBadge.textContent = `${fallbackAct.label}（所持金不足）`;
                planBadge.className = "inline-block mt-1 px-3 py-1 rounded-full bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-bold";
            }
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = "💸 所持金不足";
                confirmBtn.className = "py-3.5 px-4 rounded-2xl bg-stone-700 text-stone-400 font-extrabold text-sm cursor-not-allowed";
            }
        }

        if (overlay.classList.contains("hidden")) {
            overlay.classList.remove("hidden");
            requestAnimationFrame(() => {
                overlay.classList.remove("opacity-0", "scale-90");
                overlay.classList.add("opacity-100", "scale-100");
            });
        }
    } else {
        expandedEncounterType = null;
        if (!overlay.classList.contains("hidden")) {
            overlay.classList.add("hidden", "opacity-0", "scale-90");
            overlay.classList.remove("opacity-100", "scale-100");
        }
    }
}

export function confirmExpandedEncounter() {
    if (!gameState.stoppedAtEncounter || gameState.isBlackoutTransitioning) return;
    const enc = gameState.stoppedAtEncounter;
    const act = getBestAffordableAction(enc);
    if (!act) {
        showToast("所持金が足りません！");
        return;
    }

    gameState.isBlackoutTransitioning = true;
    gameState.stoppedAtEncounter = null;
    syncEncounterFullscreenOverlay();

    const blackout = document.getElementById("event-blackout-overlay");
    setText("blackout-icon", enc.icon);
    setText("blackout-title", enc.title);
    setText("blackout-sub", enc.blackoutText || `${act.label}を実行中...`);

    if (blackout) {
        blackout.classList.remove("hidden");
        requestAnimationFrame(() => {
            blackout.classList.remove("opacity-0");
            blackout.classList.add("opacity-100");
        });
    }

    setTimeout(() => {
        gameState.money -= act.cost;
        act.effect();
        gameState.mode = "riding";
        if (gameState.targetSpeed <= 0) gameState.targetSpeed = 30;
        updateAllUI();
        showToast(`${enc.title}（${act.label}）を完了！`);
    }, 450);

    setTimeout(() => {
        if (blackout) {
            blackout.classList.remove("opacity-100");
            blackout.classList.add("opacity-0");
        }
        setTimeout(() => {
            if (blackout) blackout.classList.add("hidden");
            gameState.isBlackoutTransitioning = false;
        }, 320);
    }, 950);
}

export function declineExpandedEncounter() {
    if (!gameState.stoppedAtEncounter) return;
    const enc = gameState.stoppedAtEncounter;
    gameState.stoppedAtEncounter = null;
    syncEncounterFullscreenOverlay();
    gameState.mode = "riding";
    if (gameState.targetSpeed <= 0) gameState.targetSpeed = 30;
    setMonologue(`「やっぱり${enc.title}はやめて先へ進もう！」`);
    showToast(`${enc.title}を見送って再発進しました`);
    updateAllUI();
}
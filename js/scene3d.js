// =========================================================
// Three.js 3Dシーン＆起伏・左右カーブ道路＆車両構築
// =========================================================
import { gameState, ENCOUNTER_STOP_RADIUS } from "./state.js";
import {
    advanceRoadScroll,
    getRoadElevationAtZ,
    getRoadPitchAtZ,
    getRoadCurveXAtZ,
    getRoadYawAtZ,
    computeEffectiveSpeedKmh
} from "./roadMath.js";
import { isCubInEncounterStopZone, dismissActiveEncounter } from "./encounters.js";
import {
    setMonologue,
    showToast,
    updateSpeedAndSlopeHUD,
    updateAllUI,
    triggerMentalGameOver,
    triggerCrashGameOver
} from "./ui.js";

let scene, camera, renderer, clock;
let cubGroup, frontWheel, rearWheel;
let roadSegments = [];
let centerDashes = [];
let roadsideTrees = [];
let distantMountains = [];
let oncomingCars = [];
let overtakingCars = [];
let encounterSignGroup = null;
let encounterZoneRing = null;
let rainPoints = null;

const ROAD_LENGTH = 160;
const SEGMENT_COUNT = 80;
const SEGMENT_DEPTH = ROAD_LENGTH / SEGMENT_COUNT;

let lastDisplayedSpeedInt = 30;
let lastDisplayedSlopeCat = 0;

export function getOvertakingCarsCount() {
    return overtakingCars.length;
}

export function clearTrafficVehicles() {
    for (const car of oncomingCars) {
        if (scene) scene.remove(car);
    }
    oncomingCars = [];

    for (const car of overtakingCars) {
        if (scene) scene.remove(car);
    }
    overtakingCars = [];
}

export function initThreeScene() {
    const container = document.getElementById("three-canvas-container");
    if (!container || typeof THREE === "undefined") return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.011);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 220);
    camera.position.set(0, 3.3, 6.8);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4d7c0f, 0.85);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
    dirLight.position.set(18, 28, 16);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
    const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const segGroup = new THREE.Group();
        segGroup.rotation.order = "YXZ";

        const roadMesh = new THREE.Mesh(
            new THREE.BoxGeometry(7.4, 0.25, SEGMENT_DEPTH * 1.28),
            roadMat
        );
        roadMesh.receiveShadow = true;
        segGroup.add(roadMesh);

        const leftLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.27, SEGMENT_DEPTH * 1.28),
            edgeLineMat
        );
        leftLine.position.x = -3.35;
        segGroup.add(leftLine);

        const rightLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.27, SEGMENT_DEPTH * 1.28),
            edgeLineMat
        );
        rightLine.position.x = 3.35;
        segGroup.add(rightLine);

        const leftGrass = new THREE.Mesh(
            new THREE.BoxGeometry(68, 0.2, SEGMENT_DEPTH * 1.35),
            grassMat
        );
        leftGrass.position.set(-37.7, -0.05, 0);
        segGroup.add(leftGrass);

        const rightGrass = new THREE.Mesh(
            new THREE.BoxGeometry(68, 0.2, SEGMENT_DEPTH * 1.35),
            grassMat
        );
        rightGrass.position.set(37.7, -0.05, 0);
        segGroup.add(rightGrass);

        const baseZ = 14 - i * SEGMENT_DEPTH;
        segGroup.userData = { baseZ };
        scene.add(segGroup);
        roadSegments.push(segGroup);
    }

    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const dashCount = 32;
    for (let i = 0; i < dashCount; i++) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 2.2), dashMat);
        dash.rotation.order = "YXZ";
        dash.userData = { z: 14 - i * 5 };
        scene.add(dash);
        centerDashes.push(dash);
    }

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
    for (let i = 0; i < 36; i++) {
        const treeGroup = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.6, 6), trunkMat);
        trunk.position.y = 0.8;
        const crown = new THREE.Mesh(new THREE.ConeGeometry(1.35, 3.2, 7), foliageMat);
        crown.position.y = 2.8;
        treeGroup.add(trunk, crown);

        const side = i % 2 === 0 ? -1 : 1;
        const xOffset = side * (6.2 + (i % 5) * 2.1);
        const zPos = 12 - i * 4.5;
        treeGroup.userData = { x: xOffset, z: zPos };
        scene.add(treeGroup);
        roadsideTrees.push(treeGroup);
    }

    const mountainMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 1.0 });
    distantMountains = [];
    for (let i = 0; i < 16; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const radius = 14 + (i % 4) * 5;
        const heightM = 18 + (i % 5) * 6;
        const mtn = new THREE.Mesh(new THREE.ConeGeometry(radius, heightM, 6), mountainMat);
        const zPos = -18 - i * 10;
        const baseOffset = side * (radius + 22 + (i % 3) * 6);
        mtn.userData = { baseOffset, heightM, zPos };
        mtn.position.set(getRoadCurveXAtZ(zPos) + baseOffset, heightM * 0.45 - 2, zPos);
        scene.add(mtn);
        distantMountains.push(mtn);
    }

    buildCubAndRider();
    buildEncounterSign();

    const rainGeo = new THREE.BufferGeometry();
    const rainCount = 600;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] = (Math.random() - 0.5) * 32;
        rainPositions[i * 3 + 1] = Math.random() * 18;
        rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60 - 15;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.14, transparent: true, opacity: 0.7 });
    rainPoints = new THREE.Points(rainGeo, rainMat);
    rainPoints.visible = false;
    scene.add(rainPoints);

    const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);
    document.addEventListener("fullscreenchange", handleResize);
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(handleResize);
        ro.observe(container);
    }
}

function buildCubAndRider() {
    cubGroup = new THREE.Group();
    cubGroup.rotation.order = "YXZ";

    const cubGreenMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.35, metalness: 0.2 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8, roughness: 0.2 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });

    const wheelGeo = new THREE.TorusGeometry(0.32, 0.08, 10, 20);
    frontWheel = new THREE.Mesh(wheelGeo, tireMat);
    frontWheel.rotation.y = Math.PI / 2;
    frontWheel.position.set(0, 0.38, -0.78);
    cubGroup.add(frontWheel);

    rearWheel = new THREE.Mesh(wheelGeo, tireMat);
    rearWheel.rotation.y = Math.PI / 2;
    rearWheel.position.set(0, 0.38, 0.75);
    cubGroup.add(rearWheel);

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 1.35), cubGreenMat);
    bodyMesh.position.set(0, 0.65, 0.05);
    bodyMesh.castShadow = true;
    cubGroup.add(bodyMesh);

    const legShield = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.58, 0.22), creamMat);
    legShield.position.set(0, 0.68, -0.45);
    legShield.rotation.x = -0.22;
    cubGroup.add(legShield);

    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.76, 8), chromeMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(0, 1.12, -0.52);
    cubGroup.add(handleBar);

    const rearBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.36, 0.42),
        new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.5 })
    );
    rearBox.position.set(0, 0.98, 0.72);
    rearBox.castShadow = true;
    cubGroup.add(rearBox);

    const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.14, 0.03),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    plate.position.set(0, 0.56, 0.98);
    cubGroup.add(plate);

    const tailLamp = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.1, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    tailLamp.position.set(0, 0.72, 0.96);
    cubGroup.add(tailLamp);

    const muffler = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 8), chromeMat);
    muffler.rotation.x = Math.PI / 2;
    muffler.position.set(0.22, 0.38, 0.42);
    cubGroup.add(muffler);

    const jacketMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.56, 10), jacketMat);
    torso.position.set(0, 1.12, 0.12);
    torso.rotation.x = 0.14;
    torso.castShadow = true;
    cubGroup.add(torso);

    const helmetMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.25 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), helmetMat);
    head.position.set(0, 1.54, 0.04);
    head.castShadow = true;
    cubGroup.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const ponytail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 8), hairMat);
    ponytail.position.set(0, 1.44, 0.24);
    ponytail.rotation.x = 0.55;
    cubGroup.add(ponytail);

    cubGroup.position.set(getRoadCurveXAtZ(0) + gameState.cubXWorld, 0, 0);
    scene.add(cubGroup);
}

function buildEncounterSign() {
    encounterSignGroup = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 3.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
    );
    pole.position.y = 1.5;
    const board = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.75, 0.15, 16),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b })
    );
    board.rotation.x = Math.PI / 2;
    board.position.y = 2.8;

    const zoneGeo = new THREE.RingGeometry(1.1, ENCOUNTER_STOP_RADIUS * 0.55, 28);
    const zoneMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.42
    });
    encounterZoneRing = new THREE.Mesh(zoneGeo, zoneMat);
    encounterZoneRing.rotation.x = -Math.PI / 2;
    encounterZoneRing.position.set(2.1, 0.18, 0);

    encounterSignGroup.add(pole, board, encounterZoneRing);
    encounterSignGroup.visible = false;
    scene.add(encounterSignGroup);
}

export function spawn3DOncomingCar() {
    if (!scene) return;
    const carGroup = new THREE.Group();
    carGroup.rotation.order = "YXZ";
    const colors = [0xef4444, 0xf8fafc, 0x1e3a8a, 0x94a3b8, 0xeab308];
    const bodyColor = colors[Math.floor(Math.random() * colors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.3 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 3.8), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.62, 2.0),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 })
    );
    cabin.position.set(0, 1.15, 0.1);
    carGroup.add(cabin);

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const hlLeft = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
    hlLeft.position.set(-0.62, 0.58, 1.91);
    const hlRight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lightMat);
    hlRight.position.set(0.62, 0.58, 1.91);
    carGroup.add(hlLeft, hlRight);

    const startZ = -125;
    carGroup.position.set(getRoadCurveXAtZ(startZ) + 1.65, getRoadElevationAtZ(startZ), startZ);
    scene.add(carGroup);
    oncomingCars.push(carGroup);
}

export function spawn3DOvertakingCar() {
    if (!scene) return;
    const carGroup = new THREE.Group();
    carGroup.rotation.order = "YXZ";
    const colors = [0x3b82f6, 0xf8fafc, 0x64748b, 0x10b981, 0xf59e0b];
    const bodyColor = colors[Math.floor(Math.random() * colors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.3, metalness: 0.3 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.72, 3.8), bodyMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    carGroup.add(chassis);

    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.48, 0.62, 2.0),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 })
    );
    cabin.position.set(0, 1.15, -0.1);
    carGroup.add(cabin);

    const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
    tlLeft.position.set(-0.62, 0.62, 1.91);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.08), tailMat);
    tlRight.position.set(0.62, 0.62, 1.91);
    carGroup.add(tlLeft, tlRight);

    const relPassX = Math.max(-0.45, Math.min(0.45, gameState.cubXWorld + 1.45));
    const startZ = 13;
    carGroup.position.set(getRoadCurveXAtZ(startZ) + relPassX, getRoadElevationAtZ(startZ), startZ);
    carGroup.userData = { hasStartled: false, relPassX };
    scene.add(carGroup);
    overtakingCars.push(carGroup);
}

export function animate3DLoop() {
    requestAnimationFrame(animate3DLoop);
    if (!renderer || !scene || !camera) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    const isRiding = gameState.mode === "riding" && !gameState.isGameOver;
    const isOutOfGas = gameState.gas <= 0;

    const targetEffectiveKmh = computeEffectiveSpeedKmh();
    if (!isRiding) {
        gameState.actualSpeed = 0;
    } else {
        gameState.actualSpeed += (targetEffectiveKmh - gameState.actualSpeed) * Math.min(1, dt * 4.5);
    }
    const effectiveKmh = gameState.actualSpeed;
    const roadSpeed = !isRiding ? 0 : (isOutOfGas ? 3.5 : (effectiveKmh / 30) * 24.0);

    const roundedKmh = Math.round(effectiveKmh);
    const pitchNow = getRoadPitchAtZ(0);
    const slopeCat = pitchNow > 0.03 ? 1 : (pitchNow < -0.03 ? -1 : 0);
    if (roundedKmh !== lastDisplayedSpeedInt || slopeCat !== lastDisplayedSlopeCat) {
        lastDisplayedSpeedInt = roundedKmh;
        lastDisplayedSlopeCat = slopeCat;
        updateSpeedAndSlopeHUD(roundedKmh, pitchNow);
    }

    if (roadSpeed > 0) {
        advanceRoadScroll(roadSpeed * dt);
        frontWheel.rotation.x -= roadSpeed * dt * 2.5;
        rearWheel.rotation.x -= roadSpeed * dt * 2.5;
    }

    for (let i = 0; i < roadSegments.length; i++) {
        const seg = roadSegments[i];
        const z = seg.userData.baseZ;
        seg.position.set(getRoadCurveXAtZ(z), getRoadElevationAtZ(z), z);
        seg.rotation.y = getRoadYawAtZ(z);
        seg.rotation.x = getRoadPitchAtZ(z);
    }

    for (let i = 0; i < centerDashes.length; i++) {
        const dash = centerDashes[i];
        dash.userData.z += roadSpeed * dt;
        if (dash.userData.z > 14) dash.userData.z -= 160;
        const z = dash.userData.z;
        dash.position.set(getRoadCurveXAtZ(z), getRoadElevationAtZ(z) + 0.02, z);
        dash.rotation.y = getRoadYawAtZ(z);
        dash.rotation.x = getRoadPitchAtZ(z);
    }

    for (let i = 0; i < roadsideTrees.length; i++) {
        const tree = roadsideTrees[i];
        tree.userData.z += roadSpeed * dt;
        if (tree.userData.z > 14) tree.userData.z -= 162;
        const z = tree.userData.z;
        tree.position.set(getRoadCurveXAtZ(z) + tree.userData.x, getRoadElevationAtZ(z), z);
    }

    for (let i = 0; i < distantMountains.length; i++) {
        const mtn = distantMountains[i];
        const z = mtn.userData.zPos;
        mtn.position.x = getRoadCurveXAtZ(z) + mtn.userData.baseOffset;
    }

    const roadCenterX0 = getRoadCurveXAtZ(0);
    const roadYaw0 = getRoadYawAtZ(0);
    if (cubGroup) {
        const hasCondition = gameState.conditions.cold || gameState.conditions.sleepy;

        if (gameState.steerInputQueue.length > 0) {
            const now = performance.now();
            while (gameState.steerInputQueue.length > 0 && now >= gameState.steerInputQueue[0].applyAt) {
                const item = gameState.steerInputQueue.shift();
                gameState.desiredLean = item.lean;
            }
        }

        const leanFollowRate = hasCondition ? 5.5 : 10.5;
        gameState.currentLean += (gameState.desiredLean - gameState.currentLean) * Math.min(1, dt * leanFollowRate);

        const wobbleLean = (hasCondition && isRiding)
            ? Math.sin(elapsed * 3.2) * (gameState.conditions.sleepy ? 0.22 : 0.14)
            : 0;
        const effectiveLean = Math.max(-1.15, Math.min(1.15, gameState.currentLean + wobbleLean));

        if (isRiding) {
            const speedFactor = Math.max(0.45, Math.min(1.35, effectiveKmh / 28));
            const isSteering = Math.abs(effectiveLean) > 0.03;
            if (isSteering) {
                const turnLateralVel = effectiveLean * 8.4 * speedFactor;
                gameState.cubXWorld += turnLateralVel * dt;
            }
        }

        const MAX_ROADSIDE_LIMIT = 3.65;
        gameState.cubXWorld = Math.max(-MAX_ROADSIDE_LIMIT, Math.min(MAX_ROADSIDE_LIMIT, gameState.cubXWorld));

        const isOncomingNow = gameState.cubXWorld > 0.15;
        const isOffRoadLeftNow = gameState.cubXWorld < -3.25;
        if ((isOncomingNow && !gameState.wasOncomingLane) || (isOffRoadLeftNow && !gameState.wasOffRoadLeft)) {
            if (isOncomingNow && !gameState.wasOncomingLane) {
                gameState.mental = Math.max(0, Math.round((gameState.mental - 1.5) * 100) / 100);
                setMonologue("「ひっ、反対車線にはみ出ちゃった！左に傾けて戻らなきゃ…！」");
            } else if (isOffRoadLeftNow && !gameState.wasOffRoadLeft) {
                gameState.mental = Math.max(0, Math.round((gameState.mental - 1.0) * 100) / 100);
                setMonologue("「うわっ、路肩にはみ出しそう！右へ戻さなきゃ！」");
            }
            updateAllUI();
            if (gameState.mental <= 0) {
                triggerMentalGameOver();
            }
        } else if (!isOncomingNow && gameState.wasOncomingLane) {
            updateAllUI();
        }
        gameState.wasOncomingLane = isOncomingNow;
        gameState.wasOffRoadLeft = isOffRoadLeftNow;

        cubGroup.position.x = roadCenterX0 + gameState.cubXWorld;

        const targetBank = -effectiveLean * 0.56;
        gameState.cubBankAngle += (targetBank - gameState.cubBankAngle) * Math.min(1, dt * 12);

        cubGroup.rotation.y = roadYaw0 - effectiveLean * 0.34;
        cubGroup.rotation.z = gameState.cubBankAngle;

        const groundY = getRoadElevationAtZ(0);
        const climbStrainFreq = pitchNow > 0.03 ? 34 : 26;
        const climbStrainAmp = pitchNow > 0.03 ? 0.05 : 0.032;
        const bounce = isRiding ? Math.abs(Math.sin(elapsed * climbStrainFreq)) * climbStrainAmp : 0;
        cubGroup.position.y = groundY + bounce;
        cubGroup.rotation.x = pitchNow;
    }

    if (camera && cubGroup) {
        const orbitDist = 6.6;
        const totalYaw = gameState.cameraOrbitYaw + roadYaw0 * 0.45;
        const targetCamX = cubGroup.position.x + Math.sin(totalYaw) * orbitDist;
        const targetCamZ = Math.cos(totalYaw) * orbitDist;
        const targetCamY = cubGroup.position.y + 3.1 - pitchNow * 2.2;

        camera.position.x += (targetCamX - camera.position.x) * Math.min(1, dt * 10);
        camera.position.y += (targetCamY - camera.position.y) * Math.min(1, dt * 8);
        camera.position.z += (targetCamZ - camera.position.z) * Math.min(1, dt * 10);

        const lookAheadZ = -10;
        const lookAheadX = getRoadCurveXAtZ(lookAheadZ) * 0.45 + cubGroup.position.x * 0.55;
        const lookAheadY = getRoadElevationAtZ(-12) * 0.45 + cubGroup.position.y * 0.55 + 1.15;
        camera.lookAt(lookAheadX, lookAheadY, -4.5);
    }

    for (let i = oncomingCars.length - 1; i >= 0; i--) {
        const car = oncomingCars[i];
        const relativeSpeed = roadSpeed + 26.0;
        car.position.z += relativeSpeed * dt;
        const cz = car.position.z;
        car.position.x = getRoadCurveXAtZ(cz) + 1.65;
        car.position.y = getRoadElevationAtZ(cz);
        car.rotation.y = getRoadYawAtZ(cz);
        car.rotation.x = getRoadPitchAtZ(cz);

        if (!gameState.isGameOver && cubGroup) {
            const dz = Math.abs(cz - cubGroup.position.z);
            const dx = Math.abs(car.position.x - cubGroup.position.x);
            if (dz < 2.25 && dx < 1.15) {
                triggerCrashGameOver();
            }
        }

        if (cz > 16) {
            scene.remove(car);
            oncomingCars.splice(i, 1);
        }
    }

    for (let i = overtakingCars.length - 1; i >= 0; i--) {
        const car = overtakingCars[i];
        const overtakeRelativeSpeed = Math.max(10.0, 34.0 - roadSpeed);
        car.position.z -= overtakeRelativeSpeed * dt;
        const cz = car.position.z;
        car.position.x = getRoadCurveXAtZ(cz) + car.userData.relPassX;
        car.position.y = getRoadElevationAtZ(cz);
        car.rotation.y = getRoadYawAtZ(cz);
        car.rotation.x = getRoadPitchAtZ(cz);

        if (!car.userData.hasStartled && cz <= 0.5 && !gameState.isGameOver) {
            car.userData.hasStartled = true;
            const mentalLoss = 2.5;
            gameState.mental = Math.max(0, Math.round((gameState.mental - mentalLoss) * 100) / 100);
            setMonologue("「うわっ、ビックリした！遅すぎてすぐ横を追い抜かれちゃった…！」");
            showToast("🚗 後続車に追い抜かれて驚いて、心が削られた！");
            updateAllUI();
            if (gameState.mental <= 0) {
                triggerMentalGameOver();
            }
        }

        if (cz < -115) {
            scene.remove(car);
            overtakingCars.splice(i, 1);
        }
    }

    const badgeContainer = document.getElementById("discovery-badge-container");
    const badgeRing = document.getElementById("disc-badge-ring");
    const zoneHint = document.getElementById("disc-zone-hint");
    if (gameState.activeEncounter && encounterSignGroup) {
        if (isRiding) {
            gameState.encounterWorldZ += roadSpeed * dt;
        }
        const ez = gameState.encounterWorldZ;
        const ex = getRoadCurveXAtZ(ez) - 4.1;
        const ey = getRoadElevationAtZ(ez);
        encounterSignGroup.visible = true;
        encounterSignGroup.position.set(ex, ey, ez);
        encounterSignGroup.rotation.y = getRoadYawAtZ(ez);

        const inZone = isCubInEncounterStopZone();
        if (encounterZoneRing) {
            encounterZoneRing.material.color.setHex(inZone ? 0x10b981 : 0xf59e0b);
            encounterZoneRing.material.opacity = inZone ? 0.72 : 0.38;
        }
        if (badgeRing && zoneHint) {
            if (inZone) {
                badgeRing.className = "w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 text-2xl sm:text-3xl shadow-xl border-[3px] border-emerald-500 flex items-center justify-center transition-all duration-150 ring-4 ring-emerald-400/70 scale-110";
                zoneHint.classList.remove("hidden");
            } else {
                badgeRing.className = "w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/95 text-2xl sm:text-3xl shadow-xl border-[3px] border-amber-500 flex items-center justify-center transition-all duration-150 ring-4 ring-amber-400/40";
                zoneHint.classList.add("hidden");
            }
        }

        const worldAnchor = new THREE.Vector3(ex, ey + 3.2, ez);
        worldAnchor.project(camera);
        const container = document.getElementById("three-canvas-container");
        if (container && worldAnchor.z < 1 && ez < 6) {
            const sx = (worldAnchor.x * 0.5 + 0.5) * container.clientWidth;
            const sy = (-worldAnchor.y * 0.5 + 0.5) * container.clientHeight;
            const distScale = Math.max(0.65, Math.min(1.25, 28 / Math.max(12, Math.abs(ez))));
            badgeContainer.classList.remove("hidden");
            badgeContainer.style.left = `${sx}px`;
            badgeContainer.style.top = `${sy}px`;
            badgeContainer.style.transform = `translate(-50%, -50%) scale(${distScale.toFixed(2)})`;
        } else {
            badgeContainer.classList.add("hidden");
        }

        if (ez > ENCOUNTER_STOP_RADIUS + 1.5) {
            dismissActiveEncounter();
        }
    } else {
        if (encounterSignGroup) encounterSignGroup.visible = false;
        if (badgeContainer) badgeContainer.classList.add("hidden");
        if (zoneHint) zoneHint.classList.add("hidden");
    }

    const monoAnchor = document.getElementById("monologue-anchor");
    if (monoAnchor && cubGroup && camera) {
        const container = document.getElementById("three-canvas-container");
        const headPos = new THREE.Vector3(
            cubGroup.position.x + 0.25,
            cubGroup.position.y + 2.05,
            cubGroup.position.z
        );
        headPos.project(camera);
        if (container && headPos.z < 1) {
            const mx = Math.max(12, Math.min(container.clientWidth - 250, (headPos.x * 0.5 + 0.5) * container.clientWidth));
            const my = Math.max(54, Math.min(container.clientHeight - 40, (-headPos.y * 0.5 + 0.5) * container.clientHeight));
            monoAnchor.style.left = `${mx}px`;
            monoAnchor.style.top = `${my}px`;
        }
    }

    if (rainPoints) {
        rainPoints.visible = gameState.weather === "rain";
        rainPoints.position.x = roadCenterX0;
        if (rainPoints.visible) {
            const posAttr = rainPoints.geometry.attributes.position;
            for (let i = 0; i < posAttr.count; i++) {
                let ry = posAttr.getY(i) - 22 * dt;
                let rz = posAttr.getZ(i) + (roadSpeed * 0.5) * dt;
                if (ry < 0) ry = 18;
                if (rz > 12) rz = -48;
                posAttr.setY(i, ry);
                posAttr.setZ(i, rz);
            }
            posAttr.needsUpdate = true;
        }
    }

    renderer.render(scene, camera);
}
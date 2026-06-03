export interface Ripple {
    x: number;
    y: number;
    currentRadius: number;
    maxRadius: number;
    speed: number;
    alpha: number;
    seedX: number; // 揺らぎのランダムシード
    seedY: number; // 揺らぎのランダムシード
    numRings: number; // この波紋のリング数（2 or 3）
}

export interface Particle {
    x: number;
    y: number;
    z: number; // 奥行き
    size: number;
    speedY: number;
    speedX: number;
    rotation: number;
    rotationSpeed: number;
    flip: number;
    flipSpeed: number;
    sway: number; // 左右の揺れのパラメータ
    swaySpeed: number;
    colorType?: number; // 紅葉の色のバリエーション用
}

export function drawSakura(ctx: CanvasRenderingContext2D, p: Particle) {
    const gradient = ctx.createLinearGradient(-p.size / 2, -p.size / 2, p.size / 2, p.size / 2);
    gradient.addColorStop(0, "rgba(255, 183, 197, 0.9)");
    gradient.addColorStop(1, "rgba(255, 228, 233, 0.7)");
    ctx.fillStyle = gradient;
    ctx.shadowColor = "rgba(255, 183, 197, 0.3)";
    ctx.shadowBlur = 4;

    ctx.beginPath();
    ctx.moveTo(0, p.size / 2);
    ctx.bezierCurveTo(-p.size / 1.5, p.size / 4, -p.size / 2, -p.size * 0.8, -p.size / 6, -p.size);
    ctx.lineTo(0, -p.size * 0.75);
    ctx.lineTo(p.size / 6, -p.size);
    ctx.bezierCurveTo(p.size / 2, -p.size * 0.8, p.size / 1.5, p.size / 4, 0, p.size / 2);
    ctx.closePath();
    ctx.fill();
}

export function drawMomiji(ctx: CanvasRenderingContext2D, p: Particle) {
    let color1, color2, shadow;
    if (p.colorType !== undefined) {
        if (p.colorType < 5) {
            // 赤 (50%)
            color1 = "rgba(200, 30, 30, 0.9)";
            color2 = "rgba(160, 20, 20, 0.8)";
            shadow = "rgba(200, 30, 30, 0.4)";
        } else if (p.colorType < 8) {
            // オレンジ (30%)
            color1 = "rgba(220, 100, 20, 0.9)";
            color2 = "rgba(180, 70, 10, 0.8)";
            shadow = "rgba(220, 100, 20, 0.4)";
        } else {
            // 黄色 (20%)
            color1 = "rgba(230, 180, 30, 0.9)";
            color2 = "rgba(190, 140, 20, 0.8)";
            shadow = "rgba(230, 180, 30, 0.4)";
        }
    } else {
        color1 = "rgba(200, 30, 30, 0.9)";
        color2 = "rgba(160, 20, 20, 0.8)";
        shadow = "rgba(200, 30, 30, 0.4)";
    }

    const gradient = ctx.createLinearGradient(-p.size, -p.size, p.size, p.size);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.shadowColor = shadow;
    ctx.shadowBlur = 4;

    const s = p.size;

    // より有機的な曲線で描くカエデ（紅葉）の輪郭と茎
    ctx.beginPath();
    // 茎（果柄）の部分
    ctx.moveTo(s * 0.04, s * 0.8);
    ctx.lineTo(s * 0.02, s * 1.25);
    ctx.lineTo(-s * 0.02, s * 1.25);
    ctx.lineTo(-s * 0.04, s * 0.8);

    // 右下の裂片
    ctx.quadraticCurveTo(s * 0.3, s * 0.8, s * 0.6, s * 0.65);
    ctx.quadraticCurveTo(s * 0.4, s * 0.5, s * 0.3, s * 0.4);
    // 右中（真横）の裂片
    ctx.quadraticCurveTo(s * 0.7, s * 0.2, s * 0.9, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.05, s * 0.4, -s * 0.15);
    // 右上の裂片
    ctx.quadraticCurveTo(s * 0.6, -s * 0.4, s * 0.45, -s * 0.75);
    ctx.quadraticCurveTo(s * 0.25, -s * 0.5, s * 0.1, -s * 0.45);
    // 頂上（中央）の裂片
    ctx.quadraticCurveTo(s * 0.1, -s * 0.7, 0, -s * 1.0);
    ctx.quadraticCurveTo(-s * 0.1, -s * 0.7, -s * 0.1, -s * 0.45);
    // 左上の裂片
    ctx.quadraticCurveTo(-s * 0.25, -s * 0.5, -s * 0.45, -s * 0.75);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.4, -s * 0.4, -s * 0.15);
    // 左中（真横）の裂片
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.05, -s * 0.9, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.7, s * 0.2, -s * 0.3, s * 0.4);
    // 左下の裂片
    ctx.quadraticCurveTo(-s * 0.4, s * 0.5, -s * 0.6, s * 0.65);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.8, -s * 0.04, s * 0.8);

    ctx.closePath();
    ctx.fill();

    // 葉脈をうっすら描画して本物らしさを出す
    ctx.beginPath();
    ctx.strokeStyle = "rgba(40, 10, 0, 0.25)"; // 暗褐色の半透明
    ctx.lineWidth = s * 0.05; // 葉のサイズに応じた葉脈の太さ
    ctx.lineCap = "round";
    // 中央の主脈
    ctx.moveTo(0, s * 0.8);
    ctx.lineTo(0, -s * 0.85);
    // 右上の葉脈
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(s * 0.35, -s * 0.65);
    // 左上の葉脈
    ctx.moveTo(0, s * 0.15);
    ctx.lineTo(-s * 0.35, -s * 0.65);
    // 右横の葉脈
    ctx.moveTo(0, s * 0.45);
    ctx.lineTo(s * 0.75, -s * 0.05);
    // 左横の葉脈
    ctx.moveTo(0, s * 0.45);
    ctx.lineTo(-s * 0.75, -s * 0.05);
    // 右下の葉脈
    ctx.moveTo(0, s * 0.65);
    ctx.lineTo(s * 0.45, s * 0.55);
    // 左下の葉脈
    ctx.moveTo(0, s * 0.65);
    ctx.lineTo(-s * 0.45, s * 0.55);
    ctx.stroke();
}

export function drawSnow(ctx: CanvasRenderingContext2D, p: Particle) {
    // 現在のテーマがダークモードかどうかをHTML要素のクラスで判定
    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? "rgba(255, 255, 255, 0.85)" : "rgba(200, 210, 220, 0.9)";
    const shadow = isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(100, 110, 120, 0.3)";

    if (p.size < 6) {
        // 小さい雪は丸い粉雪として描画
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = shadow;
        ctx.shadowBlur = p.size;
        ctx.fill();
    } else {
        // 大きい雪は六角形の雪の結晶として描画
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.shadowColor = shadow;
        ctx.shadowBlur = p.size / 2;
        ctx.lineWidth = Math.max(0.5, p.size / 8);
        ctx.lineCap = "round";

        const spikes = 6;
        const radius = p.size;

        // 雪の結晶を描くループ
        for (let i = 0; i < spikes; i++) {
            ctx.save();
            // 結晶全体をゆっくり回転させてきらめきを表現
            ctx.rotate((Math.PI * 2 * i) / spikes + p.rotation);

            // 中心の主軸
            ctx.moveTo(0, 0);
            ctx.lineTo(0, radius);

            // 枝分かれ（V字）
            const branchLength = radius * 0.4;
            const branchStart = radius * 0.4;

            ctx.moveTo(0, branchStart);
            ctx.lineTo(branchLength * 0.7, branchStart + branchLength * 0.7);

            ctx.moveTo(0, branchStart);
            ctx.lineTo(-branchLength * 0.7, branchStart + branchLength * 0.7);

            ctx.restore();
        }
        ctx.stroke();
    }
}

export function drawDandelion(ctx: CanvasRenderingContext2D, p: Particle) {
    const isDark = document.documentElement.classList.contains('dark');
    const fluffColor = isDark ? "rgba(255, 255, 255, 0.6)" : "rgba(220, 220, 220, 0.8)";
    const seedColor = isDark ? "rgba(100, 80, 60, 0.9)" : "rgba(80, 60, 40, 0.9)";

    ctx.save();
    // 重力方向を下に保ちつつ、風(sway)と自身のゆっくりとした回転(rotation)を組み合わせて
    // ふわふわと向きを変える自然な動きを表現する
    ctx.rotate(Math.sin(p.sway) * 0.3 + Math.cos(p.rotation) * 0.2);

    const s = p.size;

    // 種（そう果） - 下部の茶色い部分
    ctx.beginPath();
    ctx.ellipse(0, s * 0.6, s * 0.15, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = seedColor;
    ctx.fill();

    // 種から冠毛への茎（嘴）
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.lineTo(0, -s * 0.2);
    ctx.strokeStyle = seedColor;
    ctx.lineWidth = Math.max(0.5, s * 0.03);
    ctx.stroke();

    // 綿毛全体が風で一斉にたなびくための統一されたオフセット（傘全体が傾くイメージ）            // 冠毛（パラシュート部分）
    ctx.beginPath();
    const fluffLines = 24; // 毛の数（シンプルで綺麗な密度にする）

    // 綿毛全体が風で一斉に傾くためのオフセット
    const globalSway = Math.sin(p.sway * 1.5) * 0.15;

    // 扇状の広がり角度（ベース）
    const maxSpread = Math.PI * 0.8;

    // 風が強い時（swayが大きい時）は少しすぼまる
    const currentSpread = maxSpread * (1 - Math.abs(globalSway) * 0.4);

    for (let i = 0; i < fluffLines; i++) {
        // 素直に左から右へ均等に配置する
        const t = i / (fluffLines - 1); // 0.0 ~ 1.0
        const baseAngle = -Math.PI / 2 - currentSpread / 2 + currentSpread * t;

        // 全ての毛が同じ傘として同じ方向にたなびく
        const angle = baseAngle + globalSway;

        // 根元は固定し、先端に向けて美しい同じカーブを描く
        const cpX = Math.cos(angle) * s * 0.5;
        const cpY = Math.sin(angle) * s * 0.5;

        // 長さは全て固定にし、風でわずかに全体が伸縮する程度にとどめる
        const lengthM = 1.0 + Math.cos(p.sway * 2) * 0.03;
        const endX = Math.cos(angle) * s * 1.2 * lengthM;
        const endY = Math.sin(angle) * s * 1.2 * lengthM;

        ctx.moveTo(0, -s * 0.2);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    }

    // 線の太さや透明度を完全に統一して、スッキリとした1つの綿毛にする
    ctx.strokeStyle = fluffColor;
    ctx.lineWidth = Math.max(0.5, s * 0.04);
    ctx.lineCap = "round";
    ctx.stroke();

    // 冠毛の中心のふわふわした部分
    ctx.beginPath();
    ctx.arc(0, -s * 0.2, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = fluffColor;
    ctx.fill();

    ctx.restore();
}

export function drawRainDrop(ctx: CanvasRenderingContext2D, p: Particle) {
    const isDark = document.documentElement.classList.contains("dark");
    const color = isDark ? "rgba(200, 220, 255, 0.5)" : "rgba(150, 180, 220, 0.45)";

    ctx.beginPath();
    // 雨粒: わずかに傾いた縦線（上から下）
    const tilt = p.speedX * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(tilt, p.size);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, p.z * 1.2);
    ctx.lineCap = "round";
    ctx.stroke();
}

export function drawRipple(ctx: CanvasRenderingContext2D, r: Ripple) {
    const isDark = document.documentElement.classList.contains('dark');

    // 滑らかなフェードアウト（曲線で自然な消失を表現）
    const fadeAlpha = Math.pow(Math.max(0, r.alpha), 1.5);

    ctx.save();
    ctx.translate(r.x, r.y);

    // わずかな揺らぎ（真円ではなく微妙に歪む）
    const wobbleX = 1 + Math.sin(r.seedX + r.currentRadius * 0.05) * 0.02;
    const wobbleY = 0.35 + Math.cos(r.seedY + r.currentRadius * 0.05) * 0.02;
    ctx.scale(wobbleX, wobbleY);

    // この波紋のリング数（2本 or 3本、生成時にランダム決定済み）
    const numRings = r.numRings;

    // 波同士が重なっても破綻しないブレンドモード
    ctx.globalCompositeOperation = isDark ? "screen" : "source-over";

    for (let i = 0; i < numRings; i++) {
        // 全てのリングが同時に発生し、内側のリングほど速度が遅い
        // これにより時間が経つほど自然に間隔が広がる（実際の水面と同じ）
        // i=0: 最外リング（speed × 1.0）, i=1: (speed × 0.82), i=2: (speed × 0.65)
        const speedFactor = 1.0 - i * 0.18;
        // seedを使ってリングごとに微妙な速度差のランダム揺らぎを加える
        const randomSpeedTweak = 1.0 + Math.sin(r.seedX * (i + 1) * 5.7) * 0.05;
        const ringRadius = r.currentRadius * speedFactor * randomSpeedTweak;

        if (ringRadius <= 0) continue;
        const ringProgress = ringRadius / r.maxRadius;
        if (ringProgress >= 1) continue;

        // 滑らかな透明度：外側ほど薄くなる曲線
        const progressFade = Math.pow(1 - ringProgress, 1.2);
        // 内側の波ほどエネルギー減衰で薄い
        const energyDecay = Math.max(0, 1 - i * 0.2);
        const ringAlpha = fadeAlpha * progressFade * energyDecay;
        if (ringAlpha <= 0.005) continue;

        // 波が広がるほど線が細くなる
        const currentWidth = Math.max(0.3, 2.0 - (ringProgress * 1.2));

        // 水色系の色味で視認性を確保
        const highlightColor = isDark
            ? `rgba(120, 200, 255, ${Math.min(1, ringAlpha * 1.8)})`
            : `rgba(60, 160, 220, ${Math.min(1, ringAlpha * 1.2)})`;
        const shadowColor = isDark
            ? `rgba(20, 60, 120, ${Math.min(1, ringAlpha * 1.5)})`
            : `rgba(30, 80, 140, ${Math.min(1, ringAlpha * 0.8)})`;

        // 波の谷（シャドウ）
        if (ringRadius > 1) {
            ctx.beginPath();
            ctx.arc(0, 0, ringRadius - 1, 0, Math.PI * 2);
            ctx.strokeStyle = shadowColor;
            ctx.lineWidth = currentWidth * 1.5;
            ctx.stroke();
        }

        // 波の山（ハイライト）
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = currentWidth;
        ctx.stroke();
    }

    ctx.restore();
}

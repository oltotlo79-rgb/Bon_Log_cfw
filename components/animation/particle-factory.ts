import type { AnimationType } from "@/lib/sakura-petals-pref";
import type { Particle } from "./particle-renderers";

export function createParticle(animType: AnimationType, isInitial: boolean = false): Particle {
    const isSnow = animType === "snow";
    const isDandelion = animType === "dandelion";
    const isRainDrops = animType === "rain-drops";

    return {
        x: Math.random() * window.innerWidth,
        y: isInitial
            ? (isRainDrops ? Math.random() * (window.innerHeight + 100) - 100 : Math.random() * window.innerHeight)
            : (isDandelion ? Math.random() * window.innerHeight * 0.5 + window.innerHeight * 0.5 : isRainDrops ? -30 : -20),
        z: Math.random() * 0.5 + 0.5,
        size: isRainDrops ? Math.random() * 14 + 10 : isSnow ? Math.random() * 8 + 3 : isDandelion ? Math.random() * 10 + 15 : Math.random() * 8 + (animType === "sakura" ? 8 : 12),
        speedY: isRainDrops ? Math.random() * 4 + 5 : isSnow ? Math.random() * 0.8 + 0.3 : isDandelion ? Math.random() * 0.5 - 0.2 : Math.random() * 1.5 + (animType === "sakura" ? 1.0 : 0.8),
        speedX: isRainDrops ? (Math.random() - 0.5) * 0.8 : isSnow ? Math.random() * 1.5 - 0.75 : isDandelion ? Math.random() * 2 + 1.0 : Math.random() * 2 - 1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * (isDandelion ? 0.02 : 0.05),
        flip: Math.random() * Math.PI * 2,
        flipSpeed: (Math.random() - 0.5) * (animType === "sakura" ? 0.08 : isDandelion ? 0.03 : 0.05),
        sway: Math.random() * Math.PI * 2,
        swaySpeed: isSnow ? Math.random() * 0.01 + 0.005 : isDandelion ? Math.random() * 0.015 + 0.01 : Math.random() * 0.02 + 0.01,
        // 色バリエーション: 0~4(赤50%), 5~7(オレンジ30%), 8~9(黄色20%)
        colorType: Math.floor(Math.random() * 10),
    };
}

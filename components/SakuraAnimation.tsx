"use client";

import React, { useEffect, useRef, useState } from "react";
import {
    getBgAnimationType,
    BG_ANIMATION_CHANGE_EVENT,
    type BgAnimationChangeDetail,
    type AnimationType,
} from "@/lib/sakura-petals-pref";
import {
    drawSakura,
    drawMomiji,
    drawSnow,
    drawDandelion,
    drawRainDrop,
    drawRipple,
} from "@/components/animation/particle-renderers";
import type { Particle, Ripple } from "@/components/animation/particle-renderers";
import { createParticle } from "@/components/animation/particle-factory";
import {
    PARTICLE_COUNT_BY_TYPE,
    PARTICLE_COUNT_FALLBACK,
    RIPPLE_ALPHA_MIN_DECAY,
    RIPPLE_DECELERATION_EXP,
    RIPPLE_MAX_CONCURRENT,
    RIPPLE_MAX_RADIUS_BASE,
    RIPPLE_MAX_RADIUS_JITTER,
    RIPPLE_SPAWN_PROBABILITY,
    RIPPLE_SPEED_BASE,
    RIPPLE_SPEED_JITTER,
    RIPPLE_SPEED_MIN_RATIO,
    RIPPLE_TWO_RINGS_PROBABILITY,
    SNOW_FLAKE_3D_FLIP_MIN_SIZE,
    SWAY_MULTIPLIER_BY_TYPE,
    SWAY_MULTIPLIER_FALLBACK,
} from "@/lib/constants/animation";

export default function SakuraAnimation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const ripplesRef = useRef<Ripple[]>([]);
    const animationFrameId = useRef<number>(0);
    // 初期値は "none"。preference / 季節判定は client mount 後に上書きする。
    // Why: 初期値を "sakura" にすると、ユーザーが "none" 設定でも初回 paint だけ
    // 桜 canvas が出てしまい、reduced-motion ユーザーに対しても同じ問題が起きる。
    const [animType, setAnimType] = useState<AnimationType>("none");

    // 設定変更イベントの購読
    useEffect(() => {
        const handler = (e: CustomEvent<BgAnimationChangeDetail>) => {
            setAnimType(e.detail.type);
        };
        window.addEventListener(
            BG_ANIMATION_CHANGE_EVENT,
            handler as EventListener
        );
        // mount 後の最初のフレームで保存設定を反映 (SSR と client 初回 paint の hydration mismatch を防ぐ)。
        const id = setTimeout(() => setAnimType(getBgAnimationType()), 0);
        return () => {
            clearTimeout(id);
            window.removeEventListener(
                BG_ANIMATION_CHANGE_EVENT,
                handler as EventListener
            );
        };
    }, []);

    useEffect(() => {
        if (animType === "none") return;

        // prefers-reduced-motion を canvas 初期化前に判定する。
        // ここで早期 return しないと resize / particle 配列を作るだけ作って捨てる無駄が出る。
        const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (motionQuery.matches) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let currentDpr = window.devicePixelRatio || 1;
        const resizeCanvas = () => {
            currentDpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * currentDpr;
            canvas.height = window.innerHeight * currentDpr;
            ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        const particleCount = PARTICLE_COUNT_BY_TYPE[animType] ?? PARTICLE_COUNT_FALLBACK;
        const particles: Particle[] = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push(createParticle(animType, true));
        }
        particlesRef.current = particles;

        const animate = () => {
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            const particles = particlesRef.current;
            const ripples = ripplesRef.current;

            if (animType === "rain") {
                // 同時表示数を抑えて CPU 負荷を防ぐ。
                if (ripples.length < RIPPLE_MAX_CONCURRENT && Math.random() < RIPPLE_SPAWN_PROBABILITY) {
                    ripples.push({
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight,
                        currentRadius: 0,
                        maxRadius: Math.random() * RIPPLE_MAX_RADIUS_JITTER + RIPPLE_MAX_RADIUS_BASE,
                        speed: Math.random() * RIPPLE_SPEED_JITTER + RIPPLE_SPEED_BASE,
                        alpha: 1.0,
                        seedX: Math.random() * Math.PI * 2,
                        seedY: Math.random() * Math.PI * 2,
                        numRings: Math.random() < RIPPLE_TWO_RINGS_PROBABILITY ? 2 : 3,
                    });
                }
            }

            // 波紋の描画と更新
            for (let i = ripples.length - 1; i >= 0; i--) {
                const r = ripples[i];
                if (!r) continue;
                drawRipple(ctx, r);

                // 広がるにつれて速度が落ちる（減速）
                const progress = r.currentRadius / r.maxRadius;
                const currentSpeed = r.speed * Math.max(RIPPLE_SPEED_MIN_RATIO, 1.0 - Math.pow(progress, RIPPLE_DECELERATION_EXP));
                r.currentRadius += currentSpeed;

                // 速度低下に伴い透明度もゆっくり下がるが、最低減衰量を設けて蓄積を防ぐ
                r.alpha -= Math.max(RIPPLE_ALPHA_MIN_DECAY, (currentSpeed / r.maxRadius) * 0.5);

                // alphaが尽きたか、maxRadiusを超えたら強制削除
                if (r.alpha <= 0 || r.currentRadius >= r.maxRadius) {
                    ripples.splice(i, 1);
                }
            }
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (!p) continue;

                p.y += p.speedY * p.z;
                const swayMultiplier = SWAY_MULTIPLIER_BY_TYPE[animType] ?? SWAY_MULTIPLIER_FALLBACK;
                const swayAmount = Math.sin(p.sway) * swayMultiplier;
                p.x += (p.speedX + swayAmount) * p.z;

                p.rotation += p.rotationSpeed;
                p.flip += p.flipSpeed;
                p.sway += p.swaySpeed;

                if (
                    p.y > window.innerHeight + p.size ||
                    p.x < -p.size * 2 ||
                    p.x > window.innerWidth + p.size * 2
                ) {
                    // 画面外に出たパーティクルをリセット
                    const recycled = createParticle(animType, false);
                    if (animType === "dandelion") {
                        // 綿毛は左から出てくるようにする
                        recycled.x = -recycled.size * 2;
                        recycled.y = Math.random() * window.innerHeight;
                    }
                    particles[i] = recycled;
                }

                ctx.save();
                ctx.translate(p.x, p.y);
                const scale = p.z;

                if (animType === "snow" || animType === "dandelion" || animType === "rain" || animType === "rain-drops") {
                    if (p.size >= SNOW_FLAKE_3D_FLIP_MIN_SIZE && animType === "snow") {
                        // 雪の結晶（大きいサイズ）は、平たい結晶の形をしているのでヒラヒラとフリップさせる
                        const xFlip = Math.cos(p.flip);
                        const yFlip = Math.sin(p.flip);
                        ctx.scale(scale * xFlip, scale * yFlip);
                    } else {
                        // 小さな粉雪（丸）・綿毛・雨粒は2Dフリップを適用しない
                        ctx.scale(scale, scale);
                    }
                } else {
                    // 桜や紅葉などの葉は、花びらのようにひらひらと裏返るフリップと回転を適用
                    const xFlip = Math.cos(p.flip);
                    const yFlip = Math.sin(p.flip);
                    ctx.scale(scale * xFlip, scale * yFlip);
                    ctx.rotate(p.rotation);
                }

                if (animType === "sakura") {
                    drawSakura(ctx, p);
                } else if (animType === "momiji") {
                    drawMomiji(ctx, p);
                } else if (animType === "snow") {
                    drawSnow(ctx, p);
                } else if (animType === "dandelion") {
                    drawDandelion(ctx, p);
                } else if (animType === "rain-drops") {
                    drawRainDrop(ctx, p);
                }

                ctx.restore();
            }

            animationFrameId.current = requestAnimationFrame(animate);
        };

        animate();

        // タブ非表示時にアニメーションを停止してCPU/バッテリーを節約
        const handleVisibilityChange = () => {
            if (document.hidden) {
                cancelAnimationFrame(animationFrameId.current);
            } else {
                animationFrameId.current = requestAnimationFrame(animate);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.removeEventListener("resize", resizeCanvas);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            cancelAnimationFrame(animationFrameId.current);
        };
    }, [animType]);

    if (animType === "none") return null;

    return (
        <canvas
            ref={canvasRef}
            className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10"
            aria-hidden="true"
        />
    );
}

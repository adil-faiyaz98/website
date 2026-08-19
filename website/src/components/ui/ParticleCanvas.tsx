"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface ParticleCanvasProps {
  /** Number of particles */
  count?: number;
  /** Particle color */
  color?: string;
  /** Whether particles follow cursor */
  cursorInteractive?: boolean;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export function ParticleCanvas({
  count = 50,
  color = "#6366F1",
  cursorInteractive = true,
  className = "",
}: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const [contextAvailable, setContextAvailable] = useState(true);

  const initParticles = useCallback(
    (width: number, height: number) => {
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          radius: Math.random() * 2 + 1,
          opacity: Math.random() * 0.5 + 0.2,
        });
      }
      particlesRef.current = particles;
    },
    [count]
  );

  const animate = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      const mouse = mouseRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Cursor interaction: particles are gently attracted to cursor
        if (cursorInteractive && mouse.x > 0 && mouse.y > 0) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const force = (150 - dist) / 150;
            p.vx += (dx / dist) * force * 0.02;
            p.vy += (dy / dist) * force * 0.02;
          }
        }

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Apply friction to prevent runaway velocity
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${Math.round(p.opacity * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.fill();
      }

      // Draw connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const lineOpacity = (1 - dist / 120) * 0.15;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `${color}${Math.round(lineOpacity * 255)
              .toString(16)
              .padStart(2, "0")}`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(() =>
        animate(ctx, width, height)
      );
    },
    [color, cursorInteractive]
  );

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // Canvas 2D context unavailable — gracefully degrade
      setContextAvailable(false);
      return;
    }

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      initParticles(width, height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    handleResize();

    // Start animation loop
    animate(ctx, canvas.width, canvas.height);

    // Event listeners
    window.addEventListener("resize", handleResize);
    if (cursorInteractive) {
      canvas.parentElement?.addEventListener("mousemove", handleMouseMove);
      canvas.parentElement?.addEventListener("mouseleave", handleMouseLeave);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
      if (cursorInteractive) {
        canvas.parentElement?.removeEventListener("mousemove", handleMouseMove);
        canvas.parentElement?.removeEventListener(
          "mouseleave",
          handleMouseLeave
        );
      }
    };
  }, [prefersReducedMotion, cursorInteractive, initParticles, animate]);

  if (prefersReducedMotion || !contextAvailable) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}

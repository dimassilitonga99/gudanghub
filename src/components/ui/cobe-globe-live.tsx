"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

export interface LiveMarker {
  id: string
  nama: string
  alamat: string
  color: string
  location: [number, number]
}

interface GlobeLiveProps {
  markers?: LiveMarker[]
  className?: string
  speed?: number
}

/* ── Haversine distance (km) ── */
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/* ── Hub pusat di Kupang ── */
const HUB: [number, number] = [-10.177, 123.597]

/* ── Posisi label di sekitar globe (persen dari lebar/tinggi) ── */
const LABEL_ANCHORS: Record<string, { top: string; left: string; align: string }> = {
  CB001: { top: "12%", left: "8%",  align: "left" },
  CB002: { top: "30%", left: "0%",  align: "left" },
  CB003: { top: "52%", left: "2%",  align: "left" },
  CB004: { top: "70%", left: "10%", align: "left" },
}

export function GlobeLive({
  markers = [],
  className = "",
  speed = 0.003,
}: GlobeLiveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        }
      }
    }
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId: number
    let phi = 0

    const safeMarkers = Array.isArray(markers) ? markers : []
    if (safeMarkers.length === 0) return

    /* ── markers: pusat + 4 toko ── */
    const allMarkers = [
      { location: HUB, size: 0.04, id: "hub" },
      ...safeMarkers.map((m) => ({ location: m.location, size: 0.06, id: m.id })),
    ]

    /* ── arcs: hub → tiap toko ── */
    const arcs = safeMarkers.map((m) => ({
      startLat: HUB[0],
      startLng: HUB[1],
      endLat: m.location[0],
      endLng: m.location[1],
      color: [1, 0.42, 0],
    }))

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return

      try {
        globe = createGlobe(canvas, {
          devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          width,
          height: width,
          phi: 0,
          theta: 0.15,
          dark: 1,
          diffuse: 1.2,
          mapSamples: 16000,
          mapBrightness: 6,
          baseColor: [0.1, 0.1, 0.13],
          markerColor: [1, 0.42, 0],
          glowColor: [0.15, 0.12, 0.08],
          markers: allMarkers,
          arcs,
          arcColor: [1, 0.42, 0],
          arcWidth: 0.4,
          arcHeight: 0.2,
          arcDashLength: 0.4,
          arcDashGap: 0.2,
          arcDashAnimateGap: 15,
          opacity: 0.85,
        })
      } catch (e) {
        console.error('[GlobeLive] createGlobe failed:', e)
        return
      }

      function animate() {
        if (!isPausedRef.current) phi += speed
        if (globe) {
          try {
            globe.update({
              phi: phi + phiOffsetRef.current + dragOffset.current.phi,
              theta: 0.15 + thetaOffsetRef.current + dragOffset.current.theta,
            })
          } catch {}
        }
        animationId = requestAnimationFrame(animate)
      }
      animate()
      setTimeout(() => canvas && (canvas.style.opacity = "1"))
    }

    if (canvas.offsetWidth > 0) {
      init()
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect()
          init()
        }
      })
      ro.observe(canvas)
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId)
      if (globe) globe.destroy()
    }
  }, [markers, speed])

  return (
    <div className={`relative select-none ${className}`}>
      {/* ── Globe canvas ── */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 1.2s ease",
          borderRadius: "50%",
          touchAction: "none",
        }}
      />

      {/* ── Floating labels di sekitar globe ── */}
      {(Array.isArray(markers) ? markers : []).map((m, i) => {
        const anchor = LABEL_ANCHORS[m.id] || { top: "50%", left: "50%", align: "center" }
        const dist = haversine(HUB, m.location)
        return (
          <div
            key={m.id}
            className="pointer-events-none absolute z-10"
            style={{
              top: anchor.top,
              left: anchor.left,
              animation: `fadeInLabel 0.8s ease ${0.4 + i * 0.15}s both`,
            }}
          >
            <div className="flex items-center gap-1.5" style={{ flexDirection: anchor.align === "right" ? "row-reverse" : "row" }}>
              {/* garis panah */}
              <div
                className="h-px flex-shrink-0"
                style={{
                  width: "28px",
                  background: `linear-gradient(${anchor.align === "right" ? "270deg" : "90deg"}, ${m.color}, transparent)`,
                }}
              />
              {/* panah segitiga */}
              <svg
                width="8" height="8" viewBox="0 0 8 8"
                style={{ transform: anchor.align === "right" ? "scaleX(-1)" : "none", flexShrink: 0 }}
              >
                <polygon points="0,0 8,4 0,8" fill={m.color} opacity={0.8} />
              </svg>
              {/* label card */}
              <div
                className="rounded-md px-2 py-1 backdrop-blur-sm"
                style={{
                  background: "rgba(0,0,0,0.7)",
                  border: `1px solid ${m.color}40`,
                  boxShadow: `0 0 8px ${m.color}20`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: m.color, boxShadow: `0 0 6px ${m.color}` }}
                  />
                  <span className="text-[9px] font-bold tracking-wider text-white/90 uppercase">
                    {m.id}
                  </span>
                </div>
                <div className="mt-0.5 max-w-[120px] truncate text-[8px] leading-tight text-white/50">
                  {m.nama}
                </div>
                {dist > 1 && (
                  <div className="mt-0.5 text-[7px] text-orange-400/70">
                    {Math.round(dist)} km dari pusat
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {/* ── Style keyframes ── */}
      <style>{`
        @keyframes fadeInLabel {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

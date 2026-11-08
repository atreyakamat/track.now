import { useState } from 'react'
import { Share2 } from 'lucide-react'
import type { WeekCard } from '@tracknow/core/domain/shareCard'
import { Button } from '@/components/ui'
import { useToast } from '@/features/notifications/ToastContext'

/** Draws the weekly card to a 1080×1080 PNG (Instagram/WhatsApp friendly) and shares or downloads it. */
export function renderWeekCardPng(card: WeekCard): Promise<Blob> {
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, size, size)
  bg.addColorStop(0, '#232220')
  bg.addColorStop(1, '#0c0c0b')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  // Ring
  const pct = card.percent ?? 0
  ctx.lineWidth = 34
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#3a3936'
  ctx.beginPath()
  ctx.arc(size / 2, 470, 230, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#c8f169'
  ctx.beginPath()
  ctx.arc(size / 2, 470, 230, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100)
  ctx.stroke()
  ctx.fillStyle = '#f4efe6'
  ctx.textAlign = 'center'
  ctx.font = '700 120px Inter, "Segoe UI", system-ui, sans-serif'
  ctx.fillText(card.planned ? `${card.done}/${card.planned}` : `${card.activeDays}`, size / 2, 500)
  ctx.font = '500 36px Inter, "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#b9b4a8'
  ctx.fillText(card.planned ? 'planned things done' : 'active days', size / 2, 560)
  ctx.fillStyle = '#f4efe6'
  ctx.font = '700 64px Inter, "Segoe UI", system-ui, sans-serif'
  wrap(ctx, card.title, size / 2, 820, 940, 72)
  ctx.font = '500 34px Inter, "Segoe UI", system-ui, sans-serif'
  ctx.fillStyle = '#b9b4a8'
  ctx.fillText([card.subtitle, card.weekLabel, card.activeDays ? `${card.activeDays} active days` : ''].filter(Boolean).join(' · '), size / 2, 930)
  ctx.fillStyle = '#c8f169'
  ctx.font = '600 30px Inter, "Segoe UI", system-ui, sans-serif'
  ctx.fillText('TRACK.NOW', size / 2, 1010)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the card.'))), 'image/png'))
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = w
      yy += lineHeight
    } else line = test
  }
  ctx.fillText(line, x, yy)
}

export function ShareWeekButton({ card, label = 'Share this week' }: { card: WeekCard; label?: string }) {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await renderWeekCardPng(card)
      const file = new File([blob], 'tracknow-week.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: card.title, text: `${card.title}: ${card.done}/${card.planned} done` })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'tracknow-week.png'
        a.click()
        URL.revokeObjectURL(url)
        showToast({ title: 'Card saved', message: 'tracknow-week.png is in your downloads, ready to post.', type: 'success' })
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) showToast({ title: 'Could not share', message: err instanceof Error ? err.message : 'Please try again.', type: 'warning' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="secondary" size="sm" onClick={() => void share()} disabled={busy} aria-busy={busy}>
      <Share2 size={14} aria-hidden="true" /> {busy ? 'Preparing…' : label}
    </Button>
  )
}

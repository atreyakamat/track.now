import { useState } from 'react'
import { generateHeatmapMatrix, type HeatmapCell, type HeatmapMatrix } from '@/domain/streaks'

interface CalendarHeatmapProps {
  dailyCounts: Record<string, number>
  weeksCount?: number
  now?: Date
  schedule?: { frequency?: string; days_of_week?: number[] | null } | null
  title?: string
  subtitle?: string
}

export function CalendarHeatmap({
  dailyCounts,
  weeksCount = 12,
  now = new Date(),
  schedule,
  title,
  subtitle,
}: CalendarHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)

  const matrix: HeatmapMatrix = generateHeatmapMatrix(dailyCounts, now, weeksCount, schedule)

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  // Colors adapted to theme tokens with graceful CSS fallbacks
  const getCellBg = (level: 0 | 1 | 2 | 3 | 4, isFuture: boolean): string => {
    if (isFuture) return 'transparent'
    switch (level) {
      case 0:
        return 'var(--surface-muted, rgba(255, 255, 255, 0.06))'
      case 1:
        return 'var(--accent-subtle, rgba(200, 241, 105, 0.25))'
      case 2:
        return 'rgba(200, 241, 105, 0.50)'
      case 3:
        return 'rgba(200, 241, 105, 0.75)'
      case 4:
        return 'var(--accent-primary, #c8f169)'
    }
  }

  const formatTooltip = (cell: HeatmapCell): string => {
    const [y, m, d] = cell.date.split('-').map(Number)
    const dateObj = new Date(y, m - 1, d)
    const dateStr = dateObj.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    if (cell.isFuture) return `${dateStr} (Upcoming)`
    if (cell.count === 0) return `${dateStr}: No completions`
    return `${dateStr}: ${cell.count} completion${cell.count > 1 ? 's' : ''}`
  }

  return (
    <div
      className="card heatmap-container"
      style={{
        padding: 'var(--space-4)',
        background: 'var(--surface-card, #14171d)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
        borderRadius: 'var(--radius-lg, 12px)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div>
          {title && <h3 className="t-h3" style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>}
          {subtitle && (
            <p className="t-meta" style={{ margin: 0, color: 'var(--text-secondary)' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div className="row" style={{ gap: 'var(--space-3)', fontSize: 'var(--text-caption)' }}>
          <span className="t-meta">
            <strong>{matrix.totalCompletions}</strong> completions
          </span>
          <span className="t-meta">
            <strong>{matrix.activeDays}</strong> active days
          </span>
        </div>
      </div>

      {/* Heatmap Grid Wrapper (responsive horizontal scroll for narrow screens) */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          paddingBottom: '4px',
          scrollbarWidth: 'thin',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            gap: '6px',
            alignItems: 'flex-start',
            minWidth: 'max-content',
          }}
        >
          {/* Day of Week Labels Column */}
          <div
            style={{
              display: 'grid',
              gridTemplateRows: 'repeat(7, 12px)',
              gap: '3px',
              paddingTop: '2px',
              marginRight: '4px',
            }}
          >
            {dayLabels.map((lbl, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '9px',
                  lineHeight: '12px',
                  color: 'var(--text-secondary)',
                  textAlign: 'right',
                  height: '12px',
                }}
              >
                {lbl}
              </span>
            ))}
          </div>

          {/* Weeks Columns */}
          {matrix.weeks.map((week) => (
            <div
              key={week.weekIndex}
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 12px)',
                gap: '3px',
              }}
            >
              {week.days.map((cell, dayIdx) => {
                if (!cell) {
                  return (
                    <div
                      key={dayIdx}
                      style={{
                        width: '12px',
                        height: '12px',
                        visibility: 'hidden',
                      }}
                    />
                  )
                }

                const isHovered = hoveredCell?.date === cell.date

                return (
                  <div
                    key={cell.date}
                    tabIndex={cell.isFuture ? -1 : 0}
                    role="gridcell"
                    aria-label={formatTooltip(cell)}
                    title={formatTooltip(cell)}
                    onMouseEnter={() => setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      background: getCellBg(cell.level, cell.isFuture),
                      border: cell.isToday
                        ? '1px solid var(--accent-primary, #c8f169)'
                        : isHovered
                        ? '1px solid var(--text-primary)'
                        : '1px solid transparent',
                      cursor: cell.isFuture ? 'default' : 'pointer',
                      transition: 'transform 0.1s ease, border-color 0.1s ease',
                      transform: isHovered ? 'scale(1.2)' : 'none',
                      zIndex: isHovered ? 2 : 1,
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Legend / Active Cell Details */}
      <div
        className="row"
        style={{
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ minHeight: '16px' }}>
          {hoveredCell ? (
            <span>{formatTooltip(hoveredCell)}</span>
          ) : (
            <span>Rolling {weeksCount}-week consistency heatmap</span>
          )}
        </div>

        <div className="row" style={{ gap: '4px', alignItems: 'center' }}>
          <span>Less</span>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(0, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(1, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(2, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(3, false),
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getCellBg(4, false),
            }}
          />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}

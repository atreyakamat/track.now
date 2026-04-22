export function setupRevealOnScroll(rootSelector, options = {}) {
  if (typeof document === 'undefined' || !rootSelector) {
    return () => {}
  }

  const {
    itemSelector = '[data-reveal]',
    revealClass = 'is-visible',
    baseClass = 'reveal-target',
    threshold = 0.12,
    rootMargin = '0px 0px -10% 0px',
    staggerMs = 70,
    staggerLoop = 6,
    maxDelayMs = 280
  } = options

  const targets = Array.from(document.querySelectorAll(`${rootSelector} ${itemSelector}`))
  if (!targets.length) {
    return () => {}
  }

  targets.forEach((target, index) => {
    target.classList.add(baseClass)
    target.style.transitionDelay = `${Math.min((index % staggerLoop) * staggerMs, maxDelayMs)}ms`
  })

  const prefersReducedMotion = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const revealAll = () => {
    targets.forEach((target) => target.classList.add(revealClass))
  }

  if (prefersReducedMotion || typeof IntersectionObserver !== 'function') {
    revealAll()
    return () => {}
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add(revealClass)
      observer.unobserve(entry.target)
    })
  }, {
    threshold,
    rootMargin
  })

  targets.forEach((target) => observer.observe(target))

  return () => {
    observer.disconnect()
  }
}

import { useLayoutEffect, useRef, type ReactNode } from 'react'

function ComputerSchedules({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateFade = () => {
      container.classList.toggle('fade-left', container.scrollLeft > 1)
      container.classList.toggle('fade-right', container.scrollLeft < container.scrollWidth - container.clientWidth - 1)
    }

    const observer = new ResizeObserver(updateFade)
    observer.observe(container)
    for (const child of container.children) observer.observe(child)
    container.addEventListener('scroll', updateFade, { passive: true })
    updateFade()

    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', updateFade)
    }
  }, [])

  return <div ref={containerRef} className="computer-schedules" aria-label="Computer schedules">{children}</div>
}

export default ComputerSchedules

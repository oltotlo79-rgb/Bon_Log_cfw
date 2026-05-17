'use client'

import { useInView } from 'react-intersection-observer'

/**
 * 墨筆ストロークアニメーション
 *
 * 要素がビューポートに入ると筆が走るようにSVG線が描かれ、
 * 同時にコンテンツがフェードインする。
 */
export function SumiStrokeReveal({ children }: { children: React.ReactNode }) {
  const { ref, inView } = useInView({ threshold: 0.2, triggerOnce: true })

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
    >
      <svg className="w-full h-3 mb-6" viewBox="0 0 800 12" preserveAspectRatio="none">
        <path
          d="M0,6 C40,3 80,9 140,5 C200,2 260,8 340,6 C420,4 500,9 580,5 C660,2 720,7 800,6"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="900"
          className={`transition-[stroke-dashoffset] duration-[1.8s] ease-out ${
            inView ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:900]'
          }`}
          opacity="0.3"
        />
      </svg>
      {children}
    </div>
  )
}

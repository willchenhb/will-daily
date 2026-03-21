'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-[#eef5ee] text-[#3a7a4f] border border-[#c5d9c5]'}`}
    >
      {message}
    </div>
  )
}

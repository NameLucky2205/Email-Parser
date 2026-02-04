import React from 'react'
import { cn } from '../lib/cn'

interface StatsCardProps {
  title: string
  value: number | string
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

export function StatsCard({ title, value, icon, variant = 'default', className }: StatsCardProps) {
  const variantStyles = {
    default: 'from-blue-500 to-blue-600',
    success: 'from-green-500 to-green-600',
    warning: 'from-yellow-500 to-yellow-600',
    danger: 'from-red-500 to-red-600',
  }

  return (
    <div className={cn('rounded-xl bg-white shadow-lg overflow-hidden', className)}>
      <div className={cn('h-1 bg-gradient-to-r', variantStyles[variant])} />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
          {icon && (
            <div className={cn('p-3 rounded-full bg-gradient-to-br', variantStyles[variant])}>
              <div className="text-white">{icon}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

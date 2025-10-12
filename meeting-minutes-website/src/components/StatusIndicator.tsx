'use client'

import React from 'react'
import { CheckCircle, AlertCircle, XCircle, Info, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatusType = 'success' | 'error' | 'warning' | 'info'

interface StatusIndicatorProps {
  type: StatusType
  title: string
  message?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'ghost'
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  onDismiss?: () => void
  className?: string
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50 border-green-200',
    iconColor: 'text-green-500',
    titleColor: 'text-green-800',
    messageColor: 'text-green-700'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50 border-red-200',
    iconColor: 'text-red-500',
    titleColor: 'text-red-800',
    messageColor: 'text-red-700'
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50 border-yellow-200',
    iconColor: 'text-yellow-500',
    titleColor: 'text-yellow-800',
    messageColor: 'text-yellow-700'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800',
    messageColor: 'text-blue-700'
  }
}

export function StatusIndicator({
  type,
  title,
  message,
  action,
  secondaryAction,
  onDismiss,
  className
}: StatusIndicatorProps) {
  const config = statusConfig[type]
  const Icon = config.icon

  return (
    <Card className={cn(
      'transition-all duration-300 ease-in-out',
      config.bgColor,
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className={cn("font-medium", config.titleColor)}>
                  {title}
                </h3>
                {message && (
                  <p className={cn("mt-1 text-sm", config.messageColor)}>
                    {message}
                  </p>
                )}
              </div>
              
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-6 w-6 p-0 hover:bg-white/50"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {(action || secondaryAction) && (
              <div className="mt-3 flex items-center space-x-2">
                {action && (
                  <Button
                    variant={action.variant || 'default'}
                    size="sm"
                    onClick={action.onClick}
                    className="h-8"
                  >
                    {action.label}
                    {action.label.includes('開啟') && (
                      <ExternalLink className="h-3 w-3 ml-1" />
                    )}
                  </Button>
                )}
                
                {secondaryAction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={secondaryAction.onClick}
                    className="h-8"
                  >
                    {secondaryAction.label}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// 預設的狀態組件，可以直接使用
export function SuccessIndicator(props: Omit<StatusIndicatorProps, 'type'>) {
  return <StatusIndicator {...props} type="success" />
}

export function ErrorIndicator(props: Omit<StatusIndicatorProps, 'type'>) {
  return <StatusIndicator {...props} type="error" />
}

export function WarningIndicator(props: Omit<StatusIndicatorProps, 'type'>) {
  return <StatusIndicator {...props} type="warning" />
}

export function InfoIndicator(props: Omit<StatusIndicatorProps, 'type'>) {
  return <StatusIndicator {...props} type="info" />
}
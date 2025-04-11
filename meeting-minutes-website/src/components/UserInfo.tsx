// src/components/UserInfo.tsx
'use client'

import { motion } from 'framer-motion'
import { LogIn, User, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

interface UserInfoProps {
  className?: string
}

export const UserInfo = ({ className = '' }: UserInfoProps) => {
  const [userEmail, setUserEmail] = useState<string | null>(null)
  // 移除未使用的 userId state
  // const [setUserId] = useState<string | null>(null) 
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const getUserInfo = () => {
      fetch('/api/user-info')
        .then(response => response.json())
        .then(data => {
          if (data.email) {
            setUserEmail(data.email.replace('accounts.google.com:', ''))
          }
          // 移除設置 userId 的部分
          // if (data.id) {
          //   setUserId(data.id.replace('accounts.google.com:', ''))
          // }
          setIsLoading(false)
        })
        .catch(error => {
          console.error('獲取用戶資訊失敗:', error)
          setIsLoading(false)
        })
    }

    getUserInfo()
  }, []) // 保持空的依賴數組

  // ... (rest of the component remains the same) ...
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground text-sm ${className}`}>
        <User className="h-4 w-4" />
        <span>正在載入用戶資訊...</span>
      </div>
    )
  }

  if (!userEmail) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground text-sm ${className}`}>
        <LogIn className="h-4 w-4" />
        <span>未登入或無法獲取用戶資訊</span>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex items-center gap-2 text-primary text-sm ${className}`}
    >
      <UserCheck className="h-4 w-4" />
      <span>歡迎, {userEmail}</span>
    </motion.div>
  )
}
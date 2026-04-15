import React, { type ReactNode } from 'react'

interface Props{
    icon: ReactNode,
    text: string
}

const Button = ({icon, text}:Props) => {
  return (
    <button className='flex text-gray-500 border border-gray-200 gap-1 rounded-md p-1 cursor-pointer'>
        {icon} <span>{text}</span>
    </button>
  )
}

export default Button

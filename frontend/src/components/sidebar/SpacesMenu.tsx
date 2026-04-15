import React from 'react'


interface Props {
  open: boolean;
}

const SpacesMenu = ({open}: Props) => {
  return (
    <div className=' p-2'>
        <p className={`${open ? 'text-[#9BABBF]':  'w-0 translate-x-24'} duration-400 overflow-hidden`}>SPACES</p>
    </div>
  )
}

export default SpacesMenu

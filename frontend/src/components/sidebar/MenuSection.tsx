import React, { type ReactNode } from 'react'

interface MenuItem {
  icon: ReactNode;
  label: string;
  property?: ReactNode; // Optional, in case some items don't have it
}

interface Props {
  header?: string;
  menuItems: MenuItem[];
  open: boolean;
}

const MenuSection = ({header="", menuItems=[], open=true}:Props) => {
  return (
    <div>
                        <div className=' p-2'>
                        <p className={`${open ? 'text-[#9BABBF]':  'w-0 translate-x-24'} duration-400 overflow-hidden`}>{header}</p>
                        </div>
                        <ul>
                            {
                                menuItems.map((item, index)=>{
                                    return(
                                        <li key = {index} className='px-3 py-1 my-2 text-sm hover:bg-[#EBEFF2] rounded-md duration-300 cursor-pointer flex justify-between relative group'>
                                            <div className='flex gap-2 items-center'>
                                                <div>{item.icon}</div>
                                                <p className={`${!open && 'w-0 translate-x-24'} whitespace-nowrap duration-500 overflow-hidden`}>{item.label}</p>
                                                <p className={`${open && 'hidden'} absolute left-32 shadow-md rounded-md
                                                  w-0
                                                  p-0 
                                                  duration-300
                                                  overflow-hidden
                                                  group-hover:w-fit
                                                  group-hover:p-2
                                                  group-hover:left-14
                                                  `}>{item.label}</p>
                                            </div>
                                            <div className={`${!open && 'w-0 translate-x-24'} whitespace-nowrap duration-500 overflow-hidden`}>{item.property}</div>
                                            
                                        </li>
                                    )
                                    
                                })
                            }
                        </ul>
                    </div>
  )
}

export default MenuSection

import React, { useState } from 'react'
import logo from '../../assets/logo.png'

import { MdOutlineMenuOpen } from "react-icons/md";
import { IoMdSettings } from "react-icons/io";
import { CgLogOut } from "react-icons/cg";
import Overview from './Overview';
import SpacesMenu from './SpacesMenu';
import Views from './Views';


const Sidebar = () => {
    const [open, setOpen] = useState<boolean>(true);
  return (
    <nav className={`border-r border-r-[#EBEFF5] h-screen text-[#4F5F73] bg-white p-2 flex flex-col duration-500 ${open? 'w-60':'w-16'}`}>
            {/* Header */} 
            <div className=' px-3 py-2 h-15 flex justify-between items-center'>
                <img src={logo} alt="mongez logo" className={open? 'w-10': 'w-0'}/>
                <div>
                    <MdOutlineMenuOpen size={35} className='cursor-pointer ' onClick={()=>{setOpen((prev)=>!prev)}}/>
                </div>
                

            </div>
            {/* Body */}

            <div className='flex-1'>
                <Overview open={open}/>
                < Views open={open} />
                <SpacesMenu open={open}/>



                

            </div>
            

            {/* footer */}
            <ul>
                <li className='flex items-center gap-2 px-3 py-1 hover:bg-gray-300 duration-300 cursor-pointer rounded-md relative group'>
                    <div>
                        <IoMdSettings size={20}/>
                    </div>
                    
                        <p className={`${!open && 'w-0 translate-x-24'} whitespace-nowrap duration-500 overflow-hidden`}>Settings</p>
                        <p className={`${open && 'hidden'} absolute left-32 shadow-md rounded-md
                                                  w-0
                                                  p-0 
                                                  duration-300
                                                  overflow-hidden
                                                  group-hover:w-fit
                                                  group-hover:p-2
                                                  group-hover:left-14
                                                  `}>Settings</p>

                </li>

                <li className='flex items-center gap-2 px-3 py-1 hover:bg-gray-300 duration-300 cursor-pointer rounded-md relative group'>
                    <div>
                        <CgLogOut size={20}/>

                    </div>
                    <p className={`${!open && 'w-0 transalte-x-24'} duration-500 overflow-hidden text-red-600`}>logout</p>
                    <p className={`${open && 'hidden'} absolute left-32 shadow-md rounded-md
                                                  w-0
                                                  p-0 
                                                  duration-300
                                                  overflow-hidden
                                                  group-hover:w-fit
                                                  group-hover:p-2
                                                  group-hover:left-14
                                                  `}>Logout</p>
                </li>
            </ul>
            
        </nav>
  )
}

export default Sidebar

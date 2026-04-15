import React, { useState } from 'react'
import { IoMdNotificationsOutline } from "react-icons/io";
import { FaRobot } from "react-icons/fa";
import Search from './navbar/Search';
import Path from './navbar/Path';
import CtlButtonsGroup from './navbar/CtlButtonsGroup';


const username = "Basmala Hussein";

const ctlMenu = [
    <button key={0}>Share</button>,
    <button key={1}>AI Agents</button>,
    <button key={2}>Automate</button>
]

const profileMenu = [
    <button key={3}><IoMdNotificationsOutline /></button>,
    <button key={4}>
        {
            username.split(" ")[0][0] + username.split(" ")[1][0]
        }
    </button>,
    <button key={5}>
        <FaRobot />

    </button>
]


const Navbar = () => {
    const [path] = useState({
        space:"Al-Noor Foundation",
        dep: "Education",
        board:"Upper Egypt Education",
        task:""
    });




    


  return (
    <div className='flex justify-around gap-2 p-3  border-b border-b-[#EBEFF5] '>
        {/* path */}
        <Path />
        {/* search */}
        <Search />
        {/* navigations */}
        <CtlButtonsGroup />
      
    </div>
  )
}

export default Navbar

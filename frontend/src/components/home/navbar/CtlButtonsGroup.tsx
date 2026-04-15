import React from 'react'
import { FaShareAlt } from "react-icons/fa";
import { FaRobot } from "react-icons/fa";
import { AiFillThunderbolt } from "react-icons/ai";
import { MdOutlineNotifications } from "react-icons/md";


import Button from './Button';



const buttons = [
    {
        icon: <FaShareAlt size={20}/>,
        text: "Share"
    },
    {
        icon: <FaRobot size={20}/>,
        text: "AI agent"
    },
    {
        icon: <AiFillThunderbolt size={20}/>,
        text: "Automate"
    },
    
    
]

const username = "Basmala Mohamed Hussein";



const CtlButtonsGroup = () => {
    const getInitialsFromUserName = (username:string)=>
    {
        let names = username.split(" ");
        let initials = names[0][0] + names[names.length - 1][0];
        return initials;
    }
  return (
    <div className='flex p-2 gap-2'>

        <div className='flex gap-2 '>
            {buttons.map(({icon, text}, ind)=>{
                return <Button icon={icon} text={text} key={ind} />
            })}
        </div>


            <MdOutlineNotifications className='cursor-pointer m-1 text-gray-500' size={20}/>
            <button className='bg-[#0120fc] p-1 text-white rounded-full cursor-pointer'>
                {getInitialsFromUserName(username)}
            </button>

    </div>
    
  )
}

export default CtlButtonsGroup

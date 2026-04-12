import React from 'react'

import { FaRegCalendar } from "react-icons/fa";
import { MdOutlineViewTimeline } from "react-icons/md";
import { FaChalkboard } from "react-icons/fa";
import { TfiStatsUp } from "react-icons/tfi";


import MenuSection from './MenuSection'

const viewsMenuItems=[
    {
        icon:<FaRegCalendar size={20}/>,
        label:'Calender',
        property: <div className='rounded-md text-[#4F5F73] bg-[#B2B9C3] px-2'>2 mtgs</div>
    },
    {
        icon:<MdOutlineViewTimeline size={20}/>,
        label:'Timeline',
        property: ''
    },
    {
        icon:<FaChalkboard size={20}/>,
        label:'Whiteboard',
        property: ''
    },
    {
        icon:<TfiStatsUp size={20}/>,
        label:'Reports',
        property: ''
    },
    

]

interface Props {
  open: boolean;
}

const Views = ({open}: Props) => {
  return (
    <MenuSection header='VIEWS' menuItems={viewsMenuItems} open={open} />
  )
}

export default Views

import React from 'react'

import { FaInbox } from "react-icons/fa";
import { IoMdCheckmarkCircle } from "react-icons/io";
import { FaChartPie } from "react-icons/fa";
import { IoMdSearch } from "react-icons/io";
import { VscSearchSparkle } from "react-icons/vsc";
import { HiSparkles } from "react-icons/hi";

import MenuSection from './MenuSection';


const overviewMenuItems=[
    {
        icon:<IoMdCheckmarkCircle size={20}/>,
        label:'My Work',
        property: <div className='rounded-[100%] text-white bg-[#F24949] px-2'>5</div>
    },
    {
        icon:<FaInbox size={20}/>,
        label:'Inbox',
        property: <div className='rounded-[100%] text-white bg-[#F24949] px-2'>3</div>
    },
    {
        icon:<FaChartPie size={20}/>,
        label:'Dashboard',
        property: ''
    },
    {
        icon:<IoMdSearch size={20}/>,
        label:'Search',
        property: ''
    },
    {
        icon:<HiSparkles size={20}/>,
        label:'AI Assistant',
        property: ''
    },
    

]

const Overview = ({open}) => {
  return (
    <MenuSection header='OVERVIEW' menuItems={overviewMenuItems} open={open} />
  )
}

export default Overview

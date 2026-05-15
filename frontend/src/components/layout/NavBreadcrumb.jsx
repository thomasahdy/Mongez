import React from 'react'

const NavBreadcrumb = ({path=[]}) => {
    
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-slate-400 shrink-0">
        {path.map((i, ind)=>{
          return (
            <>
              <span className={i.color}>{i.name}</span>
              {ind != path.length - 1 && <i className="fa-solid fa-chevron-right text-[9px] text-slate-300" />}
            </>
            
          );

        })}
      </nav>
  )
}

export default NavBreadcrumb

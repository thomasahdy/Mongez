import React, { useState } from 'react'

const Path = () => {
    const [path] = useState({
            space:"Al-Noor Foundation",
            dep: "Education",
            board:"Upper Egypt Education",
            task:""
        });
    return (
        <div className='text-gray-400 text-sm p-3'>
                {path.space && <span className='text-gray-400 '>{path.space}</span>}
                {path.dep &&<><span>{' > '}</span> <span className='text-orange-600'>{path.dep}</span></> } 
                {path.board && <><span>{' > '}</span><span className='text-black'>{path.board}</span></>}
            </div>
  )
}

export default Path

import React from 'react'

function Box(props) {
    const { children, size, bg } = props;

  return (
    <div className={`${bg ? bg : 'bg-zinc-100'} p-5 rounded-lg ${size ? size : 'w-full'}`}>
        {children}
    </div>
  )
}

export default Box
import React from 'react'

function Alert({color, children}) {
  return (
    <div className={`my-2 p-3 w-full rounded-lg shadow-md ${color} text-white`}>
        {children}
    </div>
  )
}

export default Alert
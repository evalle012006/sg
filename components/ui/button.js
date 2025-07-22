import React from 'react'

function button({ label, submit, buttonClass, onClick }) {
  return (
    <button
      type={submit ? "submit" : "button"}
      className={`whitespace-nowrap w-full h-10 rounded-md font-semibold ${buttonClass}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export default button
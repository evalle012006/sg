import React from "react";

function Spinner({ small = false}) {
  if (small) {
    return (
      <div className="fixed right-6 bottom-6 flex items-center border-2 rounded-lg p-1 px-2 bg-white z-50">
            <svg
                fill="none"
                className="w-10 h-10 animate-spin"
                viewBox="0 0 32 32"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    clipRule="evenodd"
                    d="M15.165 8.53a.5.5 0 01-.404.58A7 7 0 1023 16a.5.5 0 011 0 8 8 0 11-9.416-7.874.5.5 0 01.58.404z"
                    fill="currentColor"
                    fillRule="evenodd"
                />
            </svg>
            <span>Loading</span>
        </div>
    )
  } else {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="flex justify-center items-center space-x-1 text-lg text-gray-700">
          <svg
            fill="none"
            className="w-10 h-10 animate-spin"
            viewBox="0 0 32 32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              clipRule="evenodd"
              d="M15.165 8.53a.5.5 0 01-.404.58A7 7 0 1023 16a.5.5 0 011 0 8 8 0 11-9.416-7.874.5.5 0 01.58.404z"
              fill="currentColor"
              fillRule="evenodd"
            />
          </svg>
          <div>Loading ...</div>
        </div>
      </div>
    );
  }
}

export default Spinner;

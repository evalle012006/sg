import { useState } from "react"

export default function LayoutWithRightPanel({ mainContent, rightPanel }) {
    const [rightPanelOpen, setRightPanelOpen] = useState(false);
    return (<div className="relative">
        <div className="flex relative">
            <div className={(rightPanelOpen ? `hidden` : `visible`) + ` w-full overflow-x-hidden lg:w-8/12`}>
                {mainContent}
            </div>
            <div className={(rightPanelOpen ? `w-full` : `w-0`) + ` fixed right-0 lg:w-3/12`}>
                {rightPanel}
            </div>
        </div>
        <div className={(rightPanelOpen ? `top-0` : `bottom-0`) + ` fixed flex h-16 border border-b-2 w-full items-center z-50 bg-white lg:hidden`}>
            {rightPanelOpen ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mx-4" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg> :
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 mx-4" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>}
        </div>
        <div className='h-16 lg:hidden'></div>
    </div>)
}
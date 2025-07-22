import React, { useState } from 'react';
import { Transition } from 'react-transition-group';

export default function Accordion({ title, style, children }) {
    const [status, setStatus] = useState(false);

    const duration = 800;

    const defaultStyle = {
        transition: `height ${duration}ms ease-in-out`,
    }

    return (
        <Transition in={status} timeout={duration}>
            {state => (
                <div className={[style !== undefined ? style : 'bg-white', '']} style={{
                    ...defaultStyle,
                }}>
                    <div className='flex justify-between p-4'>
                        <div className='flex'>
                            <div className={status == true ? 'font-bold' : 'font-normal'}>
                                <input type="checkbox" />
                                <span className='ml-4'>{title}</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-center cursor-pointer" onClick={() => setStatus(!status)}>
                            {status == true ?
                                (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                                </svg>)
                                : (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>)}
                        </div>
                    </div>
                    {status == true && (
                        <Transition in={status} timeout={duration}>
                            {state => (
                                <div className="shadow-3xl rounded-2xl shadow-cyan-500/50 p-4 mb-6 select-none"
                                    style={{
                                        ...defaultStyle,
                                    }}>
                                    {children}
                                </div>
                            )}
                        </Transition>
                    )}
                </div>
            )}
        </Transition>
    );
};
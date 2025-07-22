export default function AssetBlockGraph({ data, switchTab}) {
    const dataTotal = data.reduce((a, b) => a + b.count, 0);
    const dataPercentage = (itemCount) => {
        return Math.round(((parseInt(itemCount) / dataTotal) * 100));
    };

    return (<div className="flex flex-wrap lg:flex-nowrap">
        {data.map((item, index) => {
            return (
                <div key={index} className={`group relative bg-[${item.color}] text-white mt-2 p-1 md:p-6 flex min-h-[50px] ${index == data.length - 1 ? '' : 'mr-1'} justify-between items-end w-[${dataPercentage(item.count)}%]`}>
                    {window.innerWidth > 1200 && dataPercentage(item.count) > 30 ? <div className="w-full">
                        <div className=''>
                            <p className='text-5xl mr-2'>{item.count}</p>
                            <p className='text-base whitespace-nowrap'>{item.label}</p>
                        </div>
                        <div className='text-sm underline hover:no-underline float-right cursor-pointer' onClick={() => switchTab("asset-list")}>
                            View Assets
                        </div>
                    </div> :
                        <div className="absolute hidden group-hover:block -top-4 p-2 bg-[#263238]/90 rounded-md w-48 z-40 right-4">
                            <div className=''>
                                <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-[${item.color}]`}></span>
                                <span className='text-base'>{item.count + ' ' + item.label}</span>
                            </div>
                            <div className='text-sm underline hover:no-underline float-right cursor-pointer' onClick={() => switchTab("asset-list")}>
                                View Assets
                            </div>
                        </div>}
                </div>
            )
        }
        )}
    </div>)
}

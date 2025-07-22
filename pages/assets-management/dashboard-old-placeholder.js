import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

export default function Dashboard() {
    const data = {
        labels: ['booked', 'available'],
        datasets: [
            {
                data: [22, 19],
            },
        ],
    };

    const statusData = {
        labels: ['Active', 'New', 'Warranty Expiring Soon', 'Decommissioned', 'Needs Maintenance', 'Being Repaired'],
        datasets: [
            {
                data: [22, 19, 10, 5, 3, 2],
            },
        ],
    };

    const options = {
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false,
                text: '41',
                position: 'bottom',
                padding: 0,
            }
        },
        backgroundColor: [
            'rgb(14 165 233)', // sky-500
            'rgb(20 184 166)', // teal-500
            'rgb(34 197 94)', // green-500
            'rgb(234 179 8)', // yellow-500
            'rgb(249 115 22)', // orange-500
            'rgb(239 68 68)', // red-500
            'rgb(132 204 22)', // lime-500
        ],
        borderColor: "transparent",
        circumference: 180,
        rotation: 270,
        cutout: 85,

    }

    return (
        <div className="pb-16 pt-10 max-w-6xl">
            <div className='flex justify-between'>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p>Date Range selector</p>
            </div>
            <div className='flex space-x-4'>
                <div className='flex space-x-4 w-fit bg-slate-50 p-4 rounded-md mt-4'>
                    <div className='flex rounded-md h-72 w-72'>
                        <Doughnut data={data} options={options} />
                    </div>
                    <div className='grid gap-4 bg-reg-100 rounded-md p-2 content-center'>
                        <div className='rounded-md pt-4 pb-1'>
                            <p className='text-gray-500 text-xs'>Available</p>
                            <p className='text-3xl text-sky-500 font-bold'>22</p>
                        </div>
                        <div className='rounded-md pt-4 pt-1'>
                            <p className='text-gray-500 text-xs'>Booked</p>
                            <p className='text-3xl text-teal-500 font-bold'>19</p>
                        </div>
                    </div>
                </div>
                <div className='flex justify-center space-x-4 w-full bg-slate-50 p-4 rounded-md mt-4'>
                    <div className='flex rounded-md h-72 w-72'>
                        <Doughnut data={statusData} options={options} />
                    </div>
                    <div className='grid content-center flex-wrap'>
                        <p className='text-4xl text-gray-400'>41 Assets</p>
                        <div className='flex items-center space-x-10 p-2 content-center'>
                            <div>
                                <div className='rounded-md pt-4 pb-1'>
                                    <p className='text-gray-500 text-xs'>Active</p>
                                    <p className='text-3xl text-sky-500 font-bold'>22</p>
                                </div>
                                <div className='rounded-md pt-4 pt-1'>
                                    <p className='text-gray-500 text-xs'>New Assets</p>
                                    <p className='text-3xl text-teal-500 font-bold'>19</p>
                                </div>
                            </div>
                            <div>
                                <div className='rounded-md pt-4 pb-1'>
                                    <p className='text-gray-500 text-xs'>Warranty Expiring Soon</p>
                                    <p className='text-3xl text-green-500 font-bold'>22</p>
                                </div>
                                <div className='rounded-md pt-4 pt-1'>
                                    <p className='text-gray-500 text-xs'>Decommissioned</p>
                                    <p className='text-3xl text-yellow-500 font-bold'>19</p>
                                </div>
                            </div>
                            <div>
                                <div className='rounded-md pt-4 pb-1'>
                                    <p className='text-gray-500 text-xs'>Needs Maintenance</p>
                                    <p className='text-3xl text-orange-500 font-bold'>22</p>
                                </div>
                                <div className='rounded-md pt-4 pt-1'>
                                    <p className='text-gray-500 text-xs'>Being Repaired</p>
                                    <p className='text-3xl text-red-500 font-bold'>19</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className='flex flex-wrap'>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>5 Wheel Chairs</p>
                </div>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>15 Bed Rails</p>
                </div>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>4 Shower Commodes</p>
                </div>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>3 Slide Transfer Boards</p>
                </div>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>4 Ceiling Hoists</p>
                </div>
                <div className='bg-slate-50 p-10 rounded-md mt-4 mr-4'>
                    <p className='whitespace-nowrap'>3 Slings</p>
                </div>

            </div>
        </div>
    )
}
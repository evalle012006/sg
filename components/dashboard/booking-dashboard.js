import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { useDispatch } from 'react-redux';
import { globalActions } from '../../store/globalSlice';
import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import SelectFilterComponent from '../ui/select-filter';

ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const BookingDashboardPage = (props, ref) => {
    const dispatch = useDispatch();
    const [data, setData] = useState({
        totalGuests: 0,
        toalGuestsArrivingToday: 0,
        totalGuestCheckingOutToday: 0,
        totalGuestLateCheckInToday: 0,
        guestArrivalEnquiries: {
            labels: [],
            details: [],
        },
        newBookingsVsCancelations: {
            labels: [],
            details: [],
        },
        guestOver90Kg: {
            labels: [],
            details: [
                {
                    label: 'Guest over 90 Kg',
                    data: []
                }
            ]
        },
        funderType: {
            ndis: 0,
            icare: 0,
            sargood: 0,
            private: 0,
            royalRehab: 0,
            other: 0
        }
    });

    const [barChartData, setBarChartData] = useState({
        labels: [],
        datasets: []
    });

    const [barChart2Data, setBarChart2Data] = useState({
        labels: [],
        datasets: []
    });

    const [pieChartData, setPieChartData] = useState({
        labels: [],
        datasets: []
    });

    useImperativeHandle(ref, () => ({
        reloadData() {
            fetchData();
        }
    }));

    const filters = [
        { label: 'Week', value: 'Week' },
        { label: 'Month', value: 'Month' },
        { label: 'Quarter', value: 'Quarter' },
        { label: 'Year', value: 'Year' }
    ];
    const [filterSelection, setFilterSelection] = useState('Month');

    const handleFilterSelection = (selected) => {
        setFilterSelection(selected.value);
    }

    const fetchData = async () => {
        dispatch(globalActions.setLoading(true));

        const response = await fetch("/api/bookings/dashboard/booking?filter=" +
            filterSelection, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        dispatch(globalActions.setLoading(false));
        const dataResponse = await response.json();
        setData(dataResponse);
    }

    useEffect(() => {
        setBarChartData({
            labels: data.guestArrivalEnquiries.labels,
            datasets: [
                {
                    label: data.guestArrivalEnquiries?.details[0]?.label,
                    data: data.guestArrivalEnquiries?.details[0]?.data,
                    backgroundColor: '#4FD1C7', // Teal
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.guestArrivalEnquiries?.details[1]?.label,
                    data: data.guestArrivalEnquiries?.details[1]?.data,
                    backgroundColor: '#2563EB', // Blue
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.guestArrivalEnquiries?.details[2]?.label,
                    data: data.guestArrivalEnquiries?.details[2]?.data,
                    backgroundColor: '#14B8A6', // Darker teal
                    barThickness: 20,
                    order: 1
                },
            ],
        });

        setBarChart2Data({
            labels: data.newBookingsVsCancelations.labels,
            datasets: [
                {
                    label: data.newBookingsVsCancelations?.details[0]?.label,
                    data: data.newBookingsVsCancelations?.details[0]?.data,
                    backgroundColor: '#14B8A6', // Teal for bookings
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.newBookingsVsCancelations?.details[1]?.label,
                    data: data.newBookingsVsCancelations?.details[1]?.data,
                    backgroundColor: '#EF4444', // Red for cancellations
                    barThickness: 20,
                    order: 1
                },
            ],
        });

        setPieChartData({
            labels: ['NDIS', 'iCare', 'Sargood Foundation', 'Private', 'Royal Rehab', 'Other'],
            datasets: [
                {
                    data: [data.funderType.ndis, data.funderType.icare, data.funderType.sargood, data.funderType.private, data.funderType.royalRehab, data.funderType.other],
                    backgroundColor: [
                        '#4FD1C7', // Teal
                        '#2563EB', // Blue
                        '#F59E0B', // Amber
                        '#EF4444', // Red
                        '#8B5CF6', // Purple
                        '#6B7280'  // Gray
                    ],
                    borderColor: [
                        '#4FD1C7',
                        '#2563EB',
                        '#F59E0B',
                        '#EF4444',
                        '#8B5CF6',
                        '#6B7280'
                    ],
                    borderWidth: 0,
                },
            ],
        });
    }, [data]);

    const barCharOptions = {
        responsive: true,
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    font: {
                        size: 11
                    }
                }
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                stacked: true,
                grid: {
                    display: true,
                    color: '#F3F4F6'
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
        },
        maintainAspectRatio: false
    };

    const barChar2Options = {
        responsive: true,
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    font: {
                        size: 11
                    }
                }
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                stacked: true,
                grid: {
                    display: true,
                    color: '#F3F4F6'
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
        },
        maintainAspectRatio: false
    };

    const pieChartOptions = {
        plugins: {
            legend: {
                display: false
            },
        },
        cutout: '60%',
        maintainAspectRatio: false
    };

    const barChart3Data = {
        labels: data.guestOver90Kg.labels,
        datasets: [
            {
                label: 'Guest over 90kg',
                data: data.guestOver90Kg?.details?.data,
                backgroundColor: '#2563EB', // Blue
                barThickness: 20
            }
        ],
    };

    const barChar3Options = {
        responsive: true,
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    font: {
                        size: 11
                    }
                }
            },
        },
        scales: {
            x: {
                stacked: false,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                stacked: false,
                grid: {
                    display: true,
                    color: '#F3F4F6'
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            },
        },
        maintainAspectRatio: false
    };

    useEffect(() => {
        fetchData();
    }, [filterSelection]);

    return (
        <div className='my-2 bg-gray-50'>
            {/* Key Metrics Cards */}
            <div className='flex gap-4 p-4'>
                <div className="bg-white shadow-sm rounded-lg p-6 relative flex-1 min-h-[120px] border">
                    <div className='absolute right-4 top-4'>
                        <div className='w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center'>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="#2563EB"/>
                                <path d="M12.0002 14.5C6.99016 14.5 2.91016 17.86 2.91016 22C2.91016 22.28 3.13016 22.5 3.41016 22.5H20.5902C20.8702 22.5 21.0902 22.28 21.0902 22C21.0902 17.86 17.0102 14.5 12.0002 14.5Z" fill="#2563EB"/>
                            </svg>
                        </div>
                    </div>
                    <div className='w-2/3'>
                        <h6 className='text-sm font-medium text-gray-600 mb-1'>TOTAL GUESTS ON-SITE</h6>
                        <h3 className='text-3xl font-bold text-gray-900 mb-2'>{data.totalGuests}</h3>
                    </div>
                    <div className='absolute bottom-4 right-4'>
                        <button 
                            className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                            onClick={() => { window.location.href = '/bookings' }}
                        >
                            VIEW →
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 relative flex-1 min-h-[120px] border">
                    <div className='absolute right-4 top-4'>
                        <div className='w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center'>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z" fill="#14B8A6"/>
                                <path d="M7 10H12V15H7V10Z" fill="#14B8A6"/>
                            </svg>
                        </div>
                    </div>
                    <div className='w-2/3'>
                        <h6 className='text-sm font-medium text-gray-600 mb-1'>GUESTS ARRIVING TODAY</h6>
                        <h3 className='text-3xl font-bold text-gray-900 mb-2'>{data.toalGuestsArrivingToday}</h3>
                    </div>
                    <div className='absolute bottom-4 right-4'>
                        <button 
                            className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                            onClick={() => { window.location.href = '/bookings' }}
                        >
                            VIEW →
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 relative flex-1 min-h-[120px] border">
                    <div className='absolute right-4 top-4'>
                        <div className='w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center'>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 11H7L12 6L17 11H15V16H9V11Z" fill="#14B8A6"/>
                                <path d="M20 18H4V20H20V18Z" fill="#14B8A6"/>
                            </svg>
                        </div>
                    </div>
                    <div className='w-2/3'>
                        <h6 className='text-sm font-medium text-gray-600 mb-1'>LATE CHECK-IN TODAY</h6>
                        <h3 className='text-3xl font-bold text-teal-600 mb-2'>{data.totalGuestLateCheckInToday}</h3>
                    </div>
                    <div className='absolute bottom-4 right-4'>
                        <button 
                            className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                            onClick={() => { window.location.href = '/bookings' }}
                        >
                            VIEW →
                        </button>
                    </div>
                </div>

                <div className="bg-white shadow-sm rounded-lg p-6 relative flex-1 min-h-[120px] border">
                    <div className='absolute right-4 top-4'>
                        <div className='w-12 h-12 bg-red-50 rounded-full flex items-center justify-center'>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 13H15V11H9V13Z" fill="#EF4444"/>
                                <path d="M19 3H18V1H16V3H8V1H6V3H5C3.89 3 3.01 3.9 3.01 5L3 19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19Z" fill="#EF4444"/>
                            </svg>
                        </div>
                    </div>
                    <div className='w-2/3'>
                        <h6 className='text-sm font-medium text-gray-600 mb-1'>GUESTS CHECKING-OUT TODAY</h6>
                        <h3 className='text-3xl font-bold text-red-500 mb-2'>{data.totalGuestCheckingOutToday}</h3>
                    </div>
                    <div className='absolute bottom-4 right-4'>
                        <button 
                            className='text-xs text-blue-600 hover:text-blue-800 font-medium'
                            onClick={() => { window.location.href = '/bookings' }}
                        >
                            VIEW →
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className='flex justify-end py-4 px-4'>
                <SelectFilterComponent 
                    options={filters} 
                    placeholder={"Filter"} 
                    onChange={handleFilterSelection} 
                    value={filterSelection} 
                />
            </div>

            {/* Charts Section */}
            <div className='px-4 space-y-4'>
                {/* Top Row - Two Charts Side by Side */}
                <div className='flex gap-4'>
                    {/* Guest Arrival Enquiries Chart */}
                    <div className='bg-white shadow-sm rounded-lg p-6 border flex-1'>
                        <h6 className='text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide'>Guest Arrival Enquiries</h6>
                        <div className='h-80'>
                            <Bar options={barCharOptions} data={barChartData} />
                        </div>
                    </div>

                    {/* New Bookings vs Cancellations Chart */}
                    <div className='bg-white shadow-sm rounded-lg p-6 border flex-1'>
                        <h6 className='text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide'>New Bookings vs Cancellations</h6>
                        <div className='h-80'>
                            <Bar options={barChar2Options} data={barChart2Data} />
                        </div>
                    </div>
                </div>

                {/* Bottom Row - Pie Chart and Bar Chart */}
                <div className='flex flex-wrap gap-4'>
                    {/* Funder Type Pie Chart */}
                    <div className='bg-white shadow-sm rounded-lg p-6 border w-full lg:w-1/3 flex flex-col h-96'>
                        <h6 className='text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide'>Onsite - Guest by Funder Type</h6>
                        <div className='flex items-center gap-4 flex-1'>
                            {/* Chart on the left - medium size */}
                            <div className='w-40 h-40 flex-shrink-0'>
                                <Doughnut data={pieChartData} options={pieChartOptions} />
                            </div>
                            
                            {/* Legend on the right - full width */}
                            <div className='flex-1 space-y-1'>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-teal-400 text-white text-xs font-medium rounded'>
                                    <span>NDIS</span>
                                    <span>{data.funderType.ndis}</span>
                                </div>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-blue-600 text-white text-xs font-medium rounded'>
                                    <span>iCare</span>
                                    <span>{data.funderType.icare}</span>
                                </div>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-amber-400 text-white text-xs font-medium rounded'>
                                    <span>Sargood Foundation</span>
                                    <span>{data.funderType.sargood}</span>
                                </div>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-red-500 text-white text-xs font-medium rounded'>
                                    <span>Private</span>
                                    <span>{data.funderType.private}</span>
                                </div>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-purple-500 text-white text-xs font-medium rounded'>
                                    <span>Royal Rehab</span>
                                    <span>{data.funderType.royalRehab}</span>
                                </div>
                                <div className='flex justify-between items-center px-2 py-1.5 bg-gray-500 text-white text-xs font-medium rounded'>
                                    <span>Other</span>
                                    <span>{data.funderType.other}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Guest over 90kg Chart */}
                    <div className='bg-white shadow-sm rounded-lg p-6 border w-full lg:flex-1 h-96'>
                        <h6 className='text-sm font-semibold text-gray-800 mb-4 uppercase tracking-wide'>Guest over 90kg - Next 14 days</h6>
                        <div className='h-80'>
                            <Bar options={barChar3Options} data={barChart3Data} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default forwardRef(BookingDashboardPage);
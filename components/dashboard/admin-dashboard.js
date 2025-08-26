import { Pie, Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement, PointElement, LineElement } from 'chart.js';
import { useDispatch } from 'react-redux';
import { globalActions } from '../../store/globalSlice';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import TabButton from '../ui-v2/TabButton';
import { ChevronDown } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement, PointElement, LineElement);

const AdminDashboardPage = ({ onTabChange, hideMainTabs = false, ...props }, ref) => {
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState(0);
    
    // Initialize with empty data like the original version
    const [data, setData] = useState({
        totalBookingsYTD: 0,
        bookingLastQuarter: 0,
        bookingsLastMonth: 0,
        bookingsCanceledYTD: 0,
        leads: {
            zero19: 0,
            twenty39: 0,
            fourty59: 0,
            sixtyPlus: 0
        },
        bookings_versus_data: {
            labels: [],
            details: [],
        },
        bookings_status_data: {
            labels: [],
            details: [],
        }
    });

    const [filterSelection, setFilterSelection] = useState('Year');

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

    const handleFilterSelection = (selected) => {
        setFilterSelection(selected.value);
    }

    // Restore the real API fetching function from the original version
    const fetchData = async () => {
        dispatch(globalActions.setLoading(true));

        const response = await fetch("/api/bookings/dashboard/admin?filter=" +
            filterSelection, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        dispatch(globalActions.setLoading(false));
        const data = await response.json();
        setData(data);
    }

    // Tab configuration
    const dashboardTabs = [
        { label: "MGMT", fullLabel: "MANAGEMENT" },
        { label: "BOOKINGS", fullLabel: "BOOKINGS" },
        { label: "ASSETS", fullLabel: "ASSETS" }
    ];

    const handleTabChange = (index) => {
        setActiveTab(index);
        const tabTypes = ['admin', 'bookings', 'assets'];
        if (onTabChange) {
            onTabChange(tabTypes[index]);
        }
    };

    // Updated colors to match Figma
    const lineChartData = {
        labels: data.bookings_versus_data.labels,
        datasets: [
            {
                label: data.bookings_versus_data?.details[0]?.label || 'Previous Year',
                data: data.bookings_versus_data?.details[0]?.data || [],
                fill: false,
                backgroundColor: "#FFCE00", // Yellow
                borderColor: "#FFCE00",
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            },
            {
                label: data.bookings_versus_data?.details[1]?.label || 'Current Year',
                data: data.bookings_versus_data?.details[1]?.data || [],
                backgroundColor: "#1B457B", // Blue
                borderColor: "#1B457B", 
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }
        ]
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: 'line',
                    font: {
                        size: 12
                    },
                    padding: 20
                }
            },
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                grid: {
                    display: true,
                    color: '#F1F3F4'
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            }
        }
    };

    // Updated pie chart colors
    const pieChartData = {
        labels: ['0-19 Days', '20-39 Days', '40-59 Days', '60+'],
        datasets: [
            {
                data: [data.leads.zero19, data.leads.twenty39, data.leads.fourty59, data.leads.sixtyPlus],
                backgroundColor: [
                    '#02AB92', // Teal
                    '#1B457B', // Blue  
                    '#FFCE00', // Yellow
                    '#FF5D5D'  // Red
                ],
                borderColor: [
                    '#02AB92',
                    '#1B457B', 
                    '#FFCE00',
                    '#FF5D5D'
                ],
                borderWidth: 0,
            },
        ],
    };

    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
        },
    };

    // Updated bar chart colors  
    const barChartData = {
        labels: data.bookings_status_data.labels,
        datasets: [
            {
                label: data.bookings_status_data?.details[0]?.label || 'Enquiries',
                data: data.bookings_status_data?.details[0]?.data || [],
                backgroundColor: '#FFCE00', // Yellow
                barThickness: 'flex',
                maxBarThickness: 20,
                order: 1
            },
            {
                label: data.bookings_status_data?.details[1]?.label || 'Eligible', 
                data: data.bookings_status_data?.details[1]?.data || [],
                backgroundColor: '#1B457B', // Blue
                barThickness: 'flex',
                maxBarThickness: 20,
                order: 1
            },
            {
                label: data.bookings_status_data?.details[2]?.label || 'Bookings',
                data: data.bookings_status_data?.details[2]?.data || [],
                backgroundColor: '#02AB92', // Teal
                barThickness: 'flex', 
                maxBarThickness: 20,
                order: 1
            },
        ],
    };

    const barChartOptions = {
        plugins: {
            title: {
                display: false,
            },
            legend: {
                display: true,
                position: "bottom",
                labels: {
                    usePointStyle: true,
                    pointStyle: 'rect',
                    font: {
                        size: 12
                    },
                    padding: 20
                }
            },
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                stacked: false,
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                stacked: false,
                grid: {
                    display: true,
                    color: '#F1F3F4'
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            },
        },
    };

    const handleViewBookings = () => {
        window.location.href = '/bookings';
    };

    const handleViewCancelledBookings = () => {
        window.location.href = '/bookings?status=cancelled';
    };

    useEffect(() => {
        fetchData();
    }, [filterSelection]);

    const StatCard = ({ title, value, color, onClick }) => (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border relative overflow-hidden hover:shadow-md transition-shadow">
            <div className="absolute right-4 top-4 opacity-20">
                <svg width="40" height="42" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path opacity="0.8" fillRule="evenodd" clipRule="evenodd" d="M14 2.03252C14 0.91 13.1046 0 12 0C10.8954 0 10 0.91 10 2.03252V3.061C9.0081 3.07677 8.12674 3.11283 7.35044 3.19524C5.9116 3.34805 4.60722 3.67785 3.4472 4.49376C2.65574 5.05045 1.96964 5.7477 1.42186 6.55203C0.619002 7.73091 0.294482 9.0565 0.144142 10.5187C0.0121017 11.8029 0.000982015 13.3699 8.20151e-05 15.2439L1.90646e-06 15.5557C1.90646e-06 15.6268 1.90646e-06 15.6983 1.90646e-06 15.7702V27.5825C-5.80935e-05 30.3348 -0.000117898 32.6043 0.237502 34.4006C0.487002 36.2864 1.03094 37.9518 2.34316 39.2854C3.65536 40.6189 5.29422 41.1717 7.14988 41.4252C8.91738 41.6669 11.1506 41.6667 13.8588 41.6667H26.141C28.8492 41.6667 31.0826 41.6669 32.8502 41.4252C34.7058 41.1717 36.3446 40.6189 37.6568 39.2854C38.969 37.9518 39.513 36.2864 39.7626 34.4006C40.0002 32.6043 40 30.3348 40 27.5825V15.7702C40 15.7081 40 15.6461 40 15.5846V15.2439C39.999 13.3699 39.988 11.8029 39.8558 10.5187C39.7056 9.0565 39.381 7.73091 38.5782 6.55203C38.0304 5.7477 37.3442 5.05045 36.5528 4.49376C35.3928 3.67785 34.0884 3.34805 32.6496 3.19524C31.8732 3.11283 30.992 3.07677 30 3.061V2.03252C30 0.91 29.1046 0 28 0C26.8954 0 26 0.91 26 2.03252V3.04878H14V2.03252ZM35.9998 15.2439C35.9984 13.3404 35.9858 11.9941 35.8776 10.9412C35.7612 9.81049 35.5526 9.2524 35.289 8.86545C35.0152 8.46329 34.6722 8.11465 34.2764 7.8363C33.8956 7.5685 33.3464 7.35642 32.2338 7.23827C31.612 7.17226 30.886 7.14124 30 7.12667V8.13008C30 9.2526 29.1046 10.1626 28 10.1626C26.8954 10.1626 26 9.2526 26 8.13008V7.11382H14V8.13008C14 9.2526 13.1046 10.1626 12 10.1626C10.8954 10.1626 10 9.2526 10 8.13008V7.12667C9.11392 7.14124 8.388 7.17226 7.76614 7.23827C6.65352 7.35642 6.10438 7.5685 5.7236 7.8363C5.32788 8.11465 4.98482 8.46329 4.71094 8.86545C4.4474 9.2524 4.23874 9.81049 4.12248 10.9412C4.01422 11.9941 4.00162 13.3404 4.00018 15.2439H35.9998ZM4 19.3089V27.439C4 30.3709 4.00426 32.3652 4.20184 33.8589C4.3917 35.2939 4.72644 35.9585 5.17158 36.411C5.61672 36.8634 6.27076 37.2037 7.68286 37.3965C9.1525 37.5974 11.115 37.6016 14 37.6016H26C28.885 37.6016 30.8474 37.5974 32.3172 37.3965C33.7292 37.2037 34.3832 36.8634 34.8284 36.411C35.2736 35.9585 35.6084 35.2939 35.7982 33.8589C35.9958 32.3652 36 30.3709 36 27.439V19.3089H4Z" fill="currentColor"/>
                </svg>
            </div>
            <div className="relative z-10">
                <h6 className="text-xs sm:text-sm font-bold text-gray-600 uppercase mb-2 sm:mb-4 leading-tight">
                    {title}
                </h6>
                <h3 className={`text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4`} style={{ color }}>
                    {value}
                </h3>
                <div className="flex justify-end">
                    <button 
                        onClick={onClick}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium uppercase tracking-wide transition-colors cursor-pointer"
                    >
                        VIEW →
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-full overflow-hidden">
            {/* Tab Navigation - only show if not hidden */}
            {!hideMainTabs && (
                <div className="mb-6">
                    <TabButton
                        tabs={dashboardTabs}
                        activeTab={activeTab}
                        onChange={handleTabChange}
                        type="outline"
                    />
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <StatCard
                    title="Total Bookings - YTD"
                    value={data.totalBookingsYTD}
                    color="#1B457B"
                    onClick={handleViewBookings}
                />
                <StatCard
                    title="Bookings Last Quarter"
                    value={data.bookingLastQuarter}
                    color="#1B457B"
                    onClick={handleViewBookings}
                />
                <StatCard
                    title="Bookings Last Month"
                    value={data.bookingsLastMonth}
                    color="#02AB92"
                    onClick={handleViewBookings}
                />
                <StatCard
                    title="Cancelled Bookings - YTD"
                    value={data.bookingsCanceledYTD}
                    color="#FF5D5D"
                    onClick={handleViewCancelledBookings}
                />
            </div>

            {/* Filter Selector */}
            <div className="flex justify-end mb-4 mr-1">
                <div className="relative">
                    <select 
                        value={filterSelection}
                        onChange={(e) => handleFilterSelection({ value: e.target.value })}
                        className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[100px]"
                    >
                        {filters.map(filter => (
                            <option key={filter.value} value={filter.value}>
                                {filter.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {/* Charts Section */}
            <div className="space-y-6">
                {/* Line Chart */}
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                    <h6 className="text-sm sm:text-base font-bold mb-4">BOOKINGS COMPARED TO PREVIOUS</h6>
                    <div className="h-64 sm:h-80 lg:h-96">
                        <Line data={lineChartData} options={lineChartOptions} />
                    </div>
                </div>

                {/* Bottom Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Pie Chart */}
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 order-2 lg:order-1">
                        <h6 className="text-sm font-bold mb-4">TOTAL LEADS VS LEAD TIME</h6>
                        <div className="flex flex-col items-center">
                            <div className="w-40 h-40 sm:w-48 sm:h-48 mb-4">
                                <Doughnut data={pieChartData} options={pieChartOptions} />
                            </div>
                            <div className="space-y-2 w-full max-w-xs">
                                <div className="flex items-center justify-between p-2 rounded-full text-xs font-bold bg-opacity-10" style={{ backgroundColor: 'rgba(2, 171, 146, 0.1)', color: '#02AB92' }}>
                                    <span>0 - 19 Days</span>
                                    <span>{data.leads.zero19}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-full text-xs font-bold bg-opacity-10" style={{ backgroundColor: 'rgba(27, 69, 123, 0.1)', color: '#1B457B' }}>
                                    <span>20 - 39 Days</span>
                                    <span>{data.leads.twenty39}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-full text-xs font-bold bg-opacity-10" style={{ backgroundColor: 'rgba(255, 206, 0, 0.1)', color: '#FFCE00' }}>
                                    <span>40 - 59 Days</span>
                                    <span>{data.leads.fourty59}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 rounded-full text-xs font-bold bg-opacity-10" style={{ backgroundColor: 'rgba(255, 93, 93, 0.1)', color: '#FF5D5D' }}>
                                    <span>60+ Days</span>
                                    <span>{data.leads.sixtyPlus}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="lg:col-span-2 bg-gray-50 rounded-lg p-4 sm:p-6 order-1 lg:order-2">
                        <h6 className="text-sm font-bold mb-4">ENQUIRES VS ELIGIBILITY VS BOOKINGS</h6>
                        <div className="h-64 sm:h-80 lg:h-96">
                            <Bar options={barChartOptions} data={barChartData} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default forwardRef(AdminDashboardPage);
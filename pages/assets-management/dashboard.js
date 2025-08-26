import { Pie, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement } from 'chart.js';
import Link from 'next/link';
import AssetBlockGraph from './asset-block-graph';
import DateRangeSelector from '../../components/DateRangeSelector';
import { useDispatch } from 'react-redux';
import { globalActions } from '../../store/globalSlice';
import moment from 'moment';
import { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { startCase } from 'lodash';
import { useRouter } from 'next/router';

ChartJS.register(ArcElement, Tooltip, Legend, Title, CategoryScale, LinearScale, BarElement);

function Dashboard({ switchTab, origin }, ref) {
    const router = useRouter();
    const dispatch = useDispatch();
    const [data, setData] = useState({
        active: 0,
        require_maintenance: 0,
        require_hiring: 0,
        being_repaired: 0,
        expiring_soon: 0,
        new: 0,
        warranty_expired: 0,
        booked: 0,
        available: 0,
        total_assets: 0,
        categories: [],
        available_data: {
            labels: [],
            available: [],
            booked: [],
        },
    });

    const [assetByStatus, setAssetByStatus] = useState([
        { count: 0, label: "Expiring Soon", color: "#02ab92" },
        { count: 0, label: "Active", color: "#ffbb00" },
        { count: 0, label: "New", color: "#ff5d5d" },
        { count: 0, label: "Decommissioned", color: "#84dccf" },
        { count: 0, label: "Needs Maintenance", color: "#7426b3" },
        { count: 0, label: "Being Repaired", color: "#af1f6a" },
    ]);

    const [dateRangeSelection, setDateRangeSelection] = useState({
        startDate: new Date(),
        endDate: moment().add(1, 'months').toDate(),
        key: 'selection',
    });

    useImperativeHandle(ref, () => ({
        reloadData() {
            fetchData();
        }
    }));

    const handleRangeSelection = (ranges) => {
        setDateRangeSelection(ranges.selection);
    }

    const fetchData = async () => {
        dispatch(globalActions.setLoading(true));

        const response = await fetch("/api/equipments/dashboard?startDate=" +
            dateRangeSelection.startDate +
            '&endDate=' + dateRangeSelection.endDate, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        dispatch(globalActions.setLoading(false));
        const data = await response.json();
        setData(data);

        const updatedAssetsByStatus = assetByStatus.map((asset) => {
            if (asset.label === 'Decommissioned') {
                return { ...asset, count: data.warranty_expired };
            }

            if (asset.label === 'Expiring Soon') {
                return { ...asset, count: data.expiring_soon };
            }

            if (asset.label === 'Active') {
                return { ...asset, count: data.active };
            }

            if (asset.label === 'New') {
                return { ...asset, count: data.new };
            }

            if (asset.label === 'Needs Maintenance') {
                return { ...asset, count: data.require_maintenance };
            }

            if (asset.label === 'Being Repaired') {
                return { ...asset, count: data.being_repaired };
            }

            return asset;
        });

        setAssetByStatus(updatedAssetsByStatus.sort((a, b) => b.count - a.count));
    }

    // Generate colors for categories
    const generateColors = (count) => {
        const colors = [
            '#02ab92', '#0288d1', '#ffbb00', '#ff5d5d', '#7426b3', '#84dccf',
            '#9c27b0', '#e91e63', '#f44336', '#ff9800', '#4caf50', '#00bcd4'
        ];
        return colors.slice(0, count);
    };

    // Chart configurations
    const AssetsByTypeData = {
        labels: data.categories?.map(category => startCase(category.name.replace(/_/g, ' '))) || [],
        datasets: [
            {
                data: data.categories?.map(category => category.count) || [],
                backgroundColor: generateColors(data.categories?.length || 0),
                borderWidth: 0,
                cutout: '60%'
            },
        ],
    };

    const AvailableVsBookedData = {
        labels: ['Available', 'Booked'],
        datasets: [
            {
                data: [data.available, data.booked],
                backgroundColor: ['#02ab92', '#0288d1'],
                borderWidth: 0,
                cutout: '60%'
            },
        ],
    };

    const AssetsByStatusData = {
        labels: ['Active', 'Inactive'],
        datasets: [
            {
                data: [data.active, data.total_assets - data.active],
                backgroundColor: ['#02ab92', '#e5e7eb'],
                borderWidth: 0,
                cutout: '60%'
            },
        ],
    };

    const barChartData = {
        labels: data.available_data.labels,
        datasets: [
            {
                label: 'Assets Availability',
                data: data.available_data.available,
                backgroundColor: '#02ab92',
                borderRadius: 4,
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false // We'll create custom legends
            },
            tooltip: {
                enabled: true
            }
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    font: {
                        size: 12
                    }
                }
            },
            y: {
                grid: {
                    display: true,
                    color: '#f3f4f6'
                },
                ticks: {
                    font: {
                        size: 12
                    }
                }
            },
        },
    };

    const navigate = (page) => {
        if (origin == 'main_dashboard') {
            localStorage.setItem("assetCurrentTab", JSON.stringify('asset-list'));
            router.push('/assets-management')
        } else {
            switchTab(page);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <div className="bg-gray-50 min-h-screen p-6">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Total Assets */}
                <div className="bg-white rounded-lg p-6 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                TOTAL ASSETS
                            </h3>
                            <p className="text-4xl font-bold text-blue-600 mt-2">
                                {data.total_assets}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                                    <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                                    <circle cx="12" cy="12" r="2" fill="currentColor"/>
                                </svg>
                            </div>
                            <button 
                                onClick={() => navigate("asset-list")}
                                className="text-xs text-blue-600 underline hover:no-underline"
                            >
                                VIEW →
                            </button>
                        </div>
                    </div>
                </div>

                {/* Assets Require Maintenance */}
                <div className="bg-white rounded-lg p-6 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                ASSETS REQUIRE MAINTENANCE
                            </h3>
                            <p className="text-4xl font-bold text-red-500 mt-2">
                                {data.require_maintenance}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                                    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l2-7z" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                            </div>
                            <button 
                                onClick={() => navigate("asset-list")}
                                className="text-xs text-blue-600 underline hover:no-underline"
                            >
                                VIEW →
                            </button>
                        </div>
                    </div>
                </div>

                {/* Assets Require Hiring */}
                <div className="bg-white rounded-lg p-6 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                ASSETS REQUIRE HIRING
                            </h3>
                            <p className="text-4xl font-bold text-blue-600 mt-2">
                                {data.require_hiring}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                            </div>
                            <button 
                                onClick={() => navigate("asset-list")}
                                className="text-xs text-blue-600 underline hover:no-underline"
                            >
                                VIEW →
                            </button>
                        </div>
                    </div>
                </div>

                {/* Assets Warranty Ending */}
                <div className="bg-white rounded-lg p-6 shadow-sm relative overflow-hidden">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                                ASSETS WARRANTY ENDING
                            </h3>
                            <p className="text-4xl font-bold text-red-500 mt-2">
                                {data.expiring_soon}
                            </p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-gray-400">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                                    <path d="M12 8v4M12 16h0" stroke="currentColor" strokeWidth="2"/>
                                </svg>
                            </div>
                            <button 
                                onClick={() => navigate("asset-list")}
                                className="text-xs text-blue-600 underline hover:no-underline"
                            >
                                VIEW →
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Total Active Assets By Type */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-6">
                        TOTAL ACTIVE ASSETS BY TYPE
                    </h3>
                    <div className="flex items-center">
                        <div className="w-48 h-48">
                            <Pie data={AssetsByTypeData} options={chartOptions} />
                        </div>
                        <div className="ml-6 flex-1 space-y-2 text-sm">
                            {data.categories?.map((category, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div 
                                            className="w-3 h-3 rounded-sm mr-2"
                                            style={{ backgroundColor: generateColors(data.categories?.length || 0)[index] }}
                                        ></div>
                                        <span className="text-gray-600 text-xs">
                                            {startCase(category.name.replace(/_/g, ' '))}
                                        </span>
                                    </div>
                                    <span className="font-medium text-gray-900">{category.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Assets Available vs Booked */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-6">
                        ASSETS AVAILABLE VS BOOKED
                    </h3>
                    <div className="flex items-center">
                        <div className="w-48 h-48">
                            <Pie data={AvailableVsBookedData} options={chartOptions} />
                        </div>
                        <div className="ml-6 flex-1 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-sm mr-2 bg-green-500"></div>
                                    <span className="text-gray-600">Available</span>
                                </div>
                                <span className="font-medium text-gray-900">{data.available}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-sm mr-2 bg-blue-500"></div>
                                    <span className="text-gray-600">Booked</span>
                                </div>
                                <span className="font-medium text-gray-900">{data.booked}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Assets by Status */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-6">
                        ASSETS BY STATUS
                    </h3>
                    <div className="flex items-center">
                        <div className="w-48 h-48">
                            <Pie data={AssetsByStatusData} options={chartOptions} />
                        </div>
                        <div className="ml-6 flex-1 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-sm mr-2 bg-green-500"></div>
                                    <span className="text-gray-600">Active</span>
                                </div>
                                <span className="font-medium text-gray-900">{data.active}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center">
                                    <div className="w-3 h-3 rounded-sm mr-2 bg-gray-300"></div>
                                    <span className="text-gray-600">Inactive</span>
                                </div>
                                <span className="font-medium text-gray-900">{data.total_assets - data.active}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Assets Availability Rolling 12 Months */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide mb-6">
                    ASSETS AVAILABILITY ROLLING 12 MONTHS
                </h3>
                <div className="h-64">
                    <Bar data={barChartData} options={barChartOptions} />
                </div>
            </div>
        </div>
    )
}

export default forwardRef(Dashboard);
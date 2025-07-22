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
                    backgroundColor: '#ffbb00',
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.guestArrivalEnquiries?.details[1]?.label,
                    data: data.guestArrivalEnquiries?.details[1]?.data,
                    backgroundColor: '#0288d1',
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.guestArrivalEnquiries?.details[2]?.label,
                    data: data.guestArrivalEnquiries?.details[2]?.data,
                    backgroundColor: '#02ab92',
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
                    backgroundColor: '#009587', // green
                    barThickness: 20,
                    order: 1
                },
                {
                    label: data.newBookingsVsCancelations?.details[1]?.label,
                    data: data.newBookingsVsCancelations?.details[1]?.data,
                    backgroundColor: '#E92828', // red
                    barThickness: 20,
                    order: 1
                },
            ],
        });

        setPieChartData({
            labels: ['0-19 Days', '20-39 Days', '40-59 Days', '60+'],
            datasets: [
                {
                    data: [data.funderType.ndis, data.funderType.icare, data.funderType.sargood, data.funderType.private, data.funderType.royalRehab, data.funderType.other],
                    backgroundColor: [
                        '#02ab92',
                        '#0288d1',
                        '#ffbb00',
                        '#ff5d5d',
                        '#6666ff',
                        '#a6a6a6'
                    ],
                    borderColor: [
                        '#02ab92',
                        '#0288d1',
                        '#ffbb00',
                        '#ff5d5d',
                        '#6666ff',
                        '#a6a6a6'
                    ],
                    borderWidth: 1,
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
                position: "bottom"
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: false
                },
            },
            y: {
                stacked: true,
                grid: {
                    display: false,
                },
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
                position: "bottom"
            },
        },
        responsive: true,
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: true
                },
            },
            y: {
                stacked: true,
                grid: {
                    display: true,
                },
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
    };

    const barChart3Data = {
        labels: data.guestOver90Kg.labels,
        datasets: [
            {
                label: 'Guest over 90 Kg',
                data: data.guestOver90Kg?.details?.data,
                backgroundColor: '#0288D1', // blue
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
                position: "bottom"
            },
        },
        responsive: true,
        scales: {
            x: {
                stacked: false,
                grid: {
                    display: false
                },
            },
            y: {
                stacked: false,
                grid: {
                    display: false,
                },
            },
        },
        maintainAspectRatio: false
    };

    useEffect(() => {
        fetchData();
    }, [filterSelection]);

    return (
        <div className='my-2'>
            <div className='flex flex-wrap'>
                <div className="p-6 relative w-full md:w-1/2 lg:w-1/4">
                    <div className='absolute inset-1 bg-zinc-100 -z-20 rounded-md'></div>
                    <div className='absolute right-4 pr-2 -z-10'>
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" clipRule="evenodd" d="M54.6848 26.4771L29.8543 9.40257C29.7191 9.31995 29.5626 9.27865 29.4042 9.2836C29.2466 9.28067 29.0914 9.32184 28.956 9.40257L4.1255 26.4771C3.96628 26.601 3.85754 26.7785 3.81955 26.9766C3.78157 27.1747 3.81695 27.38 3.91906 27.554L4.94201 29.0028C5.06089 29.1692 5.23925 29.2836 5.44009 29.322C5.64094 29.3604 5.8489 29.3201 6.02082 29.2094L9.84303 26.5682V41.686C9.84048 41.8805 9.91419 42.0681 10.0484 42.2089C10.1826 42.3497 10.3666 42.4323 10.5609 42.4391H12.3744C12.5692 42.4417 12.7572 42.3678 12.8981 42.2332C13.039 42.0986 13.1214 41.9141 13.1277 41.7194V25.002C13.1239 24.7865 13.1765 24.574 13.2803 24.3851C13.384 24.1962 13.5353 24.0375 13.7192 23.9251L28.6286 13.6377C28.6675 13.6019 28.7099 13.5703 28.7551 13.543C28.9499 13.4263 29.1735 13.3664 29.4005 13.37C29.6283 13.3656 29.8526 13.4256 30.0478 13.543C30.0923 13.5713 30.1346 13.6028 30.1743 13.6377L45.0837 23.9251C45.2672 24.0379 45.4182 24.1965 45.5219 24.3853C45.6256 24.5741 45.6784 24.7866 45.6752 25.002V41.7194C45.6815 41.9141 45.7639 42.0986 45.9048 42.2332C46.0456 42.3678 46.2337 42.4417 46.4285 42.4391H48.2401C48.4348 42.4328 48.6192 42.3504 48.7538 42.2096C48.8884 42.0687 48.9624 41.8808 48.9599 41.686V26.5682L52.7821 29.2094C52.9537 29.32 53.1614 29.3602 53.3619 29.3218C53.5624 29.2833 53.7405 29.169 53.859 29.0028L54.882 27.554C54.9855 27.3812 55.0226 27.1766 54.9863 26.9784C54.95 26.7803 54.8429 26.6021 54.6848 26.4771ZM29.3848 36.6214C29.5376 36.6918 29.7038 36.7286 29.8721 36.7292C30.0914 36.7282 30.306 36.6653 30.4913 36.5478C30.6765 36.4304 30.8248 36.2631 30.9192 36.0651C30.9836 35.928 31.0201 35.7794 31.0265 35.6281C31.0328 35.4767 31.0091 35.3256 30.9565 35.1835C30.9053 35.0408 30.8264 34.9096 30.7242 34.7975C30.622 34.6855 30.4987 34.5948 30.3613 34.5307C30.2887 34.4973 30.2181 34.4656 30.1455 34.434C30.8708 33.8331 31.4557 33.0804 31.859 32.2292C32.2623 31.378 32.4742 30.4488 32.4798 29.5069C32.4744 27.8177 31.8008 26.1993 30.6062 25.005C29.4116 23.8108 27.793 23.1377 26.1038 23.1328C24.4147 23.1372 22.796 23.8102 21.6016 25.0046C20.4071 26.199 19.7342 27.8177 19.7297 29.5069C19.7328 30.4626 19.9495 31.4057 20.364 32.2669C20.7785 33.128 21.3803 33.8856 22.1254 34.4842C19.7779 35.5544 17.9436 37.5023 17.0161 39.9097C16.9101 40.1953 16.9203 40.5111 17.0444 40.7893C17.1685 41.0674 17.3968 41.2859 17.6801 41.3978C17.8118 41.4461 17.9509 41.4711 18.0911 41.472C18.3241 41.4705 18.5512 41.3988 18.7427 41.2661C18.9342 41.1333 19.0812 40.9456 19.1643 40.728C19.8824 38.8634 21.3114 37.3603 23.1372 36.5487C24.0971 36.1184 25.1374 35.8966 26.1894 35.8978C27.1165 35.8978 28.0355 36.0704 28.8993 36.4073C28.9249 36.4185 28.9503 36.4295 28.9757 36.4405C28.9996 36.4509 29.0233 36.4611 29.047 36.4713C29.1614 36.5207 29.274 36.5693 29.3848 36.6214ZM30.1716 29.5051C30.1672 30.5817 29.7376 31.613 28.9765 32.3745C28.2153 33.136 27.1842 33.5661 26.1076 33.571C25.0317 33.5642 24.0017 33.1338 23.2407 32.3731C22.4797 31.6125 22.049 30.5828 22.0417 29.5069C22.048 28.4303 22.4783 27.3996 23.2394 26.6382C24.0005 25.8768 25.031 25.446 26.1076 25.4391C27.1835 25.4465 28.2132 25.8772 28.9738 26.6382C29.7344 27.3991 30.1648 28.4292 30.1716 29.5051ZM40.5042 43.0045C42.2199 43.8799 43.55 45.3604 44.2372 47.1597C44.3212 47.3839 44.3336 47.6286 44.2726 47.8601C44.2117 48.0917 44.0803 48.2988 43.8968 48.4525L44.0586 48.6923L43.376 48.7241H43.1528C42.9198 48.7219 42.6927 48.6499 42.501 48.5172C42.3094 48.3846 42.1619 48.1974 42.0778 47.98C41.806 47.2656 41.3868 46.6165 40.8475 46.0749C40.3081 45.5333 39.6607 45.1113 38.9475 44.8366C38.3258 44.5988 37.6657 44.4777 37.0001 44.4794C36.2409 44.4793 35.49 44.6386 34.796 44.9465C33.4832 45.5313 32.4558 46.6128 31.9392 47.9539C31.8542 48.1707 31.7065 48.3572 31.515 48.4897C31.3236 48.6223 31.0969 48.6948 30.8641 48.6979C30.7232 48.6972 30.5834 48.672 30.4511 48.6235C30.1669 48.5128 29.9378 48.2945 29.8135 48.0159C29.6892 47.7373 29.6797 47.4211 29.7872 47.1356C30.4655 45.3812 31.7576 43.9324 33.4234 43.0586C32.9176 42.5801 32.5149 42.0033 32.2398 41.3637C31.9648 40.724 31.8232 40.0349 31.8238 39.3387C31.8282 37.9836 32.3686 36.6852 33.3269 35.7273C34.2852 34.7693 35.5837 34.2295 36.9387 34.2256C38.2944 34.2295 39.5935 34.7694 40.5525 35.7277C41.5115 36.686 42.0524 37.9848 42.0573 39.3405C42.0556 40.0239 41.9173 40.6999 41.6506 41.3292C41.3839 41.9584 40.9941 42.528 40.5042 43.0045ZM36.7974 36.1655L36.8141 36.5376H36.8215C36.0988 36.5683 35.4159 36.8769 34.9154 37.3992C34.4149 37.9215 34.1356 38.6171 34.1358 39.3405C34.1372 40.0851 34.4336 40.7989 34.9599 41.3255C35.4862 41.8522 36.1997 42.1489 36.9443 42.1509C37.6887 42.1489 38.402 41.852 38.9281 41.3253C39.4541 40.7986 39.75 40.0849 39.7509 39.3405C39.7485 38.5966 39.4514 37.8839 38.9247 37.3586C38.3979 36.8333 37.6845 36.5381 36.9406 36.5376L36.7974 36.1655Z" fill="#E3E5E6" />
                        </svg>
                    </div>
                    <div className='w-1/2'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Total Guests On-site</h6>
                        <h3 className='text-5xl font-semibold mt-4'>{data.totalGuests}</h3>
                    </div>
                    <div className='flex flex-end' onClick={() => { window.location.href = '/bookings' }}>
                        <span className='ml-auto mr-0 text-xs text-sky-800 underline font-bold cursor-pointer hover:no-underline'>View</span>
                    </div>
                </div>
                <div className="p-6 relative w-full md:w-1/2 lg:w-1/4">
                    <div className='absolute inset-1 bg-zinc-100 -z-20 rounded-md'></div>
                    <div className='absolute right-4 pr-2 -z-10'>
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M51.8458 58.4285H8.17638C6.03051 58.4355 3.96846 57.596 2.43772 56.0921C0.906971 54.5882 0.0310362 52.5414 0 50.3957V15.9606C0.0119344 14.8669 0.243853 13.7869 0.681941 12.7847C1.12003 11.7826 1.75533 10.8789 2.54999 10.1274C4.12698 8.66351 6.2096 7.86721 8.36096 7.90555C8.93945 7.92909 9.4859 8.17752 9.88397 8.59793C10.282 9.01834 10.5003 9.57753 10.4922 10.1564C10.481 10.7314 10.2433 11.2787 9.83076 11.6794C9.41823 12.0801 8.86424 12.3018 8.28918 12.2962H8.14733C7.17282 12.2979 6.23704 12.6779 5.53721 13.356C4.83737 14.0342 4.42816 14.9576 4.39583 15.9315V50.3684C4.41687 51.3484 4.82171 52.281 5.52328 52.9656C6.22484 53.6503 7.16708 54.0322 8.14733 54.0293H51.7006C52.706 54.0433 53.6796 53.677 54.4266 53.0038C54.7867 52.6698 55.0761 52.2668 55.2775 51.8187C55.4789 51.3707 55.5882 50.8868 55.599 50.3957V15.9606C55.5789 14.98 55.1744 14.0465 54.4728 13.3611C53.7711 12.6758 52.8284 12.2934 51.8475 12.2962H51.6766C51.0937 12.2962 50.5347 12.0647 50.1225 11.6525C49.7103 11.2403 49.4787 10.6813 49.4787 10.0983C49.4787 9.51541 49.7103 8.95636 50.1225 8.54417C50.5347 8.13198 51.0937 7.90042 51.6766 7.90042H51.8236C53.9691 7.89478 56.0304 8.73476 57.5608 10.2383C59.0913 11.7419 59.9676 13.788 60 15.9332V50.3684C59.9766 52.5139 59.108 54.5636 57.5826 56.0726C56.0573 57.5817 53.9983 58.4282 51.8527 58.4285H51.8458Z" fill="#E3E5E6" />
                            <path d="M13.9811 15.2569C13.4001 15.2506 12.8447 15.0171 12.4338 14.6062C12.023 14.1954 11.7894 13.6399 11.7832 13.0589V3.76823C11.7832 3.1853 12.0148 2.62626 12.427 2.21407C12.8391 1.80188 13.3982 1.57031 13.9811 1.57031C14.564 1.57031 15.1231 1.80188 15.5353 2.21407C15.9475 2.62626 16.179 3.1853 16.179 3.76823V13.0589C16.1728 13.6399 15.9392 14.1954 15.5284 14.6062C15.1176 15.0171 14.5621 15.2506 13.9811 15.2569Z" fill="#E3E5E6" />
                            <path d="M45.8678 15.2569C45.2868 15.2506 44.7314 15.0171 44.3206 14.6062C43.9097 14.1954 43.6761 13.6399 43.6699 13.0589V3.76823C43.6699 3.1853 43.9015 2.62626 44.3137 2.21407C44.7259 1.80188 45.2849 1.57031 45.8678 1.57031C46.4508 1.57031 47.0098 1.80188 47.422 2.21407C47.8342 2.62626 48.0658 3.1853 48.0658 3.76823V13.0589C48.0662 13.3477 48.0097 13.6337 47.8994 13.9006C47.7891 14.1675 47.6272 14.4099 47.423 14.6141C47.2188 14.8183 46.9763 14.9802 46.7095 15.0905C46.4426 15.2008 46.1566 15.2573 45.8678 15.2569Z" fill="#E3E5E6" />
                            <path d="M37.7193 12.2962H22.2741C21.6912 12.2962 21.1321 12.0647 20.7199 11.6525C20.3077 11.2403 20.0762 10.6812 20.0762 10.0983C20.0762 9.51538 20.3077 8.95633 20.7199 8.54415C21.1321 8.13196 21.6912 7.90039 22.2741 7.90039H37.7193C38.3022 7.90039 38.8613 8.13196 39.2735 8.54415C39.6857 8.95633 39.9172 9.51538 39.9172 10.0983C39.9172 10.6812 39.6857 11.2403 39.2735 11.6525C38.8613 12.0647 38.3022 12.2962 37.7193 12.2962Z" fill="#E3E5E6" />
                            <path d="M26.4774 45.2579C25.9466 45.2505 25.4343 45.0621 25.0251 44.724C24.5903 44.3359 24.3254 43.7925 24.2874 43.211C24.2495 42.6294 24.4416 42.0562 24.8223 41.615L40.5108 23.7349C40.7006 23.5154 40.9318 23.3357 41.1913 23.206C41.4508 23.0763 41.7333 22.9992 42.0227 22.9791C42.3121 22.9591 42.6026 22.9965 42.8775 23.0892C43.1524 23.1818 43.4062 23.328 43.6244 23.5191C43.8426 23.7103 44.0208 23.9428 44.1488 24.2031C44.2768 24.4634 44.352 24.7465 44.3701 25.036C44.3882 25.3256 44.3489 25.6158 44.2544 25.8901C44.1599 26.1643 44.0121 26.4172 43.8195 26.6341L28.1303 44.5203C27.922 44.7524 27.6672 44.938 27.3824 45.065C27.0976 45.1921 26.7893 45.2578 26.4774 45.2579Z" fill="#E3E5E6" />
                            <path d="M25.658 44.595C25.0766 44.5911 24.5204 44.3573 24.1108 43.9447L17.4485 37.2675C17.2395 37.0644 17.073 36.8218 16.9587 36.5536C16.8444 36.2855 16.7846 35.9973 16.7828 35.7059C16.781 35.4144 16.8372 35.1255 16.9482 34.856C17.0592 34.5865 17.2228 34.3418 17.4293 34.1362C17.6358 33.9305 17.8812 33.768 18.1512 33.6582C18.4211 33.5483 18.7103 33.4933 19.0017 33.4963C19.2932 33.4993 19.5811 33.5603 19.8487 33.6758C20.1163 33.7912 20.3583 33.9587 20.5605 34.1686L27.2228 40.8458C27.6364 41.261 27.8683 41.8235 27.8675 42.4096C27.8666 42.9957 27.6332 43.5576 27.2184 43.9717C26.795 44.368 26.2379 44.5906 25.658 44.595Z" fill="#E3E5E6" />
                        </svg>
                    </div>
                    <div className='w-1/2'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Guests Arriving Today</h6>
                        <h3 className='text-5xl font-semibold mt-4'>{data.toalGuestsArrivingToday}</h3>
                    </div>
                    <div className='flex flex-end' onClick={() => { window.location.href = '/bookings' }}>
                        <span className='ml-auto mr-0 text-xs text-sky-800 underline font-bold cursor-pointer hover:no-underline'>View</span>
                    </div>
                </div>
                <div className="p-6 relative w-full md:w-1/2 lg:w-1/4">
                    <div className='absolute inset-1 bg-zinc-100 -z-20 rounded-md'></div>
                    <div className='absolute right-4 pr-2 -z-10'>
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M51.8458 58.4285H8.17638C6.03051 58.4355 3.96846 57.596 2.43772 56.0921C0.906971 54.5882 0.0310362 52.5414 0 50.3957V15.9606C0.0119344 14.8669 0.243853 13.7869 0.681941 12.7847C1.12003 11.7826 1.75533 10.8789 2.54999 10.1274C4.12698 8.66351 6.2096 7.86721 8.36096 7.90555C8.93945 7.92909 9.4859 8.17752 9.88397 8.59793C10.282 9.01834 10.5003 9.57753 10.4922 10.1564C10.481 10.7314 10.2433 11.2787 9.83076 11.6794C9.41823 12.0801 8.86424 12.3018 8.28918 12.2962H8.14733C7.17282 12.2979 6.23704 12.6779 5.53721 13.356C4.83737 14.0342 4.42816 14.9576 4.39583 15.9315V50.3684C4.41687 51.3484 4.82171 52.281 5.52328 52.9656C6.22484 53.6503 7.16708 54.0322 8.14733 54.0293H51.7006C52.706 54.0433 53.6796 53.677 54.4266 53.0038C54.7867 52.6698 55.0761 52.2668 55.2775 51.8187C55.4789 51.3707 55.5882 50.8868 55.599 50.3957V15.9606C55.5789 14.98 55.1744 14.0465 54.4728 13.3611C53.7711 12.6758 52.8284 12.2934 51.8475 12.2962H51.6766C51.0937 12.2962 50.5347 12.0647 50.1225 11.6525C49.7103 11.2403 49.4787 10.6813 49.4787 10.0983C49.4787 9.51541 49.7103 8.95636 50.1225 8.54417C50.5347 8.13198 51.0937 7.90042 51.6766 7.90042H51.8236C53.9691 7.89478 56.0304 8.73476 57.5608 10.2383C59.0913 11.7419 59.9676 13.788 60 15.9332V50.3684C59.9766 52.5139 59.108 54.5636 57.5826 56.0726C56.0573 57.5817 53.9983 58.4282 51.8527 58.4285H51.8458Z" fill="#E3E5E6" />
                            <path d="M13.9811 15.2569C13.4001 15.2506 12.8447 15.0171 12.4338 14.6062C12.023 14.1954 11.7894 13.6399 11.7832 13.0589V3.76823C11.7832 3.1853 12.0148 2.62626 12.427 2.21407C12.8391 1.80188 13.3982 1.57031 13.9811 1.57031C14.564 1.57031 15.1231 1.80188 15.5353 2.21407C15.9475 2.62626 16.179 3.1853 16.179 3.76823V13.0589C16.1728 13.6399 15.9392 14.1954 15.5284 14.6062C15.1176 15.0171 14.5621 15.2506 13.9811 15.2569Z" fill="#E3E5E6" />
                            <path d="M45.8678 15.2569C45.2868 15.2506 44.7314 15.0171 44.3206 14.6062C43.9097 14.1954 43.6761 13.6399 43.6699 13.0589V3.76823C43.6699 3.1853 43.9015 2.62626 44.3137 2.21407C44.7259 1.80188 45.2849 1.57031 45.8678 1.57031C46.4508 1.57031 47.0098 1.80188 47.422 2.21407C47.8342 2.62626 48.0658 3.1853 48.0658 3.76823V13.0589C48.0662 13.3477 48.0097 13.6337 47.8994 13.9006C47.7891 14.1675 47.6272 14.4099 47.423 14.6141C47.2188 14.8183 46.9763 14.9802 46.7095 15.0905C46.4426 15.2008 46.1566 15.2573 45.8678 15.2569Z" fill="#E3E5E6" />
                            <path d="M37.7193 12.2962H22.2741C21.6912 12.2962 21.1321 12.0647 20.7199 11.6525C20.3077 11.2403 20.0762 10.6812 20.0762 10.0983C20.0762 9.51538 20.3077 8.95633 20.7199 8.54415C21.1321 8.13196 21.6912 7.90039 22.2741 7.90039H37.7193C38.3022 7.90039 38.8613 8.13196 39.2735 8.54415C39.6857 8.95633 39.9172 9.51538 39.9172 10.0983C39.9172 10.6812 39.6857 11.2403 39.2735 11.6525C38.8613 12.0647 38.3022 12.2962 37.7193 12.2962Z" fill="#E3E5E6" />
                            <path d="M40.9523 47.4719L29.9977 36.5241L19.0483 47.4719C18.7135 47.8067 18.2594 47.9948 17.786 47.9948C17.3125 47.9948 16.8584 47.8067 16.5236 47.4719C16.1888 47.1371 16.0007 46.683 16.0007 46.2096C16.0007 45.7361 16.1888 45.2821 16.5236 44.9473L27.4771 33.9974L16.5225 23.0475C16.1879 22.7127 15.9999 22.2587 16 21.7853C16.0001 21.312 16.1883 20.858 16.5231 20.5234C16.8579 20.1887 17.3119 20.0008 17.7852 20.0009C18.2586 20.001 18.7126 20.1891 19.0473 20.5239L29.9977 31.4769L40.9523 20.5229C41.2871 20.1881 41.7412 20 42.2147 20C42.6882 20 43.1423 20.1881 43.4771 20.5229C43.8119 20.8576 44 21.3117 44 21.7852C44 22.2587 43.8119 22.7127 43.4771 23.0475L32.5246 33.9974L43.4729 44.9525C43.8077 45.2873 43.9958 45.7413 43.9958 46.2148C43.9958 46.6883 43.8077 47.1423 43.4729 47.4771C43.1381 47.8119 42.684 48 42.2105 48C41.7371 48 41.283 47.8119 40.9482 47.4771L40.9523 47.4719Z" fill="#E3E5E6" />
                        </svg>
                    </div>
                    <div className='w-1/2'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Guests Checking-out Today</h6>
                        <h3 className='text-5xl font-semibold mt-4'>{data.totalGuestCheckingOutToday}</h3>
                    </div>
                    <div className='flex flex-end' onClick={() => { window.location.href = '/bookings' }}>
                        <span className='ml-auto mr-0 text-xs text-sky-800 underline font-bold cursor-pointer hover:no-underline'>View</span>
                    </div>
                </div>
                <div className="p-6 relative w-full md:w-1/2 lg:w-1/4">
                    <div className='absolute inset-1 bg-zinc-100 -z-20 rounded-md'></div>
                    <div className='absolute right-4 pr-2 -z-10'>
                        <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M48.5425 3.47282C48.3438 3.26012 48.1043 3.08954 47.8384 2.97131C47.5724 2.85308 47.2855 2.7895 46.9945 2.7845C46.7035 2.7795 46.4145 2.83313 46.1446 2.94215C45.8747 3.05117 45.6294 3.21331 45.4235 3.41905C45.2176 3.62479 45.0552 3.87007 44.946 4.13987C44.8367 4.40968 44.7826 4.69845 44.7874 4.98949C44.7922 5.28053 44.8559 5.56785 44.9739 5.83394C45.0919 6.10002 45.262 6.33946 45.4745 6.53835C47.9201 8.97139 49.8587 11.8655 51.1785 15.0527C52.4983 18.24 53.1734 21.6572 53.1639 25.1068C53.1639 25.682 53.392 26.2335 53.7987 26.6402C54.2054 27.0469 54.7569 27.2754 55.3321 27.2754C55.9072 27.2754 56.4588 27.0469 56.8655 26.6402C57.2722 26.2335 57.5009 25.682 57.5009 25.1068C57.5121 21.0876 56.7264 17.1061 55.1887 13.3927C53.651 9.67921 51.3917 6.30758 48.5425 3.47282Z" fill="#E3E5E6" />
                            <path d="M6.83281 25.1068C6.82283 21.6572 7.49787 18.2399 8.81818 15.053C10.1385 11.866 12.078 8.9726 14.5246 6.54073C14.732 6.34059 14.8974 6.10108 15.0112 5.83631C15.125 5.57155 15.1848 5.28673 15.1874 4.99854C15.19 4.71036 15.1355 4.42478 15.0264 4.15804C14.9173 3.8913 14.7557 3.6489 14.5519 3.44512C14.3482 3.24134 14.1061 3.08006 13.8393 2.97095C13.5726 2.86185 13.2867 2.8071 12.9985 2.80966C12.7103 2.81221 12.4255 2.87201 12.1607 2.98584C11.896 3.09966 11.6568 3.26509 11.4566 3.47246C8.60711 6.30651 6.34808 9.67769 4.81039 13.3908C3.27269 17.1039 2.48664 21.0852 2.49817 25.104C2.49817 25.6792 2.72694 26.231 3.13364 26.6377C3.54033 27.0444 4.09185 27.2729 4.66701 27.2729C5.24217 27.2729 5.79369 27.0444 6.20039 26.6377C6.60708 26.231 6.83524 25.6792 6.83524 25.104L6.83281 25.1068Z" fill="#E3E5E6" />
                            <path d="M53.3828 44.4241C51.5751 42.8974 50.1224 40.9942 49.1266 38.8477C48.1307 36.7013 47.6159 34.3633 47.6175 31.9971V25.1066C47.6126 20.8112 46.0407 16.6654 43.1966 13.4465C40.3525 10.2276 36.4316 8.15695 32.1695 7.62314V2.24326C32.1794 1.95229 32.1301 1.66233 32.0255 1.39061C31.921 1.11889 31.7631 0.871212 31.5608 0.661891C31.3584 0.45257 31.1162 0.285918 30.8482 0.172231C30.5802 0.0585448 30.2918 0 30.0007 0C29.7096 0 29.4212 0.0585448 29.1532 0.172231C28.8852 0.285918 28.6429 0.45257 28.4406 0.661891C28.2382 0.871212 28.0798 1.11889 27.9752 1.39061C27.8707 1.66233 27.822 1.95229 27.8318 2.24326V7.62314C23.57 8.15746 19.6494 10.2284 16.8054 13.4471C13.9614 16.6659 12.3893 20.8114 12.3839 25.1066V31.9971C12.3839 34.3674 11.8661 36.7092 10.8663 38.8584C9.86651 41.0075 8.40906 42.9121 6.59605 44.439C5.87544 45.0557 5.3611 45.8783 5.12222 46.7962C4.88333 47.7141 4.93156 48.6832 5.26012 49.5729C5.58868 50.4626 6.18185 51.2301 6.95996 51.7724C7.73806 52.3147 8.66333 52.6056 9.61177 52.6059H20.668C21.1621 54.7099 22.3525 56.5852 24.0464 57.9274C25.7403 59.2697 27.8383 60 29.9995 60C32.1607 60 34.2586 59.2697 35.9525 57.9274C37.6464 56.5852 38.8369 54.7099 39.331 52.6059H50.3866C51.3371 52.6051 52.2646 52.3122 53.0432 51.7669C53.8219 51.2216 54.4142 50.4504 54.74 49.5574C55.0659 48.6644 55.1097 47.6929 54.8652 46.7743C54.6206 45.8557 54.0998 45.0345 53.3731 44.4217L53.3828 44.4241ZM29.9922 55.6866C28.985 55.6848 27.9992 55.3936 27.1526 54.8479C26.3061 54.3023 25.634 53.5249 25.2165 52.6083H34.7697C34.352 53.5252 33.6793 54.3028 32.8323 54.8485C31.9853 55.3943 30.9998 55.6853 29.9922 55.6866ZM50.581 47.7388C50.614 47.767 50.6407 47.8022 50.6587 47.8417C50.6768 47.8813 50.6858 47.924 50.6855 47.9675C50.6855 48.048 50.6537 48.1253 50.5968 48.1823C50.5398 48.2392 50.4622 48.2713 50.3817 48.2713H9.59719C9.53449 48.271 9.47329 48.2511 9.42223 48.2148C9.37117 48.1784 9.33239 48.1272 9.31166 48.068C9.29093 48.0089 9.28899 47.9446 9.30619 47.8843C9.32339 47.824 9.35882 47.7705 9.40765 47.7312C11.6979 45.7985 13.5384 43.3888 14.8 40.6706C16.0615 37.9524 16.7137 34.9913 16.7112 31.9946V25.1042C16.759 21.6138 18.1792 18.2827 20.6644 15.8313C23.1495 13.3799 26.5002 12.0055 29.991 12.0055C33.4817 12.0055 36.8318 13.3799 39.317 15.8313C41.8021 18.2827 43.2223 21.6138 43.2701 25.1042V31.9946C43.2689 34.994 43.9233 37.9576 45.1874 40.6776C46.4516 43.3976 48.2947 45.8083 50.5883 47.7412L50.581 47.7388Z" fill="#E3E5E6" />
                        </svg>
                    </div>
                    <div className='w-1/2'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Late Check-in Today</h6>
                        <h3 className='text-5xl font-semibold mt-4'>{data.totalGuestLateCheckInToday}</h3>
                    </div>
                    <div className='flex flex-end' onClick={() => { window.location.href = '/bookings' }}>
                        <span className='ml-auto mr-0 text-xs text-sky-800 underline font-bold cursor-pointer hover:no-underline'>View</span>
                    </div>
                </div>
            </div>
            <div className='flex justify-end py-4 mr-2'>
                <SelectFilterComponent options={filters} placeholder={"Filter"} onChange={handleFilterSelection} value={filterSelection} />
            </div>
            <div className='flex flex-wrap'>
                <div className='bg-zinc-100 w-full py-8 px-6 relative border-8 border-white rounded-md'>
                    <h6 className='text-sm font-bold whitespace-nowrap'>Guest Arrival Enquiries</h6>
                    <div className='p-4 relative h-80'>
                        <Bar options={barCharOptions} data={barChartData} />
                    </div>
                </div>
                <div className='bg-zinc-100 w-full py-8 px-6 relative border-8 border-white rounded-md'>
                    <h6 className='text-sm font-bold whitespace-nowrap'>New Bookings vs Cancelations</h6>
                    <div className='p-4 relative h-80'>
                        <Bar options={barChar2Options} data={barChart2Data} />
                    </div>
                </div>
                <div className='flex w-full flex-wrap'>
                    <div className='bg-zinc-100 w-full lg:w-1/3 p-6 border-8 border-white rounded-lg'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Onsite - Guest by Funder Type</h6>
                        <div className='flex justify-center items-center p-6'>
                            <div className='w-32 h-32'>
                                <Doughnut data={pieChartData} options={pieChartOptions} />
                            </div>
                        </div>
                        <div className='bg-[#02ab92] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#02ab92]'>
                            <p>NDIS</p>
                            <p>{data.funderType.ndis}</p>
                        </div>
                        <div className='bg-[#0288d1] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#0288d1]'>
                            <p>iCare</p>
                            <p>{data.funderType.icare}</p>
                        </div>
                        <div className='bg-[#ffbb00] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#FFBB00]'>
                            <p>Sargood Foundation</p>
                            <p>{data.funderType.sargood}</p>
                        </div>
                        <div className='bg-[#ff5d5d] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#FF5D5D]'>
                            <p>Private</p>
                            <p>{data.funderType.private}</p>
                        </div>
                        <div className='bg-[#6666ff] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#6666ff]'>
                            <p>Royal Rehab</p>
                            <p>{data.funderType.royalRehab}</p>
                        </div>
                        <div className='bg-[#a6a6a6] bg-opacity-10 mt-2 p-2 rounded-full flex justify-between text-xs font-bold text-[#a6a6a6]'>
                            <p>Other</p>
                            <p>{data.funderType.other}</p>
                        </div>
                    </div>
                    <div className='bg-zinc-100 w-full lg:w-[66.60%] p-2 md:p-6 border-8 border-white rounded-lg'>
                        <h6 className='text-sm font-bold whitespace-nowrap'>Guest over 90kg - Next 14 days</h6>
                        <div className='p-6 relative h-96'>
                            <Bar options={barChar3Options} data={barChart3Data} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default forwardRef(BookingDashboardPage);
import { useSelector } from "react-redux";
import dynamic from 'next/dynamic';

const Dashboards = dynamic(() => import('../../components/dashboard/dashboard-view'));

const DashboardPage = () => {
    const user = useSelector((state) => state.user.user);

    return user && user.type == 'user' ? <Dashboards /> : "";
}

export default DashboardPage;
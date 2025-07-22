import { useSelector } from "react-redux";
import dynamic from 'next/dynamic';

const AdminView = dynamic(() => import('./../../components/booking-comp/admin-view'));
const GuestView = dynamic(() => import('./../../components/booking-comp/guest-view'));
const GuestViewV2 = dynamic(() => import('./../../components/booking-comp/guest-view-v2'));

export default function Bookings() {
  const user = useSelector((state) => state.user.user);

  return user && user.type == 'user' ? <AdminView /> : <GuestViewV2 />;
}

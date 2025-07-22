import dynamic from 'next/dynamic';
import { Can } from '../../services/acl/can';
const Layout = dynamic(() => import('../../components/layout'));
const BookingList = dynamic(() => import('../../components/booking-comp/list'));
const BookingListV2 = dynamic(() => import('../../components/booking-comp/listv2'));

export default function Bookings() {
  return (
    <Layout title={"Bookings"} hideSpinner={true}>
      <div className="p-4 col-span-9">
        <Can I="Read" a="Booking">
          <BookingListV2 />
        </Can>
        <Can not I="Read" a="Booking">
          <div className="text-center">You are not authorized to view this page</div>
        </Can>
      </div>
    </Layout>
  );
}

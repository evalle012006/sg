import { useRouter } from "next/router";
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../components/layout'));
const Avatar = dynamic(() => import('../../components/avatar'));
const BookingHistory = dynamic(() => import('../../components/booking-comp/history'));

export default function History() {
  const router = useRouter();
  const { uuid } = router.query;

  return (
    <Layout title={"Booking History"}>
      <div className="p-8 col-span-9">
        {uuid && <BookingHistory uuid={uuid} />}
        <div className="sticky bottom-0 bg-white w-full border-zinc-100 border-t-8 flex">
            <div className="py-10 px-16 flex justify-end w-full items-center">
                <button className="px-10 py-2 bg-emerald-500 text-white rounded-md font-bold" onClick={() => router.back()}>Back</button>
            </div>
          </div>
      </div>
    </Layout>
  );
}

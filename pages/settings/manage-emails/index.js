import NotificationLibraryPage from "../manage-notification-library";
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));

export default function ManageEmailPage() {
    return (
        <Layout title="Manage Emails">
            <div className="p-4">
                <NotificationLibraryPage />
            </div>
        </Layout>
    );
}
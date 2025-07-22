import dynamic from 'next/dynamic';
const AssetEquipmentList = dynamic(() => import('../../components/assets-management/list'));
const Layout = dynamic(() => import('../../components/layout'));

export default function AssetManagementPage() {
  return (
    <Layout title="Assets">
      <div className='container mx-auto px-4 py-8'>
        <AssetEquipmentList />
      </div>
    </Layout>
  )
}

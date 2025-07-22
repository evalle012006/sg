import React from 'react';
import dynamic from 'next/dynamic';
import { Can } from '../../services/acl/can';

const Layout = dynamic(() => import('../../components/layout'));
const GuestList = dynamic(() => import('../../components/guest-comp/list'));

export default function Guests() {
    return (<Layout title={"Guest List"}>
        <div className='p-16'>
            <Can I="Read" a="Guest">
                <GuestList />
            </Can>
            <Can not I="Read" a="Guest">
                <div className="text-center">You are not authorized to view this page</div>
            </Can>
        </div>
    </Layout>)
}
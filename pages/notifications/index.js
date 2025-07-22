import { useState } from "react";
import Notification from "./../../components/notification.js";
import Layout from "./../../components/layout.js";
import Avatar from "./../../components/avatar.js";
import { useSelector } from "react-redux";

export default function Notifications() {

    const notifications = useSelector(state => state.notifications.notifications);

    return (
        <Layout>
            <div className="notifications p-16">
                <div className="flex justify-between">
                    <h2 className="page-title">Notifications</h2>
                    <Avatar />
                </div>
                {notifications.length > 0 ? notifications.map((notification) => (
                    <Notification key={notification.id} {...notification} />
                )) : <p>No notifications.</p>}
            </div>
        </Layout>
    );
}

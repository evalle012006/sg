import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { userActions } from "../store/userSlice";
import { useRouter } from "next/router";
import { GetField } from "./fields";
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';

export default function Avatar() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [dropdownStatus, setDropdownStatus] = useState(false);
    const dispatch = useDispatch();
    const user = useSelector((state) => state.user.user);

    const profilePhotoRef = useRef();
    const [isProfilePhotoError, setIsProfilePhotoError] = useState(false);

    // Function to get user initials
    const getUserInitials = () => {
        if (!user) return "";
        const firstName = user.first_name || "";
        const lastName = user.last_name || "";
        return (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
    };

    // Function to check if we should show initials
    const shouldShowInitials = () => {
        return !user.profile_url || isProfilePhotoError;
    };

    // Function to get random background color for initials
    const getRandomBackgroundColor = () => {
        const colors = [
            'bg-blue-500',
            'bg-green-500',
            'bg-purple-500',
            'bg-pink-500',
            'bg-indigo-500',
            'bg-red-500',
            'bg-yellow-500',
            'bg-teal-500',
            'bg-orange-500',
            'bg-cyan-500',
            'bg-emerald-500',
            'bg-violet-500'
        ];
        // Use user email as seed for consistent color per user
        const seed = user?.email ? user.email.charCodeAt(0) + user.email.charCodeAt(user.email.length - 1) : 0;
        return colors[seed % colors.length];
    };

    // Handle image load error - just set error state permanently
    const handleImageError = (e) => {
        console.log('Image failed to load, showing initials instead');
        setIsProfilePhotoError(true);
    };

    const fetchAndUpdateUser = async () => {
        const response = await fetch("/api/" + user.type + "s/by-email/" + user.email, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (response.ok) {
            const userData = await response.json();
            dispatch({ type: 'user/updateUser', payload: { ...userData, type: user.type } });
        }
    }

    useEffect(() => {
        if (user) {
            // console.log('user user', user)
            fetchAndUpdateUser();
        }
    }, []);

    // Reset error state when user changes (new user might have valid image)
    useEffect(() => {
        setIsProfilePhotoError(false)
    }, [user?.profile_url]); // Only reset when profile_url changes

    const logout = async () => {
        setDropdownStatus(false);
        dispatch(userActions.removeUser());
        localStorage.removeItem("persist:root");
        const data = await signOut({ redirect: false });
        user.type == 'user' ? router.push("/auth/admin-login") : router.push("/auth/login");
        localStorage.removeItem("persist:root");
        localStorage.removeItem("currentTab");
        localStorage.removeItem("assetCurrentTab");
    }

    const viewProfile = () => {
        setDropdownStatus(false);
        // Navigate to the my-profile page instead of showing modal
        router.push('/my-profile');
    }

    return (
        <div className="relative cursor-pointer">
            {user && (
                <div className="flex items-center justify-center" onClick={() => setDropdownStatus(!dropdownStatus)}>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center">
                        {shouldShowInitials() ? (
                            <div className={`w-full h-full rounded-full ${getRandomBackgroundColor()} flex items-center justify-center text-white font-semibold text-sm sm:text-base md:text-lg lg:text-xl`}>
                                {getUserInitials()}
                            </div>
                        ) : (
                            <Image
                                className="rounded-full"
                                width={56}
                                height={56}
                                src={user.profile_url}
                                onError={handleImageError}
                                alt="profile picture"
                            />
                        )}
                    </div>
                </div>
            )}
            {dropdownStatus && (
                <div className="absolute z-50 top-full right-0 min-w-[120px] shadow-lg rounded border border-slate-300 bg-white">
                    {/* {user.type === 'guest' && <p className="hover:bg-gray-100 px-4 py-2 cursor-pointer whitespace-nowrap" onClick={() => viewProfile()}>Profile</p>} */}
                    <p className="hover:bg-gray-100 px-4 py-2 cursor-pointer whitespace-nowrap" onClick={() => logout()}>Sign out</p>
                </div>
            )}
            {dropdownStatus && (<div className="fixed z-10 inset-0" onClick={() => setDropdownStatus(false)}></div>)}
        </div >
    )
}
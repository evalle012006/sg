import React, { useEffect, useState } from "react";
import { useRouter,  } from "next/router";
import { useFormik } from "formik";
import * as yup from 'yup';
import Image from "next/image"
import Link from "next/link";
import logo from "/public/sargood-logo.svg";

import dynamic from 'next/dynamic';
const FormLayout = dynamic(() => import('./../../../components/formLayout'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));

function SignupPage() {
    const router = useRouter();
    const { token } = router.query;
    const [tokenData, setTokenData] = useState({ email: null, user_type: null });

    const [status, setStatus] = useState("loading");
    const [submitted, setSubmitted] = useState(false);
    const [passwordStatus, setPasswordStatus] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        if (token) {
            validateToken();
        }
    }, [token]);

    const validateToken = async () => {
        const res = await fetch("/api/auth/validate-token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                token,
                userEmail: tokenData.email ? tokenData.email : null,
                userType: tokenData.user_type ? tokenData.user_type : null,
            }),
        });

        const data = await res.json();
        console.log('data', data)

        if (data.status == "valid") {
            setStatus("valid-token");
            setTokenData(data);
        } else {
            setStatus("invalid-token");
        }
    };

    const formik = useFormik({
        initialValues: { password: '', confirm_password: '' },
        onSubmit: (values) => {
            setSubmitted(true)
            fetch('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    token: token,
                    password: values.password,
                    confirm_password: values.confirm_password,
                    usertype: tokenData.user_type
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            }).then(response => response.json()).then(response => {
                setMessage(response.message)
                setPasswordStatus(response.status)
                setInterval(() => {
                    if (tokenData.user_type == 'guest') {
                        router.push('/auth/login')
                    } else {
                        router.push('/auth/login')
                    }
                }, 1500);
            })
        },
        validationSchema: yup.object({
            password: yup.string()
                .required('No password provided.')
                .min(8, 'Password is too short - should be 8 characters minimum.'),
            confirm_password: yup.string()
                .oneOf([yup.ref('password'), null], 'Passwords must match')
        }),
    })
    return (
        <FormLayout>
            <div className="w-full max-w-md mx-auto">
                {status == 'loading' && <Spinner />}
                {status == 'valid-token' && <main id="content" role="main" className="w-full max-w-md">
                    <div className="flex justify-center">
                        <div className="relative m-4 h-40 w-40">
                            <Image alt="" src={logo.src} layout="fill" objectFit="contain" />
                        </div>
                    </div>
                    <div className="mt-7 bg-white">
                        <div className="p-4 sm:p-7">
                            <div className="">
                                <h1 className="block text-2xl font-bold text-gray-800">Set a new password</h1>
                                <p>for {tokenData.email}</p>
                            </div>
                            <div hidden={!submitted} className={`my-5 p-2 border-l-4 ${passwordStatus == 'success' ? "border-green-500" : "border-red-500"}`} role="alert">
                                {message}
                            </div>
                            <div className="mt-5">
                                <form onSubmit={formik.handleSubmit}>
                                    <div className="grid gap-y-4">
                                        <div>
                                            <label htmlFor="password" className="block text-sm font-bold ml-1 mb-2">New password</label>
                                            <div className="relative">
                                                <input
                                                    className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:border-sargood-blue focus:ring-sargood-blue shadow-sm" aria-describedby="email-error"
                                                    type="password"
                                                    id="password"
                                                    name="password"
                                                    value={formik.values.password}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                />
                                                {formik.errors.password && (
                                                    <div className="text-red-600">{formik.errors.password}</div>
                                                )}
                                            </div>
                                            <p className="hidden text-xs text-red-600 mt-2" id="email-error">Please include a valid email address so we can get back to you</p>
                                        </div>
                                        <div>
                                            <label htmlFor="confirm_password" className="block text-sm font-bold ml-1 mb-2">Confirm password</label>
                                            <div className="relative">
                                                <input
                                                    className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:border-sargood-blue focus:ring-sargood-blue shadow-sm" aria-describedby="email-error"
                                                    type="password"
                                                    id="confirm_password"
                                                    name="confirm_password"
                                                    value={formik.values.confirm_password}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur}
                                                />
                                                {formik.errors.confirm_password && (
                                                    <div className="text-red-600">{formik.errors.confirm_password}</div>
                                                )}
                                            </div>
                                        </div>
                                        <button type="submit" className="py-3 px-4 inline-flex justify-center items-center gap-2 rounded-md border border-transparent font-semibold bg-yellow-400 hover:bg-sky-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-sargood-blue focus:ring-offset-2 transition-all text-sm dark:focus:ring-offset-gray-800">Set new password</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </main >}
                {status == 'invalid-token' &&
                    <div id="content" role="main" className="w-full max-w-md">                        <div className="flex justify-center">
                        <div className="relative m-4 h-40 w-40">
                            <Image alt="" src={logo.src} layout="fill" objectFit="contain" />
                        </div>
                    </div>
                        <p className="p-5">Sorry, this link has expired. Please <Link className="cursor-pointer text-sky-500 hover:text-sky-700" href="/auth/login">click here </Link>
                            to login or request a new link to reset the password.</p>
                    </div>}
            </div>
        </FormLayout>
    );
}

export default SignupPage;

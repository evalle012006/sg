import { useFormik } from "formik";
import { useRouter } from "next/router"
import { useState } from "react";
import * as yup from 'yup';
const jwt = require('jsonwebtoken');
import Image from "next/image"
import Link from "next/link";
import logo from "/public/sargood-logo.svg";

import dynamic from 'next/dynamic';
const FormLayout = dynamic(() => import('./../../../components/formLayout'));

function ForgotPassword() {
    const router = useRouter();
    const { token, email, usertype } = router.query;

    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");
    const [submitted, setSubmitted] = useState(false);

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
                    usertype: usertype
                }),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
            }).then(response => response.json()).then(response => {
                setMessage(response.message)
                setStatus(response.status)
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
            <main id="content" role="main" className="w-full max-w-md mx-auto">
                <div className="flex justify-center">
                    <div className="relative m-4 h-40 w-40">
                        <Image alt="" src={logo.src} layout="fill" objectFit="contain" />
                    </div>
                </div>
                <div className="mt-7 bg-white">
                    <div className="p-4 sm:p-7">
                        <div className="">
                            <h1 className="block text-2xl font-bold text-gray-800">Set a new password</h1>
                            <p>for {email}</p>
                        </div>
                        <div hidden={!submitted} className={`my-5 p-2 border-l-4 ${status == 'success' ? "border-green-500" : "border-red-500"}`} role="alert">
                            {message}
                            {status == 'success' && <Link href={usertype == 'guest' ? '/auth/login' : '/auth/admin-login'}>
                                <span className='cursor-pointer ml-2 text-sargood-blue decoration-2 hover:underline font-medium'>
                                    Login here
                                </span>
                            </Link>}
                        </div>
                        <div className="mt-5">
                            <form onSubmit={formik.handleSubmit}>
                                <div className="grid gap-y-4">
                                    <div>
                                        <label htmlFor="password" className="block text-sm font-bold ml-1 mb-2">New password</label>
                                        <div className="relative">
                                            <input
                                                className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm" aria-describedby="email-error"
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
                                                className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm" aria-describedby="email-error"
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
                                    <button type="submit" className="py-3 px-4 inline-flex justify-center items-center gap-2 rounded-md border border-transparent font-semibold bg-yellow-400 hover:bg-sky-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all text-sm dark:focus:ring-offset-gray-800">Reset password</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main >
        </FormLayout>
    )
}

export default ForgotPassword
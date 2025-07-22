import { useFormik } from 'formik';
import { useState } from 'react';
import * as yup from 'yup';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import logo from "/public/sargood-logo.svg";

import dynamic from 'next/dynamic';
const FormLayout = dynamic(() => import('./../../../components/formLayout'));

function ForgotPassword() {

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const { userType } = router.query;

  const formik = useFormik({
    initialValues: { email: '' },
    onSubmit: (values) => {
      setSubmitted(true)
      fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: values.email,
          usertype: userType
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
      email: yup
        .string()
        .email('Must be a valid email')
        .required('Email is required'),
    }),
  });

  return (
    <FormLayout>
      <main id="content" role="main" className="w-full max-w-md mx-auto">
        <div className='flex justify-center'>
          <div className='m-4 h-40 w-40 relative'>
            <Image alt='' src={logo.src} layout='fill' objectFit="contain" />
          </div>
        </div>
        <div className="mt-7 bg-white">
          <div className="p-4 sm:p-7">
            <div className="">
              <h1 className="block text-2xl font-bold text-gray-800">Forgot password?</h1>
              <p className="mt-2 text-sm text-gray-600">
                Remember your password?
                <Link href={userType == 'guest' ? '/auth/login' : '/auth/admin-login'}>
                  <span className='cursor-pointer ml-2 text-sargood-blue decoration-2 hover:underline font-medium'>
                    Login here
                  </span>
                </Link>
              </p>
            </div>
            <div hidden={!submitted} className={`my-5 p-2 border-l-4 ${status == 'success' ? "border-green-500" : "border-red-500"}`} role="alert">
              {message}
            </div>
            <div className="mt-5">
              <form onSubmit={formik.handleSubmit}>
                <div className="grid gap-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-bold ml-1 mb-2">Email address</label>
                    <div className="relative">
                      <input
                        className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:border-sargood-blue focus:ring-sargood-blue shadow-sm" aria-describedby="email-error"
                        type="email"
                        id="email"
                        name="email"
                        value={formik.values.email}
                        onChange={formik.handleChange}
                        placeholder={'Please Input Email'}
                        onBlur={formik.handleBlur} />
                      {formik.errors.email && (
                        <div className="text-red-600">{formik.errors.email}</div>
                      )}
                    </div>
                    <p className="hidden text-xs text-red-600 mt-2" id="email-error">Please include a valid email address so we can get back to you</p>
                  </div>
                  <button type="submit" className="py-3 px-4 inline-flex justify-center items-center gap-2 rounded-md border border-transparent font-semibold bg-yellow-400 hover:bg-sky-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-sargood-blue focus:ring-offset-2 transition-all text-sm">Send link</button>
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
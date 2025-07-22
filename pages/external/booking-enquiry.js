import React, { useRef, useState } from 'react'
import Image from "next/image";
import { useFormik } from 'formik';
import * as yup from 'yup';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import logo from "/public/sargood-logo.svg";
import Modal from '../../components/ui/genericModal';
import { useRouter } from 'next/router';

const FormLayout = dynamic(() => import('../../components/formLayout'));
const DateInputField = dynamic(() => import('../../components/ui/date'));

export default function BookingEnquiry() {
    const router = useRouter();
    const [errors, setErrors] = React.useState(false);
    const [enquirySubmitted, setEnquirySubmitted] = React.useState(false);
    const [arrivalDate, setArrivalDate] = useState();
    const [departureDate, setDepartureDate] = useState();
    const [duplicateEmail, setDuplicateEmail] = useState();
    const [showModal, setShowModal] = useState(false);

    const formik = useFormik({
        initialValues: {
            first_name: "",
            last_name: "",
            email: "",
            type_of_spinal_injury: "",
            phone_number: "",
            alternate_contact_name: "",
            alternate_contact_number: "",
            preferred_arrival_date: undefined,
            preferred_departure_date: undefined,
        },
        onSubmit: async (values) => {
            setErrors(false);
            const addDatesValues = {...values, preferred_arrival_date: arrivalDate, preferred_departure_date: departureDate};
            const updatedValues = structuredClone(addDatesValues);

            if (updatedValues.preferred_arrival_date == "") {
                delete updatedValues.preferred_arrival_date;
            }

            if (updatedValues.preferred_departure_date == "") {
                delete updatedValues.preferred_departure_date;
            }

            const response = await fetch("/api/bookings/enquiry/create", {
                method: "POST",
                body: JSON.stringify(updatedValues)
            })
            if (response.ok) {
                setErrors(false);
                setEnquirySubmitted(true);
            } else {
                const data = await response.json();
                if (data.type == 'unique violation') {
                    setDuplicateEmail(values.email);
                    setErrors(true)
                }
            }
        },
        validationSchema: yup.object({
            first_name: yup
                .string()
                .min(2, "Too Short!")
                .max(50, "Too Long!")
                .required("First name is required"),

            last_name: yup
                .string()
                .min(2, "Too Short!")
                .max(50, "Too Long!")
                .required("Last name is required"),

            phone_number: yup
                .string()
                .required("Phone number is required")
                .matches(
                    /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/,
                    "Invalid phone number"
                ),

            email: yup
                .string()
                .email("Must be a valid email")
                .required("Email is required"),

            type_of_spinal_injury: yup
                .string()
                .required("Type of spinal cord injury is required"),
            alternate_contact_name: yup
                .string()
                .required("Alternate contact name is required"),
            alternate_contact_number: yup
                .string()
                .required("Alternate contact number is required")
                .matches(
                    /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/,
                    "Invalid phone number"
                ),
            preferred_arrival_date: yup
                .date(),
            preferred_departure_date: yup
                .date()
                .min(
                    yup.ref('preferred_arrival_date'),
                    "Departure date can't be before the arrival date."
                )
        }),
    });

    const updateDateChange = (value, field) => {
        if (field === 'preferred_arrival_date') {
            setArrivalDate(value);
        } else if (field === 'preferred_departure_date') {
            setDepartureDate(value);
        }
    }

    return (
        <FormLayout>
            <div className="flex justify-center items-center w-full overflow-x-auto min-h-[35rem] landscape:min-h-[20rem] lg:h-[95vh]">
                <div className="m-4">
                    {showModal ? (
                        <Modal title="" confirmLabel={'I Acknowledge'} onConfirm={() => setShowModal(false)} external={true} externalUrl='https://www.sargoodoncollaroy.com'>
                            <div className="flex justify-center">
                                <div className="relative w-40 h-40">
                                    <Image alt="logo" layout="fill" objectFit="contain" src={logo.src} />
                                </div>
                            </div>
                            <p className='mb-2'>
                                For new users, please note that Sargood on Collaroy is a spinal specialist service.  
                            </p>
                            <div className='mb-4'>
                                <p>All guests must acknowledge the below to be eligible for a stay:</p>
                                <ul className='list-disc ml-8'>
                                    <li>I have permanent damage to my spinal cord that is not progressive or palliative.</li>
                                    <li>My needs meet the primary purpose of Sargood on Collaroy that is to support and promote access and inclusion for people with spinal cord injury.</li>
                                    <li>Sargood on Collaroy is not equipped to support ventilator dependent tetraplegics. If you use Oxygen Concentrator, please contact us to discuss whether your support requirements are able to be met.</li>
                                    <li>Sargood on Collaroy cannot support you if you have significant behaviours of concerns or addictions that may affect the quiet enjoyment of other guests.</li>
                                    <li>The staff at Sargood on Collaroy are trained to support people with Traumatic Spinal Cord Injuries. If my care requirements are complex and likely to exceed the staff’s skill set, I understand that I might be required to bring my own trained support.</li>
                                    <li>Sargood on Collaroy is not a medical facility and the staff cannot manage any medical conditions I may have. I understand that an ambulance will be called for me if I require medical attention and that I will be responsible for any costs incurred in transporting me and/or my equipment to and from hospital.</li>
                                </ul>
                            </div>
                            <p className='mb-4'>
                                If you meet this eligibility criteria, please complete the form below to request a stay, and a Sargood on Collaroy staff member will contact you soon.
                            </p>
                            <p className='mb-2'>
                                If you have an existing Sargood Guest Portal account, <Link href="/auth/login"><span className='font-bold underline cursor-pointer'>please login here</span></Link> .
                            </p>
                        </Modal>
                    ) : (
                        <div className='h-screen'>
                            <div className="flex justify-center">
                                <div className="relative w-40 h-40">
                                    <Image alt="logo" layout="fill" objectFit="contain" src={logo.src} />
                                </div>
                            </div>
                            <div className="my-auto">
                                {enquirySubmitted ? (
                                    <React.Fragment>
                                        <h1 className="mt-4 text-2xl font-bold text-sargood-blue">
                                            Thank you for submitting your enquiry.
                                        </h1>
                                    </React.Fragment>
                                ) : (
                                    <React.Fragment>
                                        <h1 className="mt-4 text-2xl font-bold text-sargood-blue">
                                            Welcome to Sargood on Collaroy!
                                        </h1>
                                        <p className='mb-4'>
                                            If you have an existing Sargood Guest Portal account, please <Link href="/auth/login"><span className='font-bold underline cursor-pointer'>LOGIN HERE</span></Link> to make a booking. 
                                            If you do not have an account, please complete the form below, and you will hear from our team.
                                        </p>
                                    </React.Fragment>
                                )}
                            </div>
                            {errors && (<div className="flex flex-col items-center justify-center w-full p-2 my-10 bg-red-100 border border-red-400 rounded">
                                <div className="">An account with <strong>{duplicateEmail}</strong> already exists. Please use a different email address or <Link href="/auth/login"><span className='cursor-pointer text-sargood-blue font-bold'>click here</span></Link> to login.</div>
                            </div>)}
                            {enquirySubmitted ?
                                (
                                    <div className='flex flex-col justify-center'>
                                        <div className="flex flex-col items-center justify-center w-full p-2 my-10 bg-green-100 border border-green-400 rounded text-center">
                                            You will receive an e-mail from no-reply@sargoodoncollaroy.com.au to verify your account and finalise your account set up. If you do not receive this e-mail within 24 hours, please contact our friendly team on (02) 8597 0600
                                        </div>
                                        <div className='flex flex-row items-center justify-center'>
                                            <a href='https://sargoodoncollaroy.com'><span className='font-bold underline cursor-pointer'>Back to Website</span></a>
                                        </div>
                                    </div>
                                
                                ) :
                                (
                                    <form className="flex flex-col space-y-4" onSubmit={formik.handleSubmit}>
                                        <div className='grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4'>
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    First Name (Primary Guest)
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="first-name"
                                                    name="first_name"
                                                    type="text"
                                                    placeholder="First Name"
                                                    value={formik.values.first_name}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.first_name && formik.errors.first_name) && (
                                                    <div className="text-base text-red-600">{formik.errors.first_name}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Last Name (Primary Guest)
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="last-name"
                                                    name="last_name"
                                                    type="text"
                                                    placeholder="Last Name"
                                                    value={formik.values.last_name}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.last_name && formik.errors.last_name) && (
                                                    <div className="text-base text-red-600">{formik.errors.last_name}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Email
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    placeholder="Email address"
                                                    value={formik.values.email}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.email && formik.errors.email) && (
                                                    <div className='text-base text-red-600'>{formik.errors.email}</div>
                                                )}
                                            </div>
                                            <div className='flex flex-col space-y-2'>
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Phone Number
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="phone-number"
                                                    name="phone_number"
                                                    type="text"
                                                    placeholder="Phone Number"
                                                    value={formik.values.phone_number}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.phone_number && formik.errors.phone_number) && (
                                                    <div className="text-base text-red-600">{formik.errors.phone_number}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 mb-4">
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Level / Type of SCI (Spinal Cord Injury)
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="type-of-spinal-injury"
                                                    name="type_of_spinal_injury"
                                                    type="text"
                                                    placeholder="Level / Type of SCI"
                                                    value={formik.values.type_of_spinal_injury}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.type_of_spinal_injury && formik.errors.type_of_spinal_injury) && (
                                                    <div className='text-base text-red-600'>{formik.errors.type_of_spinal_injury}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">

                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Emergency Contact Name
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="alternate-contact-name"
                                                    name="alternate_contact_name"
                                                    type="text"
                                                    placeholder="Alternate Contact Name"
                                                    value={formik.values.alternate_contact_name}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.alternate_contact_name && formik.errors.alternate_contact_name) && (
                                                    <div className='text-base text-red-600'>{formik.errors.alternate_contact_name}</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide required">
                                                    Emergency Contact Number
                                                </label>
                                                <input
                                                    className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-sargood-blue"
                                                    id="alternate-contact-number"
                                                    name="alternate_contact_number"
                                                    type="text"
                                                    placeholder="Alternate Contact Number"
                                                    value={formik.values.alternate_contact_number}
                                                    onChange={formik.handleChange}
                                                    onBlur={formik.handleBlur} />
                                                {(formik.touched.alternate_contact_number && formik.errors.alternate_contact_number) && (
                                                    <div className='text-base text-red-600'>{formik.errors.alternate_contact_number}</div>
                                                )}
                                            </div>
                                        </div>
                                        {/* <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                                            <div className="flex flex-col justify-between space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide">
                                                    Preferred Arrival Date (optional)
                                                </label>
                                                <DateInputField value={formik.values.preferred_arrival_date} top={'top-0'} bottom={'-top-[19rem]'} left={'-left-3'} width='100%' label={''} placeholder={'Preferred Arrival Date'} onChange={(e) => updateDateChange(e, 'preferred_arrival_date')} />
                                            </div>
                                            <div className="flex flex-col justify-between space-y-2">
                                                <label className="text-sm font-bold text-gray-700 tracking-wide">
                                                    Preferred Departure Date (optional)
                                                </label>
                                                <DateInputField value={formik.values.preferred_departure_date} top={'top-0'} bottom={'-top-[19rem]'} left={'-left-14'} width='100%' label={''} placeholder={'Preferred Departure Date'} onChange={(e) => updateDateChange(e, 'preferred_departure_date')} />
                                            </div>
                                        </div> */}
                                        <div className="flex items-center justify-between">
                                            <button className="px-4 py-2 my-2 bg-yellow-400 hover:bg-sky-900 hover:text-white rounded focus:outline-none focus:shadow-outline"
                                                type="submit">
                                                Request an Account
                                            </button>
                                        </div>
                                    </form>
                                )}
                        </div>
                    )}
                </div>
            </div >
        </FormLayout >
    )
}
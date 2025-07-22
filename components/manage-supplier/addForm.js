import React from 'react'
import { useFormik } from "formik";
import { useState } from "react";
import * as yup from "yup";

import dynamic from 'next/dynamic';
const Alert = dynamic(() => import('../ui/alert'));
const Button = dynamic(() => import('../ui/button'));
const Input = dynamic(() => import('../ui/input'));
const Spinner = dynamic(() => import('../ui/spinner'));

function SupplierAddForm(props) {

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState("");

    const formik = useFormik({
        initialValues: {
          name: "",
          phone_number: "",
        },
        onSubmit: (values) => {
          setFormError("");
          props.saveData(values);
        },
        validationSchema: yup.object({
          name: yup
            .string()
            .min(2, "Too Short!")
            .max(50, "Too Long!")
            .required("Name is required"),
          phone_number: yup
            .string()
            .required("Phone number is required")
            .matches(
              /^(\+?\d{0,4})?\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{4}\)?)?$/,
              "Invalid phone number"
            )
        }),
      });

  return (
    <div className="fixed inset-0 bg-black/30 z-50" onClick={props.closeModal}>
      <div className="flex items-center justify-center h-screen">
        <div className='bg-white rounded-xl shadow-lg w-2/5 p-4' onClick={(e) => e.stopPropagation()}>
            <form onSubmit={formik.handleSubmit}>
            <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
            Supplier
          </h1>

          {isLoading ? (
            <Spinner />
          ) : (
            (isSuccess ||
            formError) && (
              <Alert color={`${formError ? "bg-red-500" : "bg-green-500"}`}>
                {formError ? formError : isSuccess && "Supplier successfully created!"}
              </Alert>
            )
          )}

            <Input
              name="name"
              labelClass={'text-grey-700'}
              label={"Name"}
              type={"text"}
              value={formik.values.name}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.name}
            />
            <Input
              name="phone_number"
              label={"Phone Number"}
              type={"text"}
              value={formik.values.phone_number}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.phone_number}
            />
            <Button
              buttonClass={"my-2 bg-yellow-400 hover:bg-sky-900 hover:text-white"}
              label={"Save Supplier"}
              submit
            />
            </form>
        </div>
      </div>
    </div>
  )
}

export default SupplierAddForm;
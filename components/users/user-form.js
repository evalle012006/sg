import React from 'react'
import { useFormik } from "formik";
import { useState } from "react";
import * as yup from "yup";
import { create } from "./../../utilities/api/users";

import dynamic from 'next/dynamic';
const Alert = dynamic(() => import('../ui/alert'));
const Button = dynamic(() => import('../ui/button'));
const Input = dynamic(() => import('../ui/input'));
const Spinner = dynamic(() => import('../ui/spinner'));

function UserForm(props) {

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState("");

    const formik = useFormik({
        initialValues: {
          email: "",
          first_name: "",
          last_name: "",
          phone_number: "",
          password: "",
        },
        onSubmit: (values) => {
          setFormError("");
          
          async function createForm(form) {
            try {
              setIsLoading(true);
              const result = await create(form);
              if (result) {
                setIsLoading(false);
                setIsSuccess(true);
              }
            } catch (e) {
              setIsLoading(false);
              setFormError(e.message);
              console.log(e);
            }
          }
          createForm(values);
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
            .matches(
              /^(\+?\d{0,4})?\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{3}\)?)\s?-?\s?(\(?\d{4}\)?)?$/,
              "Invalid phone number"
            ),
    
          email: yup
            .string()
            .email("Must be a valid email")
            .required("Email is required"),

            password: yup
            .string()
            .required("Password is required")
            .min(6, "Password is too short - should be 6 chars minimum"),
        }),
      });

  return (
    <div className='shadow-lg rouned-lg w-2/5 p-4'>
        <form onSubmit={formik.handleSubmit}>
        <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
        Team Member
      </h1>

      {isLoading ? (
        <Spinner />
      ) : (
        (isSuccess ||
        formError) && (
          <Alert color={`${formError ? "bg-red-500" : "bg-green-500"}`}>
            {formError ? formError : isSuccess && "User successfully created!"}
          </Alert>
        )
      )}

        <Input
          name="first_name"
          labelClass={'text-grey-700'}
          label={"First Name"}
          type={"text"}
          value={formik.values.first_name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.first_name}
        />
        <Input
          name="last_name"
          label={"Last Name"}
          type={"text"}
          value={formik.values.last_name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.last_name}
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
        <Input
          name="email"
          label={"Email"}
          type={"email"}
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.email}
        />
        <Input
          name="password"
          label={"Password"}
          type={"password"}
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.password}
        />
        <Button
          buttonClass={"my-2 bg-yellow-400 hover:bg-sky-900 hover:text-white"}
          label={"Save User"}
          submit
        />
        </form>
    </div>
  )
}

export default UserForm
import React from 'react'

import dynamic from 'next/dynamic';
const FormLayout = dynamic(() => import('../../components/formLayout'));
const SigninForm = dynamic(() => import('../../components/auth/signin-form'));

function SignupPage() {
  return (
    <FormLayout>
      <div className='flex items-start w-full'>
        <SigninForm type={'user'} />
      </div>
    </FormLayout>
  )
}

export default SignupPage
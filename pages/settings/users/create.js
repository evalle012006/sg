import React from 'react'
import UserForm from '../../../components/users/user-form';
import Layout from '../../../components/layout'

function UserCreatePage() {
  return (
    <Layout>
      <div className='flex p-20'>
        <UserForm />
      </div>
    </Layout>
  )
}

export default UserCreatePage
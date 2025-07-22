import React, { useEffect, useState } from 'react';
import UsersList from '../../../components/users/list';
import { getUsers } from '../../../utilities/api/users';
import Spinner from '../../../components/ui/spinner';
import Modal from '../../../components/ui/genericModal';
import { toast } from "react-toastify";
import { Plus } from 'lucide-react';
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../../components/layout'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [disableModalButton, setDisableModalButton] = useState(false);
  const [newUser, setNewUser] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
    phone_number: "",
    role: "",
  });
  const [roles, setRoles] = useState([]);

  const passwordMatch = newUser.password === newUser.confirm_password;

  const formError = {
    first_name: newUser.first_name.length === 0,
    last_name: newUser.last_name.length === 0,
    email: newUser.email.length === 0,
    password: newUser.password.length === 0,
    role: newUser.role.length === 0,
  }

  useEffect(() => {
    async function loadUsers() {
      setIsLoading(true);
      fetchUsers();
    }
    loadUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const result = await getUsers();
      if (result) {
        setUsers(result.users);
        // setIsLoading(false);
      }

      getRoles();
    } catch (e) {
      setError(e.message);
      setIsLoading(false);
    }
  }

  const getRoles = async () => {
    const response = await fetch("/api/acl/roles-and-permissions");
    const data = await response.json();
    if (response.ok) {
      setRoles(data.roles);
      setIsLoading(false);
    }
  }

  const handleInputChange = (e) => {
    setNewUser({
      ...newUser,
      [e.target.name]: e.target.value
    });
  };

  const createUser = async () => {
    // validate the form
    if (!newUser.first_name || !newUser.last_name || !newUser.email || !newUser.password || !newUser.confirm_password || !newUser.role) {
      return toast.error("Please fill all the required fields");
    }
    setDisableModalButton(true);
    const response = await fetch("/api/users/create", {
      method: "POST",
      body: JSON.stringify(newUser),
      headers: {
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (response.status !== 200) {
      setDisableModalButton(false);
      toast.error(data.message);
    } else {
      setNewUser({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        confirm_password: "",
        phone_number: "",
        role: "",
      });
      toast.success("User created successfully");
      fetchUsers();
      setShowModal(false);
      setDisableModalButton(false);
    }
  }

  if (isLoading) {
    return (
      <div className='h-screen flex items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <Layout title={"User List"}>
      <div className="p-4">
        {/* New User Button */}
        <div className="flex justify-end mb-6">
          <Button
            color="secondary"
            size="medium"
            label="New User"
            onClick={() => setShowModal(true)}
            withIcon={true}
            iconName="custom"
            iconSvg={<Plus />}
          />
        </div>

        <UsersList data={users} fetchUsers={fetchUsers} />

        {showModal && (
          <Modal title="Add New User" confirmLabel={'Add User'} onConfirm={() => createUser()} onClose={() => setShowModal(false)} disabled={disableModalButton}>
            <div className="mr-2">
              <label htmlFor="first_name" className="block mb-1">First Name<span className='text-red-700'>*</span></label>
              <input type="text" id="first_name" name="first_name" value={newUser.first_name} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
              {formError.first_name && <p className='text-red-400'>First name is required</p>}
            </div>
            <div>
              <label htmlFor="last_name" className="block mb-1">Last Name<span className='text-red-700'>*</span></label>
              <input type="text" id="last_name" name="last_name" value={newUser.last_name} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
              {formError.last_name && <p className='text-red-400'>Last name is required</p>}

            </div>
            <div className="mb-4">
              <label htmlFor="email" className="block mb-1">Email<span className='text-red-700'>*</span></label>
              <input type="email" id="email" name="email" value={newUser.email} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
              {formError.email && <p className='text-red-400'>email is required</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block mb-1">Password<span className='text-red-700'>*</span></label>
              <input type="password" id="password" name="password" value={newUser.password} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
              {formError.password && <p className='text-red-400'>Password is required</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="confirm_password" className="block mb-1">Confirm Password<span className='text-red-700'>*</span></label>
              <input type="password" id="confirm_password" name="confirm_password" value={newUser.confirm_password} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
              {!passwordMatch && <p className='text-red-400'>Password do not match</p>}
            </div>
            <div className="mb-4">
              <label htmlFor="phone" className="block mb-1">Phone</label>
              <input type="text" id="phone" name="phone" value={newUser.phone} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required />
            </div>
            <div className="mb-4">
              <label htmlFor="role" className="block mb-1">Role<span className='text-red-700'>*</span></label>
              <select id="role" name="role" value={newUser.role} onChange={handleInputChange} className="border border-gray-300 rounded-md px-3 py-2 w-full" required>
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              {formError.role && <p className='text-red-400'>Select a role for the new user</p>}
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}
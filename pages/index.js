import Layout from "./../components/layout"
import Image from "next/image"
import Avatar from "../components/avatar"
import { useEffect } from "react"
import { useRouter } from "next/router"
import logo from "/public/sargood-logo.svg";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/dashboard')
  });
  return (
    <Layout title="Home">
      <div className="p-8 col-span-9">
        <p className="text-xs">Coming soon...</p>

        <div className="w-36 h-36 mt-80 relative mx-auto">
          <Image alt="" src={logo.src} layout='fill' objectFit='contain' />
        </div>
      </div>
    </Layout>
  )
}

// USAGE EXAMPLES: 

// <GetField type='text' value='Salman' label='Name' error="Invalid input. Please enter your full name." onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='select' value={{ value: 'Salman', label: 'Salman Saleem' }} options={options} label='Select Field' error="Invalid input. Please enter your full name." onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='multi-select' value={[{ value: 'Alex', label: 'Alex Burton' }, { value: 'Rolando', label: 'Rolando Evalle' }]} options={options} label='Multi-select Field' error="Please select one or more options." onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='file-upload' value={[{ value: 'Alex', label: 'Alex Burton' }, { value: 'Rolando', label: 'Rolando Evalle' }]} options={options} label='File Upload' error="Please upload a valid file." onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='number' value={100} label='Number Field' error="Please enter a valid number." onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='date' value={new Date()} label='Date Field' error="Please enter a valid date" onChange={(e) => {
//   // TODO - handle field value change
// }} />
// <GetField type='date-range' value={new Date()} label='Date Range Field' error="Please enter a valid date" onChange={(e) => {
//   // TODO - handle field value change
// }} />
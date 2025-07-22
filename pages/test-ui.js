import React, { useState } from "react";
import Button from "../components/ui-v2/Button";
import StatusBadge from "../components/ui-v2/StatusBadge";
import RadioButton from "../components/ui-v2/RadioButton";
import Checkbox from "../components/ui-v2/CheckboxButton";
import TabButton from "../components/ui-v2/TabButton";
import Select from "../components/ui-v2/Select";
import TextField from "../components/ui-v2/TextField";
import DateComponent from "../components/ui-v2/DateField";
import ProgressBar from "../components/ui-v2/ProgressBar";
import NumberedListComponent, { StepState } from "../components/ui-v2/NumberedListComponent";
import { ChevronDown } from 'lucide-react';
import HorizontalCardSelection from "../components/ui-v2/HorizontalCardSelection";
import ThumbnailCard from "../components/ui-v2/ThumbnailCard";
import Card from "../components/ui-v2/Card";
import { Eye, Edit, Trash2, User } from 'lucide-react';
import Table from "../components/ui-v2/Table";

const UIV2Demo = () => {
  const [formValues, setFormValues] = useState({
    name: '',
    email: '',
    phone: '',
    amount: ''
  });

  const handleChange = (field) => (value) => {
    setFormValues(prev => ({
      ...prev,
      [field]: value
    }));
  };

    const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [count, setCount] = useState(0);

    const customSvg = (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    );
    
    // Simulated screen size adjustment for demo purposes
    const updateViewportWidth = (width) => {
      setViewportWidth(width);
    };

    const [selectedRadio, setSelectedRadio] = React.useState('option1');
  
    const handleRadioChange = (value) => {
      setSelectedRadio(value);
    };

    const [checkedItems, setCheckedItems] = React.useState({
      option1: false,
      option2: true,
    });
    
    const handleCheckboxChange = (isChecked, value) => {
      setCheckedItems({
        ...checkedItems,
        [value]: isChecked
      });
    };

    const [selectedItem, setSelectedItem] = useState(null);

    const PyramidIcon = () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 2L18 15H2L10 2Z" fill="currentColor" />
      </svg>
    );
  
    const SailboatIcon = () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12L10 5V15H4V12Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 15H16L13 8L10 15Z" stroke="currentColor" strokeWidth="1.5" />
        <line x1="4" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  
    const KeyIcon = () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10H16M14 8V12M16 12V8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  
    // Tab data for the filled tabs with icons (top rows in screenshot)
    const filledTabs = [
      { label: 'LABEL', icon: <PyramidIcon />, withIcon: true },
      { label: 'LABEL', icon: <SailboatIcon />, withIcon: true },
      { label: 'LABEL', icon: <KeyIcon />, withIcon: true }
    ];
  
    // Tab data for the outline tabs (bottom rows in screenshot)
    const outlineTabs = [
      { label: 'ACTIVE' },
      { label: 'NAV LINK' },
      { label: 'NAV LINK' }
    ];

    const [singleValue, setSingleValue] = useState(null);
    const [multiValue, setMultiValue] = useState([]);
    
    const demoOptions = [
      { value: "complete", label: "Complete" },
      { value: "some_sensation", label: "Some Sensation" },
      { value: "less_than_50", label: "Less than 50%" },
      { value: "more_than_50", label: "More than 50%" },
      { value: "all_muscle", label: "All Muscle" },
    ];

    const [singleDate, setSingleDate] = useState('2025-05-08');
    const [dateRange, setDateRange] = useState(['2025-05-01', '2025-05-15']);
    
    // Format for displaying demo info
    const formatDate = (dateStr) => {
      if (!dateStr) return 'None';
      return dateStr;
    };

    const exampleSteps = [
      {
        id: 'guest_details',
        label: 'Guest Details & SCI Information',
        initialState: StepState.COMPLETED,
        status: 'Complete',
        statusType: 'success'
      },
      {
        id: 'funding',
        label: 'Funding',
        initialState: StepState.SELECTED,
        status: 'Pending',
        statusType: 'warning'
      },
      {
        id: 'dates',
        label: 'Dates',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'room_options',
        label: 'Room Options',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'equipment',
        label: 'Equipment',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'courses',
        label: 'Courses',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'care',
        label: 'Care',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'packages',
        label: 'Packages',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'services',
        label: 'Services',
        initialState: StepState.NOT_SELECTED
      },
      {
        id: 'other_medical',
        label: 'Other Medical Information',
        initialState: StepState.NOT_SELECTED
      }
    ];

    const exampleItems = [
      { 
        title: "Step One", 
        description: "Lorem ipsum dummy text for this section", 
        status: "complete" 
      },
      { 
        title: "Step Two", 
        description: "Lorem ipsum dummy text for this section", 
        status: "error",
        customContent: (
          <div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
              <div className="relative">
                <select className="appearance-none w-full p-2 pr-8 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option>Select</option>
                  <option>Option 1</option>
                  <option>Option 2</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <ChevronDown size={16} className="text-gray-400" />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-4">
              <button className="px-4 py-2 border border-gray-300 rounded bg-white text-gray-700 hover:bg-gray-50">Previous</button>
              <button className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900">Next</button>
            </div>
          </div>
        ) 
      },
      { 
        title: "Step Three", 
        description: "Provide your other Medical Information", 
        status: null
      },
      { 
        title: "Step Four", 
        description: "Lorem ipsum dummy text for this section", 
        status: null 
      }
    ];

    const [selectedCard, setSelectedCard] = useState(null);
    const [selectedMultiCards, setSelectedMultiCards] = useState([]);
    const [selectedHorizontalCard, setSelectedHorizontalCard] = useState('card1');

    const cards = [
      {
        value: 'card1',
        label: 'Option 1',
        description: 'This is the first option description'
      },
      {
        value: 'card2',
        label: 'Option 2',
        description: 'This is the second option description'
      },
      {
        value: 'card3',
        label: 'Option 3',
        description: 'This is the third option description'
      }
    ];
  
    const horizontalCards = [
      {
        value: 'card1',
        label: 'Label',
        description: 'Lorem ipsum dummy text for this section'
      },
      {
        value: 'card2',
        label: 'Label',
        description: 'Lorem ipsum dummy text for this section'
      }
    ];

    const handleEditBooking = (id) => console.log(`Edit booking ${id}`);
    const handleBookNow = () => console.log('Book now clicked');
    const handleViewDetails = () => console.log('View details clicked');


    const cardItems = [
      {
        title: "Adaptive Surfing",
        image: "/api/placeholder/400/320",
        isSpecialOffer: true,
        status: "Special offer",
        minStayDates: "05 Apr, 2025 - 07 Apr, 2025",
        showBookNow: true,
        onViewDetails: () => console.log("View Adaptive Surfing details"),
        onBookNow: () => console.log("Book Adaptive Surfing")
      },
      {
        title: "Adaptive Mountain Biking",
        image: "/api/placeholder/400/320",
        isSpecialOffer: true,
        status: "Special offer",
        minStayDates: "02 May, 2025 - 04 May, 2025",
        showBookNow: true,
        onViewDetails: () => console.log("View Mountain Biking details"),
        onBookNow: () => console.log("Book Mountain Biking")
      },
      {
        title: "Sunset Drinks",
        image: "/api/placeholder/400/320",
        onViewDetails: () => console.log("View Sunset Drinks details")
      },
      {
        title: "Home Automation Program",
        image: "/api/placeholder/400/320",
        onViewDetails: () => console.log("View Home Automation details")
      },
      {
        title: "Creative Arts Workshop",
        image: "/api/placeholder/400/320",
        isSpecialOffer: true,
        status: "Confirmed", // Will show a green "success" type badge
        minStayDates: "10 Jun, 2025 - 12 Jun, 2025",
        showBookNow: true,
        onViewDetails: () => console.log("View Creative Arts details"),
        onBookNow: () => console.log("Book Creative Arts")
      },
      {
        title: "Bushwalking Information Sessions",
        image: "/api/placeholder/400/320", 
        isSpecialOffer: true,
        status: "Pending", // Will show an orange "pending" type badge
        minStayDates: "20 May, 2025 - 22 May, 2025",
        customButtons: [
          <Button 
            key="request"
            color="primary"
            size="small"
            label="REQUEST INFO"
            onClick={() => console.log("Request info clicked")}
          />
        ],
        onViewDetails: () => console.log("View Bushwalking details")
      }
    ];

    const demoData = [
    {
      name: 'Jaxon Everhart',
      email: 'example@gmail.com',
      offeredCourses: '3 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Active'
    },
    {
      name: 'Maya Sinclair',
      email: 'example@gmail.com',
      offeredCourses: '3 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Active'
    },
    {
      name: 'Lila Hawthorne',
      email: 'example@gmail.com',
      offeredCourses: '6 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Active'
    },
    {
      name: 'Dante Caldwell',
      email: 'example@gmail.com',
      offeredCourses: '3 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Active'
    },
    {
      name: 'Sienna Prescott',
      email: 'example@gmail.com',
      offeredCourses: '0 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Inactive'
    },
    {
      name: 'Kieran Ashford',
      email: 'example@gmail.com',
      offeredCourses: '6 Courses',
      contactNumber: '1234567890',
      active: true,
      accountStatus: 'Active'
    }
  ];

  const demoColumns = [
    {
      key: 'name',
      label: 'NAME',
      searchable: true, // Enable search for name column
      render: (value) => (
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    {
      key: 'email',
      label: 'EMAIL',
      searchable: true, // Enable search for email column
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'offeredCourses',
      label: 'OFFERED COURSES',
      searchable: true, // Enable search for courses column
      render: (value) => (
        <span className="text-blue-600 font-medium">{value}</span>
      )
    },
    {
      key: 'contactNumber',
      label: 'CONTACT NUMBER',
      searchable: true, // Enable search for contact number column
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'active',
      label: 'ACTIVE',
      searchable: false, // Disable search for toggle column
      render: (value) => (
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={value}
            onChange={() => {}} // Handle toggle logic
            className="sr-only"
          />
          <div className={`relative inline-block w-10 h-6 rounded-full transition-colors ${
            value ? 'bg-teal-500' : 'bg-gray-300'
          }`}>
            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </label>
      )
    },
    {
      key: 'accountStatus',
      label: 'ACCOUNT STATUS',
      searchable: false, // Disable search for status badge column
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'Active' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'ACTION',
      searchable: false, // Disable search for action buttons column
      render: () => (
        <div className="flex items-center space-x-2">
          <button 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

    return (
      <React.Fragment>
        <div className="p-6 bg-gray-50 min-h-screen">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">TextField Component Demo</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <h2 className="font-semibold mb-4">Sizes</h2>
                <TextField 
                  label="Small" 
                  size="small" 
                  placeholder="Small input" 
                />
                
                <TextField 
                  label="Medium (Default)" 
                  size="medium" 
                  placeholder="Medium input" 
                />
                
                <TextField 
                  label="Large" 
                  size="large" 
                  placeholder="Large input" 
                />
              </div>
              
              <div>
                <h2 className="font-semibold mb-4">Validation Types</h2>
                <TextField 
                  label="Required Field" 
                  required={true}
                  placeholder="This field is required"
                  onBlur={() => {}} // Trigger validation on blur
                />
                
                <TextField 
                  label="Email" 
                  type="email" 
                  placeholder="Enter email address"
                  value={formValues.email}
                  onChange={handleChange('email')}
                />
                
                <TextField 
                  label="Phone Number" 
                  type="phone" 
                  placeholder="Enter phone number (e.g. 123-456-7890)"
                  value={formValues.phone}
                  onChange={handleChange('phone')}
                />
                
                <TextField 
                  label="Number" 
                  type="number" 
                  placeholder="Enter a number"
                  value={formValues.amount}
                  onChange={handleChange('amount')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextField 
                label="Fixed Width 270px" 
                width="270px" 
                placeholder="Width: 270px" 
              />
              
              <TextField 
                label="With Custom Error" 
                error="This is a custom error message" 
                placeholder="Has error state" 
              />
              
              <TextField 
                label="Disabled" 
                disabled={true} 
                placeholder="Disabled input" 
                value="Cannot edit this"
              />
            </div>
          </div>
        </div>

        
        <div className="p-6 space-y-12">
          <h1 className="text-3xl font-bold mb-8">Buttons</h1>
          
          {/* Large Size */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Large Size</h2>
            
            <div className="space-y-4">
              <div className="font-medium">Default</div>
              <div className="flex flex-wrap gap-4">
                <Button size="large" color="primary" label="BUTTON" />
                <Button size="large" color="secondary" label="BUTTON" />
                <Button size="large" color="outline" label="BUTTON" />
                <Button size="large" color="white" label="BUTTON" />
                <Button size="large" color="legacy-outline" label="BUTTON" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="font-medium">Hover</div>
              <div className="flex flex-wrap gap-4">
                {/* Simulating hover state with additional classes */}
                <Button size="large" color="primary" label="BUTTON" className="ring-2 ring-[#1B457B]" />
                <Button size="large" color="secondary" label="BUTTON" className="bg-[#FFCF01] text-[#1B457B]" />
                <Button size="large" color="outline" label="BUTTON" className="bg-[#1B457B] text-white border-transparent" />
                <Button size="large" color="white" label="BUTTON" className="bg-[#f5f5f5]" />
                <Button size="large" color="legacy-outline" label="BUTTON" className="bg-[#f5f5f5]" />
              </div>
            </div>
          </div>
          
          {/* Medium Size */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Medium Size</h2>
            
            <div className="space-y-4">
              <div className="font-medium">Default</div>
              <div className="flex flex-wrap gap-4">
                <Button size="medium" color="primary" label="BUTTON" />
                <Button size="medium" color="secondary" label="BUTTON" />
                <Button size="medium" color="outline" label="BUTTON" />
                <Button size="medium" color="white" label="BUTTON" />
                <Button size="medium" color="legacy-outline" label="BUTTON" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="font-medium">Hover</div>
              <div className="flex flex-wrap gap-4">
                <Button size="medium" color="primary" label="BUTTON" className="ring-2 ring-[#1B457B]" />
                <Button size="medium" color="secondary" label="BUTTON" className="bg-[#FFCF01] text-[#1B457B]" />
                <Button size="medium" color="outline" label="BUTTON" className="bg-[#1B457B] text-white border-transparent" />
                <Button size="medium" color="white" label="BUTTON" className="bg-[#f5f5f5]" />
                <Button size="medium" color="legacy-outline" label="BUTTON" className="bg-[#f5f5f5]" />
              </div>
            </div>
          </div>
          
          {/* Small Size */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Small Size</h2>
            
            <div className="space-y-4">
              <div className="font-medium">Default</div>
              <div className="flex flex-wrap gap-4">
                <Button size="small" color="primary" label="BUTTON" />
                <Button size="small" color="secondary" label="BUTTON" />
                <Button size="small" color="outline" label="BUTTON" />
                <Button size="small" color="white" label="BUTTON" />
                <Button size="small" color="legacy-outline" label="BUTTON" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="font-medium">Hover</div>
              <div className="flex flex-wrap gap-4">
                <Button size="small" color="primary" label="BUTTON" className="ring-2 ring-[#1B457B]" />
                <Button size="small" color="secondary" label="BUTTON" className="bg-[#FFCF01] text-[#1B457B]" />
                <Button size="small" color="outline" label="BUTTON" className="bg-[#1B457B] text-white border-transparent" />
                <Button size="small" color="white" label="BUTTON" className="bg-[#f5f5f5]" />
                <Button size="small" color="legacy-outline" label="BUTTON" className="bg-[#f5f5f5]" />
              </div>
            </div>
          </div>

          {/* Configuration Examples */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Configuration Examples</h2>
            
            <div className="space-y-4">
              <div className="font-medium">Secondary Button Options</div>
              <div className="flex flex-wrap gap-4">
                <Button size="medium" color="secondary" label="Default Secondary" />
                <Button size="medium" color="secondary" label="No Border" secondaryNoBorder={true} />
                <Button size="medium" color="secondary" label="No Hover Effect" secondaryNoHoverEffect={true} />
                <Button size="medium" color="secondary" label="No Border/Hover" secondaryNoBorder={true} secondaryNoHoverEffect={true} />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="font-medium">Outline Button Border Colors</div>
              <div className="flex flex-wrap gap-4">
                <Button size="medium" color="outline" label="Blue Border (Default)" />
                <Button size="medium" color="outline" label="Yellow Border" outlineBorderColor="#FFCF01" />
              </div>
            </div>
          </div>

          {/* Interactive example */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Interactive Example</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Button 
                label={`Clicked ${count} times`} 
                onClick={() => setCount(count + 1)} 
                color="primary"
              />
              <Button 
                label="Reset counter" 
                onClick={() => setCount(0)} 
                color="secondary"
              />
              <span className="text-sm sm:text-base text-gray-600">Click the buttons to modify the counter</span>
            </div>
          </div>
        </div>

        <div className="p-8 bg-gray-50 min-h-screen">
          <h1 className="text-2xl font-bold mb-8">Button Component with Icons</h1>
          
          <div className="space-y-8">
            {/* Standard Icons */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Standard Icons</h2>
              <div className="flex flex-wrap gap-4 items-center">
                <Button 
                  withIcon 
                  iconName="check" 
                  label="Selected" 
                  color="primary"
                />
                <Button 
                  withIcon 
                  iconName="wrong" 
                  label="Cancel" 
                  color="secondary"
                />
                <Button 
                  withIcon 
                  iconName="delete" 
                  label="Delete" 
                  color="warning"
                />
                <Button 
                  withIcon 
                  iconName="custom" 
                  iconSvg={customSvg} 
                  label="Custom Icon" 
                  color="white"
                />
              </div>
            </div>
            
            {/* Icons with different sizes */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Icon Size Variations</h2>
              <div className="flex flex-wrap gap-4 items-center">
                <Button 
                  size="small" 
                  withIcon 
                  iconName="check" 
                  label="Small" 
                />
                <Button 
                  size="medium" 
                  withIcon 
                  iconName="check" 
                  label="Medium" 
                />
                <Button 
                  size="large" 
                  withIcon 
                  iconName="check" 
                  label="Large" 
                />
              </div>
            </div>
            
            {/* Sample use case - selected state */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selected State Example</h2>
              <div className="flex flex-wrap gap-4">
                {['Item 1', 'Item 2', 'Item 3'].map((item) => (
                  <Button
                    key={item}
                    withIcon={selectedItem === item}
                    iconName="check"
                    color={selectedItem === item ? 'primary' : 'white'}
                    label={item}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-600">
                Selected: {selectedItem || 'None'}
              </p>
            </div>
            
            {/* Icons with disabled state */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Disabled Buttons with Icons</h2>
              <div className="flex flex-wrap gap-4">
                <Button 
                  withIcon 
                  iconName="check" 
                  label="Disabled" 
                  disabled 
                />
                <Button 
                  withIcon 
                  iconName="delete" 
                  label="Cannot Delete" 
                  color="warning" 
                  disabled 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          <h1 className="text-2xl font-bold mb-6">Status Badge Examples</h1>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3">With Icons (Default)</h2>
              <div className="flex flex-wrap gap-3">
                <StatusBadge type="success" label="Success" />
                <StatusBadge type="error" label="Error" />
                <StatusBadge type="pending" label="Pending" />
                <StatusBadge type="offer" label="Offer" />
                <StatusBadge type="primary" label="Primary" />
                <StatusBadge type="secondary" label="Secondary" />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3">Without Icons</h2>
              <div className="flex flex-wrap gap-3">
                <StatusBadge type="success" label="Success" showIcon={false} />
                <StatusBadge type="error" label="Error" showIcon={false} />
                <StatusBadge type="pending" label="Pending" showIcon={false} />
                <StatusBadge type="offer" label="Offer" showIcon={false} />
                <StatusBadge type="primary" label="Primary" showIcon={false} />
                <StatusBadge type="secondary" label="Secondary" showIcon={false} />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3">Different Sizes</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <StatusBadge type="success" label="Small" size="small" />
                <StatusBadge type="success" label="Medium" size="medium" />
                <StatusBadge type="success" label="Large" size="large" />
              </div>
            </div>
            
            <div>
              <h2 className="text-lg font-semibold mb-3">Full Width</h2>
              <div className="space-y-2 max-w-md">
                <StatusBadge type="success" label="Success Badge" fullWidth />
                <StatusBadge type="primary" label="Primary Badge" fullWidth />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">Radio Button Demo</h2>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Small Size</h3>
            <RadioButton
              label="Option 1"
              value="option1"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="small"
              name="demo-radio"
            />
            <RadioButton
              label="Option 2"
              value="option2"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="small"
              name="demo-radio"
            />
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Medium Size (Default)</h3>
            <RadioButton
              label="Option 1"
              value="option1"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="medium"
              name="demo-radio"
            />
            <RadioButton
              label="Option 2"
              value="option2"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="medium"
              name="demo-radio"
            />
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Large Size</h3>
            <RadioButton
              label="Option 1"
              value="option1"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="large"
              name="demo-radio"
            />
            <RadioButton
              label="Option 2"
              value="option2"
              selectedValue={selectedRadio}
              onClick={handleRadioChange}
              size="large"
              name="demo-radio"
            />
          </div>
        </div>


        <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md">
          <h2 className="text-xl font-bold mb-4">Checkbox Demo</h2>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Small Size</h3>
            <Checkbox
              label="Option 1"
              value="option1"
              checked={checkedItems.option1}
              onClick={handleCheckboxChange}
              size="small"
              name="demo-checkbox"
            />
            <Checkbox
              label="Option 2"
              value="option2"
              checked={checkedItems.option2}
              onClick={handleCheckboxChange}
              size="small"
              name="demo-checkbox"
            />
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Medium Size (Default)</h3>
            <Checkbox
              label="Option 1"
              value="option1"
              checked={checkedItems.option1}
              onClick={handleCheckboxChange}
              size="medium"
              name="demo-checkbox"
            />
            <Checkbox
              label="Option 2"
              value="option2"
              checked={checkedItems.option2}
              onClick={handleCheckboxChange}
              size="medium"
              name="demo-checkbox"
            />
          </div>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Large Size</h3>
            <Checkbox
              label="Option 1"
              value="option1"
              checked={checkedItems.option1}
              onClick={handleCheckboxChange}
              size="large"
              name="demo-checkbox"
            />
            <Checkbox
              label="Option 2"
              value="option2"
              checked={checkedItems.option2}
              onClick={handleCheckboxChange}
              size="large"
              name="demo-checkbox"
            />
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Button Mode - Similar to Screenshot</h2>
            <div className="flex flex-wrap">
              <Checkbox 
                label="C1" 
                value="button1" 
                checked={checkedItems.button1}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C2" 
                value="button2" 
                checked={checkedItems.button2}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C3" 
                value="button3" 
                checked={checkedItems.button3}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C4" 
                value="button4" 
                checked={checkedItems.button4}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C5" 
                value="button5" 
                checked={checkedItems.button5}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C6" 
                value="button6" 
                checked={checkedItems.button6}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C7" 
                value="button7" 
                checked={checkedItems.button7}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
              <Checkbox 
                label="C8" 
                value="button8" 
                checked={checkedItems.button8}
                onClick={handleCheckboxChange}
                mode="button"
                size="medium"
              />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Different Sizes - Button Mode</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Small</h3>
                <div className="flex flex-wrap">
                  <Checkbox label="Small 1" value="small1" checked={true} onClick={() => {}} mode="button" size="small" />
                  <Checkbox label="Small 2" value="small2" checked={false} onClick={() => {}} mode="button" size="small" />
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Large</h3>
                <div className="flex flex-wrap">
                  <Checkbox label="Large 1" value="large1" checked={true} onClick={() => {}} mode="button" size="large" />
                  <Checkbox label="Large 2" value="large2" checked={false} onClick={() => {}} mode="button" size="large" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Responsive Test</h2>
            <p className="text-gray-600 mb-4">Resize your browser to see how the button checkboxes wrap on smaller screens:</p>
            <div className="flex flex-wrap">
              {Array.from({ length: 12 }, (_, i) => (
                <Checkbox 
                  key={i}
                  label={`Option ${i + 1}`} 
                  value={`responsive${i}`} 
                  checked={i % 3 === 0}
                  onClick={() => {}}
                  mode="button"
                  size="medium"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 bg-gray-50">
          <h1 className="text-2xl font-bold mb-6">Tabs</h1>
          
          {/* First row: Filled tabs with rounded corners */}
          <div className="mb-4">
            <TabButton 
              tabs={filledTabs} 
              activeTab={0} 
              type="filled"
              borderRadius="12px" 
            />
          </div>
          
          {/* Second row: Filled tabs with less border radius */}
          <div className="mb-8">
            <TabButton 
              tabs={filledTabs} 
              activeTab={0} 
              type="filled"
              borderRadius="4px" 
            />
          </div>
          
          {/* Third row: Outline tabs with yellow underline */}
          <div className="mb-4">
            <TabButton 
              tabs={outlineTabs} 
              activeTab={0} 
              type="outline" 
            />
          </div>
          
          {/* Fourth row: Another instance of outline tabs */}
          <div>
            <TabButton 
              tabs={outlineTabs} 
              activeTab={0}
              type="outline" 
            />
          </div>
        </div>

        <div className="flex flex-col space-y-6 p-4 max-w-md mx-auto">
          <div>
            <h2 className="text-lg font-medium mb-2">Large Select</h2>
            <Select 
              label="Select" 
              options={demoOptions} 
              size="large"
              onClick={setSingleValue}
              value={singleValue}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Medium Select</h2>
            <Select 
              label="Select" 
              options={demoOptions}
              size="medium"
              onClick={setSingleValue}
              value={singleValue}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Small Select</h2>
            <Select 
              label="Select" 
              options={demoOptions}
              size="small"
              onClick={setSingleValue}
              value={singleValue}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Multi-Select</h2>
            <Select 
              label="Select Multiple" 
              options={demoOptions}
              multi={true}
              onClick={setMultiValue}
              value={multiValue}
            />
          </div>
          
          <div>
            <h2 className="text-lg font-medium mb-2">Pre-selected Value</h2>
            <Select 
              label="Select" 
              options={demoOptions}
              value={demoOptions[3]} // "More than 50%" pre-selected
              onClick={setSingleValue}
            />
          </div>
        </div>


        <div className="p-4 space-y-6">
          <div className="w-full max-w-md">
            <DateComponent 
              label="Select Date"
              value={singleDate}
              onChange={(date) => {
                console.log('Date changed:', date);
                setSingleDate(date);
              }}
              required
            />
            <div className="mt-2 text-sm text-gray-500">
              Selected: {formatDate(singleDate)}
            </div>
          </div>
          
          <div className="w-full max-w-md">
            <DateComponent 
              label="Date Range"
              value={dateRange}
              onChange={(startDate, endDate) => {
                console.log('Range changed:', startDate, endDate);
                setDateRange([startDate, endDate || '']);
              }}
              range={true}
              size="medium"
            />
            <div className="mt-2 text-sm text-gray-500">
              Range: {formatDate(dateRange[0])} to {formatDate(dateRange[1])}
            </div>
          </div>
          
          <div className="w-full max-w-md">
            <DateComponent 
              label="No Past Dates"
              value=""
              allowPrevDate={false}
            />
          </div>
          
          <div className="w-full max-w-md">
            <DateComponent 
              label="Disabled Date"
              value="2025-05-08"
              disabled={true}
            />
          </div>
          
          <div className="w-full max-w-md">
            <DateComponent 
              label="Required Field"
              required={true}
            />
          </div>
        </div>


        <div className="w-full max-w-lg mx-auto space-y-8 p-6">
          <h2 className="text-xl font-bold mb-4">Progress Bar Component</h2>
          
          <div>
            <h3 className="font-medium mb-2">Small:</h3>
            <ProgressBar 
              label="steps to submit" 
              progress={25} 
              size="small" 
            />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Medium (default):</h3>
            <ProgressBar 
              label="tasks completed" 
              progress={50} 
            />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Large:</h3>
            <ProgressBar 
              label="progress complete" 
              progress={75} 
              size="large" 
            />
          </div>
          
          <div>
            <h3 className="font-medium mb-2">Custom example:</h3>
            <ProgressBar 
              label="9 steps to submit" 
              progress={10} 
              size="medium" 
            />
          </div>
        </div>

        <NumberedListComponent steps={exampleSteps} />

        {/* <Accordion items={exampleItems} defaultOpenIndex={1} /> */}

        <div className="p-8 max-w-xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Card Selection Components</h1>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Single Selection</h2>
            <HorizontalCardSelection 
              items={cards} 
              value={selectedCard} 
              onChange={setSelectedCard} 
            />
          </div>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Multi Selection</h2>
            <HorizontalCardSelection 
              items={cards} 
              value={selectedMultiCards} 
              onChange={setSelectedMultiCards}
              multi={true}
            />
          </div>
          
          <div className="mb-8">
            <HorizontalCardSelection 
              items={horizontalCards} 
              value={selectedHorizontalCard} 
              onChange={setSelectedHorizontalCard}
            />
          </div>
        </div>
            
        <div className="p-8 bg-gray-100">
          <h1 className="text-2xl font-bold mb-6">Thumbnail Card Demo</h1>
          
          <div className="flex flex-wrap gap-6">
            {/* Card 1: Room with Image (Approved) */}
            <div className="w-full max-w-xs">
              <ThumbnailCard
                type="booking"
                bookingId="742931640"
                bookingDate="5 Feb, 2024"
                title="2 Room Deluxe Family Suite"
                checkInDate="8 Feb, 2024"
                checkOutDate="10 Feb, 2024"
                status="Approved"
                image="https://images.unsplash.com/photo-1566665797739-1674de7a421a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=774&q=80"
                buttonText="EDIT BOOKING"
                onButtonClick={() => handleEditBooking("742931640")}
              />
            </div>
            
            {/* Card 2: No Room Selected (Pending) */}
            <div className="w-full max-w-xs">
              <ThumbnailCard
                type="booking"
                bookingId="742931640"
                bookingDate="5 Feb, 2024"
                title="No Room Selected"
                checkInDate="-"
                checkOutDate="-"
                status="Pending"
                buttonText="EDIT BOOKING"
                onButtonClick={() => handleEditBooking("742931640")}
              />
            </div>
            
            {/* Card 3: Special Offer */}
            <div className="w-full max-w-xs">
              <ThumbnailCard
                type="offer"
                title="Adaptive Waterskiing"
                description="Come 'n Try adaptive water skiing whilst enjoying a weekend at beautiful Sargood on Collaroy!"
                minStayDates="05 Apr, 2025 - 07 Apr, 2025"
                status="Special Offer"
                image="https://images.unsplash.com/photo-1530870110042-98b2cb110834?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80"
                buttonText="BOOK NOW"
                onButtonClick={handleBookNow}
                viewDetails={handleViewDetails}
              />
            </div>
          </div>
        </div>


        <div className="p-4 bg-gray-50">
          <h1 className="text-2xl font-bold mb-6">Activity Cards</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cardItems.map((item, index) => (
              <Card key={index} {...item} />
            ))}
          </div>
        </div>

        <div className="p-6 bg-gray-100 min-h-screen">
          <Table 
            title="GUEST LIST"
            data={demoData} 
            columns={demoColumns}
            itemsPerPageOptions={[10, 15, 25, 50]}
            defaultItemsPerPage={15}
          />
        </div>
        
      </React.Fragment>
    );
  };
  
  export default UIV2Demo;
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    fontFamily: {
      sans: ['Open Sans', 'sans-serif'],
    },
    extend: {
      maxWidth: {
        'screen-xl-1': '1550px',
      },
      colors: {
        // Primary Colors
        "sea": "#00467F",
        "sky": {
          DEFAULT: "#60ACDF",
          // Preserve default Tailwind sky colors
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985', // This is the one used in your CSS
          900: '#0c4a6e',
          950: '#082f49',
        },
        
        // Secondary Color
        "sun": "#FFCE00",
        
        // Neutral Colors
        "neutral-darkest": "#000000",
        "neutral-darker": "#333333",
        "neutral-dark": "#666666",
        "neutral": "#999999",
        "neutral-light": "#CCCCCC",
        "neutral-white": "#FFFFFF",
        
        // Blend Colors
        "blend-darkest": "#00467F",
        "blend-darker": "#255A8F",
        "blend-dark": "#3A70A5",
        "blend": "#548ABD",
        "blend-light": "#60ACDF",
        
        // Tertiary Colors
        "seafoam": "#3EBFB9",
        "dawn": "#FEC467",
        "sunset": "#F99D1C",
        "lobster": "#F26244",
        "rockpool": "#396373",
        
        // Keep the old color for backward compatibility
        "sargood-blue": "#00467F",
        
        // Preserve default color palettes for backward compatibility
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
        red: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        yellow: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
      },
      fontSize: {
        // Heading font sizes
        'h1': '42px',
        'h2': '36px',
        'h3': '28px',
        'h4': '24px',
        'h5': '20px',
        'h6': '18px',
        
        // Body font sizes
        'body-xl': '20px',
        'body-lg': '18px',
        'body-md': '16px',
        'body-sm': '14px',
        'body-xs': '12px',
      },
      lineHeight: {
        'heading': '120%',
        'heading-large': '140%',
        'body': '140%',
      },
      fontWeight: {
        'normal': '400',
        'semibold': '600',
        'bold': '700',
        'extrabold': '800',
      },
      gradientColorStops: {
        'sea-sky': ['#00467F', '#60ACDF'],
        'sky-seafoam': ['#60ACDF', '#3EBFB9'],
        'sunset-dawn': ['#F99D1C', '#FEC467'],
        'lobster-sunset': ['#F26244', '#F99D1C'],
      },
    },
  },
  safelist: [
    // Colors from the palette
    'text-sea', 'bg-sea', 'border-sea',
    'text-sky', 'bg-sky', 'border-sky',
    'text-sun', 'bg-sun', 'border-sun',
    'text-seafoam', 'bg-seafoam', 'border-seafoam',
    'text-dawn', 'bg-dawn', 'border-dawn',
    'text-sunset', 'bg-sunset', 'border-sunset',
    'text-lobster', 'bg-lobster', 'border-lobster',
    'text-rockpool', 'bg-rockpool', 'border-rockpool',
    
    // Neutrals
    'text-neutral-darkest', 'bg-neutral-darkest', 'border-neutral-darkest',
    'text-neutral-darker', 'bg-neutral-darker', 'border-neutral-darker',
    'text-neutral-dark', 'bg-neutral-dark', 'border-neutral-dark',
    'text-neutral', 'bg-neutral', 'border-neutral',
    'text-neutral-light', 'bg-neutral-light', 'border-neutral-light',
    'text-neutral-white', 'bg-neutral-white', 'border-neutral-white',
    
    // Blends
    'text-blend-darkest', 'bg-blend-darkest', 'border-blend-darkest',
    'text-blend-darker', 'bg-blend-darker', 'border-blend-darker',
    'text-blend-dark', 'bg-blend-dark', 'border-blend-dark',
    'text-blend', 'bg-blend', 'border-blend',
    'text-blend-light', 'bg-blend-light', 'border-blend-light',
    
    // Typography classes
    'text-h1', 'text-h2', 'text-h3', 'text-h4', 'text-h5', 'text-h6',
    'text-body-xl', 'text-body-lg', 'text-body-md', 'text-body-sm', 'text-body-xs',
    'leading-heading', 'leading-heading-large', 'leading-body',
    'font-normal', 'font-semibold', 'font-bold', 'font-extrabold',
    
    // Gradient backgrounds
    'bg-gradient-to-r', 'from-sea', 'to-sky',
    'bg-gradient-to-r', 'from-sky', 'to-seafoam',
    'bg-gradient-to-r', 'from-sunset', 'to-dawn',
    'bg-gradient-to-r', 'from-lobster', 'to-sunset',
    
    // Explicit backward compatibility classes
    'border-sky-800',
    'focus:border-sky-400',
    'text-yellow-500',
    'text-slate-400',
    'text-red-500',
    'border-slate-300',
    'hover:border-slate-300',
    
    // Keep existing safelist for backward compatibility
    'bg-[#02ab92]',
    'bg-[#ffbb00]',
    'bg-[#ff5d5d]',
    'bg-[#84dccf]',
    'bg-[#7426b3]',
    'bg-[#af1f6a]',
    'bg-[#0288d1]',
    'bg-yellow-400',
    'bg-sky-400',
    'bg-green-400',
    'bg-lime-400',
    'bg-fuchsia-400',
    'bg-red-400',
    'bg-orange-400',
    'bg-amber-400',
    'w-0',
    'w-[1%]', 'w-[2%]', 'w-[3%]', 'w-[4%]', 'w-[5%]', 'w-[6%]', 'w-[7%]', 'w-[8%]', 'w-[9%]', 'w-[10%]',
    'w-[11%]', 'w-[12%]', 'w-[13%]', 'w-[14%]', 'w-[15%]', 'w-[16%]', 'w-[17%]', 'w-[18%]', 'w-[19%]', 'w-[20%]',
    'w-[21%]', 'w-[22%]', 'w-[23%]', 'w-[24%]', 'w-[25%]', 'w-[26%]', 'w-[27%]', 'w-[28%]', 'w-[29%]', 'w-[30%]',
    'w-[31%]', 'w-[32%]', 'w-[33%]', 'w-[34%]', 'w-[35%]', 'w-[36%]', 'w-[37%]', 'w-[38%]', 'w-[39%]', 'w-[40%]',
    'w-[41%]', 'w-[42%]', 'w-[43%]', 'w-[44%]', 'w-[45%]', 'w-[46%]', 'w-[47%]', 'w-[48%]', 'w-[49%]', 'w-[50%]',
    'w-[51%]', 'w-[52%]', 'w-[53%]', 'w-[54%]', 'w-[55%]', 'w-[56%]', 'w-[57%]', 'w-[58%]', 'w-[59%]', 'w-[60%]',
    'w-[61%]', 'w-[62%]', 'w-[63%]', 'w-[64%]', 'w-[65%]', 'w-[66%]', 'w-[67%]', 'w-[68%]', 'w-[69%]', 'w-[70%]',
    'w-[71%]', 'w-[72%]', 'w-[73%]', 'w-[74%]', 'w-[75%]', 'w-[76%]', 'w-[77%]', 'w-[78%]', 'w-[79%]', 'w-[80%]',
    'w-[81%]', 'w-[82%]', 'w-[83%]', 'w-[84%]', 'w-[85%]', 'w-[86%]', 'w-[87%]', 'w-[88%]', 'w-[89%]', 'w-[90%]',
    'w-[91%]', 'w-[92%]', 'w-[93%]', 'w-[94%]', 'w-[95%]', 'w-[96%]', 'w-[97%]', 'w-[98%]', 'w-[99%]', 'w-[100%]',
  ],
  plugins: [],
  variants: {
    extend: {
      display: ["group-hover"]
    }
  }
}
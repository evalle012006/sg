import React from 'react';
import { Check, Percent } from 'lucide-react';

// Define the badge types and their corresponding properties
const BADGE_TYPES = {
  success: {
    background: '#3EBFB9',
    iconComponent: Check,
    iconColor: '#3EBFB9',
    iconChar: null,
    customSvg: false
  },
  error: {
    background: '#F26244',
    iconComponent: null,
    iconColor: '#F26244',
    iconChar: '!',
    customSvg: false
  },
  pending: {
    background: '#F99D1C',
    iconComponent: null,
    iconColor: '#F99D1C',
    iconChar: 'i',
    customSvg: false
  },
  offer: {
    background: '#FFCE00',
    iconComponent: Percent,
    iconColor: 'white',
    iconChar: null,
    customSvg: true
  },
  draft: {
    background: '#E6EDF3',
    iconComponent: null,
    iconColor: '#00467F',
    iconChar: null,
    customSvg: true
  },
  archived: {
    background: '#F26244',
    iconComponent: null,
    iconColor: 'white',
    iconChar: null,
    customSvg: true
  },
  primary: {
    background: '#00467F',
    iconComponent: null,
    iconColor: '#00467F',
    iconChar: null,
    customSvg: false
  },
  secondary: {
    background: '#00467F1A',
    iconComponent: null,
    iconColor: '#00467F',
    iconChar: null,
    customSvg: false
  }
};

// Size presets for the component
const SIZES = {
  small: {
    height: 26,
    paddingX: 10,
    paddingY: 6,
    gap: 5,
    iconSize: 16,
    iconInnerSize: 12,
    fontSize: 'text-xs'
  },
  medium: {
    height: 32,
    paddingX: 12,
    paddingY: 8,
    gap: 6,
    iconSize: 20,
    iconInnerSize: 14,
    fontSize: 'text-sm'
  },
  large: {
    height: 40,
    paddingX: 16,
    paddingY: 10,
    gap: 8,
    iconSize: 24,
    iconInnerSize: 16,
    fontSize: 'text-base'
  }
};

// Special Offer SVG Component
const SpecialOfferIcon = ({ size = 16, color = '#1B457B' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.8502 8.77856L14.6326 8.48921C14.5177 8.33614 14.455 8.1503 14.4535 7.95893C14.452 7.76757 14.5119 7.58078 14.6244 7.42595L14.8355 7.13386C14.912 7.02869 14.9647 6.90816 14.9901 6.78062C15.0154 6.65308 15.0128 6.52157 14.9824 6.39514C14.952 6.26872 14.8945 6.15039 14.8139 6.04834C14.7333 5.9463 14.6315 5.86298 14.5156 5.8041L14.1905 5.63358C14.0196 5.54583 13.8812 5.40592 13.7952 5.23413C13.7092 5.06233 13.6802 4.8676 13.7124 4.67821L13.7732 4.32393C13.794 4.19479 13.787 4.06269 13.7526 3.93648C13.7182 3.81027 13.6573 3.69289 13.5738 3.59216C13.4904 3.49143 13.3864 3.40972 13.2687 3.35247C13.1511 3.29522 13.0226 3.26377 12.8919 3.26023L12.5262 3.24606C12.3328 3.23956 12.1463 3.1726 11.993 3.0546C11.8397 2.93661 11.7272 2.7735 11.6714 2.58825L11.5699 2.2422C11.5309 2.11693 11.466 2.00125 11.3795 1.9026C11.293 1.80394 11.1867 1.72451 11.0676 1.66946C10.9485 1.61441 10.8192 1.58494 10.688 1.58297C10.5568 1.581 10.4267 1.60658 10.3059 1.65802L9.9695 1.80017C9.79021 1.87608 9.59188 1.89487 9.40153 1.85397C9.21118 1.81306 9.03808 1.71447 8.90579 1.57161L8.66214 1.30511C8.57281 1.20819 8.46423 1.13101 8.34335 1.07847C8.22247 1.02594 8.09194 0.999201 7.96014 1.00002C7.82833 1.00084 7.69815 1.02919 7.57793 1.08322C7.45771 1.13725 7.3501 1.21579 7.26199 1.31381L7.02154 1.58305C6.89151 1.72741 6.72023 1.82826 6.53091 1.87193C6.3416 1.9156 6.14343 1.89997 5.96331 1.82715L5.62412 1.69002C5.50262 1.64008 5.37199 1.61624 5.24069 1.62008C5.10938 1.62391 4.98035 1.65531 4.86197 1.71226C4.74359 1.76921 4.6385 1.85041 4.55356 1.95061C4.46861 2.05081 4.40569 2.16777 4.36888 2.29387L4.27332 2.63992C4.2196 2.82581 4.10912 2.99024 3.95732 3.11024C3.80553 3.23023 3.62001 3.29978 3.42674 3.30914L3.06105 3.32878C2.93064 3.33436 2.80292 3.36774 2.68643 3.42665C2.56995 3.48557 2.46737 3.56866 2.38558 3.67039C2.3038 3.77213 2.24469 3.89016 2.21218 4.01658C2.17968 4.143 2.17452 4.27491 2.19709 4.40348L2.26383 4.75499C2.29798 4.94351 2.27148 5.138 2.1881 5.31049C2.10473 5.48298 1.96881 5.62461 1.79987 5.71496L1.47988 5.88819C1.36496 5.94908 1.26456 6.03409 1.18556 6.1374C1.10656 6.24071 1.05083 6.35988 1.02218 6.48674C0.993522 6.6136 0.992625 6.74515 1.01955 6.87238C1.04648 6.99962 1.10057 7.11953 1.17817 7.2239L1.39576 7.51325C1.51062 7.6663 1.57343 7.85213 1.57499 8.04347C1.57656 8.23482 1.51678 8.42164 1.40444 8.57654L1.19281 8.86863C1.11635 8.9738 1.0636 9.09431 1.03825 9.22184C1.01289 9.34938 1.01552 9.48092 1.04595 9.60734C1.07637 9.73377 1.13387 9.85208 1.21446 9.95412C1.29506 10.0562 1.39683 10.1395 1.51278 10.1984L1.83734 10.3684C2.00832 10.4562 2.14687 10.5962 2.23286 10.7681C2.31884 10.94 2.34779 11.1348 2.3155 11.3243L2.2547 11.6785C2.23387 11.8076 2.24088 11.9397 2.27527 12.0659C2.30965 12.1921 2.37062 12.3095 2.45408 12.4102C2.53754 12.5109 2.64158 12.5925 2.7592 12.6497C2.87681 12.7069 3.00528 12.7383 3.13602 12.7418L3.50171 12.756C3.69507 12.7627 3.8815 12.8297 4.03486 12.9477C4.18822 13.0656 4.30086 13.2286 4.357 13.4138L4.45847 13.7598C4.49738 13.8852 4.56215 14.001 4.64864 14.0997C4.73513 14.1984 4.8414 14.2779 4.96054 14.3329C5.07968 14.388 5.20905 14.4175 5.34029 14.4194C5.47153 14.4213 5.60172 14.3956 5.72241 14.344L6.05839 14.2023C6.23776 14.1264 6.43614 14.1077 6.62655 14.1486C6.81697 14.1894 6.99017 14.288 7.12257 14.4308L7.36575 14.6974C7.45517 14.7938 7.56371 14.8705 7.68445 14.9226C7.80519 14.9747 7.93549 15.0011 8.067 15C8.1985 14.9989 8.32833 14.9705 8.4482 14.9164C8.56807 14.8623 8.67534 14.7838 8.76317 14.6859L9.00361 14.4167C9.13345 14.272 9.30474 14.171 9.49413 14.1273C9.68352 14.0836 9.88178 14.0994 10.0618 14.1726L10.401 14.3097C10.5225 14.3597 10.6532 14.3835 10.7845 14.3797C10.9158 14.3758 11.0448 14.3444 11.1632 14.2875C11.2816 14.2305 11.3866 14.1493 11.4716 14.0491C11.5565 13.9489 11.6195 13.832 11.6563 13.7059L11.7518 13.3598C11.8056 13.1739 11.916 13.0095 12.0678 12.8895C12.2196 12.7695 12.4051 12.7 12.5984 12.6906L12.9641 12.6705C13.0945 12.665 13.2223 12.6317 13.3388 12.5728C13.4554 12.5139 13.5579 12.4308 13.6397 12.329C13.7215 12.2273 13.7807 12.1092 13.8131 11.9828C13.8456 11.8563 13.8507 11.7244 13.8281 11.5958L13.7613 11.2443C13.7271 11.0558 13.7536 10.8614 13.8369 10.6889C13.9201 10.5164 14.056 10.3747 14.2248 10.2843L14.5448 10.1115C14.6602 10.0515 14.7611 9.96704 14.8406 9.86411C14.9201 9.76118 14.9763 9.64223 15.0052 9.51544C15.0342 9.38865 15.0352 9.25709 15.0083 9.12986C14.9814 9.00262 14.9271 8.88275 14.8493 8.77856H14.8502Z" fill={color} stroke={color} strokeMiterlimit="10" strokeLinejoin="round"/>
  </svg>
);

// Draft SVG Component
const DraftIcon = ({ size = 11, color = '#00467F' }) => (
  <svg width={size} height={size * (12/11)} viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.65608 9.58748L1 10.4703L2.08522 7.09375L7.18004 2.02114C7.51021 1.7032 7.95151 1.52681 8.40987 1.52957C8.86822 1.53234 9.30737 1.71404 9.63367 2.03594C9.96371 2.36136 10.1519 2.80395 10.1572 3.26741C10.1625 3.73086 9.98454 4.17766 9.66205 4.51055L4.65608 9.58748Z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.69396 5.47472L6.27734 3.05811" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Archived SVG Component
const ArchivedIcon = ({ size = 15, color = 'white' }) => (
  <svg width={size} height={size * (14/15)} viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0.000214577 5.99624C0.000214577 5.95042 0.00642776 5.90693 0.0157471 5.865C0.0180769 5.8549 0.0219593 5.8448 0.0258427 5.83548C0.0359392 5.79976 0.0499172 5.76559 0.0654497 5.73219C0.0693331 5.72598 0.0693331 5.71822 0.0732164 5.712L2.38759 1.44371C2.87064 0.552935 3.79947 0 4.8113 0H9.72016C10.7321 0 11.6609 0.552935 12.1439 1.44371L14.4582 5.712C14.4582 5.712 14.4621 5.72598 14.466 5.73219C14.4815 5.76404 14.4955 5.79976 14.5056 5.83548C14.508 5.84558 14.5134 5.85568 14.5157 5.865C14.5258 5.90693 14.5312 5.95042 14.5312 5.99624V12.1455C14.5312 13.1691 13.6979 14 12.6767 14H1.85936C0.835797 14 0.00482273 13.1667 0.00482273 12.1455V5.99624H0.000214577ZM11.0941 2.00987C10.82 1.50506 10.2927 1.19054 9.71796 1.19054H4.8091C4.23441 1.19054 3.70786 1.50429 3.43527 2.00987L1.59858 5.39742L12.9309 5.3982L11.0942 2.01064L11.0941 2.00987ZM1.19309 12.1453C1.19309 12.5111 1.4913 12.807 1.85475 12.807L12.6745 12.8077C13.0403 12.8077 13.3362 12.5095 13.3362 12.1461V6.59326H1.19313V12.1461L1.19309 12.1453Z" fill={color}/>
    <path d="M9.37622 9.37598H5.15545C4.82538 9.37598 4.55901 9.10961 4.55901 8.77954C4.55901 8.44947 4.82538 8.18311 5.15545 8.18311H9.37622C9.70629 8.18311 9.97266 8.44947 9.97266 8.77954C9.97266 9.10961 9.70629 9.37598 9.37622 9.37598Z" fill={color}/>
  </svg>
);

const StatusBadge = ({ 
  type, 
  label, 
  icon, 
  size = "small", 
  fullWidth = false,
  showIcon = true,
  customColor = null,
  customTextColor = null,
  customIconColor = null,
  className = "" 
}) => {
  // Get the badge type settings, default to success if type not found
  const badgeType = BADGE_TYPES[type?.toLowerCase()] || BADGE_TYPES.success;
  
  // Get size configuration
  const sizeConfig = typeof size === 'string' ? 
    (SIZES[size] || SIZES.small) : 
    { ...SIZES.small, ...size };
  
  // Determine text color based on the badge type or use customTextColor if provided
  let textColor = customTextColor || 'white';
  if (!customTextColor) {
    if (type?.toLowerCase() === 'offer') {
      textColor = '#14213D';
    } else if (type?.toLowerCase() === 'secondary') {
      textColor = '#00467F';
    } else if (type?.toLowerCase() === 'draft') {
      textColor = '#00467F';
    }
  }
  
  // Determine icon color - prioritize customIconColor, then use customColor if provided
  // otherwise fall back to badgeType's iconColor
  const iconColorToUse = customIconColor || (customColor ? customColor : badgeType.iconColor);
  
  // Extract color code from customColor if it's a Tailwind class
  const getColorFromTailwind = (tailwindClass) => {
    if (!tailwindClass || typeof tailwindClass !== 'string') return null;
    
    // Try to extract hex code if customColor contains a hex code
    const hexMatch = tailwindClass.match(/#([0-9A-Fa-f]{3,8})/);
    if (hexMatch) return hexMatch[0];
    
    // For Tailwind class colors - includes the custom colors from your Tailwind config
    const colorMap = {
      // Custom tailwind colors from config
      'bg-yellow-400': '#facc15',
      'bg-sky-400': '#38bdf8',
      'bg-green-400': '#4ade80',
      'bg-lime-400': '#a3e635',
      'bg-fuchsia-400': '#e879f9',
      'bg-red-400': '#f87171',
      'bg-orange-400': '#fb923c',
      'bg-amber-400': '#fbbf24',
      
      // Additional common Tailwind colors
      'bg-blue-400': '#60a5fa',
      'bg-purple-400': '#c084fc',
      'bg-pink-400': '#f472b6',
      'bg-indigo-400': '#818cf8',
      'bg-teal-400': '#2dd4bf',
      'bg-cyan-400': '#22d3ee',
      'bg-emerald-400': '#34d399',
      'bg-violet-400': '#a78bfa',
      'bg-rose-400': '#fb7185',
      
      // Darker/lighter variants of your custom colors
      'bg-yellow-500': '#eab308',
      'bg-yellow-300': '#fde047',
      'bg-sky-500': '#0ea5e9',
      'bg-sky-300': '#7dd3fc',
      'bg-green-500': '#22c55e',
      'bg-green-300': '#86efac'
    };
    
    // Check if the class is in our map
    for (const [className, colorValue] of Object.entries(colorMap)) {
      if (tailwindClass.includes(className)) return colorValue;
    }
    
    // Return null if we can't determine the color
    return null;
  };
  
  // Get extracted color from Tailwind class or use as is if it's a hex code
  const extractedColor = getColorFromTailwind(customColor) || iconColorToUse;
  
  // Common icon container styles - consistent for all icon types
  const iconContainerStyle = {
    width: sizeConfig.iconSize,
    height: sizeConfig.iconSize,
    flexShrink: 0,
    border: 'none',
    verticalAlign: 'middle' // Added to ensure consistency
  };
  
  // Determine icon content
  let iconContent = null;
  
  // Only create iconContent if showIcon is true
  if (showIcon) {
    if (icon) {
      const IconComponent = icon;
      iconContent = <IconComponent size={sizeConfig.iconInnerSize} color={extractedColor} strokeWidth={2.5} />;
    } else if (type?.toLowerCase() === 'offer' && badgeType.customSvg) {
      // Use the custom SVG for Offer with the appropriate color
      iconContent = (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SpecialOfferIcon size={sizeConfig.iconSize} />
          <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Percent size={sizeConfig.iconInnerSize * 0.8} color="white" strokeWidth={3} />
          </div>
        </div>
      );
    } else if (type?.toLowerCase() === 'draft' && badgeType.customSvg) {
      // Use the custom SVG for Draft
      iconContent = <DraftIcon size={sizeConfig.iconInnerSize} color={badgeType.iconColor} />;
    } else if (type?.toLowerCase() === 'archived' && badgeType.customSvg) {
      // Use the custom SVG for Archived
      iconContent = <ArchivedIcon size={sizeConfig.iconInnerSize} color={badgeType.iconColor} />;
    } else if (badgeType.iconComponent) {
      const IconComponent = badgeType.iconComponent;
      iconContent = (
        <div className="flex items-center justify-center rounded-full bg-white" 
          style={iconContainerStyle}
        >
          <IconComponent size={sizeConfig.iconInnerSize} color={badgeType.iconColor} strokeWidth={2.5} />
        </div>
      );
    } else if (badgeType.iconChar) {
      iconContent = (
        <div className="flex items-center justify-center rounded-full bg-white" 
          style={iconContainerStyle}
        >
          <span 
            style={{ 
              color: badgeType.iconColor, 
              fontWeight: 'bold', 
              fontSize: `${sizeConfig.iconInnerSize}px`,
              lineHeight: 1,
              position: 'relative',
              // Add letter-spacing to ensure consistent character width
              letterSpacing: '0px',
              // Ensure consistent text alignment
              textAlign: 'center',
              // Add font family specification for consistency
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {badgeType.iconChar}
          </span>
        </div>
      );
    }
  }

  return (
    <div 
      className={`flex items-center rounded-3xl ${fullWidth ? 'w-full' : ''} ${customColor && customColor.startsWith('bg-') ? customColor : ''} ${className}`}
      style={{ 
        backgroundColor: customColor && !customColor.startsWith('bg-') ? customColor : (customColor && customColor.startsWith('bg-') ? '' : badgeType.background),
        height: sizeConfig.height,
        paddingLeft: sizeConfig.paddingX,
        paddingRight: sizeConfig.paddingX,
        paddingTop: sizeConfig.paddingY,
        paddingBottom: sizeConfig.paddingY,
        gap: sizeConfig.gap,
        // Add these styles to ensure consistent text rendering
        whiteSpace: 'nowrap',
        // Ensure consistent font rendering
        fontFamily: 'system-ui, -apple-system, sans-serif',
        // Add subtle letter spacing to prevent text from appearing cramped
        letterSpacing: '0.025em'
      }}
    >
      {iconContent}
      <span 
        className={`font-medium ${sizeConfig.fontSize}`}
        style={{ 
          color: textColor,
          // Ensure consistent text rendering
          letterSpacing: '0.025em',
          whiteSpace: 'nowrap'
        }}
      >
        {label || type}
      </span>
    </div>
  );
};

export default StatusBadge;
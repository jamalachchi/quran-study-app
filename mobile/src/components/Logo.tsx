interface LogoProps {
  size?: number;
  className?: string;
  active?: boolean;
}

export default function Logo({ size = 32, className = "", active = true }: LogoProps) {
  const strokeColor = active ? "url(#logo-grad)" : "currentColor";
  const fillColor = active ? "url(#logo-grad)" : "currentColor";
  const sparkColor = active ? "#F59E0B" : "currentColor";
  const opacity = active ? "0.95" : "0.5";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 8-pointed Rub el Hizb star using overlapping rounded rectangles */}
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="4.5"
        stroke={strokeColor}
        strokeWidth="2.2"
        fill="none"
      />
      <rect
        x="6"
        y="6"
        width="20"
        height="20"
        rx="4.5"
        transform="rotate(45 16 16)"
        stroke={strokeColor}
        strokeWidth="2.2"
        fill="none"
      />

      {/* Stylized Open Book / Rehal */}
      <path
        d="M16 22.5C13.8 22.5 11.8 21.3 10 20.2V13.5C11.8 14.6 13.8 15.8 16 15.8C18.2 15.8 20.2 14.6 22 13.5V20.2C20.2 21.3 18.2 22.5 16 22.5Z"
        fill={fillColor}
        opacity={opacity}
      />
      
      {/* Book vertical divider page fold line */}
      <path
        d="M16 15.8V22.5"
        stroke={active ? "#FFFFFF" : "none"}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Radiant Light/Exposition Spark (representing Al-Bayan) */}
      <path
        d="M16 8.5L17.5 10L16 11.5L14.5 10L16 8.5Z"
        fill={sparkColor}
        className={active ? "animate-pulse" : ""}
      />

      <defs>
        <linearGradient
          id="logo-grad"
          x1="6"
          y1="6"
          x2="26"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#10B981" /> {/* Brand Emerald */}
          <stop offset="100%" stopColor="#6366F1" /> {/* Brand Indigo */}
        </linearGradient>
      </defs>
    </svg>
  );
}

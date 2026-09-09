import './AppBackground.css';

export default function AppBackground() {
  return (
    <div className="urcare-background">
      {/* Soft top-left leaves */}
      <svg
        className="leaves leaves-top"
        viewBox="0 0 300 280"
        aria-hidden="true"
      >
        <defs>
          <filter id="leafBlur">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          <linearGradient id="leafGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#B8E99B" />
            <stop offset="100%" stopColor="#4CAF50" />
          </linearGradient>
        </defs>

        <path
          d="M10 15 C90 5 145 35 205 105 C125 100 60 75 10 15Z"
          fill="url(#leafGradient)"
          opacity=".72"
        />

        <path
          d="M0 90 C75 55 125 95 160 170 C80 155 35 130 0 90Z"
          fill="#75C95C"
          opacity=".55"
          filter="url(#leafBlur)"
        />

        <path
          d="M90 0 C150 30 205 70 225 135 C160 115 120 70 90 0Z"
          fill="#A7E88C"
          opacity=".65"
        />
      </svg>

      {/* Heart ECG */}
      <svg
        className="heart-ecg"
        viewBox="0 0 120 120"
        aria-hidden="true"
      >
        <path
          d="M60 95
             C52 86 25 68 20 48
             C14 24 42 14 60 34
             C78 14 106 24 100 48
             C95 68 68 86 60 95Z"
          fill="none"
          stroke="#CFEFD2"
          strokeWidth="4"
        />

        <path
          d="M32 55 H46 L53 45 L61 67 L69 52 H88"
          fill="none"
          stroke="#D5F2D8"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Medical cross */}
      <div className="medical-cross">
        <span></span>
        <span></span>
      </div>

      {/* Floating leaves */}
      <svg className="floating-leaf leaf-one" viewBox="0 0 100 100">
        <path
          d="M15 80 C20 40 50 15 90 10 C82 52 55 78 15 80Z"
          fill="#BCECBD"
          opacity=".48"
        />
        <path
          d="M20 75 C40 55 60 35 85 18"
          stroke="#A8E2A9"
          fill="none"
          strokeWidth="2"
        />
      </svg>

      <svg className="floating-leaf leaf-two" viewBox="0 0 100 100">
        <path
          d="M15 80 C20 40 50 15 90 10 C82 52 55 78 15 80Z"
          fill="#A9E4B1"
          opacity=".42"
        />
      </svg>

      <svg className="floating-leaf leaf-three" viewBox="0 0 100 100">
        <path
          d="M15 80 C20 40 50 15 90 10 C82 52 55 78 15 80Z"
          fill="#C5F0C5"
          opacity=".48"
        />
      </svg>

      {/* Bottom wave */}
      <svg
        className="bottom-wave"
        viewBox="0 0 900 300"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="
            M0 160
            C140 70 240 100 350 175
            C470 255 600 245 900 90
            L900 300
            L0 300
            Z
          "
          fill="#E8F9E8"
        />

        <path
          d="
            M0 205
            C150 105 245 135 370 205
            C510 280 650 245 900 125
          "
          fill="none"
          stroke="#D1F1D2"
          strokeWidth="3"
        />
      </svg>

      {/* Bottom-left plant */}
      <svg
        className="bottom-plant"
        viewBox="0 0 280 260"
        aria-hidden="true"
      >
        <path
          d="M70 260 C90 195 130 130 205 65"
          fill="none"
          stroke="#6FBD58"
          strokeWidth="5"
          strokeLinecap="round"
        />

        <path
          d="M100 185 C40 170 20 125 25 80 C75 90 105 125 100 185Z"
          fill="#6FC45C"
          opacity=".75"
        />

        <path
          d="M135 140 C105 90 120 45 155 15 C185 65 175 110 135 140Z"
          fill="#8BD873"
          opacity=".72"
        />

        <path
          d="M80 230 C30 220 5 185 8 150 C55 155 82 185 80 230Z"
          fill="#B1E69D"
          opacity=".62"
        />

        <path
          d="M165 105 C170 60 205 35 240 30 C235 70 205 100 165 105Z"
          fill="#75C85D"
          opacity=".55"
        />
      </svg>
    </div>
  );
}

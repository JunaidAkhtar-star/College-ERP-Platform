'use client';

import { motion } from '@/shared/utils/motion';

const nodes = [
  { cx: 76, cy: 72, delay: 0 },
  { cx: 310, cy: 62, delay: 0.3 },
  { cx: 342, cy: 188, delay: 0.55 },
  { cx: 58, cy: 198, delay: 0.8 },
];

export default function OverviewIllustration() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[420px]" aria-hidden="true">
      <motion.svg
        viewBox="0 0 400 300"
        className="h-full w-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <defs>
          <linearGradient id="overview-panel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e6f2fb" />
          </linearGradient>
          <linearGradient id="overview-chart" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#0178d7" stopOpacity="0.08" />
            <stop offset="1" stopColor="#0178d7" stopOpacity="0.42" />
          </linearGradient>
        </defs>

        <path
          d="M76 72L184 130M310 62L216 126M342 188L222 150M58 198L178 152"
          stroke="#8dc5ee"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        {nodes.map((node) => (
          <motion.g
            key={`${node.cx}-${node.cy}`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: node.delay, type: 'spring', stiffness: 150 }}
          >
            <circle cx={node.cx} cy={node.cy} r="22" fill="#ffffff" />
            <circle cx={node.cx} cy={node.cy} r="15" fill="#e6f2fb" />
            <circle cx={node.cx} cy={node.cy} r="5" fill="#0178d7" />
          </motion.g>
        ))}

        <motion.g
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x="116" y="86" width="170" height="130" rx="24" fill="url(#overview-panel)" />
          <rect x="132" y="104" width="138" height="26" rx="9" fill="#ffffff" />
          <circle cx="147" cy="117" r="6" fill="#9bb94f" />
          <rect x="159" y="112" width="66" height="5" rx="2.5" fill="#94a3b8" />
          <path
            d="M138 184C158 166 170 174 187 151C205 128 222 173 263 139V199H138Z"
            fill="url(#overview-chart)"
          />
          <motion.path
            d="M138 184C158 166 170 174 187 151C205 128 222 173 263 139"
            fill="none"
            stroke="#0178d7"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.35 }}
          />
          <circle cx="187" cy="151" r="5" fill="#ffffff" stroke="#0178d7" strokeWidth="3" />
          <circle cx="263" cy="139" r="5" fill="#ffffff" stroke="#0178d7" strokeWidth="3" />
        </motion.g>

        <motion.g
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <rect x="268" y="214" width="96" height="48" rx="15" fill="#ffffff" />
          <circle cx="290" cy="238" r="10" fill="#f5f8ec" />
          <path
            d="M285 238L289 242L296 233"
            fill="none"
            stroke="#7c9440"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="308" y="230" width="38" height="5" rx="2.5" fill="#64748b" />
          <rect x="308" y="241" width="27" height="4" rx="2" fill="#cbd5e1" />
        </motion.g>
      </motion.svg>
    </div>
  );
}

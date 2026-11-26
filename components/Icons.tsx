import React from 'react';

export const WaynoteLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className}>
    <path
      d="M5 16.5C5 11.2 8.2 7.5 12 4.5C15.8 7.5 19 11.2 19 16.5C19 18.43 17.43 20 15.5 20H8.5C6.57 20 5 18.43 5 16.5Z"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinejoin="round"
    />
    <path
      d="M8.5 15.25L10.65 11.2L12.7 13.75L15.5 9.8"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="15.5" cy="9.8" r="1.45" fill="currentColor" />
  </svg>
);

export const PlaneIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
);

export const MapIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 21s-6.5-5.35-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.65 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.25" />
  </svg>
);

export const GlobeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.6 9h16.8M3.6 15h16.8" />
    <path d="M12 3a13.5 13.5 0 0 0 0 18M12 3a13.5 13.5 0 0 1 0 18" />
  </svg>
);

export const SparklesIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m14.8 9.2-1.8 4.4-4.4 1.8 1.8-4.4 4.4-1.8z" />
  </svg>
);

export const WalletIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.75" />
    <path d="M16 12h5" />
    <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const SuitcaseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="7" width="16" height="13" rx="2.5" />
    <path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2" />
    <path d="M9 11.5h6M9 15h4" />
  </svg>
);

export const GridIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v3M16 3v3" />
    <path d="M8.5 13.5h7M8.5 17h4" />
  </svg>
);

export const CogIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h12M20 17h0" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="17" r="2" />
  </svg>
);

export const PlusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChevronLeftIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

export const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const ChevronUpIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 15l6-6 6 6" />
  </svg>
);

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const ArrowLongRightIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 12h15m-4-4l4 4-4 4" />
  </svg>
);

export const ArrowDownTrayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
);

export const CalendarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const ClockIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const HourglassIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6.5 3.5h11M6.5 20.5h11" />
    <path d="M7.5 3.5v4.2a4 4 0 0 0 1.6 3.2L12 12l2.9-1.1a4 4 0 0 0 1.6-3.2V3.5" />
    <path d="M7.5 20.5v-4.2a4 4 0 0 1 1.6-3.2L12 12l2.9 1.1a4 4 0 0 1 1.6 3.2v4.2" />
  </svg>
);

export const CoffeeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 9.5h11v4.5a5.5 5.5 0 0 1-11 0V9.5z" />
    <path d="M16 10.5h1.75a2.25 2.25 0 0 1 0 4.5H16M8.5 5.5v1.5M12.5 5.5v1.5" />
  </svg>
);

export const CartIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 4.5h2l2.2 9.5a1.5 1.5 0 0 0 1.46 1.17h8.74a1.5 1.5 0 0 0 1.45-1.13L20.5 8H6.2" />
    <circle cx="9.5" cy="19" r="1.25" />
    <circle cx="17" cy="19" r="1.25" />
  </svg>
);

export const ShoppingBagIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 8.5h12l1 11.5H5L6 8.5z" />
    <path d="M9 8.5V6.75a3 3 0 0 1 6 0V8.5" />
  </svg>
);

export const HomeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5z" />
    <path d="M9.5 20.5v-6h5v6" />
  </svg>
);

export const TagIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 10.5V5a1 1 0 0 1 1-1h5.5l8.8 8.8a1.5 1.5 0 0 1 0 2.1l-4.4 4.4a1.5 1.5 0 0 1-2.1 0L4 10.5z" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const CameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 8.5A2 2 0 0 1 6 6.5h2.2l1.3-2h5l1.3 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9z" />
    <circle cx="12" cy="13" r="3.25" />
  </svg>
);

export const DiningIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 4v7.5a2.5 2.5 0 0 0 5 0V4M9.5 4v16" />
    <path d="M16.5 4v16M16.5 4c2 0 2.75 2.2 2.75 4.8 0 1.8-.95 3.2-2.75 3.2" />
  </svg>
);

export const BusIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4.5" y="4" width="15" height="14.5" rx="2.5" />
    <path d="M4.5 12h15M7.5 18.5v2M16.5 18.5v2" />
    <circle cx="8" cy="15" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="16" cy="15" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const UsersIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="9.5" cy="8.5" r="3" />
    <path d="M4 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="16.5" cy="9.5" r="2.25" />
    <path d="M16.5 14.5a4.5 4.5 0 0 1 4 4.5" />
  </svg>
);

export const SunIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18" />
  </svg>
);

export const MoonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M19.5 14.2A7.5 7.5 0 0 1 9.8 4.5a7.5 7.5 0 1 0 9.7 9.7z" />
  </svg>
);

export const EditIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15.5 5.5l3 3L8.5 18.5H5.5v-3L15.5 5.5z" />
    <path d="M13 8l3 3" />
  </svg>
);

export const ShareIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4v10m0-10L8.5 7.5M12 4l3.5 3.5" />
    <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </svg>
);

export const InfoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11.5v5" />
    <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const ArchiveIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
    <path d="M5 8.5v9.5a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V8.5M10 12.5h4" />
  </svg>
);

export const LockClosedIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
  </svg>
);

export const LockOpenIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.75-1.3" />
  </svg>
);

export const TrashIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 6.5h15M9.5 4h5M7 6.5l.8 12a1.5 1.5 0 0 0 1.5 1.5h5.4a1.5 1.5 0 0 0 1.5-1.5l.8-12" />
  </svg>
);

export const NavigationArrowIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 11.5L19.5 4.5l-7 15-1.8-6.2-6.2-1.8z" />
  </svg>
);

export const ArrowsRightLeftIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 8h15m0 0-3-3m3 3-3 3M19.5 16h-15m0 0 3-3m-3 3 3 3" />
  </svg>
);

export const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="5.5" width="18" height="13" rx="2.25" />
    <path d="M3 10h18M7 14.5h4" />
  </svg>
);

export const BanknotesIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 12h.01M17.5 12h.01" />
  </svg>
);

export const TicketIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v2.25a2.25 2.25 0 0 0 0 4.5v2.25A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-2.25a2.25 2.25 0 0 0 0-4.5V7.5z" />
    <path d="M10 6v12" strokeDasharray="2 2.5" />
  </svg>
);

export const ShieldCheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3.5L5 6.5v5c0 4.6 3 8.1 7 9.5 4-1.4 7-4.9 7-9.5v-5l-7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const LinkIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3.17-3.17a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3.17 3.17a4 4 0 0 0 5.66 5.66l1.5-1.5" />
  </svg>
);

export const DocumentTextIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6.5 4h7.5l4.5 4.5V19a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5 19V5.5A1.5 1.5 0 0 1 6.5 4z" />
    <path d="M14 4v4.5h4.5M8.5 13h7M8.5 16.5h4.5" />
  </svg>
);

export const PhotoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.25" />
    <circle cx="8.5" cy="9.5" r="1.25" />
    <path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4" />
  </svg>
);

export const PaperClipIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15.5 7.5l-6.75 6.75a2.5 2.5 0 0 0 3.54 3.54l6.75-6.75a4.5 4.5 0 0 0-6.36-6.36L5.5 11.86" />
  </svg>
);

export const CloudIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 18h10.25a3.75 3.75 0 0 0 .5-7.47A5.25 5.25 0 0 0 7.6 8.85 3.75 3.75 0 0 0 7 18z" />
  </svg>
);

export const NewspaperIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="5" width="16" height="14" rx="2" />
    <path d="M8 9.5h8M8 13h8M8 16.5h5" />
  </svg>
);

export const ClipboardDocumentListIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="5" y="5" width="14" height="15.5" rx="2" />
    <path d="M9 5V3.75h6V5M9 10.5h6M9 14.5h6" />
  </svg>
);

export const DocumentDuplicateIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="8" y="8" width="11.5" height="12" rx="2" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-8A1.5 1.5 0 0 0 5 5.5v9A1.5 1.5 0 0 0 6.5 16H8" />
  </svg>
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5.5 12.5l4.25 4.25L18.5 8" />
  </svg>
);

export const ArchiveBoxArrowDownIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
    <path d="M5 8.5v9.5a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V8.5M12 11.5v5m0 0-2.5-2.5M12 16.5l2.5-2.5" />
  </svg>
);

export const XMarkIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);

export const RefreshIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5M4 4v4.5h4.5" />
    <path d="M4 13a8 8 0 0 0 14.6 4.5M20 20v-4.5h-4.5" />
  </svg>
);

export const ChartPieIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3.5v8.5h8.5A8.5 8.5 0 1 1 12 3.5z" />
    <path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15V3.8z" />
  </svg>
);

export const WifiIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 9.5a11.5 11.5 0 0 1 15 0M7.5 13a7.2 7.2 0 0 1 9 0M10.5 16.5a3 3 0 0 1 3 0" />
    <circle cx="12" cy="19.25" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const QrCodeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
    <path d="M14 14h2.5v2.5H14zM18.5 14v2M14 19h5.5M19.5 17.5v2" />
  </svg>
);

export const DevicePhoneMobileIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="6.5" y="3" width="11" height="18" rx="2.25" />
    <path d="M10.5 18h3" />
  </svg>
);

export const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="10.75" cy="10.75" r="6.25" />
    <path d="M15.5 15.5L20 20" />
  </svg>
);

export const ArrowUpTrayIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 15V4m0 0-4 4m4-4 4 4M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
  </svg>
);

export const ArrowUpRightIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export const EllipsisHorizontalIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="6.5" cy="12" r="1.4" />
    <circle cx="12" cy="12" r="1.4" />
    <circle cx="17.5" cy="12" r="1.4" />
  </svg>
);

export const BoltIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 3L5.5 13.5H12L11 21l7.5-10.5H12L13 3z" />
  </svg>
);

export const TranslateIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4.5 6.5h9M9 4.5v2M6.5 6.5c0 4 2.5 7 5.5 8.5M11.5 6.5c-.6 3.2-2.5 6-5.5 8" />
    <path d="M13.5 19.5l3.25-8 3.25 8M14.75 17h4" />
  </svg>
);

export const ComputerDesktopIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="4.5" width="17" height="12" rx="2.2" />
    <path d="M8.5 19.5h7M12 16.5v3" />
  </svg>
);

export const GripVerticalIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="9" cy="6.5" r="1.4" />
    <circle cx="15" cy="6.5" r="1.4" />
    <circle cx="9" cy="12" r="1.4" />
    <circle cx="15" cy="12" r="1.4" />
    <circle cx="9" cy="17.5" r="1.4" />
    <circle cx="15" cy="17.5" r="1.4" />
  </svg>
);

export const GoogleGIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export const AppleLogoIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16.365 12.695c-.022-2.263 1.849-3.355 1.934-3.407-1.055-1.54-2.696-1.751-3.277-1.775-1.383-.14-2.724.827-3.431.827-.719 0-1.805-.813-2.976-.791-1.515.023-2.931.894-3.711 2.256-1.599 2.771-.409 6.847 1.132 9.085.764 1.096 1.659 2.323 2.835 2.279 1.151-.046 1.582-.734 2.97-.734 1.379 0 1.775.734 2.977.708 1.236-.02 2.01-1.106 2.752-2.208.881-1.279 1.236-2.539 1.255-2.605-.028-.013-2.435-.932-2.46-3.635zM14.12 6.08c.624-.766 1.052-1.815.935-2.878-.904.04-2.028.613-2.677 1.369-.573.665-1.084 1.744-.953 2.77 1.015.077 2.061-.51 2.695-1.261z" />
  </svg>
);

export const UserCircleIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="9.5" r="2.6" />
    <path d="M7 18.2a6.2 6.2 0 0 1 10 0" />
  </svg>
);

export const CompassIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.55} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="15.8 8.2 13.7 13.7 8.2 15.8 10.3 10.3 15.8 8.2" />
  </svg>
);

export const StarIcon = ({ className, filled = false }: { className?: string; filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.6}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 3.5l2.65 5.38 5.93.86-4.29 4.18 1.01 5.91L12 17.04l-5.3 2.79 1.01-5.91-4.29-4.18 5.93-.86L12 3.5z" />
  </svg>
);

export const BookmarkIcon = ({ className, filled = false }: { className?: string; filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M18.5 20.5 12 15.75 5.5 20.5V5.5A2 2 0 0 1 7.5 3.5h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const HeartIcon = ({ className, filled = false }: { className?: string; filled?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20.2 5.2a5.2 5.2 0 0 0-7.35 0L12 6.06l-.85-.86a5.2 5.2 0 0 0-7.35 7.36l.85.85L12 20.5l7.35-7.09.85-.85a5.2 5.2 0 0 0 0-7.36z" />
  </svg>
);

export const PaperAirplaneIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21.5 2.5 10.5 13.5" />
    <path d="M21.5 2.5 14.5 21.5l-4-8-8-4 19-7z" />
  </svg>
);

export const SpeakerWaveIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.65}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M11 5.5 6.5 9H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5l4.5 3.5V5.5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.3 5.8a8.8 8.8 0 0 1 0 12.4" />
  </svg>
);

export const SpeakerXMarkIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.65}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M11 5.5 6.5 9H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5l4.5 3.5V5.5z" />
    <path d="m16 9.5 5 5m0-5-5 5" />
  </svg>
);




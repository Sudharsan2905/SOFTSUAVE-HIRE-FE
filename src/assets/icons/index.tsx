import React from "react";

interface IconProps {
  size?: number | string;
  color?: string;
  className?: string;
  strokeWidth?: number;
}

const icon = (paths: React.ReactNode, viewBox = "0 0 24 24") =>
  function Icon({ size = 18, color = "currentColor", className, strokeWidth = 1.8 }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };

export const IconDashboard = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </>
);
export const IconWorkspace = icon(
  <>
    <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
    <path d="M8 6v14M16 6v14" />
  </>
);
export const IconQuestionBank = icon(
  <path
    fill="currentColor"
    d="M226.67-80q-27 0-46.84-19.83Q160-119.67 160-146.67v-666.66q0-27 19.83-46.84Q199.67-880 226.67-880h506.66q27 0 46.84 19.83Q800-840.33 800-813.33v666.66q0 27-19.83 46.84Q760.33-80 733.33-80H226.67Zm0-66.67h506.66v-666.66h-66.66v270.66l-98-57.33-98 57.33v-270.66h-244v666.66Zm0 0v-666.66 666.66Zm244-396 98-57.33 98 57.33-98-57.33-98 57.33Z"
  />,
  "0 -1000 950 960"
);
export const IconAssessment = icon(
  <>
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 16h4" />
  </>
);
export const IconLiveInterview = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M5.27 5.27A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 7.07-2.93" />
    <path d="M18.73 18.73A10 10 0 0 0 22 12 10 10 0 0 0 12 2a10 10 0 0 0-6.36 2.27" />
  </>
);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </>
);
export const IconFilter = icon(<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />);
export const IconSort = icon(<path d="M3 6h18M7 12h10M11 18h2" />);
export const IconSortAsc = icon(
  <>
    <path d="M3 6h18" />
    <path d="M7 12h10" />
    <path d="M11 18h2" />
    <path d="M18 4v10M21 11l-3 3-3-3" />
  </>
);
export const IconSortDesc = icon(
  <>
    <path d="M3 6h18" />
    <path d="M7 12h10" />
    <path d="M11 18h2" />
    <path d="M18 14V4M21 7l-3-3-3 3" />
  </>
);
export const IconGrid = icon(
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </>
);
export const IconList = icon(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconEdit = icon(
  <>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </>
);
export const IconDelete = icon(
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </>
);
export const IconClose = icon(<path d="M18 6 6 18M6 6l12 12" />);
export const IconCheck = icon(<polyline points="20 6 9 17 4 12" />);
export const IconChevronDown = icon(<polyline points="6 9 12 15 18 9" />);
export const IconChevronRight = icon(<polyline points="9 18 15 12 9 6" />);
export const IconChevronLeft = icon(<polyline points="15 18 9 12 15 6" />);
export const IconChevronsRight = icon(
  <>
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </>
);
export const IconChevronsLeft = icon(
  <>
    <path d="m18 17-5-5 5-5" />
    <path d="m11 17-5-5 5-5" />
  </>
);
export const IconSettings = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);
export const IconUserPlus = icon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </>
);
export const IconUser = icon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
  </>
);
export const IconUsers = icon(
  <>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>
);
export const IconUserSetting = icon(
  <path
    fill="currentColor"
    stroke="none"
    d="M256.5 72C322.8 72 376.5 125.7 376.5 192C376.5 258.3 322.8 312 256.5 312C190.2 312 136.5 258.3 136.5 192C136.5 125.7 190.2 72 256.5 72zM226.7 368L286.1 368L287.6 368C274.7 394.8 279.8 426.2 299.1 447.5C278.9 469.8 274.3 503.3 289.7 530.9L312.2 571.3C313.1 572.9 314.1 574.5 315.1 576L78.1 576C61.7 576 48.4 562.7 48.4 546.3C48.4 447.8 128.2 368 226.7 368zM432.6 311.6C432.6 298.3 443.3 287.6 456.6 287.6L504.6 287.6C517.9 287.6 528.6 298.3 528.6 311.6L528.6 317.7C528.6 336.6 552.7 350.5 569.1 341.1L574.1 338.2C585.7 331.5 600.6 335.6 607.1 347.3L629.5 387.5C635.7 398.7 632.1 412.7 621.3 419.5L616.6 422.4C600.4 432.5 600.4 462.3 616.6 472.5L621.2 475.4C632 482.2 635.7 496.2 629.5 507.4L607 547.8C600.5 559.5 585.6 563.7 574 556.9L569.1 554C552.7 544.5 528.6 558.5 528.6 577.4L528.6 583.5C528.6 596.8 517.9 607.5 504.6 607.5L456.6 607.5C443.3 607.5 432.6 596.8 432.6 583.5L432.6 577.6C432.6 558.6 408.4 544.6 391.9 554.1L387.1 556.9C375.5 563.6 360.7 559.5 354.1 547.8L331.5 507.4C325.3 496.2 328.9 482.1 339.8 475.3L344.2 472.6C360.5 462.5 360.5 432.5 344.2 422.4L339.7 419.6C328.8 412.8 325.2 398.7 331.4 387.5L353.9 347.2C360.4 335.5 375.3 331.4 386.8 338.1L391.6 340.9C408.1 350.4 432.3 336.4 432.3 317.4L432.3 311.5zM532.5 447.8C532.5 419.1 509.2 395.8 480.5 395.8C451.8 395.8 428.5 419.1 428.5 447.8C428.5 476.5 451.8 499.8 480.5 499.8C509.2 499.8 532.5 476.5 532.5 447.8z"
  />,
  "0 0 640 640"
);
export const IconShare = icon(
  <>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </>
);
export const IconCopy = icon(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
);
export const IconMail = icon(
  <>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </>
);
export const IconDownload = icon(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </>
);
export const IconUpload = icon(
  <>
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </>
);
export const IconEye = icon(
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
export const IconEyeOff = icon(
  <>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </>
);
export const IconLock = icon(
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>
);
export const IconLogout = icon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </>
);
export const IconMoon = icon(<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);
export const IconSun = icon(
  <>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </>
);
export const IconCamera = icon(
  <>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </>
);
export const IconMic = icon(
  <>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </>
);
export const IconMonitor = icon(
  <>
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </>
);
export const IconClone = icon(
  <path
    fill="currentColor"
    stroke="none"
    d="M176 168C189.3 168 200 157.3 200 144C200 130.7 189.3 120 176 120C162.7 120 152 130.7 152 144C152 157.3 162.7 168 176 168zM256 144C256 176.8 236.3 205 208 217.3L208 240C208 266.5 229.5 288 256 288L384 288C410.5 288 432 266.5 432 240L432 217.3C403.7 205 384 176.8 384 144C384 99.8 419.8 64 464 64C508.2 64 544 99.8 544 144C544 176.8 524.3 205 496 217.3L496 240C496 301.9 445.9 352 384 352L352 352L352 422.7C380.3 435 400 463.2 400 496C400 540.2 364.2 576 320 576C275.8 576 240 540.2 240 496C240 463.2 259.7 435 288 422.7L288 352L256 352C194.1 352 144 301.9 144 240L144 217.3C115.7 205 96 176.8 96 144C96 99.8 131.8 64 176 64C220.2 64 256 99.8 256 144zM464 168C477.3 168 488 157.3 488 144C488 130.7 477.3 120 464 120C450.7 120 440 130.7 440 144C440 157.3 450.7 168 464 168zM344 496C344 482.7 333.3 472 320 472C306.7 472 296 482.7 296 496C296 509.3 306.7 520 320 520C333.3 520 344 509.3 344 496z"
  />,
  "0 0 640 640"
);
export const IconRefresh = icon(
  <>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </>
);
export const IconExternalLink = icon(
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>
);
export const IconAlertTriangle = icon(
  <>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>
);
export const IconInfo = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </>
);
export const IconDrag = icon(
  <>
    <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
  </>
);
export const IconWhatsApp = icon(
  <>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.12 1.534 5.857L0 24l6.29-1.511A11.935 11.935 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.006-1.374l-.359-.212-3.72.894.936-3.617-.234-.372A9.798 9.798 0 0 1 2.182 12C2.182 6.582 6.582 2.182 12 2.182c5.42 0 9.818 4.4 9.818 9.818 0 5.42-4.398 9.818-9.818 9.818z" />
  </>,
  "0 0 24 24"
);
export const IconBrain = icon(
  <>
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z" />
  </>
);
export const IconStar = icon(
  <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
);
export const IconSparkles = icon(
  <>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </>
);
export const IconFileExcel = icon(
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </>
);
export const IconTime = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>
);
export const IconChevronUp = icon(<polyline points="18 15 12 9 6 15" />);
export const IconGlobe = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>
);
export const IconShield = icon(
  <path
    fill="currentColor"
    stroke="none"
    d="M320 64C324.6 64 329.2 65 333.4 66.9L521.8 146.8C543.8 156.1 560.2 177.8 560.1 204C559.6 303.2 518.8 484.7 346.5 567.2C329.8 575.2 310.4 575.2 293.7 567.2C121.3 484.7 80.6 303.2 80.1 204C80 177.8 96.4 156.1 118.4 146.8L306.7 66.9C310.9 65 315.4 64 320 64z"
  />,
  "0 0 640 640"
);
export const IconInvalid = icon(
  <path
    fill="currentColor"
    stroke="none"
    d="M431.2 476.5L163.5 208.8C141.1 240.2 128 278.6 128 320C128 426 214 512 320 512C361.5 512 399.9 498.9 431.2 476.5zM476.5 431.2C498.9 399.8 512 361.4 512 320C512 214 426 128 320 128C278.5 128 240.1 141.1 208.8 163.5L476.5 431.2zM64 320C64 178.6 178.6 64 320 64C461.4 64 576 178.6 576 320C576 461.4 461.4 576 320 576C178.6 576 64 461.4 64 320z"
  />,
  "0 0 640 640"
);
export const IconNotStarted = icon(
  <path
    fill="currentColor"
    stroke="none"
    d="M160 64C142.3 64 128 78.3 128 96C128 113.7 142.3 128 160 128L160 139C160 181.4 176.9 222.1 206.9 252.1L274.8 320L206.9 387.9C176.9 417.9 160 458.6 160 501L160 512C142.3 512 128 526.3 128 544C128 561.7 142.3 576 160 576L480 576C497.7 576 512 561.7 512 544C512 526.3 497.7 512 480 512L480 501C480 458.6 463.1 417.9 433.1 387.9L365.2 320L433.1 252.1C463.1 222.1 480 181.4 480 139L480 128C497.7 128 512 113.7 512 96C512 78.3 497.7 64 480 64L160 64zM416 501L416 512L224 512L224 501C224 475.5 234.1 451.1 252.1 433.1L320 365.2L387.9 433.1C405.9 451.1 416 475.5 416 501z"
  />,
  "0 0 640 640"
);
export const IconBell = icon(
  <>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </>
);
export const IconCalendar = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </>
);
export const IconDotsVertical = icon(
  <>
    <circle cx="12" cy="5" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.3" fill="currentColor" stroke="none" />
  </>
);

/* ── Candidate detail tab icons (path-only) ── */
// "Over All" — a layout/overview pane.
export const IconOverview = icon(
  <>
    <path d="M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5z" />
    <path d="M4 9h16" />
    <path d="M9 9v11" />
  </>
);
// "Rounds" — stacked layers for the successive rounds.
export const IconRounds = icon(
  <>
    <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3z" />
    <path d="m3 12 9 4.5 9-4.5" />
    <path d="m3 16.5 9 4.5 9-4.5" />
  </>
);
// "Malpractice" — a shield with an alert mark.
export const IconMalpractice = icon(
  <>
    <path d="M12 3 5 6v5c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6l-7-3z" />
    <path d="M12 8.5v4" />
    <path d="M12 15.5h.01" />
  </>
);
// "Screenshots" — a capture/crop frame.
export const IconScreenshot = icon(
  <>
    <path d="M4 8V5a1 1 0 0 1 1-1h3" />
    <path d="M16 4h3a1 1 0 0 1 1 1v3" />
    <path d="M20 16v3a1 1 0 0 1-1 1h-3" />
    <path d="M8 20H5a1 1 0 0 1-1-1v-3" />
    <path d="M9 12h6" />
  </>
);
// "Resume" — a filled play triangle.
export const IconPlay = icon(<path fill="currentColor" stroke="none" d="M8 5v14l11-7z" />);
// "Terminate" — a power symbol.
export const IconPower = icon(
  <>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    <path d="M12 2v10" />
  </>
);

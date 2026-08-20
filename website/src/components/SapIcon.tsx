"use client";

import { forwardRef, HTMLAttributes } from "react";

/**
 * SAP Icon names mapped to their Unicode values from SAP-icons font
 * Reference: https://sapui5.hana.ondemand.com/sdk/#/api/sap.ui.core.IconPool
 */
const SAP_ICONS: Record<string, string> = {
  // Finance & Money
  "money-bills": "\ue148",
  "sales-order": "\ue120",
  "sales-quote": "\ue10c",
  "capital-projects": "\ue110",
  "payment-approval": "\ue1b5",
  "money-bills": "\ue148",
  "waiver": "\ue10d",
  "expense-report": "\ue0e4",
  
  // Business & Analytics
  "business-objects-experience": "\ue179",
  "business-objects-explorer": "\ue17a",
  "business-objects-mobile": "\ue17b",
  "bar-chart": "\ue073",
  "line-chart": "\ue074",
  "horizontal-bar-chart": "\ue075",
  "horizontal-stacked-chart": "\ue076",
  "vertical-bar-chart": "\ue077",
  "vertical-stacked-chart": "\ue078",
  "trend-up": "\ue0f0",
  "trend-down": "\ue0f1",
  "performance": "\ue0c5",
  "kpi-corporate-performance": "\ue12e",
  "kpi-managing-my-area": "\ue12f",
  "overview-chart": "\ue1bc",
  "analytics": "\ue197",
  
  // Time & Clock
  "time-entry-request": "\ue1b7",
  "time-overtime": "\ue1c5",
  "history": "\ue0f8",
  "lateness": "\ue0cf",
  "pending": "\ue1b3",
  "appointment": "\ue0a5",
  "calendar": "\ue050",
  "date-time": "\ue0a5",
  
  // Shield & Security
  "shield": "\ue24f",
  "locked": "\ue03e",
  "unlocked": "\ue03f",
  "key": "\ue0ac",
  "key-user-settings": "\ue1c3",
  "privacy": "\ue196",
  
  // Documents & Files
  "document": "\ue068",
  "document-text": "\ue069",
  "pdf-attachment": "\ue18c",
  "attachment": "\ue0eb",
  "form": "\ue1dc",
  "paper-plane": "\ue040",
  "official-service": "\ue195",
  
  // People & Users
  "employee": "\ue0c4",
  "group": "\ue060",
  "person-placeholder": "\ue0ce",
  "customer": "\ue0cc",
  "leads": "\ue0cd",
  "collaborate": "\ue061",
  "family-care": "\ue17e",
  "population": "\ue0c6",
  
  // Buildings & Organizations
  "factory": "\ue0c7",
  "building": "\ue0c8",
  "company-view": "\ue1ca",
  "org-chart": "\ue0c9",
  "world": "\ue083",
  "globe": "\ue083",
  
  // Technology & Systems
  "database": "\ue1e2",
  "cloud": "\ue0b6",
  "sap-logo-shape": "\ue1e1",
  "technical-object": "\ue0d4",
  "system-hana": "\ue1dd",
  "system-abap": "\ue1de",
  "it-host": "\ue0b7",
  "it-instance": "\ue0b8",
  "settings": "\ue070",
  "action-settings": "\ue071",
  "wrench": "\ue072",
  "tools-opportunity": "\ue10e",
  
  // Calculator & Math
  "calculator": "\ue1d6",
  "number-sign": "\ue1c6",
  "sum": "\ue18b",
  
  // Status & Actions
  "accept": "\ue05a",
  "decline": "\ue05b",
  "complete": "\ue05a",
  "error": "\ue05c",
  "warning": "\ue02e",
  "warning2": "\ue093",
  "alert": "\ue02e",
  "status-critical": "\ue093",
  "status-positive": "\ue05a",
  "status-negative": "\ue05b",
  "status-inactive": "\ue05e",
  "message-success": "\ue05a",
  "message-warning": "\ue02e",
  "message-error": "\ue05c",
  "message-information": "\ue045",
  
  // Navigation & UI
  "navigation-right-arrow": "\ue066",
  "navigation-left-arrow": "\ue067",
  "navigation-up-arrow": "\ue064",
  "navigation-down-arrow": "\ue065",
  "slim-arrow-right": "\ue06a",
  "slim-arrow-left": "\ue06b",
  "slim-arrow-up": "\ue068",
  "slim-arrow-down": "\ue069",
  "arrow-right": "\ue1ed",
  "arrow-left": "\ue1ee",
  "arrow-top": "\ue1ef",
  "arrow-bottom": "\ue1f0",
  "chevron-phase": "\ue1ea",
  "down": "\ue1fa",
  "up": "\ue1fb",
  "expand": "\ue08c",
  "collapse": "\ue08d",
  
  // Communication
  "email": "\ue017",
  "email-read": "\ue018",
  "phone": "\ue019",
  "call": "\ue019",
  "outgoing-call": "\ue01a",
  "incoming-call": "\ue01b",
  "message-popup": "\ue086",
  "comment": "\ue14b",
  "discussion": "\ue14c",
  "feed": "\ue14d",
  
  // Actions
  "add": "\ue001",
  "less": "\ue003",
  "delete": "\ue002",
  "edit": "\ue006",
  "save": "\ue007",
  "copy": "\ue00c",
  "paste": "\ue00d",
  "undo": "\ue00e",
  "redo": "\ue00f",
  "refresh": "\ue011",
  "sync": "\ue012",
  "search": "\ue015",
  "filter": "\ue016",
  "sort": "\ue08e",
  "download": "\ue0ab",
  "upload": "\ue0ac",
  "share": "\ue082",
  "action": "\ue0d0",
  "create": "\ue01e",
  "open-folder": "\ue0d2",
  "play": "\ue025",
  "pause": "\ue026",
  "stop": "\ue027",
  
  // Misc & Special
  "star": "\ue021",
  "star-empty": "\ue022",
  "favorite": "\ue021",
  "flag": "\ue023",
  "bookmark": "\ue024",
  "tag": "\ue05d",
  "tags": "\ue05f",
  "lightbulb": "\ue0d7",
  "idea-wall": "\ue0d8",
  "initiatives": "\ue0d9",
  "target-group": "\ue0da",
  "goal": "\ue0db",
  "mission": "\ue0dc",
  "puzzle": "\ue0dd",
  "solution": "\ue0de",
  "thumb-up": "\ue0df",
  "thumb-down": "\ue0e0",
  "palette": "\ue0e1",
  "picture": "\ue0e2",
  "video": "\ue0e3",
  "camera": "\ue0e4",
  "microphone": "\ue0e5",
  "music": "\ue0e6",
  "headset": "\ue0e7",
  "laptop": "\ue0e8",
  "desktop-mobile": "\ue0e9",
  "mobile": "\ue0ea",
  "theater": "\ue1bb",
  "trophy": "\ue1bd",
  "medal": "\ue1be",
  "badge": "\ue1bf",
  
  // Process & Workflow
  "workflow-tasks": "\ue0f2",
  "task": "\ue0f3",
  "checklist-item": "\ue0f4",
  "checklist": "\ue0f5",
  "checklist-2": "\ue0f6",
  "activities": "\ue0f7",
  "process": "\ue0fa",
  "journey-change": "\ue1c9",
  "journey-arrive": "\ue1cb",
  "journey-depart": "\ue1cc",
  
  // Languages & Localization
  "world": "\ue083",
  "translate": "\ue1e6",
  "character": "\ue1e7",
  
  // Layers & Structure
  "detail-view": "\ue094",
  "overview": "\ue095",
  "multi-select": "\ue096",
  "list": "\ue097",
  "table-view": "\ue098",
  "grid": "\ue099",
  "split": "\ue09a",
  "full-screen": "\ue09b",
  "exit-full-screen": "\ue09c",
  "resize": "\ue09d",
  "resize-horizontal": "\ue09e",
  "resize-vertical": "\ue09f",
  "crop": "\ue0a0",
  "rotate": "\ue0a1",
  "zoom-in": "\ue0a2",
  "zoom-out": "\ue0a3",
  
  // Energy & Rocket
  "energy-saving-lightbulb": "\ue1a0",
  "accelerated": "\ue1a1",
  "fuel-cell": "\ue1a2",
  "positive": "\ue1a3",
  "begin": "\ue1a4",
  "endoscopy": "\ue1a5",
  "sys-first-page": "\ue1a6",
  "sys-last-page": "\ue1a7",
  "sys-prev-page": "\ue1a8",
  "sys-next-page": "\ue1a9",
  
  // Specific to Finance/Tax
  "currency": "\ue1d0",
  "sales-document": "\ue1d1",
  "credit-card": "\ue1d2",
  "paid-leave": "\ue1d3",
  "unpaid-leave": "\ue1d4",
  "program-triangles": "\ue1e8",
  "program-triangles-2": "\ue1e9",
  
  // Additional icons for Company pages
  "heart": "\ue0e7",
  "favorite-list": "\ue087",
  "learning-assistant": "\ue1ba",
  "education": "\ue17f",
  "suitcase": "\ue0d3",
  "home": "\ue08a",
};

export interface SapIconProps extends HTMLAttributes<HTMLSpanElement> {
  /** The SAP icon name (e.g., "calculator", "shield", "money-bills") */
  name: keyof typeof SAP_ICONS | string;
  /** Size of the icon (inherits from parent font-size by default) */
  size?: number | string;
  /** Icon color (inherits from parent color by default) */
  color?: string;
}

/**
 * SapIcon - Renders SAP UI5 icons using the SAP-icons font
 * 
 * Usage:
 * ```tsx
 * <SapIcon name="calculator" size={24} className="text-blue-500" />
 * <SapIcon name="shield" size="1.5rem" color="#00d4ff" />
 * ```
 */
export const SapIcon = forwardRef<HTMLSpanElement, SapIconProps>(
  ({ name, size, color, style, className = "", ...props }, ref) => {
    const iconChar = SAP_ICONS[name] || "\ue000"; // Default to a placeholder if icon not found
    
    return (
      <span
        ref={ref}
        className={`sap-icon inline-flex items-center justify-center ${className}`}
        style={{
          fontFamily: "'SAP-icons'",
          fontSize: typeof size === "number" ? `${size}px` : size,
          color,
          lineHeight: 1,
          fontWeight: "normal",
          fontStyle: "normal",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          ...style,
        }}
        aria-hidden="true"
        {...props}
      >
        {iconChar}
      </span>
    );
  }
);

SapIcon.displayName = "SapIcon";

export default SapIcon;

export type TripType = 'Single' | 'Multi';

export interface Stop {
  id: number;
  destination: string;
  startDate: string;
  endDate: string;
}

export interface Budget {
  amount: number;
  currency: string;
  type: 'total' | 'cash_only';
  updatedAt?: number;
}

export type DocumentCategory = 'flight' | 'hotel' | 'ticket' | 'insurance' | 'other';

export interface DocumentItem {
  id: string;
  title: string;
  type: 'link' | 'note' | 'file';
  docCategory?: DocumentCategory;
  note?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  content: string;
  cloudFileId?: string;
  createdAt: string;
  updatedAt?: number;
}

export interface FlightInfo {
  flightNumber: string;
  planeType?: string;
  departureCode: string;
  arrivalCode: string;
  departureDate: string;
  departureTime: string;
  departureTimezone: string;
  arrivalDate: string;
  arrivalTime: string;
  arrivalTimezone: string;
  duration: string;
}

export interface Activity {
  id: string;
  time: string;
  title: string;
  location?: string;
  completed: boolean;
  type: 'sightseeing' | 'food' | 'transport' | 'flight';
  duration?: string;
  description?: string;
  flightInfo?: FlightInfo;
  updatedAt?: number;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  date: string;
  isPreTrip: boolean;
  paymentMethod: 'cash' | 'card' | 'other';
  splitCount?: number;
  updatedAt?: number;
}

export interface PackingItem {
  id: string;
  name: string;
  checked: boolean;
  category: string;
  updatedAt?: number;
}

export interface HotelBooking {
  id: string;
  name: string;
  address?: string;
  checkIn: string;
  checkOut: string;
  updatedAt?: number;
}

export interface Trip {
  id: string;
  syncId?: string;
  revision?: number;
  updatedAt?: number;
  metaUpdatedAt?: number;
  budgetUpdatedAt?: number;
  activitiesOrderUpdatedAt?: Record<string, number>;
  themesUpdatedAt?: Record<string, number>;
  tombstones?: Record<string, number>;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  type: TripType;
  stops?: Stop[];
  hotels?: HotelBooking[];
  activities: Record<string, Activity[]>;
  themes?: Record<string, string>;
  expenses: Expense[];
  packingList: PackingItem[];
  budget?: Budget;
  documents?: DocumentItem[];
}

export type ThemeMode = 'system' | 'light' | 'dark';

export enum Tab {
  ITINERARY = 'ITINERARY',
  EXPENSES = 'EXPENSES',
  PACKING = 'PACKING',
  TOOLBOX = 'TOOLBOX',
  SETTINGS = 'SETTINGS',
}

export type SyncConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface SyncDevice {
  clientId: string;
  deviceName: string;
  connectedAt: number;
}

export interface ItineraryActivity {
  time: string;
  activity: string;
  description: string;
  location: string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  activities: ItineraryActivity[];
}

export interface PackingCategory {
  category: string;
  items: string[];
}

export interface Phrase {
  original: string;
  pronunciation: string;
  translation: string;
  usageContext: string;
}

export interface FoodItem {
  name: string;
  description: string;
  priceRange: string;
  bestPlaceToTry: string;
}

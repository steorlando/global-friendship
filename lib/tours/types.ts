export type TourSettings = {
  publicEnabled: boolean;
  participantChangesEnabled: boolean;
};

export type TourOverview = {
  id: string;
  tourNumber: number;
  title: string;
  description: string;
  maxParticipants: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
  attachmentUrl: string | null;
  isActive: boolean;
  bookedCount: number;
  heldCount: number;
  waitlistCount: number;
  availableSpots: number;
  createdAt: string;
  updatedAt: string;
};

export type TourParticipantSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  group: string;
};

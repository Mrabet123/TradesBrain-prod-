export interface UserProfile {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  tradeType: string;
  accountType: 'solopreneur' | 'team_owner';
  hourlyRate: number;
  vatNumber: string;
  companyName: string | null;
  companyLogoUrl: string | null;
  licenseNumber: string;
  licenseProofUrl: string;
  nationalIdUrl: string | null;
  nationalIdKycStatus: 'not_uploaded' | 'pending' | 'verified' | 'rejected';
  licenseKycStatus: 'not_uploaded' | 'pending' | 'verified' | 'rejected';
  trialQueriesRemaining: number;
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'cancelled';
  planType: 'solo' | 'pro' | 'team' | null;
  subscriptionEndDate: string | null;
  stripeCustomerId: string | null;
  termsAcceptedAt: string;
  termsVersion: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamOwnerId: string;
  memberId: string;
  createdAt: string;
  isActive: boolean;
  temporaryPasswordSet: boolean;
}

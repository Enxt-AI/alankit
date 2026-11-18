export enum SellRequestStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONTACTED = 'CONTACTED',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export interface SellRequest {
  id: string;
  userId: string;
  stockId: string;
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  status: SellRequestStatus;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SellRequestWithDetails extends SellRequest {
  user: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
  stock: {
    id: string;
    name: string;
    logoUrl: string | null;
    price: number;
    cin: string | null;
  };
}

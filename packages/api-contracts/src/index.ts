import { IProduct, IOrder, ICart, IShift, IAIVoiceIntent, UserRole, OrderStatus } from '@cyborg/shared-types';

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    requestId?: string;
    timestamp?: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  errorCode?: string;
  timestamp: string;
  path: string;
}

export interface LoginDto {
  username_or_email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  phone: string;
  password: string;
  role?: UserRole;
}

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: UserRole;
  };
}

export interface ProductQueryDto {
  q?: string;
  category_id?: number;
  subcategory_id?: number;
  brand?: string;
  barcode?: string;
  min_price?: number;
  max_price?: number;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort_by?: 'price' | 'name' | 'created_at';
  sort_order?: 'ASC' | 'DESC';
}

export interface InventoryAdjustmentDto {
  product_id: number;
  store_id: number;
  delta_quantity: number;
  reason: 'RECEIVING' | 'DAMAGE' | 'AUDIT_CORRECTION' | 'RETURN';
  operator_id: string;
}

export interface CreateOrderDto {
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
  source: 'POS' | 'ONLINE' | 'FAMILY_CART';
  store_id: number;
  terminal_id?: string;
  shift_id?: string;
  delivery_address?: string;
  payment_method: string;
  idempotency_key: string;
}

export interface StartShiftDto {
  terminal_id: string;
  store_id: number;
  opening_balance: number;
}

export interface CloseShiftDto {
  shift_id: string;
  actual_counted_balance: number;
  notes?: string;
}

export interface SyncBatchDto {
  terminal_id: string;
  events: Array<{
    event_uuid: string;
    entity_type: string;
    entity_id: string;
    action: string;
    delta_payload: Record<string, any>;
    timestamp: string;
  }>;
}

export interface VoiceQueryDto {
  audio_base64?: string;
  text_prompt?: string;
  locale?: 'ar-EG' | 'en-US';
}

/**
 * Cyborg Supermarket - Core Shared Domain Types
 * Primary Source of Truth across Backend, Web, POS, and Mobile
 */

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  STORE_ADMIN = 'STORE_ADMIN',
  STORE_MANAGER = 'STORE_MANAGER',
  CASHIER = 'CASHIER',
  INVENTORY_OPERATOR = 'INVENTORY_OPERATOR',
  CUSTOMER = 'CUSTOMER',
  AUDITOR = 'AUDITOR',
}

export enum OrderSource {
  POS = 'POS',
  ONLINE = 'ONLINE',
  FAMILY_CART = 'FAMILY_CART',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  MOBILE_WALLET = 'MOBILE_WALLET',
  SIMULATED_MADA = 'SIMULATED_MADA',
  SIMULATED_FAWRY = 'SIMULATED_FAWRY',
}

export enum SyncAction {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface ICategory {
  id: number;
  name_ar: string;
  name_en: string;
  parent_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface IProduct {
  id: number;
  barcode: string;
  name_ar: string;
  name_en: string;
  category_id: number;
  category_name_en?: string;
  category_name_ar?: string;
  subcategory_id?: number | null;
  subcategory_name_en?: string;
  subcategory_name_ar?: string;
  brand?: string | null;
  country: string;
  size?: string | null;
  format: string;
  price: number; // in EGP
  image_url?: string | null;
  gallery_urls?: string[];
  embedding?: number[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IInventory {
  id: number;
  product_id: number;
  store_id: number;
  quantity: number;
  reserved_qty: number;
  available_qty: number;
  low_stock_threshold: number;
  version: number;
  updated_at: string;
}

export interface ICartItem {
  id?: number;
  product_id: number;
  product?: IProduct;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ICart {
  id: string;
  user_id?: string | null;
  is_family_cart: boolean;
  budget_limit?: number | null;
  items: ICartItem[];
  subtotal: number;
  tax: number;
  total: number;
  updated_at: string;
}

export interface IFamilyMember {
  id: number;
  family_cart_id: string;
  user_id: string;
  user_name: string;
  role: 'OWNER' | 'MEMBER';
  spend_limit: number;
  current_spend: number;
}

export interface IOrderItem {
  id: number;
  order_id: string;
  product_id: number;
  product_name_en: string;
  product_name_ar: string;
  barcode: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface IOrder {
  id: string;
  user_id?: string | null;
  customer_name?: string | null;
  source: OrderSource;
  status: OrderStatus;
  shift_id?: string | null;
  store_id: number;
  terminal_id?: string | null;
  items: IOrderItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
  delivery_address?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IShift {
  id: string;
  cashier_id: string;
  cashier_name: string;
  terminal_id: string;
  store_id: number;
  opening_balance: number;
  closing_balance?: number | null;
  actual_counted_balance?: number | null;
  discrepancy?: number | null;
  total_transactions: number;
  total_cash_sales: number;
  total_card_sales: number;
  total_refunds: number;
  started_at: string;
  ended_at?: string | null;
  is_closed: boolean;
}

export interface ISyncEvent {
  id: number;
  event_uuid: string;
  entity_type: 'PRODUCT' | 'INVENTORY' | 'ORDER' | 'SHIFT';
  entity_id: string;
  action: SyncAction;
  delta_payload: Record<string, any>;
  origin_terminal_id?: string;
  synced: boolean;
  created_at: string;
}

export interface IAIVoiceIntent {
  intent: 'ADD_TO_CART' | 'SEARCH_PRODUCT' | 'CHECK_PRICE' | 'REORDER' | 'UNKNOWN';
  raw_query: string;
  normalized_query: string;
  confidence: number;
  entities: {
    product_name?: string;
    category?: string;
    quantity?: number;
    size?: string;
  };
  suggested_action?: string;
  matched_products?: IProduct[];
}

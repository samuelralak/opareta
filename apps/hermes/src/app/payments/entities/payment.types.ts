export enum PaymentStatus {
  INITIATED = 'INITIATED',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum PaymentCurrency {
  UGX = 'UGX',
  USD = 'USD',
}

export enum PaymentMethod {
  MOBILE_MONEY = 'MOBILE_MONEY',
}

export type StatusTrigger = 'SYSTEM' | 'WEBHOOK' | 'ADMIN';

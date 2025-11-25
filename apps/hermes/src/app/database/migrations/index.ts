import { EnableUuidExtension1764062223262 } from './1764062223262-EnableUuidExtension';
import { CreatePaymentsTable1764095921091 } from './1764095921091-CreatePaymentsTable';
import { CreatePaymentStatusLogsTable1764096099871 } from './1764096099871-CreatePaymentStatusLogsTable';
import { CreateWebhookEventsTable1764096260081 } from './1764096260081-CreateWebhookEventsTable';

export const migrations = [
  EnableUuidExtension1764062223262,
  CreatePaymentsTable1764095921091,
  CreatePaymentStatusLogsTable1764096099871,
  CreateWebhookEventsTable1764096260081,
];

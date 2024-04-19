export enum EventType {
  CREATED = 'PRODUCT_CREATED',
  UPDATED = 'PRODUCT_UPDATED',
  DELETED = 'PRODUCT_DELETED',
}

export interface Event {
  requestId: string;
  eventType: EventType;
  productId: string;
  productCode: string;
  productPrice: number;
  email: string;
}

export class EventsRepository {
}
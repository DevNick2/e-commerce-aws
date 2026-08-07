import { DocumentClient } from "aws-sdk/clients/dynamodb"

// interface do evento de pedido da tabela
export interface OrderEventDdb {
  pk: string,
  sk: string,
  ttl: number,
  email: string,
  createdAt: number,
  requestId: string,
  eventType: string,
  info: {
    orderId: string,
    productCodes: string[],
    messageId: string
  }
}

export class OrderEventRepository {
  private ddbClient: DocumentClient
  private eventsDdb: string

  constructor(ddbCLient: DocumentClient, eventsDdb: string) {
    this.ddbClient = ddbCLient
    this.eventsDdb = eventsDdb
  }

  createOrderEvent (orderEvent: OrderEventDdb) {
    return this.ddbClient.put({
      TableName: this.eventsDdb,
      Item: orderEvent
    }).promise() 
  }
}
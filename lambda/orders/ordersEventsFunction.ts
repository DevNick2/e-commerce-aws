import { AWSError, DynamoDB } from 'aws-sdk'
import { Context, SNSEvent, SNSMessage } from 'aws-lambda'
import * as AWSXray from 'aws-xray-sdk'

import { OrderEventDdb, OrderEventRepository } from '/opt/nodejs/ordersEventsRepositoryLayer'
import { Envelope, OrderEvent } from '/opt/nodejs/ordersEventsLayer'
import { PromiseResult } from 'aws-sdk/lib/request'

AWSXray.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const ddbCLient = new DynamoDB.DocumentClient()
const orderEventsRepository = new OrderEventRepository(ddbCLient, eventsDdb)

export async function handler (event: SNSEvent, context: Context): Promise<void> {
  
  let recordsPromises: Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>>[] = []

  event.Records.forEach(record => recordsPromises.push(createEvent(record.Sns)))

  // Permite a execução da funções paralelas
  await Promise.all(recordsPromises)

  return
}

// lambda functions não podem sair do contexto de execução da função
// deixando operações assincronas pendentes
function createEvent(body: SNSMessage) {
  const envelop = JSON.parse(body.Message) as Envelope
  const event = JSON.parse(envelop.data) as OrderEvent

  console.log(`Order Event - MessageId: ${body.MessageId}`)

  const timestamp = Date.now()
  const ttl = ~~(timestamp / 10000 + 5 * 60)
  const orderEventDdb: OrderEventDdb = {
    pk: `#order_${event.orderId}`,
    sk: `${envelop.eventType}#${timestamp}`,
    ttl,
    email: event.email,
    createdAt: timestamp,
    requestId: event.requestId,
    eventType: envelop.eventType,
    info: {
      orderId: event.orderId,
      productCodes: event.productCodes,
      messageId: body.MessageId
    },

  }

  return orderEventsRepository.createOrderEvent(orderEventDdb)
}
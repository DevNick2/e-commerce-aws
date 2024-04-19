import { DynamoDB } from 'aws-sdk'
import * as AWSXray from 'aws-xray-sdk'
import { Event } from "/opt/nodejs/eventsLayer";
import { Callback, Context } from 'aws-lambda';

AWSXray.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()
// const eventsRepository = new EventsRepository(ddbClient, eventsDdb)

// Esta função sera executada por outra função
/* esta função vai receber uma requisição rest com verbo http */
export async function handler(event: Event, context: Context, callback: Callback): Promise<void> {
  // o context é o contexto da função
  // identificador da função lambda, serve para 
  // monitorar e identificar a função
  const lambdaRequestId = context.awsRequestId

  // identificador do request que veio do cliente/api
  // const apiRequestId = event.requestContext.requestId

  // Isto aqui vai aparecer no cloudWatch
  // sempre que executa o console.log, registra
  // o log no cloudWatch
  // gerar logs consome CPU e memória além do tempo de execução
  // console.log(`API Gateway requestID: ${apiRequestId} - Lambda RequuestId: ${lambdaRequestId}`)

  // const httpMethod = event.httpMethod

  await createEvent(event)

  callback(null, JSON.stringify({
    productEventCreated: true,
    message: 'ok'
  }))
}

function createEvent(event: Event) {
  const timestamp = Date.now()

  const ttl = ~~(timestamp / 1000) + 5 * 60  // 5 minutos a frente de now(), arredondado para cima

  return ddbClient.put({
    TableName: eventsDdb,
    Item: {
      pk: `#product_${event.productCode}`,
      sk: `${event.eventType}#${timestamp}`,
      email: event.email,
      createdAt: timestamp,
      requestId: event.requestId,
      eventType: event.eventType,
      info: {
        productId: event.productId,
        price: event.productPrice
      },
      ttl
    }
  }).promise()
}
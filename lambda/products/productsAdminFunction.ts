import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository, Product } from "/opt/nodejs/productsLayer"
import { DynamoDB, Lambda } from 'aws-sdk'
import * as AWSXray from 'aws-xray-sdk'
import { Event, EventType } from "/opt/nodejs/eventsLayer";

AWSXray.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const productEventFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME! // nome da função eventsFetchFunction
const ddbClient = new DynamoDB.DocumentClient()
const productRepository = new ProductRepository(ddbClient, productsDdb)
const lambdaClient = new Lambda() // necessário para invocar outras funções lambda

/* esta função vai receber uma requisição rest com verbo http */
export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  // o context é o contexto da função
  // identificador da função lambda, serve para 
  // monitorar e identificar a função
  const lambdaRequestId = context.awsRequestId

  // identificador do request que veio do cliente/api
  const apiRequestId = event.requestContext.requestId

  // Isto aqui vai aparecer no cloudWatch
  // sempre que executa o console.log, registra
  // o log no cloudWatch
  // gerar logs consome CPU e memória além do tempo de execução
  console.log(`API Gateway requestID: ${apiRequestId} - Lambda RequuestId: ${lambdaRequestId}`)

  const httpMethod = event.httpMethod
  // cliente acessando o recurso /products no verbo GET
  if (event.resource === '/products') {
    const product = JSON.parse(event.body!) as Product

    const result = await productRepository.createProduct(product)
    const eventResponse = await sendEvent(result, EventType.CREATED, 'um@gmail.com', lambdaRequestId)

    console.log(eventResponse)

    return {
      statusCode: 201,
      body: JSON.stringify(result)
    }
  } else if (event.resource === '/products/{id}') {
    const productId = event.pathParameters!.id as string

    if (httpMethod === 'PUT') {
      const product = JSON.parse(event.body!) as Product

      try {
        const updated = await productRepository.updateProduct(productId, product)
        const eventResponse = await sendEvent(updated, EventType.UPDATED, 'outro@gmail.com', lambdaRequestId)

        console.log(eventResponse)
    
        return {
          statusCode: 200,
          body: JSON.stringify(updated)
        }
      } catch (ConditionalCheckFailedException) {
        // Quando passa um id de um produto que não existe
        // o respository vai retornar um ConditionalCheckFailedException
        return {
          statusCode: 404,
          body: 'Product not found'
        }
      }
    } else if (httpMethod === 'DELETE') {
      try {
        const result = await productRepository.deleteProduct(productId)
        const eventResponse = await sendEvent(result, EventType.DELETED, 'maisum@gmail.com', lambdaRequestId)

        console.log(eventResponse)  
    
        return {
          statusCode: 200,
          body: JSON.stringify(result)
        }
      } catch(e) {
        console.error((<Error>e).message)

        return {
          statusCode: 404,
          body: (<Error>e).message
        }        
      }
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({ message: 'Bad request' })
  }
}

function sendEvent(product: Product, eventType: EventType, email: string, lambdaRequestId: string) {
  const event: Event = {
    email: email,
    eventType: eventType,
    productCode: product.code,
    productId: product.id,
    productPrice: product.price,
    requestId: lambdaRequestId
  }

  // Invocando a função eventsFetchFunction
  return lambdaClient.invoke({
    FunctionName: productEventFunctionName,
    Payload: JSON.stringify(event), // é que vai por parametro para o handler da função eventsFetchFunction
    InvocationType: 'Event' // indica para o SDK que vai ser feito uma invocação SINCRONA: RequestResponse: Sincrona, Event: Assincrona
  }).promise()
}
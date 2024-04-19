import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository } from "/opt/nodejs/productsLayer"
import { DynamoDB } from 'aws-sdk'
import * as AWSXray from 'aws-xray-sdk'

AWSXray.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()
const productRepository = new ProductRepository(ddbClient, productsDdb)

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
    if (httpMethod === 'GET') {
      const products = await productRepository.getAllProducts()

      return {
        statusCode: 200,
        body: JSON.stringify(products)
      }
    }
  } else if (event.resource === '/products/{id}') {
    // o id que vem na URL
    const productId = event.pathParameters!.id as string

    try {
      const product = await productRepository.getProductById(productId)

      return {
        statusCode: 200,
        body: JSON.stringify(product)
      }
    } catch(e) {
      console.error((<Error>e).message)

      return {
        statusCode: 404,
        body: (<Error>e).message
      }
    }
  }

  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad request'
    })
  }
}
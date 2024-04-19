import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { ProductRepository, Product } from "/opt/nodejs/productsLayer"
import { DynamoDB, Lambda } from 'aws-sdk'
import * as AWSXray from 'aws-xray-sdk'
import { Event, EventType } from "/opt/nodejs/eventsLayer";
import { OrdersRepository, Order } from "/opt/nodejs/ordersLayer";
import { CarrierType, OrderProductResponse, OrderRequest, OrderResponse, PaymentType, ShippingType } from "/opt/nodejs/ordersApiLayer";

AWSXray.captureAWS(require('aws-sdk'))

const ordersDdb = process.env.ORDERS_DDB!
const productsDdb = process.env.PRODUCTS_DDB!

const ddbClient = new DynamoDB.DocumentClient()

const orderReposistory = new OrdersRepository(ddbClient, ordersDdb)
const productRepository = new ProductRepository(ddbClient, productsDdb)

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

  const method = event.httpMethod
  const apiRequestId = event.requestContext.requestId
  const lambdaRequestId = context.awsRequestId

  console.log(`API Gateway RequestId: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`)

  if (method === 'GET') {
    console.log('GET /orders')

    if (event.queryStringParameters) {  
      const email = event.queryStringParameters!.email
      const orderId = event.queryStringParameters!.orderId

      if (email) {
        if (orderId) {
          try {
            const order = await orderReposistory.getOrderByIdEmail(email, orderId)

            return {
              statusCode: 200,
              body: JSON.stringify(convertToOrderResponse(order))
            }
          } catch(e) {
            console.log((<Error>e).message)

            return {
              statusCode: 404,
              body: (<Error>e).message
            }
          }
        } else {
          // Busca todos os pedidos do usuario
          const orders = await orderReposistory.getOrderByEmail(email)

          return {
            statusCode: 200,
            body: JSON.stringify(orders.map(convertToOrderResponse))
          }
        }
      }
    } else {
      const orders = await orderReposistory.getAllOrders()

      return {
        statusCode: 200,
        body: JSON.stringify(orders.map(convertToOrderResponse))
      }
    }
  }
  if (method === 'POST') {
    console.log('POST /orders')

    const orderRequest = JSON.parse(event.body!) as OrderRequest
    // Buscando todos os produtos pelo ID na hora de criar um pedido
    const products = await productRepository.getProductsByIds(orderRequest.productIds)

    if (products.length === orderRequest.productIds.length) {
      const order = buildOrder(orderRequest, products)
      const orderCreated = await orderReposistory.createOrder(order)

      return {
        statusCode: 201,
        body: JSON.stringify(convertToOrderResponse(orderCreated))
      }

    } else {
      return {
        statusCode: 404,
        body: 'Some product was not found'
      }
    }
  }
  if (method === 'DELETE') {
    console.log('DELETE /orders')

    const email = event.queryStringParameters!.email!
    const orderId = event.queryStringParameters!.orderId!

    try {
      const orderDeleted = await orderReposistory.deleteOrder(email, orderId)
  
      return {
        statusCode: 200,
        body: JSON.stringify(convertToOrderResponse(orderDeleted))
      }
    } catch (e) {
      console.log((<Error>e).message)

      return {
        statusCode: 404,
        body: (<Error>e).message
      }
    }
  }
  
  return {
    statusCode: 400,
    body: 'Bad Request'
  }
}
/* 
  Converter um pedido para um response

  @params: order = veio da tabela do banco
*/

function convertToOrderResponse(order: Order): OrderResponse {
  const orderProducts: OrderProductResponse[] = []

  order.products.forEach(product => {
    orderProducts.push({
      code: product.code,
      price: product.price
    })
  })

  const orderResponse: OrderResponse = {
    email: order.pk, // o email é a partition key (???????)
    id: order.sk,
    createdAt: order.createdAt!,
    products: orderProducts,
    billing: {
      payment: order.billing.payment as PaymentType,
      totalPrice: order.billing.totalPrice
    },
    shipping: {
      type: order.shipping.type as ShippingType,
      carrier: order.shipping.carrier as CarrierType
    }
  }

  return orderResponse
}

/*
  Função responsável por fazer a conversão entre o Order e productsIds

  será utilizado para criar um novo pedido (order)
*/
function buildOrder(orderRequest: OrderRequest, products: Product[]): Order {
  const orderProducts: OrderProductResponse[] = []

  let totalPrice = 0

  products.forEach(product => {
    totalPrice += product.price
    orderProducts.push({
      code: product.code,
      price: product.price
    })
  })

  const order: Order = {
    pk: orderRequest.email,
    billing: {
      payment: orderRequest.payment,
      totalPrice
    },
    shipping: {
      type: orderRequest.shipping.type,
      carrier: orderRequest.shipping.carrier
    },
    products: orderProducts
  }

  return order
}
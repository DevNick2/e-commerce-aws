import { DocumentClient } from 'aws-sdk/clients/dynamodb' // este sdk ja esta presente no ambiente de execução da aws
import { v4 as uuid } from 'uuid'

export interface OrderProduct {
  code: string;
  price: number;
}
export interface Order {
  pk: string;
  sk: string;
  createdAt?: number,
  shipping: {
    type: "URGENT" | "ECONOMIC", // informando que é uma string e que vai aceitar apenas as duas opções
    carrier: "CORREIOS" | "FEDEX"
  },
  billing: {
    payment: "CASH" | "DEBIT_CARD" | "CREDIT_CARD",
    totalPrice: number
  },
  products: OrderProduct[]
}

export class OrdersRepository {
  private ddbClient: DocumentClient
  private tableName: string

  constructor(ddbClient: DocumentClient, tableName: string) {
    this.ddbClient = ddbClient
    this.tableName = tableName
  }

  
  // Espera o retorno de uma lista da interface
  // Product
  async getAllOrders(): Promise<Order[]> {
    // Busca todos os itens na tabela
    // que foi passada em this.productsDdb
    const data = await this.ddbClient.scan({
      TableName: this.tableName
    }).promise()

    // retornando os itens usando a interface
    // definido acima
    // Fazendo um cast de Order
    return data.Items as Order[]
  }

  // Buscando todos os pedidos do email
  async getOrderByEmail(email: string): Promise<Order[]> {
    const data = await this.ddbClient.query({ // operação mais eficiente, util para pesquisas com chaves compostas ou indexadas
      TableName: this.tableName,
      KeyConditionExpression: "pk = :email",
      ExpressionAttributeValues: {
        ":email": email
      }
    }).promise()

    return data.Items as Order[]
  }
  
  async getOrderByIdEmail(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient.get({
      TableName: this.tableName,
      Key: {
        pk: email,
        sk: orderId
      }
    }).promise()

    if (data.Item) {
      return data.Item as Order
    } else {
      throw new Error('Order not found')
    }
  }

  async createOrder(order: Order): Promise<Order> {
    order.sk = uuid()
    order.createdAt = Date.now()

    // Criando um novo item
    await this.ddbClient.put({
      TableName: this.tableName,
      Item: order
    }).promise()

    return order
  }

  async deleteOrder(email: string, orderId: string): Promise<Order> {
    const data = await this.ddbClient.delete({
      TableName: this.tableName,
      Key: {
        pk: email,
        sk: orderId
      },
      ReturnValues: 'ALL_OLD', // o que vai retornar desta operação, ALL_OLD siginifica retornar tudo que tinha antes da operação
    }).promise()

    if (data.Attributes) {
      return data.Attributes as Order
    } else {
      throw new Error('Order not found')
    }
  }
}
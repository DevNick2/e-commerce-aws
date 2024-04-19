import { DocumentClient } from 'aws-sdk/clients/dynamodb' // este sdk ja esta presente no ambiente de execução da aws
import { v4 as uuid } from 'uuid'

// Repositório responsável pela construção da tabela,
// vamos usar uma lambda layer para reaproveitar
// em outras stacks
export interface Product {
  id: string;
  productName: string;
  code: string;
  price: number;
  model: string;
  productUrl: string;
}

export class ProductRepository {
  private ddbClient: DocumentClient // client que acessa o banco
  private productsDdb: string // nome da tabela, vai receber por parametro

  constructor(ddbClient: DocumentClient, productsDdb: string) {
    this.ddbClient = ddbClient
    this.productsDdb = productsDdb
  }

  // Espera o retorno de uma lista da interface
  // Product
  async getAllProducts(): Promise<Product[]> {
    // Busca todos os itens na tabela
    // que foi passada em this.productsDdb
    const data = await this.ddbClient.scan({
      TableName: this.productsDdb
    }).promise()

    // retornando os itens usando a interface
    // definido acima
    return data.Items as Product[]
  }

  async getProductById(productId: string): Promise<Product> {
    const data = await this.ddbClient.get({
      TableName: this.productsDdb,
      // Fazendo a busca pela chave primaria simples id
      Key: {
        id: productId
      }
    }).promise()

    if (data.Item) {
      // Fazendo um cast de Product
      return data.Item as Product
    } else {
      throw new Error('Product not found')
    }
  }

  async getProductsByIds(productIds: string[]): Promise<Product[]> {
    const keys: { id: string; }[] = []

    productIds.forEach(id => keys.push({ id }))

    const data = await this.ddbClient.batchGet({
      RequestItems: {
        [this.productsDdb]: {
          Keys: keys
        }
      }
    }).promise()

    return data.Responses![this.productsDdb] as Product[]
  }

  async createProduct(product: Product): Promise<Product> {
    product.id = uuid()

    // Criando um novo item
    await this.ddbClient.put({
      TableName: this.productsDdb,
      Item: product
    }).promise()

    return product
  }

  async deleteProduct(productId: string): Promise<Product> {
    const data = await this.ddbClient.delete({
      TableName: this.productsDdb,
      Key: {
        id: productId
      },
      ReturnValues: 'ALL_OLD', // o que vai retornar desta operação, ALL_OLD siginifica retornar tudo que tinha antes da operação
    }).promise()

    // data.Attributes, é todos os atributos que tinha antes da operação,
    // se retornar algo, significa que encontrou algo e executou a operação
    // se não, é pq não encotrou o item com a Key.id
    // somente com o ReturnValues: 'ALL_OLD'
    if (data.Attributes) {
      return data.Attributes as Product
    } else {
      throw new Error('Product not found')
    }
  }

  async updateProduct(productId: string, product: Product): Promise<Product> {
    const data = await this.ddbClient.update({
      TableName: this.productsDdb,
      Key: {
        id: productId
      },
      ConditionExpression: 'attribute_exists(id)', // só vai executar a operação se o atributo especifico existir
      ReturnValues: 'UPDATED_NEW', // retorna o valor que foi alterado, diferente do ALL_OLD que é tudo antes da operação
      UpdateExpression: 'set productName = :n, code = :c, price = :p, model = :m, productUrl = :u', // seleciona os atributos a serem alterados
      ExpressionAttributeValues: { // faz a atualização dos valores com chave(:n, :c, :p, :m) = valor (product.[chave])
        ':n': product.productName,
        ':c': product.code,
        ':p': product.price,
        ':m': product.model,
        ':u': product.productUrl
      }
    }).promise()

    // se o attributes retornar cria o id e atribui a ele o productId
    data.Attributes!.id = productId

    return data.Attributes as Product
  }
  // delete
}
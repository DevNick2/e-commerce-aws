import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apiGateway from 'aws-cdk-lib/aws-apigateway'
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

interface ECommerceApiStackProps extends cdk.StackProps {
  productsFetchHandler: lambdaNodeJs.NodejsFunction,
  productsAdminHandler: lambdaNodeJs.NodejsFunction
  ordersHandler: lambdaNodeJs.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ECommerceApiStackProps) {
    super(scope, id, props)

    // são pastas que guardam os logs
    const logGroup = new cwlogs.LogGroup(this, 'ECommerceApiLogs')

    // RestApi ficam as validações de requisições
    // Criação do apiGateway
    const api = new apiGateway.RestApi(this, 'ECommerceApi', {
      restApiName: 'ECommerceApi', // nome da api
      cloudWatchRole: true,
      deployOptions: {
        // onde o api gateway guarda os logs
        accessLogDestination: new apiGateway.LogGroupLogDestination(logGroup),
        // formato dos logs
        accessLogFormat: apiGateway.AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true, // tempo da requisição
          resourcePath: true, // caminho da requisição
          responseLength: true, // tamanho do body da request
          status: true, // qual o status da função lambda
          caller: true, // quem invocou o api gateway
          user: true // informações do usuario que fez a requisição
        })
      }
    })

    this.setupProductsApi(api, props)
    this.setupOrdersApi(api, props)
  }

  private setupOrdersApi(api: apiGateway.RestApi, props: ECommerceApiStackProps) {
    const ordersIntegration = new apiGateway.LambdaIntegration(props.ordersHandler)

    const ordersResource = api.root.addResource('orders')

    // GET /orders || /orders?email=[]&orderId=[]
    ordersResource.addMethod('GET', ordersIntegration)
    // DELETE /orders?email=[email]&orderId=[]

    const orderDeletionValidator = new apiGateway.RequestValidator(this, 'OrdersDeletionValidator', {
      requestValidatorName: 'OrdersDeletionValidator',
      restApi: api,
      validateRequestParameters: true, // validando os parametros
      // validateRequestBody: true // valida o corpo da requisição
    })

    ordersResource.addMethod('DELETE', ordersIntegration, {
      requestParameters: {
        'method.request.querystring.email': true, // validando a query email como obrigatório,
        'method.request.querystring.orderId': true
      },
      requestValidator: orderDeletionValidator
    })

    const orderRequestValidator = new apiGateway.RequestValidator(this, 'OrderRequestValidator', {
      requestValidatorName: 'Order request validator',
      restApi: api, // qual api gateway será aplicado, neste caso nesta mesmo
      // validateRequestParameters: true, // validando os parametros
      validateRequestBody: true // valida o corpo da requisição
    })
    const orderModel = new apiGateway.Model(this, 'OrderModel', { // o model para usar na validação da requisição
      modelName: 'OrderModel',
      restApi: api,
      schema: { // o esquema do body da request
        type: apiGateway.JsonSchemaType.OBJECT, // tipo do body, definido como JSON
        properties: {
          email: {
            type: apiGateway.JsonSchemaType.STRING
          },
          productIds: {
            type: apiGateway.JsonSchemaType.ARRAY,
            minItems: 1, // pelo menos ter 1 id no array
            items: {
              type: apiGateway.JsonSchemaType.STRING // setando os itens do array para o tipo string
            }
          },
          payment: {
            type: apiGateway.JsonSchemaType.STRING,
            enum: ['CASH', 'DEBIT_CARD', 'CREDIT_CARD'] // definindo um enum com 3 valores possíveis, não vai aceitar outro
          }
        },
        required: [ // definindo quais props são obrigatórias
          'email',
          'productIds',
          'payment'
        ]
      }
    })

    // POST /orders
    ordersResource.addMethod('POST', ordersIntegration, {
      requestValidator: orderRequestValidator,
      requestModels: { // vai pegar a requisição e o corpo e análisar se as props estão corretas
        'application/json': orderModel
      }
    })
  }

  private setupProductsApi(api: apiGateway.RestApi, props: ECommerceApiStackProps) {    
    // Faz a integração do api gateway com o método productsFetchHandler productsApp-stack.ts
    const productsFetchIntegration = new apiGateway.LambdaIntegration(props.productsFetchHandler)

    // o root ja tem o "/"
    // estou adicionado ao root o /products
    const productsResource = api.root.addResource('products')

    // invoca o método que tem no productsApp-stack.ts
    // que por sua vez chama o arquivo lambda em lambda/products/productsFetchFunction
    productsResource.addMethod('GET', productsFetchIntegration)
    // Subrecurso do /products, a url /products/{id} vai receber um id e passar para
    // productsFetchIntegration
    const productIdResource = productsResource.addResource('{id}')
    productIdResource.addMethod('GET', productsFetchIntegration)

    // Faz a integração do api gateway com o método productsAdminHandler productsApp-stack.ts
    const productAdminIntegration = new apiGateway.LambdaIntegration(props.productsAdminHandler)

    const productRequestValidator = new apiGateway.RequestValidator(this, 'ProductRequestValidator', {
      requestValidatorName: 'Product Request Validator',
      restApi: api,
      validateRequestBody: true
    })
    const productRequestModel = new apiGateway.Model(this, 'ProductRequestModel', {
      restApi: api,
      modelName: 'ProductRequestModel',
      schema: {
        type: apiGateway.JsonSchemaType.OBJECT,
        properties: {
          productName: {
            type: apiGateway.JsonSchemaType.STRING
          },
          code: {
            type: apiGateway.JsonSchemaType.STRING
          },
          model: {
            type: apiGateway.JsonSchemaType.STRING
          },
          productUrl: {
            type: apiGateway.JsonSchemaType.STRING
          },
          price: {
            type: apiGateway.JsonSchemaType.NUMBER
          }          
        },
        required: [
          'productName',
          'code'
        ]
      }
    })
    // cria o método POST, PUT e DELETE para o productAdminIntegration
    // /products
    productsResource.addMethod('POST', productAdminIntegration, {
      requestValidator: productRequestValidator,
      requestModels: {
        'application/json': productRequestModel,
      }
    })

    // estou usando o productIdResource pois é o recurso que
    // tem a rota definida com /products/{id}
    productIdResource.addMethod('PUT', productAdminIntegration)
    productIdResource.addMethod('DELETE', productAdminIntegration)

  }
}

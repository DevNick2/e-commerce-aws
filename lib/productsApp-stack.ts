import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as db from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm' // recurso AWS Systems Manager para guardar paramatros na aws

import { Construct } from 'constructs'

interface productsAppStackProps extends cdk.StackProps {
  eventsDdb: db.Table,
}

export class ProductsAppStack extends cdk.Stack {
  readonly productsFetchHandler: lambdaNodeJs.NodejsFunction
  readonly productsAdminHandler: lambdaNodeJs.NodejsFunction
  readonly productsDdb: db.Table

  constructor(scope: Construct, id: string, props: productsAppStackProps) {
    super(scope, id, props)

    // Criando a tabela no dynamodb
    this.productsDdb = new db.Table(this, 'ProductsDdb', {
      tableName: 'products',
      // estratégia de remoção da tabela caso a stack seja removida, o padrão é,
      // se a stack for excluida, a tabela é mantida fora da stack
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: { // definição da chave primária
        name: 'id',
        type: db.AttributeType.STRING
      },
      billingMode: db.BillingMode.PROVISIONED, // modo de cobrança provisionado
      readCapacity: 1, // quantas requisições de leitura por segundo recebe, o padrão é 5
      writeCapacity: 1, // quantas requisições de escrita por segundo recebe, o padrão é 5
    })

    // Parameter Store Layer Events
    const eventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'EventsLayerVersionArn')
    const eventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'EventsLayerVersionArn', eventsLayerArn)

    const productEventsHandler = new lambdaNodeJs.NodejsFunction(this, 'EventsFetchFunction', {
      functionName: 'EventsFetchFunction',
      entry: 'lambda/products/eventsFetchFunction.ts',
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      layers: [eventsLayer],
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName,
      },
      runtime: lambda.Runtime.NODEJS_20_X,
      tracing: lambda.Tracing.ACTIVE, // gera impacto no custo da operação
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
    })
    props.eventsDdb.grantWriteData(productEventsHandler)

    // Parameter Store Layer Products
    const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn')
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

    this.productsFetchHandler = new lambdaNodeJs
      .NodejsFunction(this /* o scopo é esta classe */, 'ProductsFetchFunction' /* id da função */, {
        functionName: 'ProductsFetchFunction', // nome do lambda function
        entry: 'lambda/products/productsFetchFunction.ts', // arquivo do lambda function
        handler: 'handler', // função quue será executada, esta dentro do productsFetchFunction.ts
        memorySize: 512, // quantidade de memória para função executar, em megabytes,
        timeout: cdk.Duration.seconds(5), // tempo máximo de execução da função,
        bundling: { // como a função (do entry) vai ser empacotada
          minify: true, // diminui o código,
          sourceMap: false // desliga/liga a geração dos mapas para debug
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
        },
        layers: [productsLayer],
        runtime: lambda.Runtime.NODEJS_20_X,
        tracing: lambda.Tracing.ACTIVE, // gera impacto no custo da operação
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
      })

    // Concedendo a permissão de leitura a tabela a função productsFetchHandler
    // O recurso lambda function tem permissão de acessar o DynamoDb
    this.productsDdb.grantReadData(this.productsFetchHandler)

    this.productsAdminHandler = new lambdaNodeJs
      .NodejsFunction(this, 'ProductsAdminFunction', {
        functionName: 'ProductsAdminFunction', // nome do lambda function
        entry: 'lambda/products/productsAdminFunction.ts', // arquivo do lambda function
        handler: 'handler', // função quue será executada, esta dentro do productsFetchFunction.ts
        memorySize: 512, // quantidade de memória para função executar, em megabytes,
        timeout: cdk.Duration.seconds(5), // tempo máximo de execução da função,
        bundling: { // como a função (do entry) vai ser empacotada
          minify: true, // diminui o código,
          sourceMap: false // desliga/liga a geração dos mapas para debug
        },
        environment: {
          PRODUCTS_DDB: this.productsDdb.tableName,
          PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
        },
        layers: [productsLayer, eventsLayer],
        runtime: lambda.Runtime.NODEJS_20_X,
        tracing: lambda.Tracing.ACTIVE, // gera impacto no custo da operação
        insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
      })

    // Concedendo a permissão de leitura a tabela a função productsAdminHandler
    // O recurso lambda function tem permissão de acessar o DynamoDb
    this.productsDdb.grantWriteData(this.productsAdminHandler)
    productEventsHandler.grantInvoke(this.productsAdminHandler)
  }
}
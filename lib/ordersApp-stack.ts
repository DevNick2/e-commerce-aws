import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as db from 'aws-cdk-lib/aws-dynamodb'
import * as ssm from 'aws-cdk-lib/aws-ssm' // recurso AWS Systems Manager para guardar paramatros na aws
import * as sns from 'aws-cdk-lib/aws-sns'
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions'


import { Construct } from 'constructs'

interface OrdersAppStackProps extends cdk.StackProps {
  productsDdb: db.Table,
  eventsDdb: db.Table
}

export class OrdersAppStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJs.NodejsFunction

  constructor(scope: Construct, id: string, props: OrdersAppStackProps) {
    super(scope, id, props)

    // Importando os layers do parameter store:

    // Order Layer (Function)
    const ordersLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersLayerVersionArn') // busca o ARN do OrdersLayerVersionArn do parameter store
    const ordersLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersLayerVersionArn', ordersLayerArn) // instancia a função que busca pelo ARN do ordersLayerArn pelo lambda.LayerVersion
    
    // Order Api Layer (Api Gateway)
    const ordersApiLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersApiLayerVersionArn') // busca o ARN do OrdersApiLayerVersionArn do parameter store
    const ordersApiLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OrdersApiLayerVersionArn', ordersApiLayerArn) // instancia a função que busca pelo ARN do ordersApiLayerArn pelo lambda.LayerVersion
    
    // Product Layer (Function)
    const productLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn') // busca o ARN do ProductLayer do parameter store
    const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productLayerArn) // instancia a função que busca pelo ARN do productLayerArn pelo lambda.LayerVersion

    // Order Event Layer (Topico SNS)
    const orderEventLayerArn = ssm.StringParameter.valueForStringParameter(this, 'OrdersEventsLayerVersionArn') // busca o ARN do OrdersEventsLayerVersionArn do parameter store
    const orderEventLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'orderEventLayerArn', orderEventLayerArn) // instancia a função que busca pelo ARN do orderEventLayerArn pelo lambda.LayerVersion

    const ordersDdb = new db.Table(this, 'OrdersDdb', {
      tableName: 'orders',
      partitionKey: {
        name: 'pk',
        type: db.AttributeType.STRING
      },
      sortKey: {
        name: 'sk',
        type: db.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      billingMode: db.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1
    })

    // Criando uma instancia do SNS
    const ordersTopic = new sns.Topic(this, 'OrdersEventTopic', {
      displayName: 'OrdersEventTopic',
      topicName: 'order-event'
    })

    // Função de pedidos
    this.ordersHandler = new lambdaNodeJs.NodejsFunction(this, 'OrdersFunction', { // função de pedidos
      functionName: 'OrdersFunction',
      entry: 'lambda/orders/ordersFunction.ts',
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      layers: [ordersLayer, productsLayer, ordersApiLayer, orderEventLayer], // Adiciona os layers para compartilhar com a função de pedidos
      environment: {
        PRODUCTS_DDB: props.productsDdb.tableName,
        ORDERS_DDB: ordersDdb.tableName,
        ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn
      },
      runtime: lambda.Runtime.NODEJS_20_X,
      tracing: lambda.Tracing.ACTIVE, // gera impacto no custo da operação pois precisa gerar um trace nos logs
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
    })

    // Definindo permissões
    ordersDdb.grantReadWriteData(this.ordersHandler)
    props.productsDdb.grantReadData(this.ordersHandler)
    ordersTopic.grantPublish(this.ordersHandler) // Concedendo permissão para a função de pedidos publicar no SNS

    // Função dos eventos dos pedidos (SNS)
    const ordersEventsHandler = new lambdaNodeJs.NodejsFunction(this, 'OrdersEventsFunction', { // função de pedidos
      functionName: 'OrdersEventsFunction',
      entry: 'lambda/orders/orderEventsFunction.ts',
      handler: 'handler',
      memorySize: 512,
      timeout: cdk.Duration.seconds(2),
      bundling: {
        minify: true,
        sourceMap: false
      },
      environment: {
        EVENTS_DDB: props.eventsDdb.tableName
      },
      layers: [orderEventLayer], // Adiciona os layers para compartilhar com a função de pedidos
      runtime: lambda.Runtime.NODEJS_20_X,
      tracing: lambda.Tracing.ACTIVE, // gera impacto no custo da operação pois precisa gerar um trace nos logs
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
    })
    
    // inscrevendo a função ordersEventsHandler no SNS
    ordersTopic.addSubscription(new subs.LambdaSubscription(ordersEventsHandler))
  }
}

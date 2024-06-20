import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm' // recurso AWS Systems Manager para guardar paramatros na aws

import { Construct } from 'constructs'
export class OrdersAppLayerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const ordersLayer = new lambda.LayerVersion(this, 'OrdersLayer' /* Identificação lá no Cloud Formation */, {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersLayer'), // onde o código que vai ser executado esta
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      layerVersionName: 'OrdersLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Salva no parameter store (SSM) o ARN (Amazon Resource Name) do ordersLayer
    new ssm.StringParameter(this, 'OrdersLayerVersionArn' /* Identificação lá no Cloud Formation */, {
      parameterName: 'OrdersLayerVersionArn',
      stringValue: ordersLayer.layerVersionArn
    })
    
    const ordersApiLayer = new lambda.LayerVersion(this, 'OrdersApiLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersApiLayer'), // onde o código que vai ser executado esta
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      layerVersionName: 'OrdersApiLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Salva no parameter store (SSM) o ARN (Amazon Resource Name) do ordersApiLayer
    new ssm.StringParameter(this, 'OrdersApiLayerVersionArn' /* Identificação lá no Cloud Formation */, {
      parameterName: 'OrdersApiLayerVersionArn',
      stringValue: ordersApiLayer.layerVersionArn
    })

    const orderEventsLayer = new lambda.LayerVersion(this, 'OrderEventsLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersEventsLayer'), // onde o código que vai ser executado esta
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      layerVersionName: 'OrderEventsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // Salva no parameter store (SSM) o ARN (Amazon Resource Name) do orderEventsLayer
    new ssm.StringParameter(this, 'OrdersEventsLayerVersionArn' /* Identificação lá no Cloud Formation */, {
      parameterName: 'OrdersEventsLayerVersionArn',
      stringValue: orderEventsLayer.layerVersionArn
    })
  }
}
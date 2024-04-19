import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as ssm from 'aws-cdk-lib/aws-ssm' // recurso AWS Systems Manager para guardar paramatros na aws

import { Construct } from 'constructs'

export class ProductsAppLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const productsLayers = new lambda.LayerVersion(this, 'ProductsLayer', {
      code: lambda.Code.fromAsset('lambda/products/layers/productsLayer'), // onde o código da layer vai estar
      compatibleRuntimes: [ // quais runtimes são compativeis
        lambda.Runtime.NODEJS_20_X
      ],
      layerVersionName: 'ProductsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN // vamos manter o recurso pois ele será usado em outra stack
    })

    const eventsLayer = new lambda.LayerVersion(this, 'EventsLayer', {
      code: lambda.Code.fromAsset('lambda/products/layers/eventsLayer'), // onde o código da layer vai estar
      compatibleRuntimes: [ // quais runtimes são compativeis
        lambda.Runtime.NODEJS_20_X
      ],
      layerVersionName: 'EventsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN // vamos manter o recurso pois ele será usado em outra stack
    })

    // Esta guardando o parametro ProductsLayerVersionArn com
    // o valor de this.productsLayers.layerVersionArn
    // no AWS System Manager
    new ssm.StringParameter(this, 'EventsLayerVersionArn', {
      parameterName: 'EventsLayerVersionArn',
      stringValue: eventsLayer.layerVersionArn
    })
    new ssm.StringParameter(this, 'ProductsLayerVersionArn', {
      parameterName: 'ProductsLayerVersionArn',
      stringValue: productsLayers.layerVersionArn
    })
  }
}
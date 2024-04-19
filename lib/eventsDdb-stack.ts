import * as cdk from 'aws-cdk-lib'
import * as db from 'aws-cdk-lib/aws-dynamodb'

import { Construct } from 'constructs'

export class EventsDdbStack extends cdk.Stack {
  readonly table: db.Table

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    this.table = new db.Table(this, 'EventsDdb', {
      tableName: 'events',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      partitionKey: {
        name: 'pk',
        type: db.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: db.AttributeType.STRING
      },
      timeToLiveAttribute: 'ttl',
      billingMode: db.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1
    })
  }
}
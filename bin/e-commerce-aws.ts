#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack'
import { ECommerceApiStack } from '../lib/ecommerceApi-stack'
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack'
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppStack } from '../lib/ordersApp-stack';
import { OrdersAppLayerStack } from '../lib/ordersAppLayer-stack';

const app = new cdk.App();

// Variaveis de ambientes para definir a conta
// e a região em que as stacks serão criadas
const env: cdk.Environment = {
  account: '767397782763',
  region: 'us-east-1'
}

// cria tags para identificar as stacks
// importante para gerenciar os custos
const tags = {
  cost: 'ECommerce',
  team: 'Jnavi'
}

const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', { tags, env })

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdb', { tags, env })
// Qual a stack que dever ser criada primeiro?
// Quando existem dependências, fazer a chamada pelas depedências
const productsAppStack = new ProductsAppStack(app, 'ProductsApp', { tags, env, eventsDdb: eventsDdbStack.table })

// Deixando explicito que o productsAppLayersStack é dependencia
// obrigatória para o productsAppStack
productsAppStack.addDependency(productsAppLayersStack)
productsAppStack.addDependency(eventsDdbStack)

const ordersAppLayerStack = new OrdersAppLayerStack(app, 'OrdersAppLayers', { tags, env })
const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', { tags, env, productsDdb: productsAppStack.productsDdb })
ordersAppStack.addDependency(productsAppStack)
ordersAppStack.addDependency(ordersAppLayerStack)

const eCommerceApiStack = new ECommerceApiStack(app, 'EcommerceApi', {
  tags,
  env,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler
 })

// Deixando explicito que o productsAppStack é dependencia
// obrigatória para o eCommerceApiStack
eCommerceApiStack.addDependency(productsAppStack)
eCommerceApiStack.addDependency(ordersAppStack)
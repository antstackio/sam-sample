//https://gist.github.com/Zerquix18/482261fb0250aa13c79e139b962585e0
//https://dev.to/zerquix18/a-simple-typescript-class-to-query-information-from-dynamodb-2hce

import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import { chunk } from 'lodash';
import { v4 as uuid } from 'uuid';

export type ItemStructure = { [key: string]: any; }

export type Filter = {
  expression: string;
  values?: ItemStructure;
} | ItemStructure;

type SearchResult = {
  items: DynamoDB.DocumentClient.ItemList;
  nextToken: string | null; // key is the bas64 key is to make it easier to be consumed by the front end 
}

type ScanOptions = {
  nextToken?: string;
  limit?: number;
  filter?: Filter | ItemStructure;
};

type QueryOptions = {
  index: string;
  // this will almost always be a = b, so no complex expressions hhere.
  queryExpression: { [key: string]: string };
  nextToken?: string;
  limit?: number;
  filter?: Filter | ItemStructure;
};


class DynamoTable {
  docClient: DynamoDB.DocumentClient;
  tableName = '';

  constructor(tableName: string, region?: string) {
    this.tableName = tableName;
    this.docClient = new DynamoDB.DocumentClient({
      region,
      httpOptions: {
        timeout: 2200,
        connectTimeout: 2200,
      },
      maxRetries: 10,
    });
  }

  private transformFilter = (filter?: Filter | ItemStructure) => {
    let FilterExpression: string | undefined;
    let ExpressionAttributeNames: ItemStructure | undefined;
    let ExpressionAttributeValues: ItemStructure | undefined;

    if (! filter || Object.entries(filter).length === 0) {
      return { FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues };
    }

    if (filter.expression) {
      FilterExpression = filter.expression;

      if (filter.values) {
        ExpressionAttributeNames = {};
        ExpressionAttributeValues = {};
  
        Object.entries(filter.values).forEach(([key, value]) => {
          if (typeof value === 'undefined') {
            return;
          }

          const name = `#${key}`;
          const val = `:${key}`;
          if (FilterExpression!.includes(name)) {
            ExpressionAttributeNames![name] = key;
          }
          if (FilterExpression!.includes(val)) {
            ExpressionAttributeValues![val] = value;
          }
        });

        // freaking Dynamo -.-
        if (Object.entries(ExpressionAttributeNames).length === 0) {
          ExpressionAttributeNames = undefined;
        }
        if (Object.entries(ExpressionAttributeValues).length === 0) {
          ExpressionAttributeValues = undefined;
        }
      }
    } else {
      FilterExpression = '';
      ExpressionAttributeNames = {};
      ExpressionAttributeValues = {};
      Object.entries(filter).forEach(([key, value], index, array) => {
        if (typeof value === 'undefined') {
          return;
        }
        FilterExpression += `#${key} = :${key}`;
        if (index !== array.length - 1) {
          FilterExpression += ' AND ';
        }
        ExpressionAttributeNames![`#${key}`] = key;
        ExpressionAttributeValues![`:${key}`] = value;
      });
      
      // freaking Dynamo -.-
      if (Object.entries(ExpressionAttributeNames).length === 0) {
        ExpressionAttributeNames = undefined;
      }
      if (Object.entries(ExpressionAttributeValues).length === 0) {
        ExpressionAttributeValues = undefined;
      }
    }

    return { FilterExpression, ExpressionAttributeNames, ExpressionAttributeValues };     
  };

  async addItem(item: ItemStructure): Promise<ItemStructure> {
    const id = uuid();
    const Item = { id, ...item };
    const TableName = this.tableName;

    await this.docClient.put({ TableName, Item }).promise();
    return Item;
  }

  async updateItem(Item: ItemStructure) {
    const TableName = this.tableName;
    const Key = { id: Item.id };

    delete Item.id;

    let UpdateExpression = 'SET ';
    const ExpressionAttributeNames: ItemStructure = {};
    const ExpressionAttributeValues: ItemStructure = {};
    const ReturnValues = 'ALL_NEW';

    Object.entries(Item).filter(([, value]) => typeof value !== 'undefined').forEach(([key, value], index, array) => {
      UpdateExpression += `#${key} = :${key}`;
      ExpressionAttributeNames[`#${key}`] = key;
      ExpressionAttributeValues[`:${key}`] = value;

      if (index !== array.length - 1) {
        UpdateExpression += ', ';
      }
    });

    const result = await this.docClient.update({
      TableName,
      Key,
      UpdateExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues
    }).promise();

    return result.Attributes || { id: Key.id, ...Item };
  }

  async deleteItem(id: string) {
    const TableName = this.tableName;
    const Key = { id };
    const ReturnValues = 'ALL_OLD';
    const response = await this.docClient.delete({ TableName, Key, ReturnValues }).promise();

    return response.Attributes || null;
  }

  async getItem(id: string) {
    if (! id) {
      return null;
    }

    const result = await this.docClient.get({
      TableName: this.tableName,
      Key: { id },
    }).promise();

    return result.Item || null;
  }

  async batchGetItem(ids: string[]) {
    if (! ids || ids.length === 0) {
      return [];
    }

    const TableName = this.tableName;
    const chunks = chunk(Array.from(new Set(ids)), 100); // this is the max per batch
    let result: DynamoDB.DocumentClient.ItemList = [];

    for (const chunk of chunks) {
      const response = await this.docClient.batchGet({
        RequestItems: {
          [TableName]: {
            Keys: chunk.map(id => ({ id })),
          }
        }
      }).promise();
  
      if (! response.Responses) {
        throw new Error('No response from Dynamo');
      }

      const chunkResult = response.Responses[TableName];
      result = result.concat(chunkResult);
    }

    return result;
  }

  async batchWriteItem(items: ItemStructure[]) {
    if (items.length === 0) {
      return;
    }

    const TableName = this.tableName;

    const chunks = chunk(items, 20); // this is the max per batch

    const promises = [];
    for (const chunk of chunks) {
      const promise = this.docClient.batchWrite({
        RequestItems: {
          [TableName]: chunk.map(Item => ({ PutRequest: { Item } }))
        }
      }).promise();
      promises.push(promise);
    }

    await Promise.all(promises);
  }

  async scan(options: ScanOptions = {}) {
    const { nextToken, limit, filter } = options;
    const TableName = this.tableName;

    const Limit = limit;
    const ExclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString('ascii')) : undefined;

    const {
      FilterExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    } = this.transformFilter(filter);

    const result = await this.docClient.scan({
      TableName,
      Limit,
      ExclusiveStartKey,
      FilterExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }).promise();

    return {
      items: result.Items || [],
      nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null,
    }
  }

  async simpleScan(filter?: Filter) {
    const response = await this.scan({ filter });
    return response.items;
  }

  async scanAll(filter?: Filter) {
    let items: ItemStructure[] = [];

    let nextToken;

    while (true) {
      const result: SearchResult = await this.scan({ filter, nextToken });
      items = items.concat(result.items);

      if (! result.nextToken) {
        break;
      }
      
      nextToken = result.nextToken;
    }

    return items;
  };

  async query(options: QueryOptions) {
    const { index, queryExpression, nextToken, limit, filter } = options;
    const TableName = this.tableName;

    const IndexName = index;
    const Limit = limit;
    const ExclusiveStartKey = nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString('ascii')) : undefined;

    const {
      FilterExpression,
      ExpressionAttributeNames: FilterExpressionAttributeNames,
      ExpressionAttributeValues: FilterExpressionAttributeValues,
    } = this.transformFilter(filter);

    const ExpressionAttributeNames: ItemStructure = FilterExpressionAttributeNames ? { ...FilterExpressionAttributeNames } : {};
    const ExpressionAttributeValues: ItemStructure = FilterExpressionAttributeValues ? { ...FilterExpressionAttributeValues } : {};

    let KeyConditionExpression = '';

    Object.entries(queryExpression).forEach(([key, value]) => {
      KeyConditionExpression += `#${key} = :${key}`;
      ExpressionAttributeNames[`#${key}`] = key;
      ExpressionAttributeValues[`:${key}`] = value;
    });

    const result = await this.docClient.query({
      IndexName,
      KeyConditionExpression,
      TableName,
      Limit,
      ExclusiveStartKey,
      FilterExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
    }).promise();

    return {
      items: result.Items || [],
      nextToken: result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null,
    }
  }

  async simpleQuery(index: string, queryExpression: ItemStructure, filter?: Filter) {
    const response = await this.query({ index, queryExpression, filter });
    return response.items;
  }

  async queryAll(index: string, queryExpression: ItemStructure, filter?: Filter) {
    let items: ItemStructure[] = [];
    let nextToken;

    while (true) {
      const result: SearchResult = await this.query({ index, queryExpression, filter, nextToken });
      items = items.concat(result.items);

      if (! result.nextToken) {
        break;
      }
      
      nextToken = result.nextToken;
    }

    return items;
  }
}

export default DynamoTable;
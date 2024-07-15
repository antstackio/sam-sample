import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import users from './users-module';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        console.log(process.env.NODE_PATH)
        const user = await users.getItem("user", 1);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `hello ${user ? user.name : 'user'}!`,
            }),
        };
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'some error happened',
            }),
        };
    }
};
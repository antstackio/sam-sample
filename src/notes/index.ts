import notes from "./notes-module";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const note = await notes.getItem("1");
        return {
            statusCode: 200,
            body: JSON.stringify({
                note: JSON.stringify(note),
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
import DynamoTable from '../modules/ddb';

const tableName = 'notes';

class Notes extends DynamoTable {
    constructor(tableName: string, region?: string) {
        super(tableName, region);
    }
    // Add additional methods or override existing ones as needed
}
const notes = new Notes(tableName, process.env.AWS_REGION);
export default notes


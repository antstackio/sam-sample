import { randomUUID } from "crypto";
import PostgresDB from "../modules/psql";

class Users extends PostgresDB {
    constructor(connectionString: string) {
        super(connectionString);
    }

    // USER_TABLE environment variable contains the name of the table meant for storing user information

    async addUser(username: string, email: string): Promise<void> {
      const id = randomUUID();
        await this.addItem(process.env.USER_TABLE as string, {id, username, email});
    }
    
    async getUser(id: number): Promise<{id: number, username: string, email: string} | null> {
        return await this.getItem(process.env.USER_TABLE as string, id) as {id: number, username: string, email: string} | null;
    }

    // Add additional methods or override existing ones as needed

}

// PSQL_CONNECTION_STRING environment variable contains the connection string for the PostgreSQL database
const users = new Users(process.env.PSQL_CONNECTION_STRING as string);
export default users;
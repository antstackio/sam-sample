import { randomUUID } from "crypto";
import PostgresDB from "../modules/psql";

class Users extends PostgresDB {
    constructor(connectionString: string) {
        super(connectionString);
    }

    async addUser(username: string, email: string): Promise<void> {
      const id = randomUUID();
        await this.addItem(process.env.USER_TABLE as string, {id, username, email});
    }
    
    async getUser(id: number): Promise<{id: number, username: string, email: string} | null> {
        return await this.getItem(process.env.USER_TABLE as string, id) as {id: number, username: string, email: string} | null;
    }

    // Add additional methods or override existing ones as needed

}

const users = new Users(process.env.PSQL_CONNECTION_STRING as string);
export default users;
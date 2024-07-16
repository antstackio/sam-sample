import { randomUUID } from "crypto";
import PostgresDB from "../modules/psql";

class Users extends PostgresDB {
    constructor(connectionString: string) {
        super(connectionString);
    }

    
    async addUser(username: string, email: string): Promise<void> {
      // USER_TABLE environment variable contains the name of the table meant for storing user information
      const id = randomUUID();
      const userTable = process.env.USER_TABLE;
      if (!userTable) {
        throw new Error("USER_TABLE environment variable is not set.");
      }
      await this.addItem(userTable, {id, username, email});
    }
    
    async getUser(id: number): Promise<{id: number, username: string, email: string} | null> {
      // USER_TABLE environment variable contains the name of the table meant for storing user information
      const userTable = process.env.USER_TABLE;
      if(!userTable) {
        throw new Error("USER_TABLE environment variable is not set.");
      }
      return await this.getItem(process.env.USER_TABLE!, id) as {id: number, username: string, email: string} | null;
    }

    // Add additional methods or override existing ones as needed

}

// PSQL_CONNECTION_STRING environment variable contains the connection string for the PostgreSQL database
const users = new Users(process.env.PSQL_CONNECTION_STRING!);
export default users;
import PostgresDB from "../modules/psql";

class Users extends PostgresDB {
  constructor(connectionString: string) {
    super(connectionString);
  }
}

const users = new Users(process.env.PSQL_CONNECTION_STRING as string);
export default users;
import { PrismaClient } from "@prisma/client";

class Database {
  private static instance: Database;
  private prisma: PrismaClient;

  private constructor() {
    this.prisma = new PrismaClient();
  }

  private static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
  public static async GetClient(): Promise<PrismaClient> {
    return this.getInstance().prisma;
  }
}

export default Database;

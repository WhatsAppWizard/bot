import Database from ".";
import { PrismaClient } from "@prisma/client";
import { User } from "../../generated/prisma";

class Users {
  private prisma: PrismaClient;
  constructor() {
    this.prisma = Database.GetClient();
  }

  public async isUserExists(phone: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: {
        phone,
      },
    });
    return user !== null;
  }

  public async createUser(user: Partial<User>): Promise<User> {
    return await this.prisma.user.create({
      data: user,
    });
  }

  public async getUser(phone: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        phone,
      },
    });
    return user;
  }
}

export default Users;
